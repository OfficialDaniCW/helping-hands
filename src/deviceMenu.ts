import {
  AudioTrack,
  MidiTrack,
  Track,
  type ExtensionContext,
} from "@ableton-extensions/sdk";

import deviceMenuHtmlTemplate from "./ui/deviceMenu.html";
import { dataUrl, escapeHtml } from "./ui/common.js";
import { manualStepsDialog, infoDialog } from "./ui/dialogs.js";
import { loadMenuConfig } from "./config.js";
import type { ChainDeviceEntry, MenuConfig, MenuGroupEntry } from "./types.js";

type Ctx = ExtensionContext<"1.0.0">;

const DATA_PLACEHOLDER = "/*__HELPING_HANDS_MENU_DATA__*/null";

interface DeviceMenuDialogData {
  menu: MenuConfig["items"];
  contextLabel: string;
  hasTrack: boolean;
}

type DeviceMenuDialogResult =
  | { action: "insertDevice"; deviceName: string; query: string; isBuiltIn: boolean }
  | { action: "applyChain"; chainLabel: string; chain: ChainDeviceEntry[] }
  | { action: "createGroup"; group: MenuGroupEntry }
  | { action: "editMenu" }
  | { action: "openSettings" }
  | { action: "cancel" };

// ---------------------------------------------------------------------------
// Insertion helpers
// ---------------------------------------------------------------------------

async function insertBuiltInDevice(context: Ctx, track: Track<"1.0.0">, deviceName: string): Promise<void> {
  await context.withinTransaction(() => track.insertDevice(deviceName, track.devices.length));
}

interface ChainApplyOutcome {
  insertedCount: number;
  manualSteps: string[];
}

async function applyChain(context: Ctx, track: Track<"1.0.0">, devices: ChainDeviceEntry[]): Promise<ChainApplyOutcome> {
  const builtIns = devices.filter((d) => d.isBuiltIn);
  const manual = devices.filter((d) => !d.isBuiltIn);

  await context.withinTransaction(() => {
    return builtIns.reduce<Promise<unknown>>(
      (chain, device) => chain.then(() => track.insertDevice(device.deviceName, track.devices.length)),
      Promise.resolve(),
    );
  });

  return {
    insertedCount: builtIns.length,
    manualSteps: manual.map((d) => `Add "${d.deviceName}" — search for "${d.query ?? d.deviceName}" in Ableton's browser.`),
  };
}

interface GroupCreationOutcome {
  trackName: string;
  manualSteps: string[];
}

async function createGroupFromTemplate(context: Ctx, originTrack: Track<"1.0.0"> | undefined, group: MenuGroupEntry): Promise<GroupCreationOutcome> {
  const song = context.application.song;
  const trackName = group.trackName ?? group.label;

  // SDK 1.0.0 has no "create group track" / "move tracks into group" API —
  // we create a plain track named appropriately and explain the rest.
  const useAudio = originTrack instanceof AudioTrack;
  const newTrack = await context.withinTransaction(() => (useAudio ? song.createAudioTrack() : song.createMidiTrack()));
  context.withinTransaction(() => {
    newTrack.name = trackName;
  });

  const manualSteps: string[] = [
    `Select the tracks you want grouped together with "${trackName}", then use Live's "Group Tracks" command (Ctrl/Cmd+G) — Helping Hands can create the track but can't group or reorder tracks via the SDK.`,
  ];
  if (group.colour !== undefined) {
    manualSteps.push(`Set the group's colour (Helping Hands can't set track colour — there is no Track.color in the SDK).`);
  }
  if (group.returnSends && group.returnSends.length > 0) {
    manualSteps.push(`Raise the sends to return tracks ${group.returnSends.map((s) => `"${s}"`).join(", ")} on the new track's mixer.`);
  }
  if (group.rackPresetQuery) {
    manualSteps.push(`Load the rack preset — search for "${group.rackPresetQuery}" in Ableton's browser.`);
  }

  return { trackName, manualSteps };
}

// ---------------------------------------------------------------------------
// Dialog orchestration
// ---------------------------------------------------------------------------

export interface DeviceMenuDeps {
  context: Ctx;
  storageDirectory: string;
  track: Track<"1.0.0"> | undefined;
  contextLabel: string;
  /** Opens the menu editor; returns once it has been handled. */
  openMenuEditor: () => Promise<void>;
  /** Opens the settings panel; returns once it has been handled. */
  openSettings: () => Promise<void>;
}

export async function openDeviceMenu(deps: DeviceMenuDeps): Promise<void> {
  const { context, storageDirectory, track, contextLabel, openMenuEditor, openSettings } = deps;

  const config = await loadMenuConfig(storageDirectory);
  const data: DeviceMenuDialogData = {
    menu: config.items,
    contextLabel,
    hasTrack: track !== undefined,
  };

  const html = deviceMenuHtmlTemplate.replace(DATA_PLACEHOLDER, JSON.stringify(data));
  const raw = await context.ui.showModalDialog(dataUrl(html), 720, 600);
  const result = JSON.parse(raw) as DeviceMenuDialogResult;

  switch (result.action) {
    case "insertDevice": {
      if (!track) return;
      if (result.isBuiltIn) {
        await insertBuiltInDevice(context, track, result.deviceName);
      } else {
        const html2 = infoDialog({
          title: `Add "${result.deviceName}"`,
          bodyHtml: `<p>Search Ableton's browser for <strong>${escapeHtml(result.query)}</strong> and drag it onto the track — third-party plug-ins can't be inserted via the SDK.</p>`,
        });
        await context.ui.showModalDialog(dataUrl(html2), 420, 200);
      }
      return;
    }

    case "applyChain": {
      if (!track) return;
      const outcome = await applyChain(context, track, result.chain);
      if (outcome.manualSteps.length > 0) {
        const html2 = manualStepsDialog({
          title: `Chain Applied: ${result.chainLabel}`,
          intro: `${outcome.insertedCount} device(s) inserted automatically. Add the rest manually, in order:`,
          steps: outcome.manualSteps,
        });
        await context.ui.showModalDialog(dataUrl(html2), 460, 320);
      } else {
        const html2 = infoDialog({
          title: `Chain Applied: ${result.chainLabel}`,
          bodyHtml: `<p>${outcome.insertedCount} device(s) inserted — ${escapeHtml(result.chainLabel)} is ready.</p>`,
        });
        await context.ui.showModalDialog(dataUrl(html2), 380, 180);
      }
      return;
    }

    case "createGroup": {
      const outcome = await createGroupFromTemplate(context, track, result.group);
      const html2 = manualStepsDialog({
        title: `Created Track: ${outcome.trackName}`,
        intro: `Helping Hands created a new track named "${outcome.trackName}". Finish the setup manually:`,
        steps: outcome.manualSteps,
      });
      await context.ui.showModalDialog(dataUrl(html2), 460, 320);
      return;
    }

    case "editMenu":
      await openMenuEditor();
      return;

    case "openSettings":
      await openSettings();
      return;

    case "cancel":
    default:
      return;
  }
}

/** Walks an object's canonical-parent chain to find the owning track, if any. */
export function findOwningTrack(context: Ctx, obj: { parent: import("@ableton-extensions/sdk").DataModelObject<"1.0.0"> | null } | null): Track<"1.0.0"> | undefined {
  let current: { parent: import("@ableton-extensions/sdk").DataModelObject<"1.0.0"> | null } | null = obj;
  while (current) {
    if (current instanceof Track) return current;
    current = current.parent;
  }
  return undefined;
}

export function describeTrack(track: Track<"1.0.0">): string {
  if (track instanceof MidiTrack) return `MIDI Track "${track.name}"`;
  if (track instanceof AudioTrack) return `Audio Track "${track.name}"`;
  return `Track "${track.name}"`;
}
