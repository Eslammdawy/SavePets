/**
 * Tencent EdgeOne Pages Edge Function: GET /api/contact?id=<uuid>
 *
 * Validates the pet `id` parameter (UUID format), derives the rate-limit key `_ip`
 * from a SHA-256 hash of the real client IP (`context.clientIp` / `request.eo.clientIp` / `eo-connecting-ip`),
 * injects `_ip` and `_secret` (`EDGE_SHARED_SECRET`) into the JSON body sent to Apps Script,
 * and returns the contact digits with `Cache-Control: no-store`.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractClientIp(context) {
  const { request } = context;
  if (context.clientIp) {
    return String(context.clientIp).trim();
  }
  if (request && request.eo && request.eo.clientIp) {
    return String(request.eo.clientIp).trim();
  }
  const eoHeader = request.headers.get('eo-connecting-ip');
  if (eoHeader) {
    return eoHeader.trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    return xff.split(',')[0].trim();
  }
  return 'unknown';
}

async function deriveIpKey(ip, secret) {
  const data = new TextEncoder().encode(`${ip}:${secret}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const gasUrl = env && env.GAS_URL;
  const sharedSecret = env && env.EDGE_SHARED_SECRET;

  if (!gasUrl || !sharedSecret) {
    return new Response(
      JSON.stringify({
        ok: false,
        code: 'ERR_CONFIG',
        error: 'Server misconfiguration: missing GAS_URL or EDGE_SHARED_SECRET.'
      }),
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
  const id = (url.searchParams.get('id') || '').trim();

  if (!UUID_REGEX.test(id)) {
    return new Response(
      JSON.stringify({ ok: false, code: 'ERR_BAD_ID', error: 'Invalid pet ID parameter.' }),
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
    const clientIp = extractClientIp(context);
    const ipKey = await deriveIpKey(clientIp, sharedSecret);

    const upstreamPayload = {
      action: 'contact',
      id,
      _ip: ipKey,
      _secret: sharedSecret
    };

    const upstream = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(upstreamPayload),
      redirect: 'follow'
    });

    const responseText = await upstream.text();
    let parsedUpstream = null;
    try {
      parsedUpstream = JSON.parse(responseText);
    } catch (_parseErr) {
      return new Response(
        JSON.stringify({ ok: false, code: 'ERR_UPSTREAM', error: 'Invalid response from upstream.' }),
        {
          status: 502,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    return new Response(JSON.stringify(parsedUpstream), {
      status: upstream.ok ? 200 : upstream.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    });
  } catch (_err) {
    return new Response(
      JSON.stringify({ ok: false, code: 'ERR_UPSTREAM', error: 'Failed to reach upstream service.' }),
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
