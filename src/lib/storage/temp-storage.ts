import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createServiceRoleClient } from '@/lib/supabase/server';

const PRIVATE_STAGING_DIR = process.env.VERCEL
  ? path.join('/tmp', '.private_staging')
  : path.resolve('.private_staging');
const SUPABASE_TEMP_BUCKET = process.env.SUPABASE_TEMP_BUCKET || 'threatledger-temp-staging';

// Permitted extensions and content-types
export const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',
  '.log',
  '.json',
  '.xml',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
]);

export const FORBIDDEN_EXTENSIONS = new Set([
  '.exe', '.dll', '.bat', '.cmd', '.sh', '.bash', '.ps1', '.vbs', '.js', '.mjs',
  '.py', '.php', '.phtml', '.html', '.htm', '.xhtml', '.svg', '.jar', '.war',
  '.msi', '.com', '.scr', '.hta', '.cpl', '.reg',
]);

/**
 * Ensure private local staging directory exists when running locally.
 */
function ensureLocalStagingDir(): string {
  if (!fs.existsSync(PRIVATE_STAGING_DIR)) {
    fs.mkdirSync(PRIVATE_STAGING_DIR, { recursive: true });
  }
  return PRIVATE_STAGING_DIR;
}

/**
 * Sanitize filename to prevent directory traversal or malformed characters.
 */
export function sanitizeFilename(originalName: string): string {
  const base = path.basename(originalName);
  return base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.+/g, '.')
    .slice(0, 150);
}

/**
 * Validates file extension against security policy.
 */
export function validateFileSafety(filename: string, mimeType: string): { valid: boolean; error?: string } {
  const ext = path.extname(filename).toLowerCase();

  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Executable or potentially dangerous file extension "${ext}" is strictly forbidden.`,
    };
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File format "${ext}" is not supported. Allowed formats: PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, LOG, JSON, XML, PNG, JPG, WEBP.`,
    };
  }

  return { valid: true };
}

/**
 * Check if live Supabase Storage is configured and accessible.
 */
export function isSupabaseStorageConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(
    url &&
    key &&
    !url.includes('placeholder') &&
    !key.includes('placeholder') &&
    !key.includes('your_')
  );
}

/**
 * Stage an uploaded file temporarily before email dispatch.
 */
export async function stageTemporaryFile(
  assignmentId: string,
  originalFilename: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<{
  storagePath: string;
  safeFilename: string;
  fileSize: number;
  sha256: string;
}> {
  const safeFilename = sanitizeFilename(originalFilename);
  const safety = validateFileSafety(safeFilename, mimeType);
  if (!safety.valid) {
    throw new Error(safety.error);
  }

  const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const fileId = crypto.randomUUID();
  const storagePath = `temp/${assignmentId}/${fileId}/${safeFilename}`;

  // 1. If Supabase Storage is configured in production, upload to private bucket
  if (isSupabaseStorageConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { error } = await supabase.storage
        .from(SUPABASE_TEMP_BUCKET)
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (!error) {
        return {
          storagePath: `supabase://${SUPABASE_TEMP_BUCKET}/${storagePath}`,
          safeFilename,
          fileSize: fileBuffer.length,
          sha256,
        };
      }
      console.warn('[TempStorage] Supabase upload failed, falling back to local staging:', error.message);
    } catch (err: any) {
      console.warn('[TempStorage] Supabase client error:', err.message);
    }
  }

  // 2. Local private staging fallback (for offline tests, dev, or local runs)
  const baseDir = ensureLocalStagingDir();
  const targetDir = path.join(baseDir, assignmentId, fileId);
  fs.mkdirSync(targetDir, { recursive: true });
  const localFilePath = path.join(targetDir, safeFilename);

  fs.writeFileSync(localFilePath, fileBuffer);

  return {
    storagePath: `local://${assignmentId}/${fileId}/${safeFilename}`,
    safeFilename,
    fileSize: fileBuffer.length,
    sha256,
  };
}

/**
 * Retrieve raw file bytes from temporary storage for email attachment construction.
 */
export async function getTemporaryFileBytes(storagePath: string): Promise<Buffer | null> {
  if (!storagePath) return null;

  if (storagePath.startsWith('supabase://')) {
    try {
      const supabase = createServiceRoleClient();
      const cleanPath = storagePath.replace(`supabase://${SUPABASE_TEMP_BUCKET}/`, '');
      const { data, error } = await supabase.storage
        .from(SUPABASE_TEMP_BUCKET)
        .download(cleanPath);

      if (error || !data) {
        console.error('[TempStorage] Failed to download from Supabase Storage:', error);
        return null;
      }

      const arrayBuffer = await data.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      console.error('[TempStorage] Error reading from Supabase Storage:', err);
      return null;
    }
  }

  if (storagePath.startsWith('local://')) {
    try {
      const relativePath = storagePath.replace('local://', '');
      const localFilePath = path.join(PRIVATE_STAGING_DIR, ...relativePath.split('/'));
      if (fs.existsSync(localFilePath)) {
        return fs.readFileSync(localFilePath);
      }
    } catch (err) {
      console.error('[TempStorage] Error reading local temporary file:', err);
      return null;
    }
  }

  return null;
}

/**
 * Delete a single temporary file after email dispatch.
 */
export async function deleteTemporaryFile(storagePath: string): Promise<boolean> {
  if (!storagePath) return true;

  if (storagePath.startsWith('supabase://')) {
    try {
      const supabase = createServiceRoleClient();
      const cleanPath = storagePath.replace(`supabase://${SUPABASE_TEMP_BUCKET}/`, '');
      const { error } = await supabase.storage
        .from(SUPABASE_TEMP_BUCKET)
        .remove([cleanPath]);

      if (error) {
        console.error('[TempStorage] Failed to delete from Supabase Storage:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[TempStorage] Error deleting from Supabase Storage:', err);
      return false;
    }
  }

  if (storagePath.startsWith('local://')) {
    try {
      const relativePath = storagePath.replace('local://', '');
      const localFilePath = path.join(PRIVATE_STAGING_DIR, ...relativePath.split('/'));
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
        // Clean parent folder if empty
        const parentDir = path.dirname(localFilePath);
        if (fs.existsSync(parentDir) && fs.readdirSync(parentDir).length === 0) {
          fs.rmdirSync(parentDir);
        }
      }
      return true;
    } catch (err) {
      console.error('[TempStorage] Error deleting local temporary file:', err);
      return false;
    }
  }

  return true;
}

/**
 * Batch delete multiple temporary files.
 */
export async function deleteTemporaryFiles(storagePaths: string[]): Promise<{
  allSucceeded: boolean;
  failedPaths: string[];
}> {
  const failedPaths: string[] = [];

  for (const p of storagePaths) {
    if (!p) continue;
    const ok = await deleteTemporaryFile(p);
    if (!ok) {
      failedPaths.push(p);
    }
  }

  return {
    allSucceeded: failedPaths.length === 0,
    failedPaths,
  };
}
