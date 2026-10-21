/**
 * Tencent EdgeOne Pages Edge Function: POST /api/post
 *
 * Extracts the real client IP from EdgeOne's runtime (`context.clientIp` / `request.eo.clientIp`)
 * or EdgeOne's origin-pull header (`eo-connecting-ip`), hashes it with SHA-256 to derive `_ip`,
 * strips any browser-supplied `_ip` or `_secret`, injects `_ip` and `_secret` (`EDGE_SHARED_SECRET`)
 * into the JSON body, and forwards to Google Apps Script without caching.
 */

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

export async function onRequestPost(context) {
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

  let parsedBody;
  try {
    const rawBody = await request.text();
    parsedBody = JSON.parse(rawBody);
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      throw new Error('Invalid JSON object');
    }
  } catch (_err) {
    return new Response(
      JSON.stringify({ ok: false, code: 'ERR_BAD_JSON', error: 'Invalid JSON request body.' }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        }
      }
    );
  }

  // Strip any _ip or _secret sent by the browser
  delete parsedBody._ip;
  delete parsedBody._secret;

  try {
    const clientIp = extractClientIp(context);
    const ipKey = await deriveIpKey(clientIp, sharedSecret);

    const upstreamPayload = {
      ...parsedBody,
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
        'Cache-Control': 'no-store, no-cache, must-revalidate'
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
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return new Response(JSON.stringify({ ok: false, error: 'Method not allowed.' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
