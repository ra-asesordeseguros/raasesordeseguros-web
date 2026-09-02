import http from 'node:http';
import { createHash } from 'node:crypto';

const PORT = Number(process.env.PORT || 10000);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
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

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(raw); } catch {
    const error = new Error('JSON invalido');
    error.status = 400;
    throw error;
  }
}

async function supabase(path, { method = 'GET', token, body, prefer } = {}) {
  const headers = { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error = new Error(data?.message || data?.msg || data?.error_description || data?.error || text || `Supabase ${response.status}`);
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
  const user = await supabase('/auth/v1/user', { token });
  return { token, user };
}

function outputText(response) {
  const pieces = [];
  for (const item of response?.output || []) {
    if (item?.type !== 'message') continue;
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && content?.text) pieces.push(content.text);
    }
  }
  return pieces.join('\n').trim();
}

function fingerprint(d) {
  const key = [d.obra_proyecto, d.localidad, d.provincia, d.comitente, d.contratista_oferente, d.fuente_principal]
    .map(x => String(x || '').trim().toLowerCase()).join('|');
  return createHash('sha256').update(key).digest('hex');
}

function priority(score) {
  if (score >= 80) return 'Alta';
  if (score >= 55) return 'Media';
  return 'Baja';
}

async function openaiRadarSearch({ focus = '', maxResults = 8 } = {}) {
  if (!OPENAI_API_KEY) {
    const error = new Error('El agente externo todavia no tiene OPENAI_API_KEY configurada en Render');
    error.status = 503;
    throw error;
  }

  const prompt = `Sos el agente comercial del Radar de Oportunidades de Premoldeados Bertone SRL, Argentina.

Busca en la web oportunidades REALES y ACTUALES para productos premoldeados de hormigon. Priorizá Argentina y especialmente Santa Fe, Cordoba, Entre Rios, Buenos Aires y corredores vinculados a infraestructura, industria, energia, urbanizaciones y obra publica.

Productos de interes: caños de hormigon armado, conductos rectangulares, bocas de registro, cabezales, sumideros, New Jersey, muros premoldeados, naves y estructuras premoldeadas, vigas postensadas, tanques de gran diametro, bancos y tribunas.

Señales buscadas: licitaciones, adjudicaciones, llamados a oferta, obras por iniciar, ampliaciones industriales, saneamiento, desagues, infraestructura vial, parques industriales, plantas, centros logisticos, energia y proyectos donde alguno de esos productos tenga encaje razonable.

Criterios obligatorios:
- Usá web search y basate en fuentes verificables y recientes.
- Preferí fuentes oficiales, organismos publicos, empresas, constructoras y medios confiables.
- No inventes obra, monto, contratista, fecha ni URL.
- Si un dato no esta publicado, devolvelo como null.
- Evitá noticias antiguas sin una etapa futura o accionable.
- Cada hallazgo debe tener una fuente principal que efectivamente respalde el proyecto.
- El score comercial va de 0 a 100 y debe reflejar encaje con Bertone, actualidad, cercania geografica, etapa accionable y calidad de la evidencia.
- Devolvé como maximo ${Math.min(Math.max(Number(maxResults) || 8, 1), 10)} detecciones.
${focus ? `- Foco adicional solicitado por el usuario: ${focus}` : ''}

No conviertas nada en oportunidad comercial: solo genera señales para revision humana.`;

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      detecciones: {
        type: 'array',
        maxItems: 10,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            fecha_publicacion: { type: ['string', 'null'], description: 'Fecha YYYY-MM-DD si esta disponible' },
            obra_proyecto: { type: 'string' },
            provincia: { type: ['string', 'null'] },
            localidad: { type: ['string', 'null'] },
            segmento: { type: ['string', 'null'] },
            etapa: { type: ['string', 'null'] },
            comitente: { type: ['string', 'null'] },
            contratista_oferente: { type: ['string', 'null'] },
            producto_potencial: { type: ['string', 'null'] },
            necesidad_detectada: { type: ['string', 'null'] },
            monto_presupuesto: { type: ['number', 'null'] },
            fecha_clave: { type: ['string', 'null'], description: 'Fecha YYYY-MM-DD accionable si existe' },
            fuente_principal: { type: 'string', description: 'URL directa de la fuente principal' },
            fuente_secundaria: { type: ['string', 'null'], description: 'URL directa secundaria si existe' },
            confianza: { type: 'string', enum: ['Alta', 'Media', 'Baja'] },
            puntaje_preliminar: { type: 'integer', minimum: 0, maximum: 100 },
            motivo_encaje: { type: ['string', 'null'] },
            datos_faltantes: { type: ['string', 'null'] },
            accion_investigacion: { type: ['string', 'null'] },
            accion_comercial_sugerida: { type: ['string', 'null'] },
            resumen_agente: { type: ['string', 'null'] }
          },
          required: [
            'fecha_publicacion','obra_proyecto','provincia','localidad','segmento','etapa','comitente',
            'contratista_oferente','producto_potencial','necesidad_detectada','monto_presupuesto','fecha_clave',
            'fuente_principal','fuente_secundaria','confianza','puntaje_preliminar','motivo_encaje','datos_faltantes',
            'accion_investigacion','accion_comercial_sugerida','resumen_agente'
          ]
        }
      }
    },
    required: ['detecciones']
  };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: prompt,
      tools: [{ type: 'web_search' }],
      tool_choice: 'auto',
      include: ['web_search_call.action.sources'],
      store: false,
      text: {
        format: {
          type: 'json_schema',
          name: 'bertone_radar_detections',
          strict: true,
          schema
        }
      }
    })
  });

  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  if (!response.ok) {
    const error = new Error(data?.error?.message || `OpenAI ${response.status}`);
    error.status = 502;
    throw error;
  }

  const text = outputText(data);
  if (!text) throw new Error('OpenAI no devolvio detecciones estructuradas');
  let parsed;
  try { parsed = JSON.parse(text); } catch {
    throw new Error('No se pudo interpretar la respuesta estructurada del agente');
  }
  return { detecciones: parsed.detecciones || [], responseId: data.id || null };
}

async function saveExternalRun(token, body) {
  const started = await supabase('/rest/v1/agent_runs', {
    method: 'POST', token,
    prefer: 'return=representation',
    body: {
      agente: 'Radar externo OpenAI + Web',
      estado: 'ejecutando',
      fuente_resumen: body.focus ? `Foco: ${body.focus}` : 'Busqueda general Bertone',
      observaciones: `Modelo: ${OPENAI_MODEL}`
    }
  });
  const run = started?.[0];
  if (!run) throw new Error('No se pudo registrar la ejecucion del agente');

  try {
    const result = await openaiRadarSearch(body);
    let inserted = 0;
    let duplicates = 0;

    for (const item of result.detecciones) {
      const fp = fingerprint(item);
      try {
        await supabase('/rest/v1/detecciones', {
          method: 'POST', token, prefer: 'return=minimal',
          body: {
            run_id: run.id,
            tipo_senal: 'Oportunidad externa',
            fecha_publicacion: item.fecha_publicacion,
            obra_proyecto: item.obra_proyecto,
            provincia: item.provincia,
            localidad: item.localidad,
            segmento: item.segmento,
            etapa: item.etapa,
            comitente: item.comitente,
            contratista_oferente: item.contratista_oferente,
            producto_potencial: item.producto_potencial,
            necesidad_detectada: item.necesidad_detectada,
            monto_presupuesto: item.monto_presupuesto,
            fecha_clave: item.fecha_clave,
            fuente_principal: item.fuente_principal,
            fuente_secundaria: item.fuente_secundaria,
            confianza: item.confianza,
            puntaje_preliminar: item.puntaje_preliminar,
            prioridad: priority(item.puntaje_preliminar || 0),
            motivo_encaje: item.motivo_encaje,
            datos_faltantes: item.datos_faltantes,
            accion_investigacion: item.accion_investigacion,
            accion_comercial_sugerida: item.accion_comercial_sugerida,
            resumen_agente: item.resumen_agente,
            estado_revision: 'Nuevo',
            fingerprint: fp
          }
        });
        inserted++;
      } catch (error) {
        if (error.status === 409) duplicates++;
        else throw error;
      }
    }

    await supabase(`/rest/v1/agent_runs?id=eq.${run.id}`, {
      method: 'PATCH', token, prefer: 'return=minimal',
      body: {
        estado: 'completado',
        total_detectado: result.detecciones.length,
        total_nuevo: inserted,
        observaciones: `Modelo: ${OPENAI_MODEL}. Response: ${result.responseId || 'n/a'}. Duplicados: ${duplicates}`
      }
    });

    return { run_id: run.id, detected: result.detecciones.length, inserted, duplicates };
  } catch (error) {
    try {
      await supabase(`/rest/v1/agent_runs?id=eq.${run.id}`, {
        method: 'PATCH', token, prefer: 'return=minimal',
        body: { estado: 'error', observaciones: String(error.message || error).slice(0, 900) }
      });
    } catch {}
    throw error;
  }
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
        version: '1.1.0',
        external_agent: OPENAI_API_KEY ? 'ready' : 'not_configured',
        model: OPENAI_API_KEY ? OPENAI_MODEL : null
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/radar/refresh') {
      const { token } = await requireUser(req);
      const generated = await supabase('/rest/v1/rpc/refrescar_radar_interno', {
        method: 'POST', token, body: {}
      });
      return send(req, res, 200, { ok: true, generated });
    }

    if (req.method === 'GET' && url.pathname === '/api/agent/status') {
      await requireUser(req);
      return send(req, res, 200, {
        internal_radar: 'ready',
        external_agent: OPENAI_API_KEY ? 'ready' : 'not_configured',
        model: OPENAI_API_KEY ? OPENAI_MODEL : null
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/agent/search') {
      const { token } = await requireUser(req);
      const body = await readJson(req);
      const result = await saveExternalRun(token, {
        focus: String(body.focus || '').trim().slice(0, 500),
        maxResults: Math.min(Math.max(Number(body.maxResults) || 8, 1), 10)
      });
      return send(req, res, 200, { ok: true, ...result });
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
