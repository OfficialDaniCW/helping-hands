import { initialize, type ActivationContext } from "@ableton-extensions/sdk";

import { registerMenuActions } from "./menuActions.js";
import { createProjectTimer } from "./projectTimer.js";
import { loadSettings } from "./config.js";

/**
 * Helping Hands ✋
 *
 * Reimagines the discontinued Live Enhancement Suite's workflow shortcuts as
 * a single right-click hub plus a handful of direct context-menu actions —
 * see README.md for the full feature rundown and the SDK limitations that
 * shaped this build (no track grouping/colour API, read-only scale, etc).
 */
export function activate(activation: ActivationContext) {
  const context = initialize(activation, "1.0.0");

  const storageDirectory = context.environment.storageDirectory ?? context.environment.tempDirectory;
  if (!storageDirectory) {
    console.error("Helping Hands: no writable storage directory is available — the extension can't persist its configuration, so it won't activate.");
    return;
  }

  void (async () => {
    const projectTimer = createProjectTimer(context, storageDirectory);
    const settings = await loadSettings(storageDirectory);

    if (settings.projectTimerEnabled) {
      await projectTimer.start();
    }

    // The SDK has no `unregisterCommand` / deactivation hook in 1.0.0, so the
    // returned teardown function (unregistering context menu entries) is kept
    // only for completeness — there's currently nothing that calls it.
    await registerMenuActions({ context, storageDirectory, projectTimer });
  })().catch((error: unknown) => {
    console.error("Helping Hands failed to activate:", error);
  });
}
