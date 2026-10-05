(() => {
  if (window.__raAnalyticsEventsLoaded) return;
  window.__raAnalyticsEventsLoaded = true;

  // CAPT-011 TEST. Antes de producción se reemplaza por el endpoint PROD.
  const CAPTACION_ENDPOINT = "https://erpdppymloapnjxghwwb.supabase.co/functions/v1/captacion-web-ingest";

  const cleanText = (value, max = 80) =>
    String(value || "").replace(/\s+/g, " ").trim().slice(0, max);

  const uuid = () => crypto.randomUUID();
  const getOrCreate = (storage, key) => {
    let value = storage.getItem(key);
    if (!value) {
      value = uuid();
      storage.setItem(key, value);
    }
    return value;
  };

  const visitorId = getOrCreate(window.localStorage, "ra_captacion_visitor_id");
  const firstTouchKey = "ra_captacion_first_touch";
  if (!window.sessionStorage.getItem(firstTouchKey)) {
    const qs = new URLSearchParams(window.location.search);
    window.sessionStorage.setItem(firstTouchKey, JSON.stringify({
      landing_path: window.location.pathname,
      referrer: document.referrer || "",
      utm_source: cleanText(qs.get("utm_source"), 80),
      utm_medium: cleanText(qs.get("utm_medium"), 80),
      utm_campaign: cleanText(qs.get("utm_campaign"), 120),
      utm_content: cleanText(qs.get("utm_content"), 120),
      utm_term: cleanText(qs.get("utm_term"), 120),
    }));
  }

  const firstTouch = () => {
    try { return JSON.parse(window.sessionStorage.getItem(firstTouchKey) || "{}"); }
    catch { return {}; }
  };

  const pageProduct = () => {
    const parts = window.location.pathname.split("/").filter(Boolean);
    if (parts[0] === "seguros" && parts[1]) return parts[1];
    if (parts[0] === "novedades" && parts[1]) return "novedades:" + parts[1];
    if (parts[0] === "novedades") return "novedades";
    return "home";
  };

  const sectionName = (element) => {
    if (!element) return "page";
    if (element.classList?.contains("nav-cta")) return "nav";
    if (element.classList?.contains("wa-float")) return "floating_whatsapp";
    const container = element.closest("nav,header,main,section,footer,article");
    if (!container) return "page";
    if (container.id) return cleanText(container.id, 50);
    const usefulClass = [...container.classList].find((name) =>
      /hero|cta|contact|footer|nav|form|article|contenido|main/i.test(name),
    );
    return usefulClass ? cleanText(usefulClass, 50) : container.tagName.toLowerCase();
  };

  const send = (eventName, params = {}) => {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", eventName, {
      page_path: window.location.pathname,
      page_title: document.title,
      product_context: pageProduct(),
      ...params,
    });
  };

  const quoteForm = (form) => {
    if (!form) return false;
    const action = String(form.getAttribute("action") || "");
    return form.classList.contains("form-cotiza") || action.includes("formsubmit.co");
  };

  const formName = (form) => {
    const subject = form?.querySelector('input[name="_subject"]')?.value;
    return cleanText(subject || ("cotizacion:" + pageProduct()), 80);
  };

  document.addEventListener("click", (event) => {
    const link = event.target.closest?.("a[href]");
    if (!link) return;
    const href = String(link.getAttribute("href") || "").trim();
    const common = {
      cta_text: cleanText(link.textContent || link.getAttribute("aria-label") || "sin_texto"),
      cta_location: sectionName(link),
    };
    if (/^https:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)/i.test(href)) {
      send("whatsapp_click", common); return;
    }
    if (/^tel:/i.test(href)) { send("phone_click", common); return; }
    if (/^mailto:/i.test(href)) send("email_click", common);
  }, true);

  const enviado = new URLSearchParams(window.location.search).get("enviado");
  if (enviado === "1") {
    const leadKey = "ra_ga4_generate_lead:" + window.location.pathname;
    if (!window.sessionStorage.getItem(leadKey)) {
      window.sessionStorage.setItem(leadKey, "1");
      send("generate_lead", {
        lead_type: "web_form",
        form_name: "cotizacion:" + pageProduct(),
        form_location: "confirmation",
      });
    }
  }

  const startedForms = new WeakSet();
  document.addEventListener("focusin", (event) => {
    const form = event.target.closest?.("form");
    if (!quoteForm(form) || startedForms.has(form)) return;
    startedForms.add(form);
    send("quote_start", { form_name: formName(form), form_location: sectionName(form) });
  }, true);

  const ensureHoneypot = (form) => {
    if (form.querySelector('input[name="website"]')) return;
    const field = document.createElement("input");
    field.type = "text";
    field.name = "website";
    field.tabIndex = -1;
    field.autocomplete = "off";
    field.setAttribute("aria-hidden", "true");
    field.style.position = "absolute";
    field.style.left = "-9999px";
    field.style.width = "1px";
    field.style.height = "1px";
    form.appendChild(field);
  };

  document.querySelectorAll("form").forEach((form) => {
    if (quoteForm(form)) ensureHoneypot(form);
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!quoteForm(form)) return;

    send("quote_submit", {
      form_name: formName(form),
      form_location: sectionName(form),
      transport_type: "fetch_then_formsubmit",
    });

    if (form.dataset.captacionProcesada === "1") return;
    event.preventDefault();
    form.dataset.captacionProcesada = "1";

    const data = new FormData(form);
    const touch = firstTouch();
    const payload = {
      submission_id: uuid(),
      // Cada lead tiene su propia captura. visitor_id conserva continuidad sin bloquear
      // dos consultas legítimas distintas dentro de la misma sesión.
      captacion_id: uuid(),
      visitor_id: visitorId,
      nombre: cleanText(data.get("nombre"), 100),
      telefono: cleanText(data.get("telefono"), 40),
      cobertura: cleanText(data.get("cobertura") || pageProduct(), 120),
      mensaje: cleanText(data.get("mensaje"), 1500),
      website: cleanText(data.get("website"), 100),
      form_path: window.location.pathname,
      landing_path: touch.landing_path || window.location.pathname,
      referrer: touch.referrer || "",
      utm_source: touch.utm_source || "",
      utm_medium: touch.utm_medium || "",
      utm_campaign: touch.utm_campaign || "",
      utm_content: touch.utm_content || "",
      utm_term: touch.utm_term || "",
    };

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(CAPTACION_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!response.ok) console.error("CAPT-011 ingreso web rechazado", response.status);
    } catch (error) {
      console.error("CAPT-011 ingreso web no disponible", error);
    } finally {
      window.clearTimeout(timer);
      // Conserva FormSubmit como respaldo de entrega al productor aunque el CRM falle.
      HTMLFormElement.prototype.submit.call(form);
    }
  }, true);
})();
