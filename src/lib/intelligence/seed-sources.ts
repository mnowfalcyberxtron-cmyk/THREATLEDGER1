import prisma from '@/lib/prisma';
import { SourceLineage } from '@prisma/client';

export const SYSTEM_INTELLIGENCE_SOURCES = [
  {
    id: 'RANSOMWARE_LIVE',
    name: 'Ransomware.live API PRO',
    sourceType: 'LIVE_PRIMARY',
    lineage: SourceLineage.PRIMARY_INDEPENDENT,
    isEnabled: true,
  },
  {
    id: 'ISMALICIOUS',
    name: 'isMalicious Threat Intelligence API',
    sourceType: 'DERIVED_OR_MIRRORED',
    lineage: SourceLineage.DERIVED_OR_MIRRORED,
    isEnabled: true,
  },
  {
    id: 'RANSOMWATCH',
    name: 'RansomWatch Historical Archive',
    sourceType: 'HISTORICAL_ARCHIVE',
    lineage: SourceLineage.HISTORICAL_ARCHIVE,
    isEnabled: true,
  },
];

export async function ensureIntelligenceSourcesExist(): Promise<void> {
  for (const src of SYSTEM_INTELLIGENCE_SOURCES) {
    await prisma.intelligenceSource.upsert({
      where: { id: src.id },
      update: {
        name: src.name,
        sourceType: src.sourceType,
        lineage: src.lineage,
      },
      create: {
        id: src.id,
        name: src.name,
        sourceType: src.sourceType,
        lineage: src.lineage,
        isEnabled: src.isEnabled,
      },
    });
  }
}
