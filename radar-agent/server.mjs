import http from 'node:http';

const PORT = Number(process.env.PORT || 10000);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://radar-bertone.onrender.com')
  .split(',').map(x => x.trim()).filter(Boolean);

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('Falta configuracion de Supabase');
  process.exit(1);
}

function cors(req) {
  const origin = req.headers.origin;
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Vary': 'Origin'
  };
}

function send(req, res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...cors(req) });
  res.end(JSON.stringify(data));
}

function bearer(req) {
  const value = req.headers.authorization || '';
  return value.startsWith('Bearer ') ? value.slice(7) : null;
}

async function supabase(path, { method = 'GET', token, body } = {}) {
  const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.msg || data?.error || text || `Supabase ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function requireUser(req) {
  const token = bearer(req);
  if (!token) {
    const error = new Error('Falta autenticacion');
    error.status = 401;
    throw error;
  }
  await supabase('/auth/v1/user', { token });
  return token;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors(req));
    return res.end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return send(req, res, 200, {
        ok: true,
        service: 'bertone-radar-agent',
        version: '1.0.0',
        external_agent: 'not_configured'
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/radar/refresh') {
      const token = await requireUser(req);
      const generated = await supabase('/rest/v1/rpc/refrescar_radar_interno', {
        method: 'POST', token, body: {}
      });
      return send(req, res, 200, { ok: true, generated });
    }

    if (req.method === 'GET' && url.pathname === '/api/agent/status') {
      await requireUser(req);
      return send(req, res, 200, {
        internal_radar: 'ready',
        external_agent: 'not_configured'
      });
    }

    return send(req, res, 404, { error: 'not_found' });
  } catch (error) {
    console.error(error);
    return send(req, res, error.status || 500, { error: error.message || 'internal_error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`bertone-radar-agent listening on ${PORT}`);
});
