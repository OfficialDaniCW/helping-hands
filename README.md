# Helping Hands ✋

An Ableton Live 12 extension built with `@ableton-extensions/sdk` that
reimagines the discontinued **Live Enhancement Suite** as a single right-click
hub plus a set of direct context-menu actions — device/chain/group templates,
track and clip utilities, a project timer, version-name tracking, and a scale
reference helper.

## What it adds

Right-click almost anything in Live (tracks, clips, clip slots, scenes, the
arrangement) and you'll find:

- **Helping Hands ✋** — opens the main hub: a searchable, categorised menu of
  devices, saved device-chain templates, and track/group templates, with
  one-click "Apply Chain" / "Insert" / "Create Group" actions.
- **Helping Hands: Settings** — toggles the feature menu entries on/off,
  switches the project timer on/off, sets your default Scale Helper
  preference, and links straight into the Menu Editor.

These two are always present, even with the feature menu hidden, so you can
always reach the rest of Helping Hands.

When "Show Helping Hands actions in right-click menus" is on, you'll also see,
depending on what you right-click:

| Action | Where | What it does |
| --- | --- | --- |
| Clear All Clips | Track | Empties every clip slot on the track |
| Colour Clips to Track | Track | Picks a colour and applies it to all clips on the track |
| Toggle Mute | Track | Flips the track's mute state |
| Track Info | Track | Shows device count, clip count, routing, and other details |
| Save Device Chain as Template | Track | Captures the track's devices as a reusable chain in the menu |
| Batch Rename Tracks | Scene | Renames multiple tracks at once via a pattern |
| Buplicate (×8) | Clip | Creates 8 sequential copies of a clip along the timeline |
| Disable Loop | Clip | Turns off looping and resets loop points |
| Rename Clip | Clip | Quick rename prompt |
| Set Scale | MIDI Clip | Previews a scale on a piano graphic and remembers your preference |
| Save New Version | Track / Scene | Tracks a `Name_2`, `Name_3`, … sequence and tells you what to save as |
| Show Project Timer | Track | Opens the running per-project time tracker |
| Add Cue Point Here | Arrangement selection | Drops a cue point at the selection start |
| Clear Selection | Arrangement selection | Clears all clips inside the selected time range on the selected tracks |

## The Helping Hands Menu

The centrepiece is a configurable menu (edited via **Edit Menu** in the hub or
**Settings → Open Menu Editor…**) of:

- **Plugin / Device** entries — one click inserts built-in Live devices, or
  copies a browser search query for VSTs/plug-ins (which the SDK can't insert
  directly).
- **Device Chain** templates — an ordered list of devices applied to the
  selected track in one go; built-ins are inserted automatically and anything
  else is listed as a manual follow-up step.
- **Group / Rack** templates — creates a starting track and walks you through
  the manual grouping/colouring/routing steps Live's SDK can't perform yet.

Everything is stored in `menuconfig.json` inside the extension's storage
directory, with `config/menuconfig.json` as the bundled starting point (also
the "Reset to Defaults" target in the editor).

## Known SDK limitations (and how Helping Hands works around them)

SDK 1.0.0-beta.0 doesn't expose every corner of Live yet. Rather than invent
API surface that doesn't exist, Helping Hands adapts:

- **No `Song.name`** — there's no way to read the Live Set's name, so
  Helping Hands keeps its own record (`projectname.txt`), prompting you for it
  once and reusing it for the project timer and version-save features.
- **No `Track.color`** — colouring clips/tracks isn't possible to *read*, so
  "Colour Clips to Track" uses a swatch picker instead of sampling the
  track's existing colour.
- **`Song.rootNote` / `scaleName` / `scaleMode` are read-only** — Set Scale
  can preview a scale on a piano graphic and remember your preference, but
  can't change Live's scale; it tells you exactly what to set in Live's own
  Scale chooser.
- **No track-grouping API** — "Create Group" makes a plain track with the
  right name and shows a manual checklist for grouping, colouring, and
  routing sends, since Live's SDK can't group tracks or set colours yet.
- **Third-party plug-ins can't be inserted programmatically** — chain and menu
  items for VSTs copy a browser search query to the clipboard instead.
- **No `unregisterCommand`** — command handlers are registered exactly once at
  startup; only their *context menu entries* are toggled when you flip
  "Show Helping Hands actions in right-click menus" off and on.

## Requirements

- Ableton Live 12 with the Extensions SDK enabled
- Node.js ≥ 24.14.1
- The `@ableton-extensions/cli` and SDK packages vendored in `vendor/`
  (already wired up via `package.json`)

## Setup

The path to Ableton Live's Extension Host module is stored in `.env` as
`EXTENSION_HOST_PATH`. The generator filled this in for you; edit it if your
install moves.

`npm start` also points the CLI at `.local/storage` and `.local/tmp` (created
on first run, gitignored) via `--storage-directory`/`--temp-directory` —
the dev CLI doesn't supply real paths for `context.environment.storageDirectory`
/ `tempDirectory` unless told to, and Helping Hands needs somewhere to persist
`menuconfig.json`, `settings.json`, etc.

```sh
npm install
npm start          # build + run in Live's Extension Host
```

## Scripts

```sh
npm start                  # build + run in Live's Extension Host
npm run build              # production bundle of src/extension.ts
npm run build:dev          # dev bundle (sourcemaps, not minified)
npm run package            # build for production + create a .ablx archive
```

## Project layout

```
src/
  extension.ts        activation entry point — wires everything together
  types.ts            shared interfaces for config files & dialog payloads
  config.ts           load/save menuconfig.json, settings.json, etc.
  menuActions.ts      registers every context-menu entry and command
  deviceMenu.ts       the "Helping Hands ✋" hub dialog and its actions
  menuEditor.ts       the menu editor dialog (add/edit/reorder/import/export)
  settingsPanel.ts    the settings dialog
  trackActions.ts     track-scoped feature actions
  clipActions.ts      clip-scoped feature actions
  projectTimer.ts     per-project time tracking
  versionSave.ts      "Save New Version" naming/history
  scaleHelper.ts      scale reference data and the Set Scale dialog
  ui/
    common.ts         shared dialog chrome (Live-styled CSS, message bridge)
    dialogs.ts        small reusable dialog builders (prompt/confirm/info/…)
    deviceMenu.html   the hub's tree view
    menuEditor.html   the menu editor's tree + edit form
    settings.html     the settings panel
    timer.html        the project timer panel
    scaleHelper.html  the Set Scale piano preview
config/
  menuconfig.json     bundled starting menu (Instruments, Effects, …)
  settings.json       bundled default settings
```

## Changelog

- **1.0.0** — initial release: menu system (devices/chains/groups), track and
  clip actions, project timer, version-save tracking, and the scale reference
  helper.
