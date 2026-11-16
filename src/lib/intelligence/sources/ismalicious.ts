import prisma from '@/lib/prisma';
import { decryptCredential } from '@/lib/crypto/encryption';

const BASE_URL = process.env.ISMALICIOUS_BASE_URL || 'https://api.ismalicious.com';

export interface IsMaliciousGroup {
  name: string;
  victimCount: number;
  claims30d?: number;
  claimsPrev30d?: number;
  lastClaimAt?: string | null;
  firstClaimAt?: string | null;
  activity?: number | string | null;
}

export interface IsMaliciousGroupsResponse {
  groups: IsMaliciousGroup[];
  total: number;
  limit: number;
  sourceLineage: 'DERIVED_OR_MIRRORED';
  upstreamSource: 'Ransomware.live';
  freshnessHeader?: string | null;
  retrievedAt: Date;
}

export interface IsMaliciousConnectionTestResult {
  success: boolean;
  statusCode?: number;
  message: string;
  groupCount?: number;
  sampleGroups?: string[];
  errorCode?: string;
  sourceLineage: 'DERIVED_OR_MIRRORED';
}

/**
 * Retrieve decrypted isMalicious credentials from SourceCredential or env.
 */
export async function getIsMaliciousCredentials(): Promise<{ apiKey: string; apiSecret: string } | null> {
  const credRecord = await prisma.sourceCredential.findUnique({
    where: { sourceId: 'ISMALICIOUS' },
  });

  if (credRecord && credRecord.isEnabled && credRecord.encryptedApiKey && credRecord.encryptedApiSecret) {
    try {
      const apiKey = decryptCredential(credRecord.encryptedApiKey, credRecord.iv, credRecord.tag);
      const apiSecret = decryptCredential(credRecord.encryptedApiSecret, credRecord.iv, credRecord.tag);
      if (apiKey && apiSecret) {
        return { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() };
      }
    } catch (e: any) {
      console.error('[isMalicious] Failed to decrypt stored credentials:', e.message);
      return null;
    }
  }

  // Fallback to environment variables if provided
  const envKey = process.env.ISMALICIOUS_API_KEY;
  const envSecret = process.env.ISMALICIOUS_API_SECRET;
  if (envKey && envSecret) {
    return { apiKey: envKey.trim(), apiSecret: envSecret.trim() };
  }

  return null;
}

/**
 * Construct the official X-API-KEY header: Base64(apiKey:apiSecret)
 */
export function buildIsMaliciousAuthHeader(apiKey: string, apiSecret: string): string {
  const cleanKey = apiKey.trim();
  const cleanSecret = apiSecret.trim();
  return Buffer.from(`${cleanKey}:${cleanSecret}`, 'utf8').toString('base64');
}

/**
 * Test live connection to isMalicious using supplied or saved credentials.
 */
export async function testIsMaliciousConnection(
  overrideCredentials?: { apiKey: string; apiSecret: string }
): Promise<IsMaliciousConnectionTestResult> {
  const creds = overrideCredentials || (await getIsMaliciousCredentials());

  if (!creds || !creds.apiKey || !creds.apiSecret) {
    return {
      success: false,
      message: 'Both API Key and API Secret are required. Please configure credentials in Settings.',
      errorCode: 'MISSING_CREDENTIALS',
      sourceLineage: 'DERIVED_OR_MIRRORED',
    };
  }

  const authHeader = buildIsMaliciousAuthHeader(creds.apiKey, creds.apiSecret);

  try {
    const res = await fetch(`${BASE_URL}/ransomware/groups?limit=5`, {
      method: 'GET',
      headers: {
        'X-API-KEY': authHeader,
        'Accept': 'application/json',
        'User-Agent': 'ThreatLedger-CTI/1.0',
      },
      signal: AbortSignal.timeout(12000),
    });

    if (res.status === 401) {
      return {
        success: false,
        statusCode: 401,
        message: 'Invalid API Key or API Secret. Authentication rejected by isMalicious (HTTP 401).',
        errorCode: 'INVALID_CREDENTIALS',
        sourceLineage: 'DERIVED_OR_MIRRORED',
      };
    }

    if (res.status === 403) {
      return {
        success: false,
        statusCode: 403,
        message: 'Insufficient subscription plan access for ransomware endpoints (HTTP 403).',
        errorCode: 'FORBIDDEN',
        sourceLineage: 'DERIVED_OR_MIRRORED',
      };
    }

    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      return {
        success: false,
        statusCode: 429,
        message: `isMalicious rate limit exceeded. Retry after ${retryAfter || '60'} seconds.`,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        sourceLineage: 'DERIVED_OR_MIRRORED',
      };
    }

    if (!res.ok) {
      return {
        success: false,
        statusCode: res.status,
        message: `isMalicious API error HTTP ${res.status}: ${res.statusText}`,
        errorCode: `API_ERROR_${res.status}`,
        sourceLineage: 'DERIVED_OR_MIRRORED',
      };
    }

    const data = await res.json();
    const rawGroups: any[] = Array.isArray(data) ? data : data.groups || [];

    // Track quota usage
    await incrementIsMaliciousUsage();

    return {
      success: true,
      statusCode: 200,
      message: `Successfully connected to isMalicious API PRO. Verified ${rawGroups.length} sample ransomware groups.`,
      groupCount: data.total || rawGroups.length,
      sampleGroups: rawGroups.map((g: any) => g.name || g.group).filter(Boolean).slice(0, 5),
      sourceLineage: 'DERIVED_OR_MIRRORED',
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to connect to isMalicious endpoint: ${error.message}`,
      errorCode: error.name === 'TimeoutError' ? 'TIMEOUT' : 'NETWORK_ERROR',
      sourceLineage: 'DERIVED_OR_MIRRORED',
    };
  }
}

/**
 * Fetch full group inventory from isMalicious with first-claim metadata.
 */
export async function fetchIsMaliciousGroups(limit: number = 500): Promise<IsMaliciousGroupsResponse> {
  const creds = await getIsMaliciousCredentials();
  if (!creds) {
    throw new Error('ISMALICIOUS_NOT_CONFIGURED');
  }

  const authHeader = buildIsMaliciousAuthHeader(creds.apiKey, creds.apiSecret);
  const url = `${BASE_URL}/ransomware/groups?limit=${limit}&sort=activity`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-API-KEY': authHeader,
      'Accept': 'application/json',
      'User-Agent': 'ThreatLedger-CTI/1.0',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    throw new Error(`ISMALICIOUS_HTTP_${res.status}`);
  }

  const data = await res.json();
  const rawGroups: any[] = Array.isArray(data) ? data : data.groups || [];
  const freshness = res.headers.get('Cache-Control');

  const groups: IsMaliciousGroup[] = rawGroups.map((g: any) => ({
    name: g.name || g.group || 'Unknown',
    victimCount: Number(g.victimCount || g.victims_count || g.victims || 0),
    claims30d: g.claims30d !== undefined ? Number(g.claims30d) : undefined,
    claimsPrev30d: g.claimsPrev30d !== undefined ? Number(g.claimsPrev30d) : undefined,
    lastClaimAt: g.lastClaimAt || null,
    firstClaimAt: g.firstClaimAt || null,
    activity: g.activity !== undefined ? g.activity : null,
  }));

  await incrementIsMaliciousUsage();

  return {
    groups,
    total: Number(data.total || groups.length),
    limit: Number(data.limit || limit),
    sourceLineage: 'DERIVED_OR_MIRRORED',
    upstreamSource: 'Ransomware.live',
    freshnessHeader: freshness,
    retrievedAt: new Date(),
  };
}

async function incrementIsMaliciousUsage(): Promise<void> {
  try {
    await prisma.sourceCredential.updateMany({
      where: { sourceId: 'ISMALICIOUS' },
      data: {
        requestsUsedThisMonth: { increment: 1 },
        lastSyncAt: new Date(),
      },
    });
  } catch {
    // Non-fatal telemetry update
  }
}
