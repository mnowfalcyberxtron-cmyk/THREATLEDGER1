import prisma from '@/lib/prisma';

// Default storage quota: 50 GB
export const DEFAULT_STORAGE_QUOTA_BYTES = 50 * 1024 * 1024 * 1024;

export type QuotaStatus = 'NORMAL' | 'ATTENTION' | 'WARNING' | 'CRITICAL';

export interface StorageQuotaDetails {
  usedBytes: number;
  quotaBytes: number;
  usedPercentage: number;
  status: QuotaStatus;
  reportsBytes: number;
  evidenceBytes: number;
}

/**
 * Calculates current storage consumption across verified reports and supporting evidence.
 */
export async function getStorageQuotaDetails(): Promise<StorageQuotaDetails> {
  const [reportStats, evidenceStats] = await Promise.all([
    prisma.reportVersion.aggregate({
      _sum: { fileSize: true },
      where: { uploadStatus: 'VERIFIED' },
    }),
    prisma.supportingEvidence.aggregate({
      _sum: { fileSize: true },
      where: { uploadStatus: 'VERIFIED' },
    }),
  ]);

  const reportsBytes = reportStats._sum.fileSize || 0;
  const evidenceBytes = evidenceStats._sum.fileSize || 0;
  const usedBytes = reportsBytes + evidenceBytes;
  const quotaBytes = DEFAULT_STORAGE_QUOTA_BYTES;
  const usedPercentage = (usedBytes / quotaBytes) * 100;

  let status: QuotaStatus = 'NORMAL';
  if (usedPercentage >= 95) {
    status = 'CRITICAL';
  } else if (usedPercentage >= 85) {
    status = 'WARNING';
  } else if (usedPercentage >= 70) {
    status = 'ATTENTION';
  }

  return {
    usedBytes,
    quotaBytes,
    usedPercentage,
    status,
    reportsBytes,
    evidenceBytes,
  };
}

/**
 * Validates whether an incoming upload of given size can proceed under quota limits.
 * Hard-blocks uploads at or above 95% quota to prevent storage exhaustion.
 */
export async function canUploadFile(fileSizeBytes: number): Promise<{
  allowed: boolean;
  reason?: string;
  details: StorageQuotaDetails;
}> {
  const details = await getStorageQuotaDetails();

  if (details.usedPercentage >= 95) {
    return {
      allowed: false,
      reason: `Storage quota critical: ${(details.usedPercentage).toFixed(1)}% consumed. New uploads suspended pending archival or quota increase.`,
      details,
    };
  }

  if (details.usedBytes + fileSizeBytes > details.quotaBytes) {
    return {
      allowed: false,
      reason: `Uploading this file (${(fileSizeBytes / (1024 * 1024)).toFixed(1)}MB) would exceed the maximum storage quota limit of ${(details.quotaBytes / (1024 * 1024 * 1024)).toFixed(0)}GB.`,
      details,
    };
  }

  return {
    allowed: true,
    details,
  };
}
