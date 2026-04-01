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
        // We need to parse the body to inject the model settings
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
              // If it was a Request object, we must construct a new Request
              // because we cannot mutate the body of an existing Request.
              const newRequest = new Request(resource, { body: newBody });
              args[0] = newRequest;
            } else {
              // It was just a string/URL + config object
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

    // Call original fetch with modified or unmodified args
    return originalFetch.apply(this, args);
  };

  // Scan localStorage for proxy model configurations
  function scanLocalStorageForModels() {
    const urls = ['openrouter.ai', 'chutes.ai', 'z.ai', 'googleapis.com', 'deepseek.com'];

    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            if (!value || !value.includes('{')) continue;

            // Avoid parsing large generic string blocks
            if (!urls.some(u => value.includes(u)) && !value.includes('chat/completions')) continue;

            try {
                const parsed = JSON.parse(value);
                
                // Recursively extract model strings
                function extract(obj) {
                    if (typeof obj === 'object' && obj !== null) {
                        
                        // Check if object represents a proxy configuration
                        const hasApi = ('apiUrl' in obj) || ('url' in obj) || ('endpoint' in obj) || ('apiKey' in obj) || ('key' in obj) || ('reverseProxy' in obj);
                        
                        if (hasApi) {
                            // It's a proxy config object, so 'id' or 'name' is likely the model
                            for (const k in obj) {
                                if (k === 'id' || k === 'model' || k === 'modelId' || k === 'customModel' || k === 'name') {
                                    const val = obj[k];
                                    if (typeof val === 'string' && val.length > 2 && val.length < 100 && !val.includes(' ') && !val.startsWith('http')) {
                                        window.postMessage({ type: 'JANITOR_REASONING_OBSERVED_MODEL', model: val }, '*');
                                    }
                                }
                            }
                        }
                        
                        for (const k in obj) {
                            // Unconditional check for highly specific model keys
                            if (k === 'model' || k === 'modelId' || k === 'customModel' || k === 'proxyModel') {
                                if (typeof obj[k] === 'string' && obj[k] && obj[k].length > 2 && obj[k].length < 100 && !obj[k].includes(' ')) {
                                    window.postMessage({ type: 'JANITOR_REASONING_OBSERVED_MODEL', model: obj[k] }, '*');
                                }
                            }
                            // Don't recurse excessively deeply
                            if (typeof obj[k] === 'object') {
                                extract(obj[k]);
                            }
                        }
                    }
                }
                extract(parsed);
            } catch (e) {}
        }
    } catch (e) {
        console.error('[Janitor Reasoning Interceptor] Error scanning localStorage:', e);
    }
  }

  // Run scanner periodically
  setInterval(scanLocalStorageForModels, 3000);
})();
