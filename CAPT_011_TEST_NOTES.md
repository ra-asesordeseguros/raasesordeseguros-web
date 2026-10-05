# CAPT-011 — Integración web en TEST

Fecha: 05/10/2026.

`analytics-events.js` intercepta únicamente formularios de cotización, conserva atribución first-touch de sesión y envía el lead al endpoint de recepción CAPT-011 antes de continuar con FormSubmit.

Durante validación esta rama apunta deliberadamente a Supabase TEST `erpdppymloapnjxghwwb`.

El submit original de FormSubmit se mantiene como respaldo: si el ingreso CRM falla o excede 4,5 segundos, el formulario continúa hacia el mecanismo vigente de email.

Antes de producción debe cambiarse el endpoint a Supabase PROD y publicarse sólo después de desplegar el Edge Function y las migraciones correspondientes en PROD.
