/**
 * Tencent EdgeOne Pages Edge Function: GET /api/comments?petId=<uuid>
 *
 * Validates `petId` (UUID format) and fetches comments for that pet from Apps Script.
 * Only sets a short public cache header if `upstream.ok` and `parsed.ok === true`,
 * and supports `?fresh=1` to bypass caching.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbzdWqhulLBedqA5wM7hcBMom3RSIGAcqFSLMcOC1xMSW8kQU9FcfqYmNO_AhbB05qZB/exec';

export async function onRequestGet(context) {
  const { request, env } = context;
  const gasUrl = (env && env.GAS_URL) || DEFAULT_GAS_URL;

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
  const petId = (url.searchParams.get('petId') || '').trim();
  const isFresh = url.searchParams.get('fresh') === '1';

  if (!UUID_REGEX.test(petId)) {
    return new Response(
      JSON.stringify({ ok: false, code: 'ERR_BAD_PET_ID', error: 'Invalid petId parameter.' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  try {
    const targetUrl = `${gasUrl}?action=comments&petId=${encodeURIComponent(petId)}`;
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

    if (!upstream.ok || !parsed || parsed.ok !== true) {
      return new Response(JSON.stringify(parsed || { ok: false, error: 'Upstream error.' }), {
        status: upstream.ok ? 200 : upstream.status,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      });
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': isFresh ? 'no-store' : 'public, max-age=0, s-maxage=60'
      }
    });
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

export default onRequest;
