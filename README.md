# JanitorAI Reasoning Effort Extension

## Project Context & Objective
JanitorAI uses standard completion API payloads (`/chat/completions`) for text generation but currently lacks native UI support for injecting emerging fields like `reasoning_effort` or `thinking` used by modern models (e.g., `o1`, `o3-mini`, `claude-3-7-sonnet`).

**Objective:** Build a Firefox extension (Manifest V3) that allows users to configure a mapping of models to reasoning effort levels (`low`, `medium`, `high`, or `none`). The extension intercepts outgoing API requests on JanitorAI, reads the configured model from the JSON payload, injects the corresponding reasoning parameter into the POST body, and forwards the modified request.

## Core Technical Challenge: The "Monkey-Patch" Architecture
The Extension API (`webRequest`) **cannot** modify the *body* of POST requests. Therefore, we must intercept the `window.fetch` call directly within the webpage's environment.

To do this securely and successfully in Firefox MV3 without CSP violations, we use a two-script injection architecture:

### 1. The Injector (Isolated World Content Script)
`content-scripts/injector.js`
*   **Permissions Context:** Runs in the isolated extension world. It has access to `browser.storage.local`.
*   **Responsibility 1:** Retrieve the user's reasoning settings from `browser.storage.local`.
*   **Responsibility 2:** Pass these settings to the webpage’s main world. This is typically done by embedding a `<script>` tag containing the settings as a JSON string, or writing them to a hidden `<div id="janitor-reasoning-settings" data-config="..."></div>` in the DOM.
*   **Responsibility 3:** Inject the main interceptor script (`interceptor.js`) into the webpage by appending a `<script src="chrome-extension://.../content-scripts/interceptor.js">` tag to the document head or body.

### 2. The Interceptor (Main World Script)
`content-scripts/interceptor.js`
*   **Permissions Context:** Runs in the standard webpage "Main" world. It shares the same `window` object as the JanitorAI frontend but *does not* have access to Extension APIs like `browser.storage`.
*   **Responsibility 1:** Read the settings injected by the Injector (e.g., by checking the DOM or reading a custom `window.CustomSettings` object).
*   **Responsibility 2:** Monkey-patch `window.fetch` (and optionally `window.XMLHttpRequest.prototype.send` if Janitor uses it, though modern apps overwhelmingly use `fetch`).
    ```javascript
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        // ... interception logic ...
        return originalFetch.apply(this, args);
    }
    ```
*   **Responsibility 3 (Interception Logic):**
    *   Check if the request URL targets the chat completion endpoint (e.g., `/chat/completions`, `/api/v1/chat`, or Janitor's specific proxies).
    *   If it matches, clone the request, parse the JSON `body`.
    *   Extract the `model` property from the JSON.
    *   Look up the `model` in the configured settings.
    *   If a setting exists (e.g., `reasoning_effort: "high"`), inject it into the JSON object.
    *   Stringify the modified JSON, replace the request body, and pass it to `originalFetch`.

### 3. The Settings UI (Popup)
`popup/popup.html`, `popup.css`, `popup.js`
*   **UI Elements:** A dynamic list where the user can view auto-populated proxy models, and a button to clear them.
*   **Interaction:** User toggles a dropdown for `Reasoning Effort: None / Low / Medium / High` per configured model.
*   **Persistence:** Saves this JSON mapping to `browser.storage.local`.

## Current File Structure
```text
Janitor_AI_Reasoning_Effort/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
└── content-scripts/
    ├── scraper.js
    ├── injector.js
    └── interceptor.js
```
