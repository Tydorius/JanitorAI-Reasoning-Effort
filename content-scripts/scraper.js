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

  function scrapeModels() {
    const fullText = document.body.innerText || "";
    
    // Match model names immediately preceding an API URL
    const regex = /([a-zA-Z0-9\/\.\-:]+)[\s\n\r]{0,10}https?:\/\/[^\s]+/g;
    let match;
    const currentFound = [];
    
    while ((match = regex.exec(fullText)) !== null) {
      const model = match[1].trim();
      // Clean string
      const cleanModel = model.split(/[\s\n\r]+/).pop().trim();
      if (cleanModel && cleanModel.length > 2 && cleanModel !== 'http' && !cleanModel.startsWith('http')) {
        currentFound.push(cleanModel);
      }
    }
    
    if (currentFound.length > 0) {
      syncModelsToStorage(currentFound);
    }
  }

  // Poll DOM for changes
  setInterval(scrapeModels, 2000);
  
  // Listen for interceptor detection events
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
