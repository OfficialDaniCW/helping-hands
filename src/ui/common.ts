// Shared building blocks for Helping Hands' webview dialogs.
//
// Small one-off dialogs (rename, confirm, colour pick, prompts…) are built
// here as plain template strings so we don't need a dedicated .html file —
// and therefore a dedicated esbuild text-import — for every tiny popup.
// The larger panels (settings, device menu, menu editor, timer, scale
// helper) live in their own files under src/ui/*.html.

export const LIVE_CSS_VARS = `
  --p-live-ui-bg: hsl(0, 0%, 21%);
  --p-live-control-bg: hsl(0, 0%, 16%);
  --p-live-input-bg: hsl(0, 0%, 12%);
  --p-live-text-primary: hsl(0, 0%, 71%);
  --p-live-control-border: hsl(0, 0%, 7%);
  --p-live-text-secondary: hsl(0, 0%, 41%);
  --p-live-accent-primary: hsl(31, 100%, 67%);
  --p-live-control-text--enabled: hsl(0, 0%, 7%);
`;

export const BASE_STYLES = `
  :root {${LIVE_CSS_VARS}}
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background-color: var(--p-live-ui-bg);
    color: var(--p-live-text-primary);
    font-family: "AbletonSansSmall", sans-serif;
    font-size: 11.5px;
    font-weight: 500;
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 { color: var(--p-live-text-primary); font-weight: 600; margin: 0 0 0.6em; }
  p { margin: 0 0 0.6em; }
  .alx-row { display: flex; align-items: center; gap: 0.5em; }
  .alx-col { display: flex; flex-direction: column; gap: 0.5em; }
  .alx-spacer { flex: 1; }
  .alx-muted { color: var(--p-live-text-secondary); }
  .alx-divider { border: none; border-top: 1px solid var(--p-live-control-border); margin: 0.6em 0; }

  .alx-button {
    background-color: var(--p-live-control-bg);
    color: var(--p-live-text-primary);
    border: 1px solid var(--p-live-control-border);
    height: 22px;
    padding: 0 1.1em;
    border-radius: 1em;
    cursor: pointer;
    font-family: inherit;
    font-size: inherit;
    font-weight: 500;
  }
  .alx-button:hover { color: var(--p-live-text-primary); border-color: var(--p-live-accent-primary); }
  .alx-button:active,
  .alx-button.alx-button--active {
    color: var(--p-live-control-text--enabled);
    background-color: var(--p-live-accent-primary);
    border-color: var(--p-live-accent-primary);
  }
  .alx-button--primary {
    color: var(--p-live-control-text--enabled);
    background-color: var(--p-live-accent-primary);
    border-color: var(--p-live-accent-primary);
  }
  .alx-button:disabled { opacity: 0.4; cursor: default; }

  .alx-input, .alx-select, textarea.alx-input {
    background-color: var(--p-live-input-bg);
    color: var(--p-live-text-primary);
    border: 1px solid var(--p-live-control-border);
    height: 22px;
    padding: 0 0.5em;
    border-radius: 0.25em;
    font-family: inherit;
    font-size: inherit;
  }
  textarea.alx-input { height: auto; padding: 0.4em 0.5em; resize: vertical; }

  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-thumb { background: var(--p-live-control-bg); border-radius: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
`;

/** Cross-platform message bridge — required in every Helping Hands dialog. */
export const BRIDGE_SCRIPT = `
  function sendToLive(message) {
    if (window.webkit?.messageHandlers?.live) {
      window.webkit.messageHandlers.live.postMessage(message);
    } else if (window.chrome?.webview) {
      window.chrome.webview.postMessage(message);
    }
  }
  function closeWithResult(result) {
    sendToLive({ method: "close_and_send", params: [JSON.stringify(result)] });
  }
`;

/**
 * Wraps a body fragment and optional script into a full HTML document with
 * the Live-styled base CSS and the sendToLive/closeWithResult bridge baked in.
 */
export function renderDialog(options: { title: string; body: string; style?: string; script?: string }): string {
  const { title, body, style = "", script = "" } = options;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>${BASE_STYLES}\n${style}</style>
</head>
<body>
${body}
<script>
${BRIDGE_SCRIPT}
${script}
</script>
</body>
</html>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function dataUrl(html: string): string {
  return `data:text/html,${encodeURIComponent(html)}`;
}
