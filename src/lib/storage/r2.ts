import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import crypto from 'crypto';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'threatledger-storage';
const R2_ENDPOINT =
  process.env.R2_ENDPOINT ||
  (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : 'https://placeholder.r2.cloudflarestorage.com');

export const isR2Configured = Boolean(
  R2_ACCESS_KEY_ID &&
  R2_SECRET_ACCESS_KEY &&
  R2_ACCESS_KEY_ID !== 'your_r2_access_key_id'
);

export const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || 'dummy',
    secretAccessKey: R2_SECRET_ACCESS_KEY || 'dummy',
  },
});

/**
 * Generate a safe, opaque object key.
 * Pattern: {prefix}/{assignmentId}/{fileId}/{safeFilename}
 */
export function generateR2ObjectKey(
  type: 'reports' | 'evidence',
  assignmentId: string,
  originalFilename: string
): { fileId: string; objectKey: string; safeFilename: string } {
  const fileId = crypto.randomUUID();
  const safeFilename = originalFilename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .toLowerCase();

  const objectKey = `${type}/${assignmentId}/${fileId}/${safeFilename}`;
  return { fileId, objectKey, safeFilename };
}

/**
 * Generate a short-lived presigned PUT URL for direct browser-to-R2 upload.
 * Valid for 15 minutes (900 seconds).
 */
export async function getPresignedUploadUrl(
  objectKey: string,
  contentType: string,
  expiresInSeconds: number = 900
): Promise<string> {
  if (!isR2Configured) {
    // Return a direct API upload endpoint URL fallback when R2 credentials are placeholder
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${appUrl}/api/files/upload/mock?key=${encodeURIComponent(objectKey)}`;
  }

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

/**
 * Generate a short-lived presigned GET URL for authorized browser download.
 * Valid for 15 minutes (900 seconds). Never stored permanently in the database.
 */
export async function getPresignedDownloadUrl(
  objectKey: string,
  expiresInSeconds: number = 900
): Promise<string> {
  if (!isR2Configured) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${appUrl}/api/files/download/mock?key=${encodeURIComponent(objectKey)}`;
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: objectKey,
  });

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

/**
 * Fetch raw object bytes server-side for physical MIME email attachments (Section 31).
 */
export async function getObjectBytes(objectKey: string): Promise<Buffer | null> {
  if (!isR2Configured) {
    // Return mock PDF buffer for testing email MIME attachments
    return Buffer.from(`%PDF-1.4 Mock ThreatLedger CTI Research Document: ${objectKey}`);
  }

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
    });
    const response = await s3Client.send(command);
    if (!response.Body) return null;

    const stream = response.Body as any;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } catch (error) {
    console.error('[R2 Storage] getObjectBytes failed:', error);
    return null;
  }
}

/**
 * Verify object existence and metadata in R2 bucket.
 */
export async function verifyObjectExists(
  objectKey: string
): Promise<{ exists: boolean; size?: number; contentType?: string }> {
  if (!isR2Configured) {
    // Mock verification for staging/offline
    return { exists: true, size: 1024 * 45, contentType: 'application/pdf' };
  }

  try {
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
    });
    const res = await s3Client.send(command);
    return {
      exists: true,
      size: res.ContentLength,
      contentType: res.ContentType,
    };
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return { exists: false };
    }
    console.error('[R2 Storage] verifyObjectExists error:', error);
    return { exists: false };
  }
}
