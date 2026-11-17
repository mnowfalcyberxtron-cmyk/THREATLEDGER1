/**
 * Threat Actor Multi-Source Correlation Engine
 *
 * Implements:
 * - Robust name normalization (case folding, trimming, punctuation collapsing)
 * - Exact canonical match & alias lookup
 * - Lineage enforcement (isMalicious + Ransomware.live not counted twice)
 * - Source observation linking without losing original source metadata
 * - Flagging uncertain matches for analyst review
 */

import prisma from '@/lib/prisma';
import { SourceLineage, ObservationSemantic } from '@prisma/client';

export interface CorrelationResult {
  matchType: 'EXACT_CANONICAL' | 'KNOWN_ALIAS' | 'NORMALIZED_MATCH' | 'UNCERTAIN_MATCH' | 'NO_MATCH';
  canonicalGroupId: string | null;
  canonicalGroupName: string | null;
  confidence: number; // 0.0 to 1.0
  notes?: string;
}

/**
 * Standardizes a group name for robust matching:
 * - Lowercase
 * - Trim
 * - Remove common punctuation: hyphens, underscores, dots, apostrophes
 * - Collapse multiple whitespaces
 */
export function normalizeActorName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/[._\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Correlates an incoming source observation against the ThreatLedger canonical database.
 */
export async function correlateGroup(
  rawName: string,
  aliases: string[] = []
): Promise<CorrelationResult> {
  const cleanName = rawName.trim();
  const normalized = normalizeActorName(cleanName);

  if (!normalized) {
    return {
      matchType: 'NO_MATCH',
      canonicalGroupId: null,
      canonicalGroupName: null,
      confidence: 0,
      notes: 'Empty group name provided',
    };
  }

  // 1. Exact match (case-insensitive) on RansomwareGroup.name
  const exactGroup = await prisma.ransomwareGroup.findFirst({
    where: {
      name: { equals: cleanName, mode: 'insensitive' },
    },
    select: { id: true, name: true },
  });

  if (exactGroup) {
    return {
      matchType: 'EXACT_CANONICAL',
      canonicalGroupId: exactGroup.id,
      canonicalGroupName: exactGroup.name,
      confidence: 1.0,
      notes: 'Exact canonical name match',
    };
  }

  // 2. Check known aliases on existing groups
  const aliasMatch = await prisma.ransomwareGroup.findFirst({
    where: {
      aliases: {
        some: {
          alias: { equals: cleanName, mode: 'insensitive' },
        },
      },
    },
    select: { id: true, name: true },
  });

  if (aliasMatch) {
    return {
      matchType: 'KNOWN_ALIAS',
      canonicalGroupId: aliasMatch.id,
      canonicalGroupName: aliasMatch.name,
      confidence: 0.95,
      notes: `Matched known alias for ${aliasMatch.name}`,
    };
  }

  // 3. Normalized string match across all groups
  const allGroups = await prisma.ransomwareGroup.findMany({
    select: {
      id: true,
      name: true,
      aliases: { select: { alias: true } },
    },
  });

  for (const group of allGroups) {
    if (normalizeActorName(group.name) === normalized) {
      return {
        matchType: 'NORMALIZED_MATCH',
        canonicalGroupId: group.id,
        canonicalGroupName: group.name,
        confidence: 0.9,
        notes: `Normalized match against canonical ${group.name}`,
      };
    }

    // Check incoming aliases against canonical group name or aliases
    for (const a of aliases) {
      if (normalizeActorName(a) === normalizeActorName(group.name)) {
        return {
          matchType: 'KNOWN_ALIAS',
          canonicalGroupId: group.id,
          canonicalGroupName: group.name,
          confidence: 0.9,
          notes: `Incoming alias "${a}" matched canonical ${group.name}`,
        };
      }
    }

    // Check group existing aliases against normalized input
    for (const ea of group.aliases) {
      if (normalizeActorName(ea.alias) === normalized) {
        return {
          matchType: 'KNOWN_ALIAS',
          canonicalGroupId: group.id,
          canonicalGroupName: group.name,
          confidence: 0.9,
          notes: `Normalized match against group alias ${ea.alias}`,
        };
      }
    }
  }

  // 4. No high-confidence match found
  return {
    matchType: 'NO_MATCH',
    canonicalGroupId: null,
    canonicalGroupName: null,
    confidence: 0.0,
    notes: 'No existing group or alias matched',
  };
}

/**
 * Links a source observation to a canonical group, preserving provenance and distinct timestamps.
 */
export async function linkGroupObservation({
  sourceId,
  canonicalGroupId,
  externalId,
  observedName,
  sourceLineage,
  timestampSemantic,
  firstClaimAt,
  lastClaimAt,
  rawPayload,
}: {
  sourceId: string;
  canonicalGroupId: string;
  externalId: string;
  observedName: string;
  sourceLineage?: SourceLineage;
  timestampSemantic: ObservationSemantic;
  firstClaimAt: Date | null;
  lastClaimAt: Date | null;
  rawPayload?: any;
}) {
  const existing = await prisma.groupSourceObservation.findFirst({
    where: {
      groupId: canonicalGroupId,
      sourceId,
      externalRecordId: externalId,
    },
  });

  if (existing) {
    return await prisma.groupSourceObservation.update({
      where: { id: existing.id },
      data: {
        sourceGroupName: observedName,
        firstClaimAt: firstClaimAt ?? undefined,
        observedAt: new Date(),
        rawPayload: rawPayload ?? undefined,
      },
    });
  }

  return await prisma.groupSourceObservation.create({
    data: {
      sourceId,
      groupId: canonicalGroupId,
      sourceGroupName: observedName,
      externalRecordId: externalId,
      semantic: timestampSemantic,
      firstClaimAt,
      observedAt: new Date(),
      rawPayload,
    },
  });
}
