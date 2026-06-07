// The Settings panel — toggles for the right-click menu and project timer,
// plus the default Scale Helper preference, and a shortcut into the Menu
// Editor. A thin dialog: it just persists `settings.json` and notifies
// `extension.ts` (via the callbacks below) so live state stays in sync.

import type { ExtensionContext } from "@ableton-extensions/sdk";

import settingsHtmlTemplate from "./ui/settings.html";
import { dataUrl } from "./ui/common.js";
import { loadSettings, saveSettings } from "./config.js";
import { NOTE_NAMES, SCALE_DEFINITIONS } from "./scaleHelper.js";
import type { SettingsConfig, SettingsDialogResult } from "./types.js";

type Ctx = ExtensionContext<"1.0.0">;

const DATA_PLACEHOLDER = "/*__HELPING_HANDS_SETTINGS_DATA__*/null";

interface SettingsDialogData {
  settings: SettingsConfig;
  noteNames: readonly string[];
  scales: string[];
}

export interface SettingsPanelDeps {
  context: Ctx;
  storageDirectory: string;
  /** Applies a freshly-saved `contextMenuEnabled` preference to live menu registrations. */
  onContextMenuToggle: (enabled: boolean) => Promise<void>;
  /** Opens the menu editor dialog. */
  onOpenMenuEditor: () => Promise<void>;
}

export async function openSettingsDialog(deps: SettingsPanelDeps): Promise<void> {
  const { context, storageDirectory, onContextMenuToggle, onOpenMenuEditor } = deps;

  const settings = await loadSettings(storageDirectory);
  const data: SettingsDialogData = {
    settings,
    noteNames: NOTE_NAMES,
    scales: SCALE_DEFINITIONS.map((s) => s.label),
  };

  const html = settingsHtmlTemplate.replace(DATA_PLACEHOLDER, JSON.stringify(data));
  const raw = await context.ui.showModalDialog(dataUrl(html), 460, 560);
  const result = JSON.parse(raw) as SettingsDialogResult;

  if (result.action === "cancel" || !result.settings) return;

  await saveSettings(storageDirectory, result.settings);
  await onContextMenuToggle(result.settings.contextMenuEnabled);

  if (result.action === "openMenuEditor") {
    await onOpenMenuEditor();
  }
}
