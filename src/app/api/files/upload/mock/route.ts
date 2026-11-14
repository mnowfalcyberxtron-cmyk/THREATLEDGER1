import { NextRequest, NextResponse } from 'next/server';

export async function PUT(req: NextRequest) {
  // Mock endpoint for direct-to-R2 upload fallback when live Cloudflare R2 credentials are not set
  return new NextResponse(null, { status: 200 });
}

export async function POST(req: NextRequest) {
  return new NextResponse(null, { status: 200 });
}
