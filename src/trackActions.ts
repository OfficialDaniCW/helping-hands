import {
  AudioTrack,
  Device,
  MidiTrack,
  Track,
  type ExtensionContext,
  type Handle,
} from "@ableton-extensions/sdk";

import { colourPickerDialog, infoDialog, promptDialog } from "./ui/dialogs.js";
import { dataUrl, escapeHtml } from "./ui/common.js";
import type { ChainDeviceEntry, MenuCategoryEntry, MenuConfig } from "./types.js";
import { loadMenuConfig, saveMenuConfig } from "./config.js";

type Ctx = ExtensionContext<"1.0.0">;

/** Built-in Live device names, used to guess `isBuiltIn` when capturing a chain. */
export const KNOWN_BUILTIN_DEVICES = [
  "Wavetable", "Operator", "Analog", "Simpler", "Sampler", "Drum Rack", "Tension",
  "Collision", "Electric", "Impulse",
  "EQ Eight", "EQ Three", "Compressor", "Glue Compressor", "Limiter",
  "Multiband Dynamics", "Auto Filter", "Reverb", "Echo", "Delay", "Saturator",
  "Redux", "Utility", "Gate", "Corpus", "Vinyl Distortion", "Erosion",
  "Beat Repeat", "Frequency Shifter", "Grain Delay", "Phaser-Flanger", "Chorus-Ensemble",
  "Arpeggiator", "Chord", "Scale", "Pitch", "Note Length", "Velocity", "Random",
  "Audio Effect Rack", "Instrument Rack", "MIDI Effect Rack", "Drum Buss",
] as const;

function resolveTrack(context: Ctx, arg: unknown): Track<"1.0.0"> {
  return context.getObjectFromHandle(arg as Handle, Track);
}

// ---------------------------------------------------------------------------
// Clear All Clips
// ---------------------------------------------------------------------------

export function registerClearTrack(context: Ctx): void {
  context.commands.registerCommand("helping-hands.clearTrack", async (...args: unknown[]) => {
    const track = resolveTrack(context, args[0]);
    const clips = track.arrangementClips;
    if (clips.length === 0) return;

    const lastEnd = Math.max(...clips.map((c) => c.endTime));
    await context.withinTransaction(() => track.clearClipsInRange(0, lastEnd + 1));
  });
}

// ---------------------------------------------------------------------------
// Colour Clips to a chosen colour (Track.color does not exist in SDK 1.0.0,
// so we ask the user to pick instead of reading it from the track)
// ---------------------------------------------------------------------------

export function registerColourClips(context: Ctx): void {
  context.commands.registerCommand("helping-hands.colourClips", async (...args: unknown[]) => {
    const track = resolveTrack(context, args[0]);

    const result = await context.ui.showModalDialog(dataUrl(colourPickerDialog("Colour All Clips")), 320, 240);
    const { color } = JSON.parse(result) as { color: number | null };
    if (color === null || color === undefined) return;

    context.withinTransaction(() => {
      track.arrangementClips.forEach((clip) => {
        clip.color = color;
      });
      track.clipSlots.forEach((slot) => {
        if (slot.clip) slot.clip.color = color;
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Mute / Unmute toggle
// ---------------------------------------------------------------------------

export function registerToggleMute(context: Ctx): void {
  context.commands.registerCommand("helping-hands.toggleMute", (...args: unknown[]) => {
    const track = resolveTrack(context, args[0]);
    context.withinTransaction(() => {
      track.mute = !track.mute;
    });
  });
}

// ---------------------------------------------------------------------------
// Track Info (read-only overview)
// ---------------------------------------------------------------------------

export function registerTrackInfo(context: Ctx): void {
  context.commands.registerCommand("helping-hands.trackInfo", async (...args: unknown[]) => {
    const track = resolveTrack(context, args[0]);
    const song = context.application.song;

    const kind = track instanceof MidiTrack ? "MIDI Track" : track instanceof AudioTrack ? "Audio Track" : "Track";
    const deviceNames = track.devices.map((d) => d.name);
    const clipCount = track.arrangementClips.length + track.clipSlots.filter((s) => s.clip).length;

    const deviceListHtml = deviceNames.length
      ? `<ul style="margin:0;padding-left:1.2em;">${deviceNames.map((n) => `<li>${escapeHtml(n)}</li>`).join("")}</ul>`
      : `<p class="alx-muted">No devices on this track.</p>`;

    const html = infoDialog({
      title: "Track Info",
      bodyHtml: `
        <table style="border-collapse: collapse; width: 100%;">
          <tr><td class="alx-muted">Name</td><td>${escapeHtml(track.name)}</td></tr>
          <tr><td class="alx-muted">Type</td><td>${escapeHtml(kind)}</td></tr>
          <tr><td class="alx-muted">Devices</td><td>${deviceNames.length}</td></tr>
          <tr><td class="alx-muted">Clips</td><td>${clipCount}</td></tr>
          <tr><td class="alx-muted">Song Tempo</td><td>${song.tempo.toFixed(2)} BPM</td></tr>
          <tr><td class="alx-muted">Scale</td><td>${escapeHtml(song.scaleName)} ${song.scaleMode ? "(Scale Mode on)" : "(Scale Mode off)"}</td></tr>
        </table>
        <hr class="alx-divider" />
        <p class="alx-muted">Devices on this track:</p>
        ${deviceListHtml}
      `,
    });

    await context.ui.showModalDialog(dataUrl(html), 420, 440);
  });
}

// ---------------------------------------------------------------------------
// Save Device Chain as Template (capture mode)
// ---------------------------------------------------------------------------

function collectCategoryLabels(items: import("./types.js").MenuEntry[], prefix: string[] = []): string[] {
  const labels: string[] = [];
  for (const item of items) {
    if (item.type === "category") {
      const path = [...prefix, item.label];
      labels.push(path.join(" / "));
      labels.push(...collectCategoryLabels(item.items, path));
    }
  }
  return labels;
}

function findCategoryByPath(config: MenuConfig, labelPath: string): MenuCategoryEntry | undefined {
  const segments = labelPath.split(" / ");
  let items = config.items;
  let found: MenuCategoryEntry | undefined;
  for (const segment of segments) {
    found = items.find((i): i is MenuCategoryEntry => i.type === "category" && i.label === segment);
    if (!found) return undefined;
    items = found.items;
  }
  return found;
}

function buildCaptureDialog(deviceNames: string[], categories: string[]): string {
  const checklistHtml = deviceNames
    .map(
      (name, i) => `
      <label class="alx-row">
        <input type="checkbox" class="device-check" data-name="${escapeHtml(name)}" checked />
        <span>${escapeHtml(name)}</span>
      </label>`,
    )
    .join("");

  const categoryOptionsHtml = categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Save Device Chain as Template</title>
<style>
  :root { --p-live-ui-bg: hsl(0,0%,21%); --p-live-control-bg: hsl(0,0%,16%); --p-live-input-bg: hsl(0,0%,12%);
    --p-live-text-primary: hsl(0,0%,71%); --p-live-control-border: hsl(0,0%,7%); --p-live-text-secondary: hsl(0,0%,41%);
    --p-live-accent-primary: hsl(31,100%,67%); --p-live-control-text--enabled: hsl(0,0%,7%); }
  * { box-sizing: border-box; }
  body { margin:0; padding: 1em; background: var(--p-live-ui-bg); color: var(--p-live-text-primary);
    font-family: "AbletonSansSmall", sans-serif; font-size: 11.5px; }
  h2 { margin: 0 0 0.6em; }
  .alx-col { display:flex; flex-direction:column; gap:0.5em; }
  .alx-row { display:flex; align-items:center; gap:0.5em; }
  .alx-muted { color: var(--p-live-text-secondary); }
  .list { max-height: 160px; overflow-y: auto; border: 1px solid var(--p-live-control-border); border-radius: 0.3em; padding: 0.4em; }
  .alx-input, .alx-select { background: var(--p-live-input-bg); color: var(--p-live-text-primary);
    border: 1px solid var(--p-live-control-border); height: 22px; padding: 0 0.5em; border-radius: 0.25em; font: inherit; }
  .alx-button { background: var(--p-live-control-bg); color: var(--p-live-text-primary); border: 1px solid var(--p-live-control-border);
    height: 22px; padding: 0 1.1em; border-radius: 1em; cursor: pointer; font: inherit; }
  .alx-button--primary { color: var(--p-live-control-text--enabled); background: var(--p-live-accent-primary); border-color: var(--p-live-accent-primary); }
</style>
</head>
<body>
  <div class="alx-col">
    <h2>Save Device Chain as Template</h2>
    <label class="alx-muted">Chain name</label>
    <input id="chainName" class="alx-input" type="text" placeholder="e.g. My Vocal Chain" />
    <label class="alx-muted">Save under category</label>
    <select id="category" class="alx-select">${categoryOptionsHtml}</select>
    <label class="alx-muted">Devices to include (in order)</label>
    <div class="list">${checklistHtml || '<p class="alx-muted">This track has no devices.</p>'}</div>
    <div class="alx-row" style="justify-content:flex-end;">
      <button class="alx-button" id="cancel">Cancel</button>
      <button class="alx-button alx-button--primary" id="save">Save Chain</button>
    </div>
  </div>
  <script>
    function sendToLive(message) {
      if (window.webkit?.messageHandlers?.live) window.webkit.messageHandlers.live.postMessage(message);
      else if (window.chrome?.webview) window.chrome.webview.postMessage(message);
    }
    function closeWithResult(result) { sendToLive({ method: "close_and_send", params: [JSON.stringify(result)] }); }

    document.getElementById("cancel").addEventListener("click", () =>
      closeWithResult({ chainName: null, selectedDevices: [], category: "" }));

    document.getElementById("save").addEventListener("click", () => {
      const chainName = document.getElementById("chainName").value.trim();
      const category = document.getElementById("category").value;
      const selectedDevices = Array.from(document.querySelectorAll(".device-check:checked")).map((el) => el.dataset.name);
      closeWithResult({ chainName: chainName || null, selectedDevices, category });
    });
  </script>
</body>
</html>`;
}

export function registerCaptureChain(context: Ctx, reloadMenu: () => Promise<void>): void {
  context.commands.registerCommand("helping-hands.captureChain", async (...args: unknown[]) => {
    const storageDirectory = context.environment.storageDirectory;
    if (!storageDirectory) return;

    const track = resolveTrack(context, args[0]);
    const deviceNames = track.devices.map((d: Device<"1.0.0">) => d.name);

    const config = await loadMenuConfig(storageDirectory);
    let categories = collectCategoryLabels(config.items);
    if (categories.length === 0) categories = ["My Chains"];

    const html = buildCaptureDialog(deviceNames, categories);
    const raw = await context.ui.showModalDialog(dataUrl(html), 480, 460);
    const { chainName, selectedDevices, category } = JSON.parse(raw) as {
      chainName: string | null;
      selectedDevices: string[];
      category: string;
    };
    if (!chainName || selectedDevices.length === 0) return;

    const newChain = {
      type: "chain" as const,
      label: chainName,
      devices: selectedDevices.map((name): ChainDeviceEntry => ({
        deviceName: name,
        isBuiltIn: (KNOWN_BUILTIN_DEVICES as readonly string[]).includes(name),
        query: name,
      })),
    };

    let target = findCategoryByPath(config, category);
    if (!target) {
      target = { type: "category", label: category || "My Chains", items: [] };
      config.items.push(target);
    }
    target.items.push(newChain);

    await saveMenuConfig(storageDirectory, config);
    await reloadMenu();

    const ack = infoDialog({
      title: "Chain Saved",
      bodyHtml: `<p>Saved <strong>${escapeHtml(chainName)}</strong> with ${selectedDevices.length} device(s) to “${escapeHtml(target.label)}”.</p>`,
    });
    await context.ui.showModalDialog(dataUrl(ack), 360, 180);
  });
}

// ---------------------------------------------------------------------------
// Batch Rename Tracks (registered on Scene scope — operates on song.tracks)
// ---------------------------------------------------------------------------

function buildBatchRenameDialog(tracks: { name: string }[]): string {
  const rowsHtml = tracks
    .map(
      (t, i) => `
      <div class="alx-row">
        <span class="alx-muted" style="width: 1.6em; text-align: right;">${i + 1}.</span>
        <input class="alx-input rename-input" data-index="${i}" type="text" value="${escapeHtml(t.name)}" style="flex:1" />
      </div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Batch Rename Tracks</title>
<style>
  :root { --p-live-ui-bg: hsl(0,0%,21%); --p-live-control-bg: hsl(0,0%,16%); --p-live-input-bg: hsl(0,0%,12%);
    --p-live-text-primary: hsl(0,0%,71%); --p-live-control-border: hsl(0,0%,7%); --p-live-text-secondary: hsl(0,0%,41%);
    --p-live-accent-primary: hsl(31,100%,67%); --p-live-control-text--enabled: hsl(0,0%,7%); }
  * { box-sizing: border-box; }
  body { margin:0; padding: 1em; background: var(--p-live-ui-bg); color: var(--p-live-text-primary);
    font-family: "AbletonSansSmall", sans-serif; font-size: 11.5px; }
  h2 { margin: 0 0 0.6em; }
  .alx-col { display:flex; flex-direction:column; gap:0.4em; }
  .alx-row { display:flex; align-items:center; gap:0.5em; }
  .alx-muted { color: var(--p-live-text-secondary); }
  .list { max-height: 320px; overflow-y: auto; display:flex; flex-direction:column; gap:0.35em; padding-right: 0.3em; }
  .alx-input { background: var(--p-live-input-bg); color: var(--p-live-text-primary);
    border: 1px solid var(--p-live-control-border); height: 22px; padding: 0 0.5em; border-radius: 0.25em; font: inherit; }
  .alx-button { background: var(--p-live-control-bg); color: var(--p-live-text-primary); border: 1px solid var(--p-live-control-border);
    height: 22px; padding: 0 1.1em; border-radius: 1em; cursor: pointer; font: inherit; }
  .alx-button--primary { color: var(--p-live-control-text--enabled); background: var(--p-live-accent-primary); border-color: var(--p-live-accent-primary); }
</style>
</head>
<body>
  <div class="alx-col">
    <h2>Batch Rename Tracks</h2>
    <p class="alx-muted">Edit any name below, then apply. Unchanged names are left as-is.</p>
    <div class="list">${rowsHtml || '<p class="alx-muted">No tracks in this set.</p>'}</div>
    <div class="alx-row" style="justify-content:flex-end;">
      <button class="alx-button" id="cancel">Cancel</button>
      <button class="alx-button alx-button--primary" id="apply">Apply Renames</button>
    </div>
  </div>
  <script>
    function sendToLive(message) {
      if (window.webkit?.messageHandlers?.live) window.webkit.messageHandlers.live.postMessage(message);
      else if (window.chrome?.webview) window.chrome.webview.postMessage(message);
    }
    function closeWithResult(result) { sendToLive({ method: "close_and_send", params: [JSON.stringify(result)] }); }
    document.getElementById("cancel").addEventListener("click", () => closeWithResult({ names: null }));
    document.getElementById("apply").addEventListener("click", () => {
      const names = Array.from(document.querySelectorAll(".rename-input"))
        .sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index))
        .map((el) => el.value);
      closeWithResult({ names });
    });
  </script>
</body>
</html>`;
}

export function registerBatchRenameTracks(context: Ctx): void {
  context.commands.registerCommand("helping-hands.batchRenameTracks", async () => {
    const song = context.application.song;
    const tracks = song.tracks;
    if (tracks.length === 0) return;

    const html = buildBatchRenameDialog(tracks.map((t) => ({ name: t.name })));
    const raw = await context.ui.showModalDialog(dataUrl(html), 480, 520);
    const { names } = JSON.parse(raw) as { names: string[] | null };
    if (!names) return;

    context.withinTransaction(() => {
      tracks.forEach((track, i) => {
        const newName = names[i];
        if (newName !== undefined && newName !== track.name) {
          track.name = newName;
        }
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Rename Clip (also used from menuActions for clips, kept here as a small util)
// ---------------------------------------------------------------------------

export function buildRenamePromptHtml(currentName: string): string {
  return promptDialog({ title: "Rename Clip", label: "Clip name", initialValue: currentName });
}
