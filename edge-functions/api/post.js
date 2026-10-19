/**
 * Tencent EdgeOne Pages Edge Function: POST /api/post
 *
 * Forwards the raw request body unchanged with Content-Type: text/plain;charset=utf-8
 * to the Google Apps Script Web App (following redirects) and never caches responses.
 */

export async function onRequestPost(context) {
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

  try {
    const rawBody = await request.text();
    const upstream = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: rawBody,
      redirect: 'follow'
    });

    const responseText = await upstream.text();

    return new Response(responseText, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (err) {
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
