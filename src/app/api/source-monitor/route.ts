import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { fetchRecentGitHubCommits } from '@/lib/integrations/github-monitor';
import { UserRole } from '@prisma/client';

export async function GET() {
  try {
    await requireAuth(UserRole.ANALYST);
    const commits = await fetchRecentGitHubCommits();
    return NextResponse.json({
      repository: process.env.GITHUB_MONITOR_REPO || 'JMousqueton/ransomware.live',
      monitoredBranch: 'main',
      commits,
    });
  } catch (error: any) {
    if (error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to query source monitor' }, { status: 500 });
  }
}
