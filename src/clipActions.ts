import {
  AudioClip,
  AudioTrack,
  Clip,
  MidiClip,
  MidiTrack,
  type ExtensionContext,
  type Handle,
} from "@ableton-extensions/sdk";

import { dataUrl } from "./ui/common.js";
import { promptDialog, infoDialog } from "./ui/dialogs.js";

type Ctx = ExtensionContext<"1.0.0">;

const BUPLICATE_COPIES = 7; // 7 duplicates + the original = ×8

function resolveClip(context: Ctx, arg: unknown): Clip<"1.0.0"> {
  return context.getObjectFromHandle(arg as Handle, Clip);
}

// ---------------------------------------------------------------------------
// Buplicate — duplicate a clip end-to-end ×8 total
// ---------------------------------------------------------------------------

export function registerBuplicate(context: Ctx): void {
  context.commands.registerCommand("helping-hands.buplicate", async (...args: unknown[]) => {
    const clip = resolveClip(context, args[0]);
    const parent = clip.parent;
    const duration = clip.duration;

    if (clip instanceof MidiClip && parent instanceof MidiTrack) {
      const track = parent;
      await context.withinTransaction(() => {
        const creates: Promise<unknown>[] = [];
        for (let i = 0; i < BUPLICATE_COPIES; i++) {
          const startTime = clip.endTime + i * duration;
          creates.push(track.createMidiClip(startTime, duration));
        }
        return Promise.all(creates);
      });
      return;
    }

    if (clip instanceof AudioClip && parent instanceof AudioTrack) {
      const track = parent;
      const filePath = clip.filePath;
      const isWarped = clip.warping;
      const loopSettings = {
        looping: clip.looping,
        startMarker: clip.startMarker,
        endMarker: clip.endMarker,
        loopStart: clip.loopStart,
        loopEnd: clip.loopEnd,
      };

      await context.withinTransaction(() => {
        const creates: Promise<unknown>[] = [];
        for (let i = 0; i < BUPLICATE_COPIES; i++) {
          const startTime = clip.endTime + i * duration;
          creates.push(
            track.createAudioClip({
              filePath,
              startTime,
              duration,
              isWarped,
              loopSettings,
            }),
          );
        }
        return Promise.all(creates);
      });
      return;
    }

    // Clips on take lanes, or any other arrangement — not supported by Buplicate.
    const html = infoDialog({
      title: "Can't Buplicate This Clip",
      bodyHtml: `<p>Buplicate works on MIDI and audio clips that live directly on a track's arrangement timeline.</p>`,
    });
    await context.ui.showModalDialog(dataUrl(html), 380, 180);
  });
}

// ---------------------------------------------------------------------------
// Disable Loop
// ---------------------------------------------------------------------------

export function registerDisableLoop(context: Ctx): void {
  context.commands.registerCommand("helping-hands.disableLoop", (...args: unknown[]) => {
    const clip = resolveClip(context, args[0]);
    context.withinTransaction(() => {
      clip.looping = false;
    });
  });
}

// ---------------------------------------------------------------------------
// Rename Clip
// ---------------------------------------------------------------------------

export function registerRenameClip(context: Ctx): void {
  context.commands.registerCommand("helping-hands.renameClip", async (...args: unknown[]) => {
    const clip = resolveClip(context, args[0]);

    const html = promptDialog({ title: "Rename Clip", label: "Clip name", initialValue: clip.name });
    const raw = await context.ui.showModalDialog(dataUrl(html), 360, 180);
    const { value } = JSON.parse(raw) as { value: string | null };
    if (value === null) return;

    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed === clip.name) return;

    context.withinTransaction(() => {
      clip.name = trimmed;
    });
  });
}
