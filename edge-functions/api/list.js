/**
 * Tencent EdgeOne Pages Edge Function: GET /api/list?gov=...
 *
 * Validates the governorate parameter against the 27 Egyptian governorates,
 * forwards the request to the Google Apps Script Web App (following redirects),
 * and sets Cache-Control: public, max-age=0, s-maxage=300 so EdgeOne caches
 * responses per governorate at the edge for 5 minutes.
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

export async function onRequestGet(context) {
  const { request, env } = context;
  const gasUrl = env && env.GAS_URL;

  if (!gasUrl) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Server misconfiguration: missing GAS_URL.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }
    );
  }

  const url = new URL(request.url);
  const gov = (url.searchParams.get('gov') || '').trim().toLowerCase();
  const type = (url.searchParams.get('type') || '').trim().toLowerCase();

  if (!VALID_GOVS.has(gov)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid governorate parameter.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }
    );
  }

  if (type && !VALID_TYPES.has(type)) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid animal type parameter.' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
      }
    );
  }

  try {
    const typeQuery = type ? `&type=${encodeURIComponent(type)}` : '';
    const targetUrl = `${gasUrl}?action=list&gov=${encodeURIComponent(gov)}${typeQuery}`;
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      redirect: 'follow'
    });

    const bodyText = await upstream.text();

    return new Response(bodyText, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=300'
      }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Failed to reach upstream service.' }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
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
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}
