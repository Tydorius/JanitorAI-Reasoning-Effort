# JanitorAI Reasoning Effort Extension

A Firefox extension (Manifest V3) that intercepts JanitorAI's outgoing chat completion requests and injects a `reasoning_effort` field into the request body on a per-model basis.

`reasoning_effort` is an OpenAI-compatible parameter supported by certain providers and reasoning models (OpenRouter, o1/o3-series, DeepSeek R1, etc.). It has no effect on models that do not support it and can be left at `None` for those.

## Installation

1. Navigate to `about:debugging#/runtime/this-firefox` in Firefox.
2. Click **Load Temporary Add-on** and select `manifest.json` from this directory.

To reload after changes, click **Reload** on the extension card at `about:debugging`.

## Usage

1. Navigate to a JanitorAI chat page (`janitorai.com/chats/*`).
2. Open the **API Settings** panel and select the **Proxy** tab. The extension reads the model IDs from the rendered config cards and registers any new ones automatically.
3. Click the extension icon. Each detected model appears with a dropdown set to `None` by default.
4. Set the desired effort level (`Low`, `Medium`, or `High`) for each model. The setting is saved immediately.
5. On the next chat request using that model, `reasoning_effort` is injected into the outgoing API call body.

Models can also be detected automatically when a chat request is sent, without opening the settings panel first.

## Architecture

The Extension `webRequest` API cannot modify POST request bodies, so the extension monkey-patches `window.fetch` directly inside the page's execution context. This requires a two-script architecture to bridge the extension's isolated world and the page's main world.

### content-scripts/injector.js

Runs at `document_start` in the isolated extension world. Reads the reasoning config from `browser.storage.local`, writes it to `document.documentElement.dataset.janitorReasoningConfig`, then injects `interceptor.js` into the page as a `<script>` tag. Listens for storage changes and keeps the dataset attribute current.

### content-scripts/interceptor.js

Runs in the page's main world (no access to extension APIs). Monkey-patches `window.fetch` to intercept requests matching `/chat/completions` or `/api/v1/chat`. On a matching request, parses the JSON body, reads the effort level for the model from the dataset attribute set by `injector.js`, and injects `reasoning_effort` if the level is not `none`. Broadcasts the observed model name via `window.postMessage` so `scraper.js` can register it.

### content-scripts/scraper.js

Runs in the isolated extension world alongside `injector.js`. Discovers proxy model IDs two ways:

- **DOM scan:** queries `[class*="_configCardModel_"]` elements from the proxy config panel when it is open. A `MutationObserver` triggers an immediate scan when the panel is added to the DOM; a 2-second interval poll handles panels open at load time. The partial class selector is intentional — JanitorAI uses CSS modules with a build-hash suffix that changes across deploys.
- **postMessage:** listens for `JANITOR_REASONING_OBSERVED_MODEL` messages broadcast by `interceptor.js` when a live chat request is intercepted.

Newly discovered model IDs are written to `browser.storage.local` with a default effort of `none`.

### popup/

Reads `browser.storage.local` and renders a list of known models with per-model effort dropdowns. Changes are written to storage immediately. Individual models can be removed with the X button; all models can be cleared with the Clear All button.

## File Structure

```
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
└── content-scripts/
    ├── injector.js
    ├── interceptor.js
    └── scraper.js
```
