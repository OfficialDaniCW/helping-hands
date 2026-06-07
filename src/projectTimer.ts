import type { ExtensionContext } from "@ableton-extensions/sdk";

import timerHtmlTemplate from "./ui/timer.html";
import { dataUrl } from "./ui/common.js";
import { confirmDialog } from "./ui/dialogs.js";
import { loadProjectName, loadProjectTimes, saveProjectTimes } from "./config.js";
import type { ProjectTimesData } from "./types.js";

type Ctx = ExtensionContext<"1.0.0">;

const TICK_MS = 1000;
const FLUSH_EVERY_SECONDS = 10;
const DATA_PLACEHOLDER = "/*__HELPING_HANDS_TIMER_DATA__*/null";

interface TimerDialogProject {
  name: string;
  totalSeconds: number;
  isCurrent: boolean;
}

interface TimerDialogData {
  projectName: string;
  sessionSeconds: number;
  totalSeconds: number;
  projects: TimerDialogProject[];
}

interface TimerDialogResult {
  action: "close" | "reset";
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (hours > 0) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
  }
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export { formatDuration };

/**
 * Tracks how long the user spends in the current project. The SDK exposes no
 * `Song.name`, so "the current project" is whatever name Helping Hands has on
 * file (set via Save New Version or the timer dialog itself) — defaulting to
 * "Untitled Project" until the user names it.
 */
export class ProjectTimer {
  private context: Ctx;
  private storageDirectory: string;
  private intervalHandle: ReturnType<typeof setInterval> | undefined;
  private projectName = "Untitled Project";
  private data: ProjectTimesData = { projects: {} };
  private baselineTotalSeconds = 0;
  private sessionSeconds = 0;
  private lastFlushedSeconds = 0;

  constructor(context: Ctx, storageDirectory: string) {
    this.context = context;
    this.storageDirectory = storageDirectory;
  }

  async start(): Promise<void> {
    this.projectName = (await loadProjectName(this.storageDirectory)) ?? "Untitled Project";
    this.data = await loadProjectTimes(this.storageDirectory);

    const entry = this.data.projects[this.projectName] ?? { totalSeconds: 0, sessions: [] };
    this.data.projects[this.projectName] = entry;
    this.baselineTotalSeconds = entry.totalSeconds;
    entry.sessions.push({ startedAt: new Date().toISOString(), seconds: 0 });

    this.intervalHandle = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }
    void this.flush();
  }

  /** Re-reads the project name on file — call after Save New Version renames it. */
  async refreshProjectName(): Promise<void> {
    const name = (await loadProjectName(this.storageDirectory)) ?? "Untitled Project";
    if (name === this.projectName) return;

    await this.flush();
    this.projectName = name;
    const entry = this.data.projects[this.projectName] ?? { totalSeconds: 0, sessions: [] };
    this.data.projects[this.projectName] = entry;
    this.baselineTotalSeconds = entry.totalSeconds;
    this.sessionSeconds = 0;
    this.lastFlushedSeconds = 0;
    entry.sessions.push({ startedAt: new Date().toISOString(), seconds: 0 });
  }

  private tick(): void {
    this.sessionSeconds += 1;
    const entry = this.data.projects[this.projectName];
    if (entry) {
      entry.totalSeconds = this.baselineTotalSeconds + this.sessionSeconds;
      const session = entry.sessions[entry.sessions.length - 1];
      if (session) session.seconds = this.sessionSeconds;
    }

    if (this.sessionSeconds - this.lastFlushedSeconds >= FLUSH_EVERY_SECONDS) {
      void this.flush();
    }
  }

  private async flush(): Promise<void> {
    this.lastFlushedSeconds = this.sessionSeconds;
    await saveProjectTimes(this.storageDirectory, this.data);
  }

  private currentTotalSeconds(): number {
    return this.baselineTotalSeconds + this.sessionSeconds;
  }

  private buildDialogHtml(): string {
    const projects: TimerDialogProject[] = Object.entries(this.data.projects)
      .map(([name, entry]) => ({
        name,
        totalSeconds: name === this.projectName ? this.currentTotalSeconds() : entry.totalSeconds,
        isCurrent: name === this.projectName,
      }))
      .sort((a, b) => (a.isCurrent === b.isCurrent ? b.totalSeconds - a.totalSeconds : a.isCurrent ? -1 : 1));

    const data: TimerDialogData = {
      projectName: this.projectName,
      sessionSeconds: this.sessionSeconds,
      totalSeconds: this.currentTotalSeconds(),
      projects,
    };

    return timerHtmlTemplate.replace(DATA_PLACEHOLDER, JSON.stringify(data));
  }

  registerCommand(): void {
    this.context.commands.registerCommand("helping-hands.showProjectTimer", async () => {
      await this.flush();
      const raw = await this.context.ui.showModalDialog(dataUrl(this.buildDialogHtml()), 480, 360);
      const { action } = JSON.parse(raw) as TimerDialogResult;

      if (action === "reset") {
        const confirmHtml = confirmDialog({
          title: "Reset Project Timer",
          message: `Reset all tracked time for "${this.projectName}"? This can't be undone.`,
          confirmLabel: "Reset",
        });
        const confirmRaw = await this.context.ui.showModalDialog(dataUrl(confirmHtml), 400, 200);
        const { confirmed } = JSON.parse(confirmRaw) as { confirmed: boolean };
        if (!confirmed) return;

        this.data.projects[this.projectName] = { totalSeconds: 0, sessions: [] };
        this.baselineTotalSeconds = 0;
        this.sessionSeconds = 0;
        this.lastFlushedSeconds = 0;
        await this.flush();
      }
    });
  }
}

export function createProjectTimer(context: Ctx, storageDirectory: string): ProjectTimer {
  return new ProjectTimer(context, storageDirectory);
}
