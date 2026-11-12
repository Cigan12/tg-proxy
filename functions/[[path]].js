// A private Telegram Bot API relay. Never log request URLs or payloads.
export async function onRequest({ request, env }) {
  const secret = env.PROXY_SECRET;
  if (typeof secret !== 'string' || secret.length === 0)
    return new Response('Relay secret is missing', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(secret))
    return new Response('Relay secret has invalid format', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const incoming = new URL(request.url);
  const prefix = `/${secret}/`;
  if (!incoming.pathname.startsWith(prefix)) return new Response('Not found', { status: 404 });
  const path = incoming.pathname.slice(prefix.length);
  if (!/^(?:bot\d+:[A-Za-z0-9_-]+\/[A-Za-z][A-Za-z0-9_]*|file\/bot\d+:[A-Za-z0-9_-]+\/.+)$/.test(path)) {
    return new Response('Not found', { status: 404 });
  }
  if (request.method !== 'GET' && request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const headers = new Headers();
  for (const name of ['content-type', 'accept']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const response = await fetch(`https://api.telegram.org/${path}${incoming.search}`, {
      method: request.method,
      headers,
      ...(request.method === 'POST' ? { body: request.body } : {}),
      redirect: 'manual',
    });
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Cache-Control', 'no-store');
    responseHeaders.delete('set-cookie');
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  } catch {
    // Do not include error.message: it can contain the full URL and bot token.
    return Response.json({ ok: false, error_code: 502, description: 'Telegram is unavailable' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
