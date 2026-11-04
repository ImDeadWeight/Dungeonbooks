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

**SRD creatures and difficulty.** For 5e (2014 and 2024) the encounter builder's list switches between your characters
and the SRD's creatures (SRD 5.1 and 5.2.1; search by name, CR and type, open a row for its stat block). Adding one
copies it into the character library once, tagged SRD, and reuses that copy; the library's **From the SRD** window
copies them in to edit. The encounter header and the builder's cart rate the fight: 5e by SRD 5.2.1's XP budget per
character (Low, Moderate, High), PF2e and SF2e by GM Core's threat budgets. PCs make the party (NPCs on their side are
allies); until an encounter has PCs, the campaign's usual party (in its settings) stands in. The creatures live in
`public/compendium/`, built by `npx vite-node scripts/compendium/build.ts -- <folder>` from the 5e-bits data; the
licence notices are in [NOTICE.md](NOTICE.md).

**Linking notes.** Mentions of another page's title or aliases (the page's **Also called** field, comma-separated)
get a dotted underline and a link button; plurals count ("Veilstrands"). The first time a page's exact name is typed
on a page it links by itself once a space or punctuation follows; **Backspace** straight after takes the link off.
While typing, when the words just typed start the name of one page, the rest of the word shows in grey, with the page
it links to: **Tab** finishes the word and links what you wrote to that page (Escape hides it; on a phone, tap the
chip above the text). With no grey text, **Tab** links the name just typed, part of a name included ("Mira" for Mira
Thorne), or lists the pages when several fit. Typing `[[` or `@` or pressing **Ctrl+Space** opens a list of pages that
fit, typos forgiven and recently opened or same-folder pages first; Enter or Tab links, and the last row creates a page
by that name. Ctrl+Space with text selected links the selection as it is. A link keeps its own
wording, and follows the page through renames. **Copy as Markdown** (in a page's ⋯ menu, and a folder's) copies
it as Markdown, links as `[[Title]]`, for pasting into any AI chat.

Each sidebar row has one ⋯ button for its actions (rename, new page or folder inside, page types, copy, delete; folders
also keep a + for a new page inside), and
the bar under a page's title has a ⋯ menu for Link encounter, Other names (the aliases field, which then stays while
a page has some), Add image and Copy as Markdown.

**Backlinks.** Under a page's title, a folded line says which pages link to it (in text, or by a pin on a map) and
which mention it without a link; opened, it lists each with the words around the mention, and a link button that links
those mentions. The peek panel lists the pages linking there.

**Images and maps.** Drop or paste pictures on a page, or use Add image; drag, resize and caption them like text
boxes. An image's map button (or a double-click) opens it as a map over the page: zoom and pan, tap a spot to pin a
page there (typing picks the page, or makes one), tap a pin to peek, open its page or open that page's own map, and
drag pins to move them. Pins show on the image on the page too. Exports carry the pictures inside the file.

**Pages inside pages.** A page can hold other pages: drag a page onto another (or use "New page under this one" in its
⋯ menu), and the page gets a caret that opens and closes like a folder; clicking its name still opens it. So Vaultrock
holds Gladiator Pit and The Mines, and a faction holds its members, without a folder of the same name beside it.
Deleting a page deletes the pages under it. Character pages also have **Belongs to**: the places and factions the
character is part of, and each Place and Faction page lists its characters under its title (click to peek, Ctrl+click
to open). Notes from before this are upgraded when first opened: a folder holding a page of its own name becomes that
page with the rest under it, and characters in a folder named after a place or faction belong to it. A copy of the
notes as they were is kept as `notebook-<campaign id>.before-format-2.json`.

**Connect AI** (desktop app, top bar) lets AI apps that speak the Model Context Protocol work with the open campaign's
notes: get an overview, search, read pages as Markdown, create pages, add or replace text, change a page's details and
link mentions. On maps they can look at the picture (with a grid and numbered pins, for models that see images), add,
move and remove pins, and set captions. They can also look at the Encounters tab without changing it: list and read
encounters, search and read creatures (the user's NPCs and the SRD's), and rate a planned fight. They can't delete pages, and each change can be undone (Settings → AI changes, or the notice that shows when one happens). Connections are off until switched on there;
the dialog gives the setup to paste:

- Claude Desktop and Claude Code start the app's executable with `--mcp-stdio`, which relays to the running app (and
  starts it if needed).
- Other apps use `http://127.0.0.1:47615/mcp` with the token from the dialog (`Authorization: Bearer …`). Only this
  computer can connect, and requests from web pages (with an `Origin` header) are refused.
- ChatGPT and Claude on the web only reach servers on the internet, so they can't connect yet.

**Assistant** (the third tab) chats with a model about the open campaign's notes, using the same actions. Models finds
servers to connect to: Ollama, LM Studio, llama.cpp, Jan, KoboldCpp, text-generation-webui, vLLM and Redstart Nest on
this computer (by their usual ports), and on the local network Redstart Nest (by its beacon on port 8765) and Ollama or
LM Studio shared to the network; a phone looks on the network. Servers can also be added by address, and Claude or GPT
used with an Anthropic or OpenAI API key (paid per use). Reading and searching happen straight away; each change waits
for Allow or Skip unless allowed for the whole chat, and shows Undo once made. Chats, connections and keys are saved on the device.

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
- Plain http on the local network (the Assistant's model servers): in `app/build.gradle.kts`'s release build type,
  add `manifestPlaceholders["usesCleartextTraffic"] = "true"` (debug builds already allow it).

The launcher icon comes from `src-tauri/icons/android` (a vector symbol on the app's tile colour).

## Code layout

- `src/campaigns/`: the campaign list and which campaign is open (`campaignStore.ts`), and creating, opening,
  renaming and deleting campaigns (`lifecycle.ts`), which each tab joins in through its `state/campaignParticipant.ts`.
- `src/encounters/`, `src/lorekeeper/`: each app's domain, state, storage and UI, from the separate apps.
- `src/bridge/`: what the tabs share: each side's catalogue of the campaigns (`catalogs.ts`, the same catalogues the
  apps used to write to the shared folder), and the showing tab plus opening things in the other one (`navigation.ts`).
- `src/shell/`: the window: both tabs, the tab switch, the campaign menu and dialog, the Connect AI dialog, window
  controls.
- `src/assistant/`: what AI apps can do (`notesTools.ts` for the notes; `tools/` for maps, encounters and creatures,
  all listed in `tools/index.ts`), notes as Markdown and back (`markdown.ts`,
  `notesMarkdown.ts`), and answering their MCP messages (`mcpServer.ts`, `connection.ts`). The native side,
  `src-tauri/src/mcp.rs`, runs the local server, hands each request to the web UI, and has the `--mcp-stdio` relay.
  The Assistant tab: `chat/` (chats, connections, running a chat), `models/` (finding servers, talking to them over
  the native HTTP plugin), `ui/`.
- `src/ui/`: components both tabs use (the dialog frame).
- `src/storage/`: saving JSON documents; each tab keeps its own folder.
- `src/migration/`: the first-start copy of the old apps' data, and turning their two lists into one campaign list.
- `build/scopeTabCss.ts`: the two apps' stylesheets reuse class names, so every rule is prefixed with the tab it
  belongs to (`:root[data-tab="encounters"] …`) and only the showing tab's styles apply.

## Data

Saved as JSON under `%APPDATA%\com.dungeonbooks.app\data\`:

- `..\ai-connection.json` (beside `data\`, where `--mcp-stdio` finds it): whether AI apps may connect, the port and
  their token.
- `assistant\`: `settings.json` (connected model servers, with their keys or sign-in tokens), `chats.json`.
- `shared\`: `campaigns.json` (every campaign's name and default format, and which is open), `view.json` (which tab
  was showing), `copied-from-old-apps.json`.
- `encounters\`: `library.json` (every campaign's areas and encounters), `characters.json`, `conditions.json`.
- `lorekeeper\`: `notebook-<campaign id>.json` (a campaign's notes), `view.json` (folded folders per campaign),
  `ai-changes-<campaign id>.json` (the last 100 AI changes, for undo), `images\<campaign id>\` (pictures, named by
  content hash; ones nothing uses are deleted when the campaign opens).

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
