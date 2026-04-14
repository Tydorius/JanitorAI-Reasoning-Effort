(function() {
  const originalFetch = window.fetch;

  window.fetch = async function(...args) {
    let [resource, config] = args;
    
    // Determine the URL string
    let url = '';
    if (typeof resource === 'string' || resource instanceof String) {
      url = resource;
    } else if (resource instanceof URL) {
      url = resource.href;
    } else if (resource instanceof Request) {
      url = resource.url;
    }

    // Check if this is a chat completion request
    if (url && (url.includes('/chat/completions') || url.includes('/api/v1/chat'))) {
      try {
        let bodyToParse = null;
        let isRequestObject = false;

        if (resource instanceof Request) {
          isRequestObject = true;
          // Clone request to read body safely
          const clone = resource.clone();
          bodyToParse = await clone.text();
        } else if (config && config.body) {
          bodyToParse = config.body;
        }

        if (bodyToParse && typeof bodyToParse === 'string') {
          const bodyJson = JSON.parse(bodyToParse);
          const model = bodyJson.model;

          if (model) {
             window.postMessage({ type: 'JANITOR_REASONING_OBSERVED_MODEL', model: model }, '*');
          }

          // Check if model exists in our config
          let datasetConfig = {};
          try {
            const configStr = document.documentElement.dataset.janitorReasoningConfig;
            if (configStr) {
              datasetConfig = JSON.parse(configStr);
            }
          } catch (e) {
            console.error('[Janitor Reasoning Interceptor] Error parsing config from dataset:', e);
          }
          
          const effort = datasetConfig[model];
            
          if (effort && effort !== 'none') {
            // Inject reasoning_effort
            bodyJson.reasoning_effort = effort;
            const newBody = JSON.stringify(bodyJson);

            // Reconstruct the request
            if (isRequestObject) {
              // Request bodies are immutable; a new Request must be constructed.
              const newRequest = new Request(resource, { body: newBody });
              args[0] = newRequest;
            } else {
              config = config || {};
              config.body = newBody;
              args[1] = config;
            }
            console.log(`[Janitor Reasoning Interceptor] Injected reasoning_effort="${effort}" for model "${model}"`);
          }
        }
      } catch (e) {
        console.error('[Janitor Reasoning Interceptor] Failed to intercept fetch:', e);
      }
    }

    return originalFetch.apply(this, args);
  };

})();
