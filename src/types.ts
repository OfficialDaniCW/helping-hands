// Shared type definitions for Helping Hands.

// ---------------------------------------------------------------------------
// Menu configuration (menuconfig.json)
// ---------------------------------------------------------------------------

export interface MenuItemEntry {
  type: "item";
  label: string;
  query: string;
  isBuiltIn: boolean;
}

export interface MenuDividerEntry {
  type: "divider";
}

export interface ChainDeviceEntry {
  deviceName: string;
  isBuiltIn: boolean;
  query?: string;
}

export interface MenuChainEntry {
  type: "chain";
  label: string;
  devices: ChainDeviceEntry[];
}

export interface MenuGroupEntry {
  type: "group";
  label: string;
  trackName?: string;
  colour?: number;
  returnSends?: string[];
  rackPresetQuery?: string;
  isBuiltIn?: boolean;
}

export interface MenuCategoryEntry {
  type: "category";
  label: string;
  items: MenuEntry[];
}

export type MenuEntry =
  | MenuItemEntry
  | MenuDividerEntry
  | MenuChainEntry
  | MenuGroupEntry
  | MenuCategoryEntry;

export interface MenuConfig {
  version: 1;
  items: MenuEntry[];
}

// ---------------------------------------------------------------------------
// Settings (settings.json)
// ---------------------------------------------------------------------------

export interface ScalePreference {
  rootNote: number;
  scaleType: string;
}

export interface SettingsConfig {
  contextMenuEnabled: boolean;
  projectTimerEnabled: boolean;
  defaultScale: ScalePreference;
}

// ---------------------------------------------------------------------------
// Project timer (project-times.json)
// ---------------------------------------------------------------------------

export interface TimerSession {
  startedAt: string;
  seconds: number;
}

export interface ProjectTimeEntry {
  totalSeconds: number;
  sessions: TimerSession[];
}

export interface ProjectTimesData {
  projects: Record<string, ProjectTimeEntry>;
}

// ---------------------------------------------------------------------------
// Version history (version-history.json)
// ---------------------------------------------------------------------------

export interface VersionHistoryEntry {
  from: string;
  to: string;
  at: string;
}

export interface VersionHistoryData {
  entries: VersionHistoryEntry[];
}

// ---------------------------------------------------------------------------
// Dialog payloads — the JSON strings exchanged with webviews
// ---------------------------------------------------------------------------

export interface DeviceMenuResult {
  action: "insertDevice" | "applyChain" | "createGroup" | "editMenu" | "openSettings" | "cancel";
  deviceName?: string;
  query?: string;
  isBuiltIn?: boolean;
  chainLabel?: string;
  chain?: ChainDeviceEntry[];
  group?: MenuGroupEntry;
}

export interface MenuEditorResult {
  action: "saveMenu" | "cancel";
  config?: MenuConfig;
}

export interface RenameDialogResult {
  name: string | null;
}

export interface ColourPickerResult {
  color: number | null;
}

export interface ConfirmDialogResult {
  confirmed: boolean;
}

export interface CaptureChainResult {
  chainName: string | null;
  selectedDevices: string[];
  category: string;
}

export interface BatchRenameResult {
  renames: { handleId: string; newName: string }[];
}

export interface ScaleHelperResult {
  rootNote: number;
  scaleType: string;
  liveScaleName: string;
  confirmed: boolean;
}

export interface SettingsDialogResult {
  action: "save" | "openMenuEditor" | "cancel";
  settings?: SettingsConfig;
}

export interface ProjectNamePromptResult {
  name: string | null;
}
