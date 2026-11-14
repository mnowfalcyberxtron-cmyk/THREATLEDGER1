import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get('key') || 'mock-document.pdf';
  const filename = key.split('/').pop() || 'threatledger-file.bin';

  const mockContent = `%PDF-1.4\n1 0 obj\n<< /Title (ThreatLedger CTI Artifact) /Author (ThreatLedger Platform) >>\nendobj\nThreatLedger Private Storage Artifact: ${key}\n`;

  return new NextResponse(mockContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
