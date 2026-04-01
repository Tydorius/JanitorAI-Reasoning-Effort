(async function init() {
  try {
    const result = await browser.storage.local.get('reasoningConfig');
    const config = result.reasoningConfig || {};

    // Inject settings into dataset
    document.documentElement.dataset.janitorReasoningConfig = JSON.stringify(config);

    // Inject interceptor
    const interceptorScript = document.createElement('script');
    interceptorScript.src = browser.runtime.getURL('content-scripts/interceptor.js');
    interceptorScript.onload = function() {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(interceptorScript);

    // Listen for storage changes
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.reasoningConfig) {
        const newConfig = changes.reasoningConfig.newValue || {};
        document.documentElement.dataset.janitorReasoningConfig = JSON.stringify(newConfig);
      }
    });

  } catch (e) {
    console.error('[Janitor Reasoning Injector] Initialization failed:', e);
  }
})();
