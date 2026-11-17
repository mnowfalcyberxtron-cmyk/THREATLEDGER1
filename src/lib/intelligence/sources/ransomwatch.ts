/**
 * RansomWatch Historical Source Adapter
 * Repository: https://github.com/joshhighet/ransomwatch
 * Archived: 3 March 2026 (Read-Only Historical Archive)
 *
 * Rules:
 * - Strictly HISTORICAL_ARCHIVE sourceType & lineage
 * - Never treated as a live or recurring discovery feed
 * - Idempotent one-time import guarded by HistoricalImportRun and sha256 checksums
 * - Groups and posts are mapped with historical provenance
 * - Earliest claim per group is derived from historical posts.json discovered timestamp
 * - Historical records MUST NOT be marked as newly discovered in the current month
 */

import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { parseSourceTimestamp } from '../date-normalization';
import { SyncStatus, SourceLineage, ObservationSemantic, GroupSource, DiscoveryStatus, VerificationStatus, GroupStatus } from '@prisma/client';

export const RANSOMWATCH_GROUPS_URL = 'https://raw.githubusercontent.com/joshhighet/ransomwatch/main/groups.json';
export const RANSOMWATCH_POSTS_URL = 'https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json';

export interface RansomWatchGroup {
  name: string;
  captcha?: boolean;
  parser?: boolean;
  javascript_render?: boolean;
  meta?: any;
  locations?: Array<{
    fqdn?: string;
    title?: string;
    version?: number;
    slug?: string;
    available?: boolean;
    updated?: string;
    lastscrape?: string;
    enabled?: boolean;
  }>;
}

export interface RansomWatchPost {
  post_title: string;
  group_name: string;
  discovered: string; // e.g. "2021-08-11 02:40:48.406834"
  description?: string;
}

export interface HistoricalImportResult {
  runId: string;
  status: 'SUCCESS' | 'ALREADY_IMPORTED' | 'FAILED';
  groupsFound: number;
  groupsImported: number;
  groupsUpdated: number;
  groupsSkipped: number;
  earliestPostDate: string | null;
  latestPostDate: string | null;
  errors: string[];
  durationMs: number;
}

/**
 * Checks if RansomWatch archive was already imported.
 */
export async function getRansomWatchImportStatus() {
  const latestRun = await prisma.historicalImportRun.findFirst({
    where: { sourceId: 'RANSOMWATCH' },
    orderBy: { startedAt: 'desc' },
  });

  return {
    hasImported: latestRun?.status === SyncStatus.SUCCESS,
    lastRun: latestRun,
  };
}

/**
 * Executes idempotent historical import of RansomWatch archive.
 */
export async function runRansomWatchHistoricalImport(forceRerun = false): Promise<HistoricalImportResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  // Check previous successful import unless forceRerun is true
  if (!forceRerun) {
    const existing = await prisma.historicalImportRun.findFirst({
      where: { sourceId: 'RANSOMWATCH', status: SyncStatus.SUCCESS },
    });
    if (existing) {
      return {
        runId: existing.id,
        status: 'ALREADY_IMPORTED',
        groupsFound: existing.recordsRead,
        groupsImported: 0,
        groupsUpdated: 0,
        groupsSkipped: existing.recordsRead,
        earliestPostDate: null,
        latestPostDate: null,
        errors: [],
        durationMs: Date.now() - startTime,
      };
    }
  }

  // 1. Fetch groups.json
  let groupsData: RansomWatchGroup[] = [];
  let groupsSha256 = '';
  try {
    const res = await fetch(RANSOMWATCH_GROUPS_URL, {
      headers: { 'User-Agent': 'ThreatLedger-Historical-Archive-Importer/1.0' },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch groups.json: HTTP ${res.status} ${res.statusText}`);
    }
    const text = await res.text();
    groupsSha256 = crypto.createHash('sha256').update(text).digest('hex');
    groupsData = JSON.parse(text);
    if (!Array.isArray(groupsData)) {
      throw new Error('Invalid format: groups.json is not an array');
    }
  } catch (err: any) {
    errors.push(`groups.json error: ${err.message}`);
    const failedRun = await prisma.historicalImportRun.create({
      data: {
        sourceId: 'RANSOMWATCH',
        repositoryUrl: RANSOMWATCH_GROUPS_URL,
        recordsRead: 0,
        status: SyncStatus.FAILED,
        error: errors.join('; '),
        startedAt: new Date(startTime),
        completedAt: new Date(),
      },
    });
    return {
      runId: failedRun.id,
      status: 'FAILED',
      groupsFound: 0,
      groupsImported: 0,
      groupsUpdated: 0,
      groupsSkipped: 0,
      earliestPostDate: null,
      latestPostDate: null,
      errors,
      durationMs: Date.now() - startTime,
    };
  }

  // 2. Fetch posts.json (for earliest public victim claim per group)
  const groupEarliestClaimMap = new Map<string, { earliest: Date; latest: Date }>();
  let earliestGlobalClaim: Date | null = null;
  let latestGlobalClaim: Date | null = null;

  try {
    const postsRes = await fetch(RANSOMWATCH_POSTS_URL, {
      headers: { 'User-Agent': 'ThreatLedger-Historical-Archive-Importer/1.0' },
      signal: AbortSignal.timeout(60000),
    });
    if (postsRes.ok) {
      const postsText = await postsRes.text();
      const postsData: RansomWatchPost[] = JSON.parse(postsText);
      if (Array.isArray(postsData)) {
        for (const post of postsData) {
          if (!post.group_name || !post.discovered) continue;
          const normalizedGroupName = post.group_name.toLowerCase().trim();
          const d = parseSourceTimestamp(post.discovered);
          if (!d) continue;

          if (!earliestGlobalClaim || d < earliestGlobalClaim) earliestGlobalClaim = d;
          if (!latestGlobalClaim || d > latestGlobalClaim) latestGlobalClaim = d;

          const existingDates = groupEarliestClaimMap.get(normalizedGroupName);
          if (!existingDates) {
            groupEarliestClaimMap.set(normalizedGroupName, { earliest: d, latest: d });
          } else {
            if (d < existingDates.earliest) existingDates.earliest = d;
            if (d > existingDates.latest) existingDates.latest = d;
          }
        }
      }
    }
  } catch (postErr: any) {
    // Non-fatal: if posts.json fails or times out, group metadata can still be imported
    errors.push(`posts.json warning (claim dates partial): ${postErr.message}`);
  }

  // 3. Upsert historical observations and canonical groups idempotently
  let importedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const importTimestamp = new Date();

  // Ensure RANSOMWATCH intelligence source exists in IntelligenceSource table
  await prisma.intelligenceSource.upsert({
    where: { id: 'RANSOMWATCH' },
    update: {
      lastSyncAt: importTimestamp,
      lastSyncStatus: SyncStatus.SUCCESS,
      recordsTotal: groupsData.length,
      lastError: null,
    },
    create: {
      id: 'RANSOMWATCH',
      name: 'RansomWatch Historical Repository',
      sourceType: 'HISTORICAL_ARCHIVE',
      lineage: SourceLineage.HISTORICAL_ARCHIVE,
      isEnabled: true,
      lastSyncAt: importTimestamp,
      lastSyncStatus: SyncStatus.SUCCESS,
      recordsTotal: groupsData.length,
    },
  });

  for (const rwGroup of groupsData) {
    if (!rwGroup.name || typeof rwGroup.name !== 'string') {
      skippedCount++;
      continue;
    }

    const rawName = rwGroup.name.trim();
    const normalizedName = rawName.toLowerCase();
    const claims = groupEarliestClaimMap.get(normalizedName);
    const firstClaim = claims?.earliest || null;
    const lastClaim = claims?.latest || null;

    try {
      // Find existing canonical group by case-insensitive name
      const existingGroup = await prisma.ransomwareGroup.findFirst({
        where: {
          name: { equals: rawName, mode: 'insensitive' },
        },
      });

      let canonicalGroupId = existingGroup?.id;

      if (existingGroup) {
        // Update existing group only if historical first claim is earlier than existing firstClaimAt
        const updateData: any = {
          importedAt: existingGroup.importedAt || importTimestamp,
        };

        if (firstClaim && (!existingGroup.firstClaimAt || firstClaim < existingGroup.firstClaimAt)) {
          updateData.firstClaimAt = firstClaim;
          updateData.firstClaimSource = 'RANSOMWATCH (Historical Archive)';
        }

        await prisma.ransomwareGroup.update({
          where: { id: existingGroup.id },
          data: updateData,
        });
        updatedCount++;
      } else {
        // Create as BASELINE historical import. Strictly isolated from live discoveries
        const createdGroup = await prisma.ransomwareGroup.create({
          data: {
            name: rawName,
            normalizedName,
            source: GroupSource.RANSOMWATCH,
            discoveryStatus: DiscoveryStatus.BASELINE,
            verificationStatus: VerificationStatus.VERIFIED_DISTINCT,
            verificationNotes: 'Historical archive import from joshhighet/ransomwatch repository',
            firstObservedAt: importTimestamp,
            firstClaimAt: firstClaim,
            firstClaimSource: firstClaim ? 'RANSOMWATCH' : null,
            lastSeenAt: lastClaim,
            importedAt: importTimestamp,
            status: GroupStatus.INACTIVE,
          },
        });
        canonicalGroupId = createdGroup.id;
        importedCount++;
      }

      // Record GroupSourceObservation with HISTORICAL_ARCHIVE provenance
      if (canonicalGroupId) {
        const existingObs = await prisma.groupSourceObservation.findFirst({
          where: {
            groupId: canonicalGroupId,
            sourceId: 'RANSOMWATCH',
          },
        });

        if (existingObs) {
          await prisma.groupSourceObservation.update({
            where: { id: existingObs.id },
            data: {
              sourceGroupName: rawName,
              externalRecordId: normalizedName,
              firstClaimAt: firstClaim,
              observedAt: importTimestamp,
              rawPayload: rwGroup as any,
            },
          });
        } else {
          await prisma.groupSourceObservation.create({
            data: {
              groupId: canonicalGroupId,
              sourceId: 'RANSOMWATCH',
              sourceGroupName: rawName,
              externalRecordId: normalizedName,
              firstClaimAt: firstClaim,
              semantic: firstClaim ? ObservationSemantic.FIRST_CLAIM : ObservationSemantic.THREATLEDGER_OBSERVED,
              observedAt: importTimestamp,
              rawPayload: rwGroup as any,
            },
          });
        }
      }
    } catch (groupErr: any) {
      errors.push(`Error processing group ${rawName}: ${groupErr.message}`);
    }
  }

  // 4. Create HistoricalImportRun audit record
  const runRecord = await prisma.historicalImportRun.create({
    data: {
      sourceId: 'RANSOMWATCH',
      repositoryUrl: RANSOMWATCH_GROUPS_URL,
      contentHash: groupsSha256,
      recordsRead: groupsData.length,
      recordsImported: importedCount,
      recordsSkipped: skippedCount,
      recordsMatched: updatedCount,
      dateCoverageStart: earliestGlobalClaim,
      dateCoverageEnd: latestGlobalClaim,
      status: errors.length > 5 ? SyncStatus.FAILED : SyncStatus.SUCCESS,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      error: errors.length > 0 ? errors.slice(0, 10).join('; ') : null,
    },
  });

  return {
    runId: runRecord.id,
    status: runRecord.status === SyncStatus.SUCCESS ? 'SUCCESS' : 'FAILED',
    groupsFound: groupsData.length,
    groupsImported: importedCount,
    groupsUpdated: updatedCount,
    groupsSkipped: skippedCount,
    earliestPostDate: earliestGlobalClaim ? earliestGlobalClaim.toISOString() : null,
    latestPostDate: latestGlobalClaim ? latestGlobalClaim.toISOString() : null,
    errors,
    durationMs: Date.now() - startTime,
  };
}
