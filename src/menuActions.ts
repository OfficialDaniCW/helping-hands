import {
  AudioClip,
  AudioTrack,
  ClipSlot,
  DataModelObject,
  Device,
  DrumRack,
  MidiClip,
  MidiTrack,
  Sample,
  Scene,
  Simpler,
  Track,
  type ArrangementSelection,
  type ClipSlotSelection,
  type ContextMenuScope,
  type ExtensionContext,
  type Handle,
} from "@ableton-extensions/sdk";

import { describeTrack, findOwningTrack, openDeviceMenu } from "./deviceMenu.js";
import {
  registerBatchRenameTracks,
  registerCaptureChain,
  registerClearTrack,
  registerColourClips,
  registerToggleMute,
  registerTrackInfo,
} from "./trackActions.js";
import { registerBuplicate, registerDisableLoop, registerRenameClip } from "./clipActions.js";
import { registerNewVersionSave } from "./versionSave.js";
import { registerScaleHelper } from "./scaleHelper.js";
import { openMenuEditorDialog } from "./menuEditor.js";
import { openSettingsDialog } from "./settingsPanel.js";
import { loadSettings } from "./config.js";
import type { ProjectTimer } from "./projectTimer.js";

type Ctx = ExtensionContext<"1.0.0">;
type Scope = ContextMenuScope<"1.0.0">;
type Unregister = () => Promise<void>;

const ALL_SCOPES: Scope[] = [
  "AudioClip",
  "MidiClip",
  "AudioTrack",
  "MidiTrack",
  "ClipSlot",
  "Scene",
  "DrumRack",
  "Simpler",
  "Sample",
  "ClipSlotSelection",
  "AudioTrack.ArrangementSelection",
  "MidiTrack.ArrangementSelection",
];

const TRACK_SCOPES: Scope[] = ["AudioTrack", "MidiTrack"];
const CLIP_SCOPES: Scope[] = ["AudioClip", "MidiClip"];
const ARRANGEMENT_SCOPES: Scope[] = ["AudioTrack.ArrangementSelection", "MidiTrack.ArrangementSelection"];

// ---------------------------------------------------------------------------
// Argument shape detection — `helping-hands.openMenu` can be invoked from
// scopes that pass a Handle, an ArrangementSelection, or a ClipSlotSelection.
// ---------------------------------------------------------------------------

function isHandle(arg: unknown): arg is Handle {
  return typeof arg === "object" && arg !== null && "id" in arg && typeof (arg as { id: unknown }).id === "bigint";
}

function isArrangementSelection(arg: unknown): arg is ArrangementSelection {
  return typeof arg === "object" && arg !== null && "time_selection_start" in arg && "selected_lanes" in arg;
}

function isClipSlotSelection(arg: unknown): arg is ClipSlotSelection {
  return typeof arg === "object" && arg !== null && "selected_clip_slots" in arg && !("time_selection_start" in arg);
}

function describeContextObject(obj: DataModelObject<"1.0.0">, track: Track<"1.0.0"> | undefined): string {
  if (obj instanceof MidiClip) return `MIDI Clip "${obj.name}"` + (track ? ` on ${describeTrack(track)}` : "");
  if (obj instanceof AudioClip) return `Audio Clip "${obj.name}"` + (track ? ` on ${describeTrack(track)}` : "");
  if (obj instanceof MidiTrack || obj instanceof AudioTrack) return describeTrack(obj);
  if (obj instanceof ClipSlot) return track ? `Clip Slot on ${describeTrack(track)}` : "Clip Slot";
  if (obj instanceof Scene) return `Scene "${obj.name}"`;
  if (obj instanceof DrumRack) return "Drum Rack" + (track ? ` on ${describeTrack(track)}` : "");
  if (obj instanceof Simpler) return "Simpler" + (track ? ` on ${describeTrack(track)}` : "");
  if (obj instanceof Sample) return "Sample";
  if (obj instanceof Device) return `Device "${obj.name}"` + (track ? ` on ${describeTrack(track)}` : "");
  return "Live";
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export interface MenuActionsDeps {
  context: Ctx;
  storageDirectory: string;
  projectTimer: ProjectTimer;
}

/**
 * Registers everything Helping Hands adds to Live's right-click menus.
 *
 * Two tiers:
 *  - "Helping Hands ✋" and "Helping Hands: Settings" are core entry points,
 *    registered on every scope and always present — they're how the user
 *    reaches everything else, including the toggle that hides the rest.
 *  - The individual feature actions (Clear Track, Buplicate, …) are
 *    registered/unregistered together based on `settings.contextMenuEnabled`,
 *    so users who prefer a tidy right-click menu can fall back to driving
 *    everything from the "Helping Hands ✋" hub.
 *
 * Returns a function that tears down every registered action.
 */
export async function registerMenuActions(deps: MenuActionsDeps): Promise<() => Promise<void>> {
  const { context, storageDirectory, projectTimer } = deps;

  let featureUnregisters: Unregister[] = [];
  let featuresRegistered = false;

  const openMenuEditor = async () => {
    await openMenuEditorDialog(context, storageDirectory);
  };

  const openSettings = async () => {
    await openSettingsDialog({
      context,
      storageDirectory,
      onContextMenuToggle: setFeatureActionsEnabled,
      onOpenMenuEditor: openMenuEditor,
    });
  };

  // -- Core entry points (always on) ---------------------------------------

  const coreUnregisters: Unregister[] = [];
  for (const scope of ALL_SCOPES) {
    coreUnregisters.push(await context.ui.registerContextMenuAction(scope, "Helping Hands ✋", "helping-hands.openMenu"));
    coreUnregisters.push(await context.ui.registerContextMenuAction(scope, "Helping Hands: Settings", "helping-hands.openSettings"));
  }

  context.commands.registerCommand("helping-hands.openMenu", async (...args: unknown[]) => {
    const arg = args[0];
    let track: Track<"1.0.0"> | undefined;
    let contextLabel = "Live";

    if (isArrangementSelection(arg)) {
      const lanes = arg.selected_lanes.map((h) => context.getObjectFromHandle(h, Track));
      track = lanes[0];
      contextLabel =
        lanes.length > 0
          ? `Arrangement Selection — ${lanes.length} lane(s), starting with ${describeTrack(lanes[0])}`
          : "Arrangement Selection";
    } else if (isClipSlotSelection(arg)) {
      const slots = arg.selected_clip_slots.map((h) => context.getObjectFromHandle(h, ClipSlot));
      track = slots.length > 0 ? findOwningTrack(context, slots[0]) : undefined;
      contextLabel = track ? `Clip Slot Selection on ${describeTrack(track)}` : "Clip Slot Selection";
    } else if (isHandle(arg)) {
      const obj = context.getObjectFromHandle(arg, DataModelObject);
      track = findOwningTrack(context, obj);
      contextLabel = describeContextObject(obj, track);
    }

    await openDeviceMenu({ context, storageDirectory, track, contextLabel, openMenuEditor, openSettings });
  });

  context.commands.registerCommand("helping-hands.openSettings", async () => {
    await openSettings();
  });

  // -- Feature actions (toggleable) -----------------------------------------

  function registerCommandHandlers(): void {
    registerClearTrack(context);
    registerColourClips(context);
    registerToggleMute(context);
    registerTrackInfo(context);
    registerCaptureChain(context, async () => {
      /* menu reloads from disk on next open — nothing to refresh in-memory */
    });
    registerBatchRenameTracks(context);

    registerBuplicate(context);
    registerDisableLoop(context);
    registerRenameClip(context);

    registerNewVersionSave(context);
    registerScaleHelper(context);

    context.commands.registerCommand("helping-hands.addCuePoint", async (...args: unknown[]) => {
      const selection = args[0] as ArrangementSelection;
      await context.application.song.createCuePoint(selection.time_selection_start);
    });

    context.commands.registerCommand("helping-hands.clearSelection", async (...args: unknown[]) => {
      const selection = args[0] as ArrangementSelection;
      const tracks = selection.selected_lanes.map((h) => context.getObjectFromHandle(h, Track));
      await context.withinTransaction(() =>
        Promise.all(tracks.map((t) => t.clearClipsInRange(selection.time_selection_start, selection.time_selection_end))),
      );
    });
  }

  // Commands only need registering once — the SDK has no `unregisterCommand`,
  // so we register handlers a single time and toggle their *menu entries*.
  let commandsRegistered = false;
  function ensureCommandsRegistered(): void {
    if (commandsRegistered) return;
    commandsRegistered = true;
    registerCommandHandlers();
    projectTimer.registerCommand();
  }

  async function registerFeatureMenuEntries(): Promise<Unregister[]> {
    const entries: Unregister[] = [];

    for (const scope of TRACK_SCOPES) {
      entries.push(await context.ui.registerContextMenuAction(scope, "Helping Hands: Clear All Clips", "helping-hands.clearTrack"));
      entries.push(await context.ui.registerContextMenuAction(scope, "Helping Hands: Colour Clips to Track", "helping-hands.colourClips"));
      entries.push(await context.ui.registerContextMenuAction(scope, "Helping Hands: Toggle Mute", "helping-hands.toggleMute"));
      entries.push(await context.ui.registerContextMenuAction(scope, "Helping Hands: Track Info", "helping-hands.trackInfo"));
      entries.push(await context.ui.registerContextMenuAction(scope, "Helping Hands: Save Device Chain as Template", "helping-hands.captureChain"));
      entries.push(await context.ui.registerContextMenuAction(scope, "Helping Hands: Save New Version", "helping-hands.newVersionSave"));
      entries.push(await context.ui.registerContextMenuAction(scope, "Helping Hands: Show Project Timer", "helping-hands.showProjectTimer"));
    }

    for (const scope of CLIP_SCOPES) {
      entries.push(await context.ui.registerContextMenuAction(scope, "Helping Hands: Buplicate (×8)", "helping-hands.buplicate"));
      entries.push(await context.ui.registerContextMenuAction(scope, "Helping Hands: Disable Loop", "helping-hands.disableLoop"));
      entries.push(await context.ui.registerContextMenuAction(scope, "Helping Hands: Rename Clip", "helping-hands.renameClip"));
    }

    entries.push(await context.ui.registerContextMenuAction("MidiClip", "Helping Hands: Set Scale", "helping-hands.setScale"));
    entries.push(await context.ui.registerContextMenuAction("Scene", "Helping Hands: Save New Version", "helping-hands.newVersionSave"));
    entries.push(await context.ui.registerContextMenuAction("Scene", "Helping Hands: Batch Rename Tracks", "helping-hands.batchRenameTracks"));

    for (const scope of ARRANGEMENT_SCOPES) {
      entries.push(await context.ui.registerContextMenuAction(scope, "Helping Hands: Add Cue Point Here", "helping-hands.addCuePoint"));
      entries.push(await context.ui.registerContextMenuAction(scope, "Helping Hands: Clear Selection", "helping-hands.clearSelection"));
    }

    return entries;
  }

  async function setFeatureActionsEnabled(enabled: boolean): Promise<void> {
    if (enabled && !featuresRegistered) {
      ensureCommandsRegistered();
      featureUnregisters = await registerFeatureMenuEntries();
      featuresRegistered = true;
    } else if (!enabled && featuresRegistered) {
      await Promise.all(featureUnregisters.map((unregister) => unregister()));
      featureUnregisters = [];
      featuresRegistered = false;
    }
  }

  // Always make the command handlers available — `helping-hands.openMenu`
  // routes to several of them (insertDevice/applyChain) regardless of
  // whether their direct menu entries are shown. Then apply the persisted
  // preference for whether the feature menu *entries* themselves show up.
  ensureCommandsRegistered();
  const settings = await loadSettings(storageDirectory);
  await setFeatureActionsEnabled(settings.contextMenuEnabled);

  return async () => {
    await Promise.all(coreUnregisters.map((unregister) => unregister()));
    await Promise.all(featureUnregisters.map((unregister) => unregister()));
  };
}

/** Helper exported for `extension.ts` to apply the persisted preference at startup. */
export { ALL_SCOPES };
