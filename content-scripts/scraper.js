(function() {
  let syncPending = false;

  async function syncModelsToStorage(observedModels) {
    if (syncPending || !observedModels || observedModels.length === 0) return;
    syncPending = true;
    try {
      const result = await browser.storage.local.get('reasoningConfig');
      const config = result.reasoningConfig || {};
      let changed = false;

      for (const model of observedModels) {
        if (!config.hasOwnProperty(model)) {
          config[model] = 'none'; // Default to none
          changed = true;
        }
      }

      if (changed) {
        await browser.storage.local.set({ reasoningConfig: config });
        console.log('[Janitor Reasoning Scraper] Synced new models to storage:', Array.from(observedModels));
      }
    } catch (e) {
      console.error('[Janitor Reasoning Scraper] Failed to sync models', e);
    } finally {
      syncPending = false;
    }
  }

  function scanPanelForModels() {
    // Partial class match handles the build-hash suffix in CSS module class names.
    const modelEls = document.querySelectorAll('[class*="_configCardModel_"]');
    if (modelEls.length === 0) return;
    const models = [];
    modelEls.forEach(el => {
      const text = el.textContent.trim();
      // Model IDs are non-empty, under 200 chars, and contain no spaces.
      if (text && text.length > 1 && text.length < 200 && !text.includes(' ')) {
        models.push(text);
      }
    });
    if (models.length > 0) {
      syncModelsToStorage(models);
    }
  }

  // Fallback poll for panels already open at page load.
  setInterval(scanPanelForModels, 2000);

  // Immediate scan on panel insertion.
  const observer = new MutationObserver(() => {
    if (document.querySelector('[class*="_configCardModel_"]')) {
      scanPanelForModels();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Model names broadcast by interceptor.js from live fetch calls.
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.type === 'JANITOR_REASONING_OBSERVED_MODEL') {
      const model = event.data.model;
      if (model && typeof model === 'string') {
        syncModelsToStorage([model]);
      }
    }
  });

})();
