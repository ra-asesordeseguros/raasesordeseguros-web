(() => {
  const load = (src) => {
    if (document.querySelector(`script[data-ra-loader="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.dataset.raLoader = src;
    document.head.appendChild(script);
  };

  load('/analytics-core.js');
  load('/ui-guides-access.js');
})();
