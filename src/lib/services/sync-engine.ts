import prisma from '@/lib/prisma';
import { fetchGroupsInventory, fetchRecentVictims } from '@/lib/integrations/ransomware-live';
import { recordAuditLog } from '@/lib/audit';
import { DiscoveryStatus, GroupSource, SyncStatus } from '@prisma/client';

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
        await prisma.ransomwareGroup.update({
          where: { id: existing.id },
          data: {
            description: raw.description || existing.description,
            websiteUrl: raw.websiteUrl || existing.websiteUrl,
            victimCount: Math.max(existing.victimCount, raw.victimCount),
            lastObservedAt: new Date(),
          },
        });
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
