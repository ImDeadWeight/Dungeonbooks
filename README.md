<img src="app-icon.svg" alt="Dungeon Books icon" width="96">

# Dungeon Books

Encounters and Lorekeeper in one app. The **Encounters** tab is the encounter builder and initiative tracker; the
**Lorekeeper** tab is the hyperlinked campaign notebook. The switch at the start of the top bar moves between them,
and each tab stays as you left it.

Linking works as it did between the two apps, without the shared folder: link a campaign to a notebook (from the
campaign's editor, or the notebook menu) and the Encounters tab suggests the notebook's Character pages, while the
Lorekeeper tab shows the campaign's encounters, their combat state, and characters' stat blocks. Changes show in the
other tab right away. Open in Lorekeeper / Open in Encounters switch tabs and open the page, encounter or character.

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

- `src/encounters/`, `src/lorekeeper/`: each app's domain, state, storage and UI, as in the separate apps.
- `src/bridge/`: what the tabs share: which campaign is linked to which notebook (`links.ts`), each side's catalogue
  of linked campaigns and notebooks (`catalogs.ts`, the same catalogues the apps used to write to the shared folder),
  and the showing tab plus opening things in the other one (`navigation.ts`).
- `src/shell/`: the window: both tabs, the tab switch, window controls.
- `src/storage/`: saving JSON documents; each tab keeps its own folder.
- `src/migration/`: the first-start copy of the old apps' data.
- `build/scopeTabCss.ts`: the two apps' stylesheets reuse class names, so every rule is prefixed with the tab it
  belongs to (`:root[data-tab="encounters"] …`) and only the showing tab's styles apply.

## Data

Saved as JSON under `%APPDATA%\com.dungeonbooks.app\data\`:

- `encounters\`: `library.json`, `characters.json`, `conditions.json` (as in Encounters).
- `lorekeeper\`: `library.json`, `notebook-<id>.json`, `view.json` (as in Lorekeeper).
- `shared\`: `links.json` (campaign ↔ notebook), `view.json` (which tab was showing), `copied-from-old-apps.json`.

**Coming from the separate apps:** on Windows, the first start copies Encounters' and Lorekeeper's data
(`%APPDATA%\com.encounters.app\data` and `%APPDATA%\com.lorekeeper.app\data`) and the links between them. Ids are kept,
so characters still point at their pages. The old folders are only read, so the separate apps keep working with their
own copies; changes in one place don't reach the other. The copy happens once (`shared\copied-from-old-apps.json`
records it) and never over data made here. To copy again, close the app and delete `%APPDATA%\com.dungeonbooks.app`.

On Android, apps can't read each other's files, so bring data over with each tab's Import (an Encounters backup, an
exported notebook) and link the campaign to its notebook again. An imported notebook gets a new id; once it's
linked, characters made from its pages find them again (by page id) on their own.
