import prisma from '@/lib/prisma';
import { fetchGroupsInventory, fetchRecentVictims } from '@/lib/integrations/ransomware-live';
import { recordAuditLog } from '@/lib/audit';
import { ensureIntelligenceSourcesExist } from '@/lib/intelligence/seed-sources';
import { getIsMaliciousCredentials, fetchIsMaliciousGroups } from '@/lib/intelligence/sources/ismalicious';
import { correlateGroup, linkGroupObservation } from '@/lib/intelligence/correlation';
import { DiscoveryStatus, GroupSource, GroupStatus, ObservationSemantic, SyncStatus, VerificationStatus } from '@prisma/client';

export interface SyncResult {
  runId: string;
  source: string;
  status: SyncStatus;
  recordsFetched: number;
  recordsCreated: number;
  recordsUpdated: number;
  newGroupsFound: number;
  isBaselineEstablishment: boolean;
  errorMessage?: string;
}

/**
 * Get current year-month string in Asia/Kolkata timezone (e.g. "2026-11").
 */
export function getISTDiscoveryMonth(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);

  const year = parts.find((p) => p.type === 'year')?.value || '2026';
  const month = parts.find((p) => p.type === 'month')?.value || '11';
  return `${year}-${month}`;
}

export async function runGroupInventorySync(): Promise<SyncResult> {
  const syncRun = await prisma.apiSyncRun.create({
    data: {
      syncSource: 'RANSOMWARE_LIVE_INVENTORY',
      status: SyncStatus.RUNNING,
      startedAt: new Date(),
    },
  });

  try {
    await ensureIntelligenceSourcesExist();
    const { groups, source } = await fetchGroupsInventory();
    const currentMonth = getISTDiscoveryMonth();

    // Check if initial baseline has already been established
    const existingGroupsCount = await prisma.ransomwareGroup.count();
    const isBaselineEstablishment = existingGroupsCount === 0;

    let recordsCreated = 0;
    let recordsUpdated = 0;
    let newGroupsFound = 0;

    for (const raw of groups) {
      const existing = await prisma.ransomwareGroup.findUnique({
        where: { name: raw.name },
      });

      if (!existing) {
        // New group discovered
        const discoveryStatus = isBaselineEstablishment
          ? DiscoveryStatus.BASELINE
          : DiscoveryStatus.NEWLY_LISTED;

        if (!isBaselineEstablishment) {
          newGroupsFound++;
        }

        const createdGroup = await prisma.ransomwareGroup.create({
          data: {
            name: raw.name,
            normalizedName: raw.normalizedName,
            description: raw.description,
            source: GroupSource.RANSOMWARE_LIVE,
            discoveryStatus,
            discoveryMonth: currentMonth,
            threatLedgerDetectedAt: new Date(),
            firstObservedAt: new Date(),
            firstClaimAt: raw.firstSeenSourceAt ? new Date(raw.firstSeenSourceAt) : undefined,
            firstClaimSource: raw.firstSeenSourceAt ? 'Ransomware.live' : undefined,
            firstSeenSourceAt: raw.firstSeenSourceAt ? new Date(raw.firstSeenSourceAt) : undefined,
            sourceAddedAt: raw.sourceAddedAt ? new Date(raw.sourceAddedAt) : undefined,
            websiteUrl: raw.websiteUrl,
            profileUrl: raw.profileUrl,
            victimCount: raw.victimCount,
            aliases: {
              create: raw.aliases.map((alias) => ({ alias })),
            },
            ttps: {
              create: (raw.ttps || []).map((t) => ({
                mitreTactic: t.tactic,
                mitreTechniqueId: t.techniqueId,
                mitreTechniqueName: t.techniqueName,
              })),
            },
            cves: {
              create: (raw.cves || []).map((c) => ({
                cveId: c.cveId,
                description: c.description,
                cvssScore: c.cvssScore,
              })),
            },
            tools: {
              create: (raw.tools || []).map((tool) => ({
                toolName: tool.toolName,
                category: tool.category,
              })),
            },
          },
        });

        // Link RANSOMWARE_LIVE source observation
        await prisma.groupSourceObservation.create({
          data: {
            sourceId: 'RANSOMWARE_LIVE',
            groupId: createdGroup.id,
            sourceGroupName: raw.name,
            externalRecordId: raw.normalizedName,
            semantic: raw.firstSeenSourceAt ? 'FIRST_CLAIM' : 'THREATLEDGER_OBSERVED',
            firstClaimAt: raw.firstSeenSourceAt ? new Date(raw.firstSeenSourceAt) : undefined,
            sourceAddedAt: raw.sourceAddedAt ? new Date(raw.sourceAddedAt) : undefined,
            observedAt: new Date(),
          },
        });

        // Record discovery event
        await prisma.groupDiscoveryEvent.create({
          data: {
            groupId: createdGroup.id,
            discoveryType: discoveryStatus,
            discoveryMonth: currentMonth,
            detectedAt: new Date(),
            details: isBaselineEstablishment
              ? 'Established during initial ThreatLedger baseline indexing.'
              : `Discovered in synchronization feed from ${source}.`,
          },
        });

        recordsCreated++;
      } else {
        // Update existing record
        const updateData: any = {
          description: raw.description || existing.description,
          websiteUrl: raw.websiteUrl || existing.websiteUrl,
          victimCount: Math.max(existing.victimCount, raw.victimCount),
          lastObservedAt: new Date(),
        };

        // Backfill firstObservedAt if null
        if (!existing.firstObservedAt) {
          updateData.firstObservedAt = existing.threatLedgerDetectedAt || new Date();
        }

        // Backfill firstClaimAt if source provides it
        if (!existing.firstClaimAt && raw.firstSeenSourceAt) {
          updateData.firstClaimAt = new Date(raw.firstSeenSourceAt);
          updateData.firstClaimSource = 'Ransomware.live';
        }

        await prisma.ransomwareGroup.update({
          where: { id: existing.id },
          data: updateData,
        });

        // Ensure RANSOMWARE_LIVE source observation
        const existingObs = await prisma.groupSourceObservation.findFirst({
          where: { groupId: existing.id, sourceId: 'RANSOMWARE_LIVE' },
        });
        if (existingObs) {
          await prisma.groupSourceObservation.update({
            where: { id: existingObs.id },
            data: {
              sourceGroupName: raw.name,
              externalRecordId: raw.normalizedName,
              firstClaimAt: raw.firstSeenSourceAt ? new Date(raw.firstSeenSourceAt) : undefined,
              sourceAddedAt: raw.sourceAddedAt ? new Date(raw.sourceAddedAt) : undefined,
              observedAt: new Date(),
            },
          });
        } else {
          await prisma.groupSourceObservation.create({
            data: {
              sourceId: 'RANSOMWARE_LIVE',
              groupId: existing.id,
              sourceGroupName: raw.name,
              externalRecordId: raw.normalizedName,
              semantic: raw.firstSeenSourceAt ? 'FIRST_CLAIM' : 'THREATLEDGER_OBSERVED',
              firstClaimAt: raw.firstSeenSourceAt ? new Date(raw.firstSeenSourceAt) : undefined,
              sourceAddedAt: raw.sourceAddedAt ? new Date(raw.sourceAddedAt) : undefined,
              observedAt: new Date(),
            },
          });
        }

        recordsUpdated++;
      }
    }

    // Sync victims telemetry
    const victims = await fetchRecentVictims();
    for (const v of victims) {
      const group = await prisma.ransomwareGroup.findFirst({
        where: {
          OR: [
            { name: { equals: v.groupName, mode: 'insensitive' } },
            { aliases: { some: { alias: { equals: v.groupName, mode: 'insensitive' } } } },
          ],
        },
      });

      if (group) {
        const victimKey = v.externalId || `${v.groupName}-${v.victimName}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
        await prisma.victim.upsert({
          where: { externalId: victimKey },
          update: {
            country: v.country,
            countryCode: v.countryCode,
            sector: v.sector,
            domain: v.domain,
          },
          create: {
            externalId: victimKey,
            groupId: group.id,
            victimName: v.victimName,
            country: v.country,
            countryCode: v.countryCode,
            sector: v.sector,
            domain: v.domain,
            discoveredAt: v.discoveredAt ? new Date(v.discoveredAt) : new Date(),
            attackedAt: v.attackedAt ? new Date(v.attackedAt) : undefined,
            claimType: v.claimType,
          },
        });
      }
    }

    // Also sync isMalicious for new group discovery & first-claim enrichment (non-fatal)
    try {
      const imCreds = await getIsMaliciousCredentials();
      if (imCreds?.apiKey && imCreds?.apiSecret) {
        const imRes = await fetchIsMaliciousGroups(imCreds.apiKey, imCreds.apiSecret, 500);
        if (imRes.success && imRes.groups) {
          for (const g of imRes.groups) {
            const corr = await correlateGroup(g.name);
            let groupId = corr.canonicalGroupId;
            const firstClaimAt = g.firstClaimAt ? new Date(g.firstClaimAt) : null;
            const lastClaimAt = g.lastClaimAt ? new Date(g.lastClaimAt) : null;

            if (!groupId) {
              const now = new Date();
              const created = await prisma.ransomwareGroup.create({
                data: {
                  name: g.name,
                  normalizedName: g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                  source: GroupSource.ISMALICIOUS,
                  discoveryStatus: DiscoveryStatus.NEWLY_LISTED,
                  discoveryMonth: getISTDiscoveryMonth(now),
                  verificationStatus: VerificationStatus.UNVERIFIED,
                  firstObservedAt: now,
                  threatLedgerDetectedAt: now,
                  firstClaimAt,
                  firstClaimSource: firstClaimAt ? 'isMalicious' : null,
                  lastSeenAt: lastClaimAt,
                  victimCount: g.victimCount || 0,
                  status: g.activity === 'active' ? GroupStatus.ACTIVE : GroupStatus.INACTIVE,
                },
              });
              groupId = created.id;
              recordsCreated++;
              newGroupsFound++;
            } else if (firstClaimAt) {
              const existing = await prisma.ransomwareGroup.findUnique({
                where: { id: groupId },
                select: { firstClaimAt: true },
              });
              if (!existing?.firstClaimAt || firstClaimAt < existing.firstClaimAt) {
                await prisma.ransomwareGroup.update({
                  where: { id: groupId },
                  data: {
                    firstClaimAt,
                    firstClaimSource: 'isMalicious',
                    lastSeenAt: lastClaimAt || undefined,
                  },
                });
              }
            }

            await linkGroupObservation({
              sourceId: 'ISMALICIOUS',
              canonicalGroupId: groupId,
              externalId: g.name,
              observedName: g.name,
              timestampSemantic: firstClaimAt ? ObservationSemantic.FIRST_CLAIM : ObservationSemantic.THREATLEDGER_OBSERVED,
              firstClaimAt,
              lastClaimAt,
              rawPayload: g,
            });
          }

          await prisma.intelligenceSource.update({
            where: { id: 'ISMALICIOUS' },
            data: {
              lastSyncAt: new Date(),
              lastSyncStatus: SyncStatus.SUCCESS,
              lastError: null,
              recordsTotal: imRes.groups.length,
            },
          });
        }
      }
    } catch (imErr: any) {
      console.warn('[Sync Engine] Non-fatal isMalicious auto-sync warning:', imErr?.message || imErr);
    }

    // Mark sync completed
    await prisma.apiSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status: SyncStatus.SUCCESS,
        recordsFetched: groups.length,
        recordsCreated,
        recordsUpdated,
        newGroupsFound,
        completedAt: new Date(),
      },
    });

    // Update RANSOMWARE_LIVE IntelligenceSource record
    await prisma.intelligenceSource.upsert({
      where: { id: 'RANSOMWARE_LIVE' },
      update: {
        lastSyncAt: new Date(),
        lastSyncStatus: SyncStatus.SUCCESS,
        lastError: null,
        recordsTotal: groups.length,
      },
      create: {
        id: 'RANSOMWARE_LIVE',
        name: 'Ransomware.live API PRO',
        sourceType: 'LIVE_PRIMARY',
        lineage: 'PRIMARY_INDEPENDENT',
        isEnabled: true,
        lastSyncAt: new Date(),
        lastSyncStatus: SyncStatus.SUCCESS,
        recordsTotal: groups.length,
      },
    });

    await recordAuditLog({
      action: 'API_SYNC_COMPLETED',
      targetType: 'SYNC_RUN',
      targetId: syncRun.id,
      afterJson: {
        recordsCreated,
        recordsUpdated,
        newGroupsFound,
        isBaselineEstablishment,
        source,
      },
    });

    return {
      runId: syncRun.id,
      source,
      status: SyncStatus.SUCCESS,
      recordsFetched: groups.length,
      recordsCreated,
      recordsUpdated,
      newGroupsFound,
      isBaselineEstablishment,
    };
  } catch (error: any) {
    console.error('[Sync Engine] Error during synchronization:', error);
    await prisma.apiSyncRun.update({
      where: { id: syncRun.id },
      data: {
        status: SyncStatus.FAILED,
        errorMessage: error.message || 'Unknown sync error',
        completedAt: new Date(),
      },
    });

    return {
      runId: syncRun.id,
      source: 'ERROR',
      status: SyncStatus.FAILED,
      recordsFetched: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      newGroupsFound: 0,
      isBaselineEstablishment: false,
      errorMessage: error.message,
    };
  }
}
