/**
 * Converts a Supabase Storage URL to use the local proxy in development
 * This fixes ERR_BLOCKED_BY_ORB errors in local development
 *
 * In production, returns the original URL to use Supabase CDN directly
 * In development, returns a proxied URL through /api/storage
 */
export function getStorageUrl(supabaseUrl: string | null | undefined): string | null {
  if (!supabaseUrl) return null;

  // Check if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development' ||
                        supabaseUrl.includes('localhost:8001');

  if (!isDevelopment) {
    // In production, use the Supabase URL directly
    return supabaseUrl;
  }

  // In development, extract the path and use our proxy
  // Expected format: http://localhost:8001/storage/v1/object/public/bucket/path/to/file
  try {
    const url = new URL(supabaseUrl);
    const pathParts = url.pathname.split('/');

    // Find 'public' in the path and get everything after it
    const publicIndex = pathParts.indexOf('public');
    if (publicIndex === -1) {
      console.warn('[getStorageUrl] Invalid storage URL format:', supabaseUrl);
      return supabaseUrl;
    }

    // Get bucket and file path after 'public'
    const remainingPath = pathParts.slice(publicIndex + 1).join('/');

    // Return proxied URL through our API route
    return `/api/storage/${remainingPath}`;
  } catch (error) {
    console.error('[getStorageUrl] Error parsing URL:', error);
    return supabaseUrl;
  }
}
