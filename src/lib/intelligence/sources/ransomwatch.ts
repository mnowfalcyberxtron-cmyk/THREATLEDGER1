/**
 * RansomWatch Historical Source Adapter
 * Repository: https://github.com/joshhighet/ransomwatch
 * Archived: 3 March 2026 (Read-Only Historical Archive)
 *
 * Rules:
 * - Strictly HISTORICAL_ARCHIVE sourceType
 * - Never treated as a live or recurring discovery feed
 * - Idempotent one-time import guarded by HistoricalImportRun and sha256 checksums
 * - Groups and posts are mapped with historical provenance
 * - Earliest claim per group is derived from historical posts.json discovered timestamp
 * - Historical records MUST NOT be marked as newly discovered in the current month
 */

import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { parseSourceTimestamp } from '../date-normalization';

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
    orderBy: { createdAt: 'desc' },
  });

  return {
    hasImported: latestRun?.status === 'SUCCESS',
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
      where: { sourceId: 'RANSOMWATCH', status: 'SUCCESS' },
    });
    if (existing) {
      return {
        runId: existing.id,
        status: 'ALREADY_IMPORTED',
        groupsFound: existing.recordCount,
        groupsImported: 0,
        groupsUpdated: 0,
        groupsSkipped: existing.recordCount,
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
        sourceUrl: RANSOMWATCH_GROUPS_URL,
        recordCount: 0,
        status: 'FAILED',
        errorLog: errors.join('; '),
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

  // Ensure RANSOMWATCH intelligence source exists
  const sourceRecord = await prisma.intelligenceSource.upsert({
    where: { sourceId: 'RANSOMWATCH' },
    update: {
      lastCheckedAt: importTimestamp,
      lastSuccessfulSyncAt: importTimestamp,
    },
    create: {
      sourceId: 'RANSOMWATCH',
      name: 'RansomWatch Historical Repository',
      sourceType: 'HISTORICAL_ARCHIVE',
      sourceLineage: 'INDEPENDENT',
      baseUrl: 'https://github.com/joshhighet/ransomwatch',
      isActive: false, // archived, not a live feed
      isHistorical: true,
      lastCheckedAt: importTimestamp,
      lastSuccessfulSyncAt: importTimestamp,
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
        // Create as HISTORICAL_IMPORT. Notice firstObservedAt is set to importTimestamp,
        // but discoveryStatus is strictly HISTORICAL_IMPORT so it is never counted as a current-month discovery!
        const createdGroup = await prisma.ransomwareGroup.create({
          data: {
            name: rawName,
            slug: normalizedName.replace(/[^a-z0-9_-]/g, '-'),
            source: 'RANSOMWATCH',
            discoveryStatus: 'HISTORICAL_IMPORT',
            verificationStatus: 'VERIFIED', // Known historical actor from 2021-2026 archive
            verificationNotes: 'Historical archive import from joshhighet/ransomwatch repository',
            firstObservedAt: importTimestamp,
            firstClaimAt: firstClaim,
            firstClaimSource: firstClaim ? 'RANSOMWATCH' : null,
            lastSeenAt: lastClaim,
            importedAt: importTimestamp,
            isActive: false, // Inactive historical group by default unless live source reports activity
          },
        });
        canonicalGroupId = createdGroup.id;
        importedCount++;
      }

      // Record GroupSourceObservation with HISTORICAL_ARCHIVE provenance
      if (canonicalGroupId) {
        await prisma.groupSourceObservation.upsert({
          where: {
            sourceId_externalId: {
              sourceId: 'RANSOMWATCH',
              externalId: normalizedName,
            },
          },
          update: {
            retrievedAt: importTimestamp,
            firstClaimAt: firstClaim,
            lastClaimAt: lastClaim,
            rawPayload: rwGroup as any,
          },
          create: {
            sourceId: 'RANSOMWATCH',
            groupId: canonicalGroupId,
            externalId: normalizedName,
            observedName: rawName,
            sourceLineage: 'INDEPENDENT',
            timestampSemantic: 'IMPORTED',
            firstClaimAt: firstClaim,
            lastClaimAt: lastClaim,
            retrievedAt: importTimestamp,
            rawPayload: rwGroup as any,
          },
        });
      }
    } catch (groupErr: any) {
      errors.push(`Error processing group ${rawName}: ${groupErr.message}`);
    }
  }

  // 4. Create HistoricalImportRun audit record
  const runRecord = await prisma.historicalImportRun.create({
    data: {
      sourceId: 'RANSOMWATCH',
      sourceUrl: RANSOMWATCH_GROUPS_URL,
      recordCount: groupsData.length,
      importedCount,
      updatedCount,
      skippedCount,
      fileChecksum: groupsSha256,
      earliestRecordDate: earliestGlobalClaim,
      latestRecordDate: latestGlobalClaim,
      status: errors.length > 5 ? 'FAILED' : 'SUCCESS',
      errorLog: errors.length > 0 ? errors.slice(0, 10).join('; ') : null,
    },
  });

  return {
    runId: runRecord.id,
    status: runRecord.status as any,
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

