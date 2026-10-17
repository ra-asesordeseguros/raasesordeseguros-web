(() => {
  if (window.__raGuidesAccessLoaded) return;
  window.__raGuidesAccessLoaded = true;

  const style = document.createElement('style');
  style.textContent = `
    .ra-guides-link{white-space:nowrap;}
    .ra-guides-gateway{background:#f7f5f0;padding:54px 24px;border-bottom:1px solid rgba(15,39,72,.06);}
    .ra-guides-gateway-inner{max-width:980px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:32px;align-items:center;}
    .ra-guides-label{font-size:11px;font-weight:800;letter-spacing:3px;text-transform:uppercase;color:#6fa32e;margin-bottom:12px;}
    .ra-guides-title{font-size:clamp(25px,3.2vw,39px);font-weight:900;line-height:1.12;letter-spacing:-1px;color:#0f2748;margin-bottom:14px;}
    .ra-guides-title span{color:#8DC63F;}
    .ra-guides-copy{font-size:15px;line-height:1.8;color:#64748b;max-width:610px;}
    .ra-guides-actions{display:flex;flex-direction:column;gap:10px;}
    .ra-guide-action{display:flex;align-items:center;justify-content:space-between;gap:16px;background:#fff;border:1.5px solid rgba(15,39,72,.09);border-radius:16px;padding:16px 18px;text-decoration:none;color:#0f2748;font-size:13px;font-weight:800;transition:.22s ease;}
    .ra-guide-action:hover{transform:translateY(-2px);border-color:#8DC63F;box-shadow:0 10px 28px rgba(15,39,72,.08);}
    .ra-guide-action b{color:#6fa32e;font-size:18px;}
    .ra-guide-action.all{background:#0f2748;color:#fff;border-color:#0f2748;}
    .ra-guide-action.all b{color:#8DC63F;}
    @media(max-width:760px){
      .ra-guides-gateway{padding:40px 20px;}
      .ra-guides-gateway-inner{grid-template-columns:1fr;gap:22px;}
      .ra-guides-copy{font-size:14px;}
    }
    @media(max-width:600px){
      .nav{gap:10px;}
      .nav-logo{height:46px;}
      .nav-links{gap:9px;}
      .nav-link.ra-guides-link{display:inline-flex!important;align-items:center;color:#fff;font-size:11.5px;font-weight:800;padding:8px 10px;border:1px solid rgba(255,255,255,.22);border-radius:999px;text-shadow:none;}
      .nav-link.ra-guides-link:hover{border-color:#8DC63F;color:#8DC63F;}
      .nav-cta{font-size:11.5px;padding:9px 13px;}
    }
    @media(max-width:390px){
      .nav{padding-left:12px!important;padding-right:12px!important;}
      .nav-logo{height:42px;padding:3px 6px;}
      .nav-link.ra-guides-link{font-size:10.5px;padding:7px 8px;}
      .nav-cta{font-size:10.5px;padding:8px 10px;}
    }
  `;
  document.head.appendChild(style);

  document.querySelectorAll('a.nav-link[href*="novedades"]').forEach((link) => {
    link.textContent = 'Dudas y guías';
    link.classList.add('ra-guides-link');
  });

  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const isHome = path === '/' || path.endsWith('/index.html');
  const isGuidesIndex = path === '/novedades' || path === '/novedades/index.html';
  const isGuideArticle = path.startsWith('/novedades/') && !isGuidesIndex;

  if (isHome && !document.querySelector('.ra-guides-gateway')) {
    const hero = document.querySelector('.hero');
    if (hero) {
      const section = document.createElement('section');
      section.className = 'ra-guides-gateway';
      section.id = 'dudas-guias';
      section.innerHTML = `
        <div class="ra-guides-gateway-inner">
          <div>
            <div class="ra-guides-label">Dudas y guías</div>
            <h2 class="ra-guides-title">¿Tenés una duda sobre tu seguro?<br><span>Capaz ya la respondimos.</span></h2>
            <p class="ra-guides-copy">Respuestas simples a problemas reales: qué hacer si chocás, cómo funciona una cobertura, qué significa una franquicia y otras preguntas que aparecen todos los días.</p>
          </div>
          <div class="ra-guides-actions">
            <a class="ra-guide-action" href="/novedades/que-hacer-si-tenes-un-siniestro/">Me chocaron, ¿qué hago? <b>→</b></a>
            <a class="ra-guide-action" href="/novedades/terceros-completos-o-todo-riesgo/">Terceros completo o todo riesgo <b>→</b></a>
            <a class="ra-guide-action all" href="/novedades/">Ver todas las dudas y guías <b>→</b></a>
          </div>
        </div>`;
      hero.insertAdjacentElement('afterend', section);
    }
  }

  if (isGuidesIndex) {
    const kicker = document.querySelector('.mh-kicker');
    if (kicker) kicker.innerHTML = '<a href="/">Inicio</a> · Dudas y guías';
    const title = document.querySelector('.mh-h1');
    if (title) title.innerHTML = 'Dudas y guías,<br><span>sin letra chica.</span>';
    const sub = document.querySelector('.mh-sub');
    if (sub) sub.textContent = 'Preguntas reales sobre seguros, respondidas de forma clara y práctica. Sin lenguaje de compañía y sin vueltas.';
  }

  if (isGuideArticle) {
    const kicker = document.querySelector('.mh-kicker');
    if (kicker) kicker.innerHTML = '<a href="/">Inicio</a> · <a href="/novedades/">Dudas y guías</a>';
  }
})();
