// The Menu Editor — a full-page dialog for building and rearranging the
// "Helping Hands ✋" menu (menuconfig.json) without hand-editing JSON.
//
// The dialog owns a working copy of the config entirely client-side (tree
// view + edit form, see ui/menuEditor.html) and only reports back once, when
// the user clicks Save — there's no live round-trip channel to persist
// intermediate edits, so "Save" both writes to disk and closes the dialog.

import type { ExtensionContext } from "@ableton-extensions/sdk";

import defaultMenuConfig from "../config/menuconfig.json" with { type: "json" };

import menuEditorHtmlTemplate from "./ui/menuEditor.html";
import { dataUrl } from "./ui/common.js";
import { loadMenuConfig, saveMenuConfig } from "./config.js";
import type { MenuConfig, MenuEditorResult } from "./types.js";

type Ctx = ExtensionContext<"1.0.0">;

const DATA_PLACEHOLDER = "/*__HELPING_HANDS_EDITOR_DATA__*/null";

interface MenuEditorDialogData {
  config: MenuConfig;
  defaults: MenuConfig;
}

export async function openMenuEditorDialog(context: Ctx, storageDirectory: string): Promise<void> {
  const config = await loadMenuConfig(storageDirectory);
  const data: MenuEditorDialogData = {
    config,
    defaults: defaultMenuConfig as MenuConfig,
  };

  const html = menuEditorHtmlTemplate.replace(DATA_PLACEHOLDER, JSON.stringify(data));
  const raw = await context.ui.showModalDialog(dataUrl(html), 1000, 720);
  const result = JSON.parse(raw) as MenuEditorResult;

  if (result.action === "saveMenu" && result.config) {
    await saveMenuConfig(storageDirectory, result.config);
  }
}
