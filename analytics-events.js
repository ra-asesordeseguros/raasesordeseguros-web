(() => {
  if (window.__raAnalyticsEventsLoaded) return;
  window.__raAnalyticsEventsLoaded = true;

  const cleanText = (value, max = 80) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);

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

  document.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest?.("a[href]");
      if (!link) return;

      const href = String(link.getAttribute("href") || "").trim();
      const common = {
        cta_text: cleanText(link.textContent || link.getAttribute("aria-label") || "sin_texto"),
        cta_location: sectionName(link),
      };

      if (/^https:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)/i.test(href)) {
        send("whatsapp_click", common);
        return;
      }

      if (/^tel:/i.test(href)) {
        send("phone_click", common);
        return;
      }

      if (/^mailto:/i.test(href)) {
        send("email_click", common);
      }
    },
    true,
  );

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

  document.addEventListener(
    "focusin",
    (event) => {
      const form = event.target.closest?.("form");
      if (!quoteForm(form) || startedForms.has(form)) return;

      startedForms.add(form);
      send("quote_start", {
        form_name: formName(form),
        form_location: sectionName(form),
      });
    },
    true,
  );

  document.addEventListener(
    "submit",
    (event) => {
      const form = event.target;
      if (!quoteForm(form)) return;

      send("quote_submit", {
        form_name: formName(form),
        form_location: sectionName(form),
        transport_type: "beacon",
      });
    },
    true,
  );
})();
