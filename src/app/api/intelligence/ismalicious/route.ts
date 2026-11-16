import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAuthSession } from '@/lib/auth';
import { encryptCredential, decryptCredential } from '@/lib/crypto/encryption';
import {
  testIsMaliciousConnection,
  fetchIsMaliciousGroups,
  maskCredential,
} from '@/lib/intelligence/sources/ismalicious';
import { correlateGroup, linkGroupObservation } from '@/lib/intelligence/correlation';

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const source = await prisma.intelligenceSource.findUnique({
      where: { sourceId: 'ISMALICIOUS' },
    });

    const credential = await prisma.sourceCredential.findFirst({
      where: { sourceId: 'ISMALICIOUS', isActive: true },
    });

    const observationCount = await prisma.groupSourceObservation.count({
      where: { sourceId: 'ISMALICIOUS' },
    });

    return NextResponse.json({
      configured: !!credential,
      maskedKey: credential?.maskedKey || null,
      isActive: source?.isActive ?? false,
      lastCheckedAt: source?.lastCheckedAt || null,
      lastSuccessfulSyncAt: source?.lastSuccessfulSyncAt || null,
      lastError: source?.lastError || null,
      recordsCount: observationCount,
      sourceLineage: 'DERIVED_OR_MIRRORED',
      rateLimitMonthly: 250,
      upstreamSource: 'Ransomware.live',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, apiKey, apiSecret } = body;

    // Helper to get active credentials
    const getCredentials = async () => {
      if (apiKey && apiSecret) {
        return { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() };
      }
      const cred = await prisma.sourceCredential.findFirst({
        where: { sourceId: 'ISMALICIOUS', isActive: true },
      });
      if (!cred) {
        throw new Error('No isMalicious credentials configured. Please provide API Key and Secret.');
      }
      const decryptedSecret = decryptCredential(cred.encryptedSecret, cred.iv, cred.authTag);
      return { apiKey: cred.keyId, apiSecret: decryptedSecret };
    };

    if (action === 'TEST') {
      const { apiKey: keyToUse, apiSecret: secretToUse } = await getCredentials();
      const testResult = await testIsMaliciousConnection(keyToUse, secretToUse);

      await prisma.intelligenceSource.upsert({
        where: { sourceId: 'ISMALICIOUS' },
        update: {
          lastCheckedAt: new Date(),
          lastError: testResult.success ? null : testResult.message,
        },
        create: {
          sourceId: 'ISMALICIOUS',
          name: 'isMalicious Ransomware Intelligence',
          sourceType: 'API',
          sourceLineage: 'DERIVED_OR_MIRRORED',
          baseUrl: 'https://api.ismalicious.com',
          lastCheckedAt: new Date(),
          lastError: testResult.success ? null : testResult.message,
        },
      });

      return NextResponse.json(testResult);
    }

    if (action === 'SAVE') {
      // Require ADMIN role
      if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only administrators can configure intelligence credentials' }, { status: 403 });
      }

      if (!apiKey || !apiSecret) {
        return NextResponse.json({ error: 'Both API Key and API Secret are required' }, { status: 400 });
      }

      const cleanKey = apiKey.trim();
      const cleanSecret = apiSecret.trim();

      // Test credentials before saving
      const testResult = await testIsMaliciousConnection(cleanKey, cleanSecret);
      if (!testResult.success) {
        return NextResponse.json({
          error: `Credential verification failed: ${testResult.message}`,
          statusCode: testResult.statusCode,
        }, { status: 400 });
      }

      // Encrypt API Secret
      const { encrypted, iv, tag } = encryptCredential(cleanSecret);

      // Deactivate older credentials
      await prisma.sourceCredential.updateMany({
        where: { sourceId: 'ISMALICIOUS' },
        data: { isActive: false },
      });

      // Save new encrypted credential
      await prisma.sourceCredential.create({
        data: {
          sourceId: 'ISMALICIOUS',
          keyId: cleanKey,
          encryptedSecret: encrypted,
          iv,
          authTag: tag,
          maskedKey: maskCredential(cleanKey),
          isActive: true,
        },
      });

      // Update IntelligenceSource
      await prisma.intelligenceSource.upsert({
        where: { sourceId: 'ISMALICIOUS' },
        update: {
          isActive: true,
          lastCheckedAt: new Date(),
          lastSuccessfulSyncAt: new Date(),
          lastError: null,
        },
        create: {
          sourceId: 'ISMALICIOUS',
          name: 'isMalicious Ransomware Intelligence',
          sourceType: 'API',
          sourceLineage: 'DERIVED_OR_MIRRORED',
          baseUrl: 'https://api.ismalicious.com',
          isActive: true,
          lastCheckedAt: new Date(),
          lastSuccessfulSyncAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'isMalicious credentials encrypted and saved successfully.',
        maskedKey: maskCredential(cleanKey),
      });
    }

    if (action === 'SYNC') {
      const { apiKey: keyToUse, apiSecret: secretToUse } = await getCredentials();
      const startTime = Date.now();

      const fetchResult = await fetchIsMaliciousGroups(keyToUse, secretToUse, 500);
      if (!fetchResult.success || !fetchResult.groups) {
        await prisma.intelligenceSource.update({
          where: { sourceId: 'ISMALICIOUS' },
          data: {
            lastCheckedAt: new Date(),
            lastError: fetchResult.message,
          },
        });
        return NextResponse.json({ error: fetchResult.message }, { status: 400 });
      }

      let createdCount = 0;
      let matchedCount = 0;
      let firstClaimEnrichedCount = 0;

      for (const group of fetchResult.groups) {
        const correlation = await correlateGroup(group.name);
        let canonicalGroupId = correlation.canonicalGroupId;

        if (!canonicalGroupId) {
          // Create new group detected by ThreatLedger via isMalicious
          const newGroup = await prisma.ransomwareGroup.create({
            data: {
              name: group.name,
              slug: group.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
              source: 'ISMALICIOUS',
              discoveryStatus: 'NEWLY_LISTED',
              verificationStatus: 'PENDING',
              firstObservedAt: new Date(),
              firstClaimAt: group.firstClaimAt,
              firstClaimSource: group.firstClaimAt ? 'isMalicious' : null,
              lastSeenAt: group.lastClaimAt,
              isActive: group.activity === 'active',
            },
          });
          canonicalGroupId = newGroup.id;
          createdCount++;
        } else {
          matchedCount++;
          // If isMalicious provides a valid firstClaimAt and existing record has none or later
          if (group.firstClaimAt) {
            const existing = await prisma.ransomwareGroup.findUnique({
              where: { id: canonicalGroupId },
              select: { firstClaimAt: true },
            });
            if (!existing?.firstClaimAt || group.firstClaimAt < existing.firstClaimAt) {
              await prisma.ransomwareGroup.update({
                where: { id: canonicalGroupId },
                data: {
                  firstClaimAt: group.firstClaimAt,
                  firstClaimSource: 'isMalicious',
                  lastSeenAt: group.lastClaimAt || undefined,
                },
              });
              firstClaimEnrichedCount++;
            }
          }
        }

        // Link group source observation
        await linkGroupObservation({
          sourceId: 'ISMALICIOUS',
          canonicalGroupId,
          externalId: group.name.toLowerCase(),
          observedName: group.name,
          sourceLineage: 'DERIVED_OR_MIRRORED',
          timestampSemantic: 'FIRST_CLAIM',
          firstClaimAt: group.firstClaimAt,
          lastClaimAt: group.lastClaimAt,
          rawPayload: group,
        });
      }

      // Update source status
      await prisma.intelligenceSource.update({
        where: { sourceId: 'ISMALICIOUS' },
        data: {
          lastCheckedAt: new Date(),
          lastSuccessfulSyncAt: new Date(),
          lastError: null,
        },
      });

      return NextResponse.json({
        success: true,
        groupsProcessed: fetchResult.groups.length,
        createdCount,
        matchedCount,
        firstClaimEnrichedCount,
        durationMs: Date.now() - startTime,
      });
    }

    if (action === 'DISABLE') {
      await prisma.intelligenceSource.update({
        where: { sourceId: 'ISMALICIOUS' },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true, message: 'isMalicious integration disabled' });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
