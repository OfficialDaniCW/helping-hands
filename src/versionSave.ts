import type { ExtensionContext } from "@ableton-extensions/sdk";

import { dataUrl, escapeHtml } from "./ui/common.js";
import { confirmDialog, infoDialog, promptDialog } from "./ui/dialogs.js";
import {
  loadProjectName,
  loadVersionHistory,
  saveProjectName,
  saveVersionHistory,
} from "./config.js";

type Ctx = ExtensionContext<"1.0.0">;

const VERSION_SUFFIX = /^(.*)_(\d+)$/;

/**
 * Computes the next version name. `My Track` -> `My Track_2`,
 * `My Track_2` -> `My Track_3`.
 */
export function nextVersionName(name: string): string {
  const match = name.match(VERSION_SUFFIX);
  if (match) {
    const base = match[1];
    const n = parseInt(match[2], 10);
    return `${base}_${n + 1}`;
  }
  return `${name}_2`;
}

async function promptForProjectName(context: Ctx, storageDirectory: string): Promise<string | undefined> {
  const html = promptDialog({
    title: "What's Your Project Called?",
    label: "Helping Hands can't read the Live Set's name directly — enter it once and it'll be remembered for next time.",
    placeholder: "My Track",
  });
  const raw = await context.ui.showModalDialog(dataUrl(html), 420, 200);
  const { value } = JSON.parse(raw) as { value: string | null };
  if (!value) return undefined;

  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;

  await saveProjectName(storageDirectory, trimmed);
  return trimmed;
}

export function registerNewVersionSave(context: Ctx): void {
  context.commands.registerCommand("helping-hands.newVersionSave", async () => {
    const storageDirectory = context.environment.storageDirectory;
    if (!storageDirectory) return;

    let currentName = await loadProjectName(storageDirectory);
    if (!currentName) {
      currentName = await promptForProjectName(context, storageDirectory);
      if (!currentName) return;
    }

    const proposedName = nextVersionName(currentName);

    const confirmHtml = confirmDialog({
      title: "Save New Version",
      message: `Rename your project from "${currentName}" to "${proposedName}"?\n\nHelping Hands can't rename the Live Set for you — after confirming, use File > Save Live Set As… and enter the new name shown.`,
      confirmLabel: "Use This Name",
      cancelLabel: "Cancel",
    });
    const confirmRaw = await context.ui.showModalDialog(dataUrl(confirmHtml), 460, 220);
    const { confirmed } = JSON.parse(confirmRaw) as { confirmed: boolean };
    if (!confirmed) return;

    const history = await loadVersionHistory(storageDirectory);
    history.entries.push({ from: currentName, to: proposedName, at: new Date().toISOString() });
    await saveVersionHistory(storageDirectory, history);
    await saveProjectName(storageDirectory, proposedName);

    const ackHtml = infoDialog({
      title: "New Version Name Ready",
      bodyHtml: `
        <p>Use <strong>File &gt; Save Live Set As…</strong> and save it as:</p>
        <p style="font-size: 1.3em; font-weight: 600; color: var(--p-live-accent-primary);">${escapeHtml(proposedName)}</p>
        <p class="alx-muted">Helping Hands has logged this in its version history.</p>
      `,
    });
    await context.ui.showModalDialog(dataUrl(ackHtml), 420, 260);
  });
}
