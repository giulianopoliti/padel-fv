import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy route for Supabase Storage to avoid CORS/ORB issues in local development
 * In production, images are served directly from Supabase CDN
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathArray } = await params;
    const path = pathArray.join('/');

    // Extract bucket and file path
    // Expected format: /api/storage/organizaciones/uuid/filename.ext
    const [bucket, ...filePath] = path.split('/').filter(Boolean);

    if (!bucket || filePath.length === 0) {
      return new NextResponse('Invalid path', { status: 400 });
    }

    const supabase = await createClient();

    // Download the file from Supabase Storage
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(filePath.join('/'));

    if (error || !data) {
      console.error('[Storage Proxy] Error downloading file:', error);
      return new NextResponse('File not found', { status: 404 });
    }

    // Determine content type from file extension
    const extension = filePath[filePath.length - 1].split('.').pop()?.toLowerCase();
    const contentTypeMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
    };
    const contentType = contentTypeMap[extension || ''] || 'application/octet-stream';

    // Return the image with proper headers
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[Storage Proxy] Unexpected error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
