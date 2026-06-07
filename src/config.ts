import fs from "node:fs/promises";
import path from "node:path";

import defaultMenuConfig from "../config/menuconfig.json" with { type: "json" };
import defaultSettings from "../config/settings.json" with { type: "json" };

import type {
  MenuConfig,
  ProjectTimesData,
  SettingsConfig,
  VersionHistoryData,
} from "./types.js";

const MENU_CONFIG_FILE = "menuconfig.json";
const SETTINGS_FILE = "settings.json";
const PROJECT_TIMES_FILE = "project-times.json";
const VERSION_HISTORY_FILE = "version-history.json";
const PROJECT_NAME_FILE = "projectname.txt";

async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Menu configuration
// ---------------------------------------------------------------------------

export function menuConfigPath(storageDirectory: string): string {
  return path.join(storageDirectory, MENU_CONFIG_FILE);
}

export async function loadMenuConfig(storageDirectory: string): Promise<MenuConfig> {
  const filePath = menuConfigPath(storageDirectory);
  const existing = await readJsonFile<MenuConfig>(filePath);
  if (existing) return existing;

  const fresh = defaultMenuConfig as MenuConfig;
  await writeJsonFile(filePath, fresh);
  return fresh;
}

export async function saveMenuConfig(storageDirectory: string, config: MenuConfig): Promise<void> {
  await writeJsonFile(menuConfigPath(storageDirectory), config);
}

export async function resetMenuConfig(storageDirectory: string): Promise<MenuConfig> {
  const fresh = defaultMenuConfig as MenuConfig;
  await writeJsonFile(menuConfigPath(storageDirectory), fresh);
  return fresh;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function settingsPath(storageDirectory: string): string {
  return path.join(storageDirectory, SETTINGS_FILE);
}

export async function loadSettings(storageDirectory: string): Promise<SettingsConfig> {
  const filePath = settingsPath(storageDirectory);
  const existing = await readJsonFile<SettingsConfig>(filePath);
  if (existing) return existing;

  const fresh = defaultSettings as SettingsConfig;
  await writeJsonFile(filePath, fresh);
  return fresh;
}

export async function saveSettings(storageDirectory: string, settings: SettingsConfig): Promise<void> {
  await writeJsonFile(settingsPath(storageDirectory), settings);
}

// ---------------------------------------------------------------------------
// Project timer data
// ---------------------------------------------------------------------------

export function projectTimesPath(storageDirectory: string): string {
  return path.join(storageDirectory, PROJECT_TIMES_FILE);
}

export async function loadProjectTimes(storageDirectory: string): Promise<ProjectTimesData> {
  const existing = await readJsonFile<ProjectTimesData>(projectTimesPath(storageDirectory));
  return existing ?? { projects: {} };
}

export async function saveProjectTimes(storageDirectory: string, data: ProjectTimesData): Promise<void> {
  await writeJsonFile(projectTimesPath(storageDirectory), data);
}

// ---------------------------------------------------------------------------
// Version history
// ---------------------------------------------------------------------------

export function versionHistoryPath(storageDirectory: string): string {
  return path.join(storageDirectory, VERSION_HISTORY_FILE);
}

export async function loadVersionHistory(storageDirectory: string): Promise<VersionHistoryData> {
  const existing = await readJsonFile<VersionHistoryData>(versionHistoryPath(storageDirectory));
  return existing ?? { entries: [] };
}

export async function saveVersionHistory(storageDirectory: string, data: VersionHistoryData): Promise<void> {
  await writeJsonFile(versionHistoryPath(storageDirectory), data);
}

// ---------------------------------------------------------------------------
// Project name
// ---------------------------------------------------------------------------
//
// The SDK does not expose the Live Set's name (there is no `Song.name`), so
// Helping Hands keeps its own record of "the project the user is currently
// working on" — set once via a prompt and reused by the timer and version
// save features. Stored as plain text since it's a single value.

export function projectNamePath(storageDirectory: string): string {
  return path.join(storageDirectory, PROJECT_NAME_FILE);
}

export async function loadProjectName(storageDirectory: string): Promise<string | undefined> {
  try {
    const raw = await fs.readFile(projectNamePath(storageDirectory), "utf-8");
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

export async function saveProjectName(storageDirectory: string, name: string): Promise<void> {
  await fs.writeFile(projectNamePath(storageDirectory), name, "utf-8");
}
