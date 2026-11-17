/**
 * Multi-Source Threat Actor Discovery Engine
 * Timezone: Asia/Kolkata (IST, UTC+05:30)
 *
 * Enforces strict distinction:
 * 1. "First Public Claim This Month": Earliest known victim claim in reporting month
 * 2. "First Observed by ThreatLedger This Month": Earliest ingestion by platform
 * 3. Historical imports strictly isolated from live monthly discovery metrics
 * 4. isMalicious marked as DERIVED_OR_MIRRORED (never counted as independent discovery alongside Ransomware.live)
 */

import prisma from '@/lib/prisma';
import { getISTMonthBoundaries, getCurrentISTMonthBoundaries } from './date-normalization';
import { VerificationStatus, SourceLineage, SyncStatus, DiscoveryStatus, GroupSource } from '@prisma/client';

export interface DiscoverySummaryMetrics {
  firstPublicClaimThisMonth: number;
  firstObservedByThreatLedgerThisMonth: number;
  pendingVerification: number;
  existingGroupsUpdated: number;
  historicalGroupsImported: number;
  sourcesWithSuccessfulSync: number;
  reportingMonth: string; // e.g. "2026-11"
}

export interface SourceStatusItem {
  sourceId: string;
  name: string;
  sourceType: string;
  sourceLineage: SourceLineage;
  status: 'ONLINE' | 'STANDBY' | 'ERROR' | 'ARCHIVED';
  lastChecked: Date | null;
  lastSuccessfulSync: Date | null;
  recordsRetrieved: number;
  canonicalGroupsCount: number;
  isHistorical: boolean;
  freshness: string;
  notes: string;
}

export interface DiscoveryFilterParams {
  year?: number;
  month?: number;
  dateType?: 'ALL' | 'FIRST_CLAIM_THIS_MONTH' | 'FIRST_OBSERVED_THIS_MONTH' | 'HISTORICAL_ONLY';
  source?: string;
  sourceLineage?: SourceLineage | 'ALL';
  verificationStatus?: VerificationStatus | 'ALL';
  search?: string;
  sortBy?: 'firstClaimAt' | 'firstObservedAt' | 'lastSeenAt' | 'name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Computes the 6 summary cards for the discovery dashboard in Asia/Kolkata IST boundaries.
 */
export async function getDiscoverySummaryMetrics(year?: number, month?: number): Promise<DiscoverySummaryMetrics> {
  const boundaries = (year && month)
    ? getISTMonthBoundaries(year, month)
    : getCurrentISTMonthBoundaries();

  const { startUTC, endUTC, monthKey } = boundaries;

  // 1. First Public Claim This Month: valid firstClaimAt within IST month boundaries
  const firstPublicClaimThisMonth = await prisma.ransomwareGroup.count({
    where: {
      firstClaimAt: {
        gte: startUTC,
        lt: endUTC,
      },
    },
  });

  // 2. First Observed by ThreatLedger This Month:
  // Must NOT be historical archive import or baseline
  const firstObservedByThreatLedgerThisMonth = await prisma.ransomwareGroup.count({
    where: {
      firstObservedAt: {
        gte: startUTC,
        lt: endUTC,
      },
      discoveryStatus: {
        notIn: [DiscoveryStatus.BASELINE],
      },
      source: {
        notIn: [GroupSource.RANSOMWATCH],
      },
    },
  });

  // 3. Pending Verification (UNVERIFIED)
  const pendingVerification = await prisma.ransomwareGroup.count({
    where: {
      verificationStatus: VerificationStatus.UNVERIFIED,
    },
  });

  // 4. Existing Groups Updated: active in month, but first observed before month start
  const existingGroupsUpdated = await prisma.ransomwareGroup.count({
    where: {
      lastSeenAt: {
        gte: startUTC,
        lt: endUTC,
      },
      firstObservedAt: {
        lt: startUTC,
      },
    },
  });

  // 5. Historical Groups Imported
  const historicalGroupsImported = await prisma.ransomwareGroup.count({
    where: {
      source: GroupSource.RANSOMWATCH,
    },
  });

  // 6. Sources with Successful Sync
  const sourcesWithSuccessfulSync = await prisma.intelligenceSource.count({
    where: {
      lastSyncStatus: SyncStatus.SUCCESS,
    },
  });

  return {
    firstPublicClaimThisMonth,
    firstObservedByThreatLedgerThisMonth,
    pendingVerification,
    existingGroupsUpdated,
    historicalGroupsImported,
    sourcesWithSuccessfulSync,
    reportingMonth: monthKey,
  };
}

/**
 * Returns current status of all intelligence sources for the status panel.
 */
export async function getSourcesStatusPanel(): Promise<SourceStatusItem[]> {
  const sources = await prisma.intelligenceSource.findMany({
    orderBy: { id: 'asc' },
  });

  const panelItems: SourceStatusItem[] = [];

  for (const s of sources) {
    const obsCount = await prisma.groupSourceObservation.count({
      where: { sourceId: s.id },
    });

    const isHistorical = s.lineage === SourceLineage.HISTORICAL_ARCHIVE || s.sourceType === 'HISTORICAL_ARCHIVE';
    let displayStatus: 'ONLINE' | 'STANDBY' | 'ERROR' | 'ARCHIVED' = 'STANDBY';
    if (isHistorical) {
      displayStatus = 'ARCHIVED';
    } else if (s.lastError) {
      displayStatus = 'ERROR';
    } else if (s.lastSyncStatus === SyncStatus.SUCCESS) {
      displayStatus = 'ONLINE';
    }

    panelItems.push({
      sourceId: s.id,
      name: s.name,
      sourceType: s.sourceType,
      sourceLineage: s.lineage,
      status: displayStatus,
      lastChecked: s.lastSyncAt,
      lastSuccessfulSync: s.lastSyncStatus === SyncStatus.SUCCESS ? s.lastSyncAt : null,
      recordsRetrieved: obsCount,
      canonicalGroupsCount: obsCount,
      isHistorical,
      freshness: isHistorical
        ? 'Archived (Static March 2026)'
        : s.lastSyncStatus === SyncStatus.SUCCESS
        ? 'Active Sync'
        : 'Awaiting Configuration',
      notes: s.lineage === SourceLineage.DERIVED_OR_MIRRORED
        ? 'Ransomware.live-backed upstream cache; provides first-claim metadata.'
        : isHistorical
        ? 'Read-only historical repository. One-time import.'
        : 'Primary live intelligence feed.',
    });
  }

  return panelItems;
}

/**
 * Queries the main discovery table with strict multi-filter support.
 */
export async function getDiscoveryRecords(params: DiscoveryFilterParams) {
  const {
    year,
    month,
    dateType = 'ALL',
    source,
    sourceLineage,
    verificationStatus,
    search,
    sortBy = 'firstObservedAt',
    sortOrder = 'desc',
    page = 1,
    limit = 50,
  } = params;

  const boundaries = (year && month)
    ? getISTMonthBoundaries(year, month)
    : getCurrentISTMonthBoundaries();

  const where: any = {};

  // Date type filters
  if (dateType === 'FIRST_CLAIM_THIS_MONTH') {
    where.firstClaimAt = {
      gte: boundaries.startUTC,
      lt: boundaries.endUTC,
    };
  } else if (dateType === 'FIRST_OBSERVED_THIS_MONTH') {
    where.firstObservedAt = {
      gte: boundaries.startUTC,
      lt: boundaries.endUTC,
    };
    where.discoveryStatus = { notIn: [DiscoveryStatus.BASELINE] };
    where.source = { notIn: [GroupSource.RANSOMWATCH] };
  } else if (dateType === 'HISTORICAL_ONLY') {
    where.source = GroupSource.RANSOMWATCH;
  }

  // Source filter
  if (source && source !== 'ALL') {
    where.source = source;
  }

  // Verification status filter
  if (verificationStatus && verificationStatus !== 'ALL') {
    where.verificationStatus = verificationStatus;
  }

  // Search filter
  if (search && search.trim()) {
    where.name = {
      contains: search.trim(),
      mode: 'insensitive',
    };
  }

  const skip = (page - 1) * limit;

  const [records, total] = await Promise.all([
    prisma.ransomwareGroup.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        sourceObservations: {
          select: {
            sourceId: true,
            sourceGroupName: true,
            semantic: true,
            firstClaimAt: true,
            observedAt: true,
            source: {
              select: {
                lineage: true,
                name: true,
              },
            },
          },
        },
        verifications: {
          include: {
            verifiedBy: {
              select: { fullName: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.ransomwareGroup.count({ where }),
  ]);

  return {
    records,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    reportingMonth: boundaries.monthKey,
  };
}
