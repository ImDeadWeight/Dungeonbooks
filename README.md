<img src="app-icon.svg" alt="Dungeon Books icon" width="96">

# Dungeon Books

Encounters and Lorekeeper in one app. Each **campaign** has both: its areas and encounters in the **Encounters** tab
(the encounter builder and initiative tracker) and its notes in the **Lorekeeper** tab (the hyperlinked notebook). The
switch at the start of the top bar moves between the tabs, and each tab stays as you left it.

The campaign menu next to it shows the open campaign; its list switches campaigns, renames one (double-click or the
pencil), opens a campaign's settings (name, default format, export its encounters or its notes, delete it), and makes
a new one. Both tabs always show the same campaign. The Encounters tab suggests the notes' Character pages when naming
characters, and the Lorekeeper tab shows the campaign's encounters, their combat state, and characters' stat blocks;
changes show in the other tab right away. Open in Lorekeeper / Open in Encounters switch tabs and open the page,
encounter or character (and its campaign, if another one is open).

The character library and custom conditions are shared by every campaign.

**Linking notes.** Mentions of another page's title or aliases (the page's **Also called** field, comma-separated)
get a dotted underline and a link button; plurals count ("Veilstrands"). While typing, when the words just typed start
the name of one page, the rest of the word shows in grey: **Tab** finishes the word and links what you wrote to that
page (Escape hides it; on a phone, tap the chip above the text). Typing `[[` or pressing **Ctrl+Space** opens a list
of pages that fit, typos forgiven and recently opened or same-folder pages first; Enter or Tab links, and the last
row creates a page by that name. Ctrl+Space with text selected links the selection as it is. A link keeps its own
wording, and follows the page through renames.

Built with Tauri 2 + React + TypeScript, from the Encounters and Lorekeeper code; the shared game formats and catalogue
formats still come from the [campaign-link](https://github.com/ImDeadWeight/campaign-link) package.

## Develop

```sh
npm install
npm run dev        # browser-only UI at http://localhost:1440 (data in localStorage)
npm test           # domain logic tests
npm run tauri dev  # desktop app (same one-time Rust setup as Encounters)
```

The dev server uses port 1440 (Encounters uses 1420, Lorekeeper 1430), so all three can run at once.

**Android** (same one-time setup as Encounters' README describes):

```sh
npm run tauri android init     # once; generates src-tauri/gen/android (not committed)
npm run tauri android build -- --debug --apk --target aarch64 --target x86_64   # phones + emulator
```

The APK lands in `src-tauri/gen/android/app/build/outputs/apk/universal/debug/`.

`src-tauri/gen/android` is generated and not committed, so after `android init` make the same two edits by hand:

- `app/src/main/java/com/dungeonbooks/app/MainActivity.kt`: call `enableEdgeToEdge()` before `super.onCreate(...)`
  (import `androidx.activity.enableEdgeToEdge`). The phone styles keep clear of the status and navigation bars
  themselves.
- Release signing: copy the `signingConfigs` block from Lorekeeper's `app/build.gradle.kts` (it reads
  `../keystore.properties`; see `C:/Users/plcar/.android-signing/README.txt`), set
  `signingConfig = signingConfigs.getByName("release")` in the release build type, and put `keystore.properties` next
  to `settings.gradle`. Then `npm run tauri android build -- --apk --target aarch64` gives a signed release APK in
  `.../apk/universal/release/`.

The launcher icon comes from `src-tauri/icons/android` (a vector symbol on the app's tile colour).

## Code layout

- `src/campaigns/`: the campaign list and which campaign is open (`campaignStore.ts`), and creating, opening,
  renaming and deleting campaigns (`lifecycle.ts`), which each tab joins in through its `state/campaignParticipant.ts`.
- `src/encounters/`, `src/lorekeeper/`: each app's domain, state, storage and UI, from the separate apps.
- `src/bridge/`: what the tabs share: each side's catalogue of the campaigns (`catalogs.ts`, the same catalogues the
  apps used to write to the shared folder), and the showing tab plus opening things in the other one (`navigation.ts`).
- `src/shell/`: the window: both tabs, the tab switch, the campaign menu and dialog, window controls.
- `src/ui/`: components both tabs use (the dialog frame).
- `src/storage/`: saving JSON documents; each tab keeps its own folder.
- `src/migration/`: the first-start copy of the old apps' data, and turning their two lists into one campaign list.
- `build/scopeTabCss.ts`: the two apps' stylesheets reuse class names, so every rule is prefixed with the tab it
  belongs to (`:root[data-tab="encounters"] …`) and only the showing tab's styles apply.

## Data

Saved as JSON under `%APPDATA%\com.dungeonbooks.app\data\`:

- `shared\`: `campaigns.json` (every campaign's name and default format, and which is open), `view.json` (which tab
  was showing), `copied-from-old-apps.json`.
- `encounters\`: `library.json` (every campaign's areas and encounters), `characters.json`, `conditions.json`.
- `lorekeeper\`: `notebook-<campaign id>.json` (a campaign's notes), `view.json` (folded folders per campaign).

Before there was one campaign list, Encounters' campaigns and Lorekeeper's notebooks were separate lists with links
between them. The first start that finds no `campaigns.json` makes the one list: a linked campaign and notebook become
one campaign (the campaign's id and name; its notes move to that id, and characters made from them follow), an
unlinked campaign gets empty notes, and an unlinked notebook becomes a campaign with no encounters yet. Encounters
that weren't in any campaign (and anything whose campaign is gone) go into the open campaign.

**Coming from the separate apps:** on Windows, the first start copies Encounters' and Lorekeeper's data
(`%APPDATA%\com.encounters.app\data` and `%APPDATA%\com.lorekeeper.app\data`) and the links between them, then makes
the one campaign list as above. Characters still point at their pages. The old folders are only read, so the separate apps keep working with their
own copies; changes in one place don't reach the other. The copy happens once (`shared\copied-from-old-apps.json`
records it) and never over data made here. To copy again, close the app and delete `%APPDATA%\com.dungeonbooks.app`.

On Android, apps can't read each other's files, so bring data over with each tab's Import: an Encounters backup first
(its campaigns join the list), then, with a campaign open, its exported notebook (the Lorekeeper tab's Import fills the
open campaign's notes when it has none yet, and otherwise adds the notes as a new campaign). Characters made from the
notebook's pages find them again (by page id) on their own.
