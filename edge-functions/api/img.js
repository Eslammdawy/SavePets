/**
 * Tencent EdgeOne Pages Edge Function: GET /api/img?id=<drive_file_id>
 *
 * - Validates `id` against `^[A-Za-z0-9_-]{10,80}$`.
 * - Uses the EdgeOne Cache API (`caches.default`) with a normalized cache key.
 * - Fetches the Google Drive thumbnail server-side (`sz=w600`), verifies `Content-Type` starts with `image/`
 *   and size is within `MAX_IMG_BYTES` (2 MB), and returns it with:
 *   `Cache-Control: public, max-age=31536000, immutable` and `Access-Control-Allow-Origin: *`.
 */

const FILE_ID_REGEX = /^[A-Za-z0-9_-]{10,80}$/;
const MAX_IMG_BYTES = 2 * 1024 * 1024; // 2 MB hard cap

function getEdgeCache() {
  try {
    if (typeof caches !== 'undefined' && caches && caches.default) {
      return caches.default;
    }
  } catch (_e) {
    // Ignore if Cache API is unavailable
  }
  return null;
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').trim();

  if (!FILE_ID_REGEX.test(id)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid photo ID parameter.' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }

  const normalizedCacheUrl = `${url.origin}/api/img?id=${encodeURIComponent(id)}`;
  const cacheKey = new Request(normalizedCacheUrl, { method: 'GET' });
  const edgeCache = getEdgeCache();

  if (edgeCache) {
    try {
      const cachedRes = await edgeCache.match(cacheKey);
      if (cachedRes) {
        return cachedRes;
      }
    } catch (_cacheReadErr) {
      // Fall through to upstream fetch
    }
  }

  try {
    const driveUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w600`;
    const upstream = await fetch(driveUrl, {
      method: 'GET',
      redirect: 'follow'
    });

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Image not found on upstream.' }),
        {
          status: upstream.status === 404 ? 404 : 502,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Upstream resource is not an image.' }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    const contentLengthHeader = upstream.headers.get('content-length');
    if (contentLengthHeader && Number(contentLengthHeader) > MAX_IMG_BYTES) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Upstream image exceeds size limit.' }),
        {
          status: 413,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    const buffer = await upstream.arrayBuffer();
    if (!buffer || buffer.byteLength === 0 || buffer.byteLength > MAX_IMG_BYTES) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Invalid or oversized image payload.' }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    const response = new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      }
    });

    if (edgeCache) {
      try {
        const putPromise = edgeCache.put(cacheKey, response.clone());
        if (context && typeof context.waitUntil === 'function') {
          context.waitUntil(putPromise);
        } else {
          await putPromise;
        }
      } catch (_cacheWriteErr) {
        // Ignore edge cache put errors
      }
    }

    return response;
  } catch (_err) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Failed to fetch image from upstream.' }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}

export async function onRequest(context) {
  if (context.request.method === 'GET') {
    return onRequestGet(context);
  }
  return new Response(JSON.stringify({ ok: false, error: 'Method not allowed.' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export default onRequest;
