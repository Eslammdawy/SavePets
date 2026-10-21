/**
 * Tencent EdgeOne Pages Edge Function: GET /api/list?gov=...
 *
 * - Validates `gov` against the 27 Egyptian governorates (and optional `type`).
 * - Supports `?fresh=1` to bypass reading/writing the edge cache right after a write.
 * - Uses the EdgeOne Cache API (`caches.default`) with a normalized cache key
 *   (lowercase `gov` and optional `type`, ignoring all other query params).
 * - Never caches upstream errors or non-JSON responses (`Cache-Control: no-store`).
 * - Only caches valid `{ ok: true, ... }` JSON responses (`s-maxage=300, stale-while-revalidate=60`).
 */

const VALID_GOVS = new Set([
  'cairo',
  'giza',
  'alexandria',
  'dakahlia',
  'red_sea',
  'beheira',
  'fayoum',
  'gharbia',
  'ismailia',
  'menofia',
  'minya',
  'qalyubia',
  'new_valley',
  'suez',
  'aswan',
  'assiut',
  'beni_suef',
  'port_said',
  'damietta',
  'sharkia',
  'south_sinai',
  'kafr_el_sheikh',
  'matrouh',
  'luxor',
  'qena',
  'north_sinai',
  'sohag'
]);

const VALID_TYPES = new Set(['dog', 'cat']);

const PUBLIC_CACHE_HEADER = 'public, max-age=0, s-maxage=300, stale-while-revalidate=60';

function getEdgeCache() {
  try {
    if (typeof caches !== 'undefined' && caches && caches.default) {
      return caches.default;
    }
  } catch (_e) {
    // Ignore if Cache API is unavailable in environment
  }
  return null;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const gasUrl = env && env.GAS_URL;

  if (!gasUrl) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Server misconfiguration: missing GAS_URL.' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  const url = new URL(request.url);
  const gov = (url.searchParams.get('gov') || '').trim().toLowerCase();
  const type = (url.searchParams.get('type') || '').trim().toLowerCase();
  const isFresh = url.searchParams.get('fresh') === '1';

  if (!VALID_GOVS.has(gov)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid governorate parameter.' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  if (type && !VALID_TYPES.has(type)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid animal type parameter.' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  // Build normalized cache key using only lowercase gov (and valid type if provided)
  const typeQuery = type ? `&type=${encodeURIComponent(type)}` : '';
  const normalizedCacheUrl = `${url.origin}/api/list?gov=${encodeURIComponent(gov)}${typeQuery}`;
  const cacheKey = new Request(normalizedCacheUrl, { method: 'GET' });
  const edgeCache = getEdgeCache();

  if (!isFresh && edgeCache) {
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
    const freshParam = isFresh ? '&fresh=1' : '';
    const targetUrl = `${gasUrl}?action=list&gov=${encodeURIComponent(gov)}${typeQuery}${freshParam}`;
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow'
    });

    const bodyText = await upstream.text();
    let parsed = null;
    try {
      parsed = JSON.parse(bodyText);
    } catch (_parseErr) {
      return new Response(
        JSON.stringify({ ok: false, code: 'ERR_UPSTREAM_NON_JSON', error: 'Invalid upstream response.' }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    const isSuccessPayload = Boolean(upstream.ok && parsed && parsed.ok === true);
    if (!isSuccessPayload) {
      return new Response(JSON.stringify(parsed || { ok: false, error: 'Upstream error.' }), {
        status: upstream.ok ? 200 : upstream.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      });
    }

    const cacheControl = isFresh ? 'no-store' : PUBLIC_CACHE_HEADER;
    const response = new Response(JSON.stringify(parsed), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': cacheControl
      }
    });

    if (!isFresh && edgeCache) {
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
      JSON.stringify({ ok: false, error: 'Failed to reach upstream service.' }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
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
      'Cache-Control': 'no-store'
    }
  });
}
