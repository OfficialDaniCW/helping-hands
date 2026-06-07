// Scale definitions and helpers for the piano-roll Scale Helper dialog.
//
// IMPORTANT: in SDK 1.0.0, `Song.rootNote`, `Song.scaleName` and
// `Song.scaleMode` are all *read-only* — there is no API to change Live's
// scale from an extension. The Scale Helper therefore acts as a reference —
// it previews the chosen scale on a piano graphic, remembers the user's
// preference, and tells them exactly what to set in Live's own Scale chooser
// (Options bar, or Key/Scale view) to match it.

export const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
] as const;

export interface ScaleDefinition {
  /** Label shown in the dialog. */
  label: string;
  /** The exact name Live uses in its Current Scale Name chooser. */
  liveScaleName: string;
  /** Semitone offsets from the root note. */
  intervals: number[];
}

export const SCALE_DEFINITIONS: ScaleDefinition[] = [
  { label: "Major", liveScaleName: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
  { label: "Natural Minor", liveScaleName: "Minor", intervals: [0, 2, 3, 5, 7, 8, 10] },
  { label: "Harmonic Minor", liveScaleName: "Harmonic Minor", intervals: [0, 2, 3, 5, 7, 8, 11] },
  { label: "Melodic Minor", liveScaleName: "Melodic Minor", intervals: [0, 2, 3, 5, 7, 9, 11] },
  { label: "Dorian", liveScaleName: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
  { label: "Phrygian", liveScaleName: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10] },
  { label: "Lydian", liveScaleName: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11] },
  { label: "Mixolydian", liveScaleName: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10] },
  { label: "Locrian", liveScaleName: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10] },
  { label: "Pentatonic Major", liveScaleName: "Pentatonic Major", intervals: [0, 2, 4, 7, 9] },
  { label: "Pentatonic Minor", liveScaleName: "Pentatonic Minor", intervals: [0, 3, 5, 7, 10] },
  { label: "Blues", liveScaleName: "Blues", intervals: [0, 3, 5, 6, 7, 10] },
];

export function findScaleDefinition(scaleType: string): ScaleDefinition | undefined {
  return SCALE_DEFINITIONS.find((s) => s.label === scaleType || s.liveScaleName === scaleType);
}

export function noteName(rootNote: number): string {
  return NOTE_NAMES[((rootNote % 12) + 12) % 12];
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

import type { ExtensionContext, Handle } from "@ableton-extensions/sdk";
import { MidiClip } from "@ableton-extensions/sdk";

import scaleHelperHtmlTemplate from "./ui/scaleHelper.html";
import { dataUrl } from "./ui/common.js";
import { loadSettings, saveSettings } from "./config.js";

type Ctx = ExtensionContext<"1.0.0">;

const DATA_PLACEHOLDER = "/*__HELPING_HANDS_SCALE_DATA__*/null";

interface ScaleHelperDialogData {
  noteNames: readonly string[];
  scales: { label: string; intervals: number[] }[];
  selectedRootNote: number;
  selectedScaleType: string;
  liveRootNote: number;
  liveScaleName: string;
  liveScaleMode: boolean;
  clipName: string;
}

interface ScaleHelperDialogResult {
  rootNote: number;
  scaleType: string;
  confirmed: boolean;
}

export function registerScaleHelper(context: Ctx): void {
  context.commands.registerCommand("helping-hands.setScale", async (...args: unknown[]) => {
    const storageDirectory = context.environment.storageDirectory;
    if (!storageDirectory) return;

    const handle = args[0] as Handle;
    const clip = context.getObjectFromHandle(handle, MidiClip);
    const song = context.application.song;
    const settings = await loadSettings(storageDirectory);

    const data: ScaleHelperDialogData = {
      noteNames: NOTE_NAMES,
      scales: SCALE_DEFINITIONS.map((s) => ({ label: s.label, intervals: s.intervals })),
      selectedRootNote: settings.defaultScale.rootNote,
      selectedScaleType: settings.defaultScale.scaleType,
      liveRootNote: song.rootNote,
      liveScaleName: song.scaleName,
      liveScaleMode: song.scaleMode,
      clipName: clip.name,
    };

    const html = scaleHelperHtmlTemplate.replace(DATA_PLACEHOLDER, JSON.stringify(data));
    const raw = await context.ui.showModalDialog(dataUrl(html), 560, 460);
    const result = JSON.parse(raw) as ScaleHelperDialogResult;
    if (!result.confirmed) return;

    settings.defaultScale = { rootNote: result.rootNote, scaleType: result.scaleType };
    await saveSettings(storageDirectory, settings);
  });
}
