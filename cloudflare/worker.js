// goalcraft.ai front for agents: the MCP server at /mcp and its sign-in under the same domain,
// so an agent only ever sees goalcraft.ai. The site itself stays on GitHub Pages; this Worker
// runs only on the routes below and passes the rest of the requests through.
//   goalcraft.ai/mcp*          → the MCP server (Supabase Edge Function)
//   goalcraft.ai/auth/*        → Supabase Auth (OAuth 2.1: register, authorize, token, keys)
//   goalcraft.ai/.well-known/* → discovery documents that name goalcraft.ai everywhere, and the
//                                ChatGPT app directory's domain check (openai-apps-challenge)

const SITE = 'https://goalcraft.ai';
const SUPABASE = 'https://wbnmtecgahwzwvcqenlk.supabase.co';
const MCP = `${SUPABASE}/functions/v1/mcp`;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'max-age=300' },
});

// The resource the agent asks access for, and who signs people in for it.
const resourceMetadata = () => json({
  resource: `${SITE}/mcp`,
  authorization_servers: [SITE],
  bearer_methods_supported: ['header'],
  resource_name: 'Goalcraft',
});

// Supabase's own Auth metadata with every address moved to goalcraft.ai.
async function authMetadata() {
  const res = await fetch(`${SUPABASE}/.well-known/oauth-authorization-server/auth/v1`);
  if (!res.ok) return json({ error: 'auth_metadata_unavailable' }, 502);
  const meta = await res.json();
  for (const [key, value] of Object.entries(meta)) {
    if (typeof value === 'string' && value.startsWith(SUPABASE)) meta[key] = SITE + value.slice(SUPABASE.length);
  }
  meta.issuer = SITE;
  return json(meta);
}

// Pass a request on to Supabase as it is; redirects go back to the agent's browser untouched.
async function forward(request, target) {
  const headers = new Headers(request.headers);
  headers.delete('host');
  const res = await fetch(target, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual',
  });
  const out = new Response(res.body, res);
  // Sign-in challenges point at our discovery document, not Supabase's.
  if (out.headers.has('www-authenticate')) {
    out.headers.set('www-authenticate', `Bearer resource_metadata="${SITE}/.well-known/oauth-protected-resource/mcp"`);
  }
  return out;
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url), path = url.pathname;
    // OpenAI checks that we own the domain: the token from its developer portal, as plain text. It
    // is kept in the Worker's variable OPENAI_APPS_CHALLENGE (Cloudflare dashboard → Settings).
    if (path === '/.well-known/openai-apps-challenge') {
      return env.OPENAI_APPS_CHALLENGE
        ? new Response(env.OPENAI_APPS_CHALLENGE.trim(), { headers: { 'content-type': 'text/plain; charset=utf-8' } })
        : new Response('Not found', { status: 404 });
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
        'access-control-allow-headers': '*',
        'access-control-expose-headers': 'mcp-session-id, www-authenticate',
      } });
    }
    if (path.startsWith('/.well-known/oauth-protected-resource')) return resourceMetadata();
    if (path.startsWith('/.well-known/oauth-authorization-server') || path.startsWith('/.well-known/openid-configuration')) return authMetadata();
    // A person opening /mcp in a browser goes to the connect page; agents never ask for HTML.
    if (path === '/mcp' && request.method === 'GET' && !request.headers.has('authorization') && (request.headers.get('accept') || '').includes('text/html')) return Response.redirect(SITE + '/connect/', 302);
    if (path === '/mcp' || path.startsWith('/mcp/')) return forward(request, MCP + path.slice(4) + url.search);
    if (path.startsWith('/auth/')) return forward(request, SUPABASE + path + url.search);
    return fetch(request); // anything else: the site on GitHub Pages
  },
};
