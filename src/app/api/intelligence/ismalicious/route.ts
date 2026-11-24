import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { encryptCredential } from '@/lib/crypto/encryption';
import {
  testIsMaliciousConnection,
  fetchIsMaliciousGroups,
  maskCredential,
  getIsMaliciousCredentials,
} from '@/lib/intelligence/sources/ismalicious';
import { correlateGroup, linkGroupObservation } from '@/lib/intelligence/correlation';
import { SourceLineage, SyncStatus, VerificationStatus, ObservationSemantic, DiscoveryStatus, GroupStatus } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const source = await prisma.intelligenceSource.findUnique({
      where: { id: 'ISMALICIOUS' },
    });

    const credential = await prisma.sourceCredential.findFirst({
      where: { sourceId: 'ISMALICIOUS', isEnabled: true },
    });

    const creds = await getIsMaliciousCredentials();

    const observationCount = await prisma.groupSourceObservation.count({
      where: { sourceId: 'ISMALICIOUS' },
    });

    return NextResponse.json({
      configured: !!credential || !!creds?.apiKey,
      maskedKey: creds?.apiKey ? maskCredential(creds.apiKey) : null,
      isActive: source?.isEnabled ?? false,
      lastCheckedAt: source?.lastSyncAt || null,
      lastSuccessfulSyncAt: source?.lastSyncStatus === 'SUCCESS' ? source.lastSyncAt : null,
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
    const session = await getCurrentUser();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, apiKey, apiSecret } = body;

    // Helper to get active credentials
    const getCredentials = async () => {
      let key = apiKey?.trim();
      let secret = apiSecret?.trim();

      if (!key || !secret) {
        const stored = await getIsMaliciousCredentials();
        if (stored) {
          if (!key) key = stored.apiKey;
          if (!secret) secret = stored.apiSecret;
        }
      }

      if (!key || !secret) {
        throw new Error('Both API Key and API Secret are required. Please enter them in Settings.');
      }

      return { apiKey: key, apiSecret: secret };
    };

    if (action === 'TEST') {
      const { apiKey: keyToUse, apiSecret: secretToUse } = await getCredentials();
      const testResult = await testIsMaliciousConnection(keyToUse, secretToUse);

      await prisma.intelligenceSource.upsert({
        where: { id: 'ISMALICIOUS' },
        update: {
          lastSyncAt: new Date(),
          lastSyncStatus: testResult.success ? SyncStatus.SUCCESS : SyncStatus.FAILED,
          lastError: testResult.success ? null : testResult.message,
        },
        create: {
          id: 'ISMALICIOUS',
          name: 'isMalicious Ransomware Intelligence',
          sourceType: 'API',
          lineage: SourceLineage.DERIVED_OR_MIRRORED,
          isEnabled: true,
          lastSyncAt: new Date(),
          lastSyncStatus: testResult.success ? SyncStatus.SUCCESS : SyncStatus.FAILED,
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

      const cleanKey = (apiKey || process.env.ISMALICIOUS_API_KEY || '').trim();
      const cleanSecret = (apiSecret || process.env.ISMALICIOUS_API_SECRET || '').trim();

      if (!cleanKey || !cleanSecret) {
        return NextResponse.json({ error: 'Both API Key and API Secret are required' }, { status: 400 });
      }

      // Test credentials before saving
      const testResult = await testIsMaliciousConnection(cleanKey, cleanSecret);

      // Encrypt combined payload with AES-256-GCM
      const payload = JSON.stringify({ apiKey: cleanKey, apiSecret: cleanSecret });
      const { encrypted, iv, tag } = encryptCredential(payload);

      // Save credential via upsert
      await prisma.sourceCredential.upsert({
        where: { sourceId: 'ISMALICIOUS' },
        update: {
          encryptedApiKey: cleanKey,
          encryptedApiSecret: encrypted,
          iv,
          tag,
          isEnabled: true,
          lastTestStatus: testResult.success ? 'SUCCESS' : `HTTP_${testResult.statusCode || 401}`,
          lastTestedAt: new Date(),
          lastError: testResult.success ? null : testResult.message,
        },
        create: {
          sourceId: 'ISMALICIOUS',
          encryptedApiKey: cleanKey,
          encryptedApiSecret: encrypted,
          iv,
          tag,
          isEnabled: true,
          lastTestStatus: testResult.success ? 'SUCCESS' : `HTTP_${testResult.statusCode || 401}`,
          lastTestedAt: new Date(),
          lastError: testResult.success ? null : testResult.message,
        },
      });

      // Update IntelligenceSource
      await prisma.intelligenceSource.upsert({
        where: { id: 'ISMALICIOUS' },
        update: {
          isEnabled: testResult.success,
          lastSyncAt: new Date(),
          lastSyncStatus: testResult.success ? SyncStatus.SUCCESS : SyncStatus.FAILED,
          lastError: testResult.success ? null : testResult.message,
        },
        create: {
          id: 'ISMALICIOUS',
          name: 'isMalicious Ransomware Intelligence',
          sourceType: 'API',
          lineage: SourceLineage.DERIVED_OR_MIRRORED,
          isEnabled: testResult.success,
          lastSyncAt: new Date(),
          lastSyncStatus: testResult.success ? SyncStatus.SUCCESS : SyncStatus.FAILED,
          lastError: testResult.success ? null : testResult.message,
        },
      });

      return NextResponse.json({
        success: testResult.success,
        message: testResult.success
          ? 'isMalicious credentials encrypted and verified successfully.'
          : `Credentials saved, but verification failed: ${testResult.message}`,
        maskedKey: maskCredential(cleanKey),
        statusCode: testResult.statusCode,
      });
    }

    if (action === 'SYNC') {
      const { apiKey: keyToUse, apiSecret: secretToUse } = await getCredentials();
      const startTime = Date.now();

      const fetchResult = await fetchIsMaliciousGroups(keyToUse, secretToUse, 500);
      if (!fetchResult.success || !fetchResult.groups) {
        await prisma.intelligenceSource.update({
          where: { id: 'ISMALICIOUS' },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: SyncStatus.FAILED,
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
        const groupFirstClaimDate = group.firstClaimAt ? new Date(group.firstClaimAt) : null;
        const groupLastClaimDate = group.lastClaimAt ? new Date(group.lastClaimAt) : null;

        if (!canonicalGroupId) {
          // Create new group detected by ThreatLedger via isMalicious
          const newGroup = await prisma.ransomwareGroup.create({
            data: {
              name: group.name,
              normalizedName: group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              source: 'ISMALICIOUS',
              discoveryStatus: DiscoveryStatus.NEWLY_LISTED,
              verificationStatus: VerificationStatus.UNVERIFIED,
              firstObservedAt: new Date(),
              firstClaimAt: groupFirstClaimDate,
              firstClaimSource: group.firstClaimAt ? 'isMalicious' : null,
              lastSeenAt: groupLastClaimDate,
              status: group.activity === 'active' ? GroupStatus.ACTIVE : GroupStatus.INACTIVE,
            },
          });
          canonicalGroupId = newGroup.id;
          createdCount++;
        } else {
          matchedCount++;
          // If isMalicious provides a valid firstClaimAt and existing record has none or later
          if (groupFirstClaimDate) {
            const existing = await prisma.ransomwareGroup.findUnique({
              where: { id: canonicalGroupId },
              select: { firstClaimAt: true },
            });
            if (!existing?.firstClaimAt || groupFirstClaimDate < existing.firstClaimAt) {
              await prisma.ransomwareGroup.update({
                where: { id: canonicalGroupId },
                data: {
                  firstClaimAt: groupFirstClaimDate,
                  firstClaimSource: 'isMalicious',
                  lastSeenAt: groupLastClaimDate || undefined,
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
          sourceLineage: SourceLineage.DERIVED_OR_MIRRORED,
          timestampSemantic: ObservationSemantic.FIRST_CLAIM,
          firstClaimAt: groupFirstClaimDate,
          lastClaimAt: groupLastClaimDate,
          rawPayload: group,
        });
      }

      // Update source status
      await prisma.intelligenceSource.update({
        where: { id: 'ISMALICIOUS' },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: SyncStatus.SUCCESS,
          lastError: null,
          recordsTotal: { increment: createdCount + matchedCount },
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
        where: { id: 'ISMALICIOUS' },
        data: { isEnabled: false },
      });
      return NextResponse.json({ success: true, message: 'isMalicious integration disabled' });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
