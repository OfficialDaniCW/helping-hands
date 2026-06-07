// Small, focused dialog builders shared across the action modules. Each
// returns a full HTML document string ready to be wrapped in a data: URL and
// passed to `context.ui.showModalDialog`.

import { escapeHtml, renderDialog } from "./common.js";

/** A single text-input prompt. Resolves to `{ value: string | null }`. */
export function promptDialog(options: { title: string; label: string; initialValue?: string; placeholder?: string }): string {
  const { title, label, initialValue = "", placeholder = "" } = options;
  return renderDialog({
    title,
    body: `
      <div class="alx-col">
        <h2>${escapeHtml(title)}</h2>
        <label class="alx-muted">${escapeHtml(label)}</label>
        <input id="value" class="alx-input" type="text" value="${escapeHtml(initialValue)}" placeholder="${escapeHtml(placeholder)}" />
        <div class="alx-row" style="margin-top: 0.4em; justify-content: flex-end;">
          <button class="alx-button" id="cancel">Cancel</button>
          <button class="alx-button alx-button--primary" id="ok">OK</button>
        </div>
      </div>`,
    script: `
      const input = document.getElementById("value");
      input.focus();
      input.select();
      function submit() { closeWithResult({ value: input.value }); }
      document.getElementById("ok").addEventListener("click", submit);
      document.getElementById("cancel").addEventListener("click", () => closeWithResult({ value: null }));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") closeWithResult({ value: null });
      });
    `,
  });
}

/** A yes/no confirmation. Resolves to `{ confirmed: boolean }`. */
export function confirmDialog(options: { title: string; message: string; confirmLabel?: string; cancelLabel?: string }): string {
  const { title, message, confirmLabel = "Confirm", cancelLabel = "Cancel" } = options;
  return renderDialog({
    title,
    body: `
      <div class="alx-col">
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
        <div class="alx-row" style="justify-content: flex-end;">
          <button class="alx-button" id="cancel">${escapeHtml(cancelLabel)}</button>
          <button class="alx-button alx-button--primary" id="ok">${escapeHtml(confirmLabel)}</button>
        </div>
      </div>`,
    script: `
      document.getElementById("ok").addEventListener("click", () => closeWithResult({ confirmed: true }));
      document.getElementById("cancel").addEventListener("click", () => closeWithResult({ confirmed: false }));
      document.addEventListener("keydown", (e) => {
        if (e.key === "Enter") closeWithResult({ confirmed: true });
        if (e.key === "Escape") closeWithResult({ confirmed: false });
      });
    `,
  });
}

/** A purely informational dialog with a single "OK"/"Close" acknowledgement. */
export function infoDialog(options: { title: string; bodyHtml: string; closeLabel?: string }): string {
  const { title, bodyHtml, closeLabel = "Close" } = options;
  return renderDialog({
    title,
    body: `
      <div class="alx-col">
        <h2>${escapeHtml(title)}</h2>
        <div>${bodyHtml}</div>
        <div class="alx-row" style="justify-content: flex-end;">
          <button class="alx-button alx-button--primary" id="ok">${escapeHtml(closeLabel)}</button>
        </div>
      </div>`,
    script: `
      document.getElementById("ok").addEventListener("click", () => closeWithResult({ acknowledged: true }));
      document.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === "Escape") closeWithResult({ acknowledged: true }); });
    `,
  });
}

const SWATCHES: { label: string; value: number }[] = [
  { label: "Red", value: 0xff4747 },
  { label: "Orange", value: 0xff7c30 },
  { label: "Amber", value: 0xffb02e },
  { label: "Yellow", value: 0xfde94c },
  { label: "Lime", value: 0xa0e92e },
  { label: "Green", value: 0x2ecc71 },
  { label: "Teal", value: 0x2ecccb },
  { label: "Cyan", value: 0x29c5f6 },
  { label: "Blue", value: 0x4a90e2 },
  { label: "Violet", value: 0x9b6bf2 },
  { label: "Magenta", value: 0xe93ec0 },
  { label: "Pink", value: 0xff6fa5 },
  { label: "Grey", value: 0xb0b0b0 },
  { label: "White", value: 0xffffff },
];

/** A swatch-grid colour picker. Resolves to `{ color: number | null }`. */
export function colourPickerDialog(title = "Choose a Colour"): string {
  const swatchHtml = SWATCHES.map(
    (s) => `<button class="swatch" data-color="${s.value}" title="${escapeHtml(s.label)}" style="background:#${s.value.toString(16).padStart(6, "0")}"></button>`,
  ).join("");

  return renderDialog({
    title,
    style: `
      .swatches { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.4em; }
      .swatch {
        width: 28px; height: 28px; border-radius: 0.3em;
        border: 1px solid var(--p-live-control-border);
        cursor: pointer;
      }
      .swatch:hover { outline: 2px solid var(--p-live-accent-primary); outline-offset: 1px; }
    `,
    body: `
      <div class="alx-col">
        <h2>${escapeHtml(title)}</h2>
        <div class="swatches">${swatchHtml}</div>
        <div class="alx-row" style="justify-content: flex-end;">
          <button class="alx-button" id="cancel">Cancel</button>
        </div>
      </div>`,
    script: `
      document.querySelectorAll(".swatch").forEach((el) => {
        el.addEventListener("click", () => closeWithResult({ color: parseInt(el.dataset.color, 10) }));
      });
      document.getElementById("cancel").addEventListener("click", () => closeWithResult({ color: null }));
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeWithResult({ color: null }); });
    `,
  });
}

/**
 * Lists a numbered checklist of manual steps the user needs to complete (e.g.
 * VSTs that can't be auto-inserted). Resolves to `{ acknowledged: true }`.
 */
export function manualStepsDialog(options: { title: string; intro: string; steps: string[] }): string {
  const { title, intro, steps } = options;
  const stepsHtml = steps
    .map((step, i) => `<li><label><input type="checkbox" /> ${escapeHtml(step)}</label></li>`)
    .join("");
  return infoDialog({
    title,
    bodyHtml: `
      <p>${escapeHtml(intro)}</p>
      <ol style="padding-left: 1.4em; margin: 0;">${stepsHtml}</ol>
    `,
  });
}
