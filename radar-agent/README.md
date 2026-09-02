# Radar Bertone - Backend del agente

## Arquitectura

- Frontend: Render Static Site `radar-bertone`
- Backend: Render Web Service `bertone-radar-agent`
- Base y autenticacion: Supabase `radar-bertone-pruebas`
- Agente externo: OpenAI Responses API + Web Search
- Revision humana: toda señal externa entra primero en `detecciones`; nunca se crea una oportunidad automaticamente.

## URLs

- Frontend: https://radar-bertone.onrender.com
- Backend: https://bertone-radar-agent.onrender.com
- Health: `GET /health`

## Variables de entorno del backend

- `SUPABASE_URL`: URL del proyecto Bertone.
- `SUPABASE_PUBLISHABLE_KEY`: publishable key del proyecto. No usar service_role en el frontend.
- `ALLOWED_ORIGINS`: origen permitido del frontend.
- `OPENAI_API_KEY`: secreto requerido para activar busqueda externa. Debe existir solo en Render, nunca en GitHub ni en el navegador.
- `OPENAI_MODEL`: opcional. Default actual: `gpt-5.6-luna`.

## Endpoints

### `GET /health`

No requiere login. Informa si el servicio esta vivo y si el agente externo esta configurado.

### `GET /api/agent/status`

Requiere el JWT del usuario del Radar. Informa estado del radar interno y del agente externo.

### `POST /api/radar/refresh`

Requiere JWT. Ejecuta el RPC `refrescar_radar_interno()` bajo el usuario autenticado. Genera recomendaciones por reglas internas: clientes dormidos, seguimientos vencidos y presupuestos sin respuesta.

### `POST /api/agent/search`

Requiere JWT y `OPENAI_API_KEY`. Ejecuta una busqueda web orientada a oportunidades comerciales de Bertone mediante OpenAI Responses API y guarda los hallazgos en `detecciones` bajo el usuario autenticado.

Body opcional:

```json
{
  "focus": "desagues en Santa Fe",
  "maxResults": 8
}
```

## Flujo de una señal externa

1. El usuario ejecuta `Buscar oportunidades externas`.
2. El backend valida el JWT con Supabase Auth.
3. Se crea un registro en `agent_runs`.
4. OpenAI usa Web Search y devuelve detecciones estructuradas.
5. El backend calcula un fingerprint para evitar duplicados.
6. Las señales nuevas se guardan en `detecciones` con estado `Nuevo`.
7. El usuario revisa la deteccion en el Radar.
8. Solo el usuario puede ejecutar `convertir_deteccion_a_oportunidad`.

## Principio de seguridad

El agente propone; no modifica automaticamente la cartera comercial oficial. Las oportunidades son creadas mediante revision humana. El backend usa la publishable key mas el JWT del usuario, de modo que RLS sigue siendo la barrera de autorizacion para las operaciones del usuario.
