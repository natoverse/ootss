# Order of the Sinking Star Interactive Map

## Changes from upstream

This fork extends [joric/ootss](https://github.com/joric/ootss) with:

* [Grid wayfinding](#grid-addresses): map-prefixed, signed screen addresses,
  nested cell letters, finer grid overlays, and live hover coordinates.
* [Fog of war](#fog-of-war): mist-covered screens, independently saved
  exploration on every layer, and per-screen or bulk reveal/hide controls.
* [Google accounts and cloud settings](#google-accounts-and-cloud-settings):
  optional Firebase-backed profiles alongside permanent local guest saves.
* Unified map controls: an upper-right dock for map navigation, visibility
  layers, cell addresses, search, settings and game-save tools, screenshot
  lookup, zoom, and a link to this fork on GitHub.
* Cell-aligned level markers: translucent, region-colored circles that scale
  with map zoom instead of oversized pins, with hover and selection highlights.
* Per-screen completion: mark all puzzles solved together, with mixed-state
  checkboxes that preserve individual exceptions.
* Unsolved puzzle highlighting: bright yellow cells show unfinished puzzles
  outside fog, independently of the level markers.
* [Shared message boards](#messages): signed cell discussions, general chat,
  progress-aware spoiler controls, and optional cell-corner message chits.
* [Automated deployment](#github-pages-deployment): GitHub Actions publishes
  changes on `main` to this fork's GitHub Pages site.

* Live app: https://natoverse.github.io/ootss/
* Upstream demo: https://joric.github.io/ootss
* Project wiki: https://github.com/joric/ootss/wiki

## Grid addresses

Enable **Grid** in the dock's **Layers** panel to show screen addresses, a lighter
cell grid inside each screen, and a live **Cell** address while hovering.
This applies to all map layers.

Addresses combine signed screen X/Y coordinates with cell X/Y letters.
Each axis includes a sign and two digits, such as `+00` or `-13`.
Crossroads is screen `+00+00`, at zero-based screen `(5,5)` from the lower left
of the 10-by-12 screen grid. Screen X ranges from `-5` to `+4`, and screen Y
from `-5` to `+6`. Within each screen, letters increase right (`A` through `S`)
and up (`A` through `M`) from `AA` at the lower left.
The center cell of Crossroads is `O+00+00JG` on the overworld;
zero always displays with a `+` sign. All layers use letters starting at `AA`
in each screen's lower-left corner, with their existing calibrated inner grids.

| Layer | Code | Origin screen from lower left (zero-based) | Inner grid |
|---|---|---|---|
| Overworld | `O` | `(5,5)` | 19 by 13 |
| Overworld high | `OH` | `(5,5)` | 19 by 13 |
| Overworld low | `OL` | `(5,5)` | 19 by 13 |
| Intro | `I` | `(3,0)` | 13 by 7 |
| Skipping stones | `S` | `(5,13)` | 9 by 6 |
| Minimap | `M` | `(5,5)` | 5 by 3 |
| Minimap high | `MH` | `(5,5)` | 5 by 3 |
| Minimap low | `ML` | `(5,5)` | 5 by 3 |

Skipping stones has a partial top row in the current calibration; the grid and
fog are clipped to the map edge. Minimap origins use the currently identified
entry screen and can be adjusted if further exploration shows otherwise.

## Fog of war

**Fog of War** is enabled by default in the upper-right **Layers** panel. Clouds
cover unexplored screens and their markers; only each layer's origin starts clear.
Uncheck the cloud checkbox in a screen's upper-right corner to reveal it, or
check it again to obscure it. This works independently of the **Grid** overlay.

The **puzzle-icon checkbox** immediately below each cloud checkbox marks every puzzle
on that screen solved. A dash means only some puzzles are solved; clicking it
marks all solved. You can then uncheck an individual puzzle's **Solved** box
without clearing the others, and the screen checkbox returns to a dash.
Unchecking a fully checked screen checkbox clears that screen's puzzle flags.
Empty screens have a disabled completion checkbox. Completion uses the existing
saved puzzle flags, so it works with guest/cloud profiles and settings imports
and exports; it does not reveal the screen or change fog settings.

Enable **Highlight Unsolved Puzzles** in **Layers** to turn cells with unfinished
puzzles bright yellow. Fog-covered cells are excluded; turning fog off treats
all screens as visible. Highlights disappear when every puzzle at the cell is
solved and return if you uncheck one. The toggle is saved with your profile and
works even when **Levels** is hidden.

The **Layers** panel also includes **Reveal All** and **Hide All** buttons.
These update the saved screen checkboxes only for the selected map layer, always
leaving its starting screen clear. They do not change the global **Fog of War**
option or exploration on other layers.

Exploration is tracked separately on every map layer.
Turning **Fog of War** off reveals the entire map without erasing your progress.
The `fogOfWar` setting and `revealedScreens` map are stored with completed levels
in the existing settings JSON. **Settings > Save Settings** exports them, and
**Settings > Load Settings** restores them. Older settings files default to fog
enabled with each layer's origin clear; **Reset Settings** resets exploration as well.
Existing saved `H`/`L` addresses and single-digit screen coordinates are migrated
automatically to `OH`/`OL` and two-digit coordinates without losing reveal choices.

## Google accounts and cloud settings

Guests can use the app indefinitely with settings saved in this browser's
localStorage. The top-right **Sign in with Google** button switches to a
separate Firebase profile; **Sign Out** switches back to your unchanged guest
save. Guest progress is **not** automatically imported into a Google account.

Signed-in settings, completed-level flags, fog exploration, and map preferences
are stored in the account's private Firestore document. **Save Settings** exports
the active guest or cloud profile; **Load Settings** explicitly replaces that
profile from a settings JSON file. Resetting settings affects only the active
profile.

The top-right status shows saving, synced, offline, or sync errors. Failed
changes remain in memory for retry or JSON export; click **Sync Error** to retry.
Firebase caches signed-in data in IndexedDB and queues offline edits. Connect
and finish syncing before signing out or closing a tab with unsaved changes.
Other devices load the account's latest settings when refreshed; simultaneous
full-profile saves use last-write-wins behavior.

See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) to create the independent OOTSS
database and enable Google login. Until configured, guest saves keep working
and the top-right **Firebase setup** link provides configuration guidance.

## Messages

Use the speech-bubble button beside the zoom controls to open or close the
**Messages** panel below the primary dock. All signed-in users can read and
post; guests keep their map functionality but cannot access shared messages.

**Cell Discussions** shows the latest messages from every cell when nothing
is selected. Click a map cell while the panel is open, choose **Discuss This
Cell** in a marker popup, or click a message's address to open that cell's
independent board. **All Cells** returns to the latest feed. Addresses retain
their map prefixes, so discussions on `O`, `OH`, `OL`, `I`, `S`, `M`, `MH`, and
`ML` never overlap. **General Chat** is a separate stream without a cell address.

Messages show the author's Google display name and a timestamp, oldest first.
The latest 50 are loaded initially; **Load Older Messages** retrieves earlier
history. New posts appear in real time while the panel is open. Posts are plain
text, up to 4,000 characters, and append-only. Drafts survive closing the panel
and switching streams during this page session; they are not included in map
save files. Wait for **Sending...** to finish before leaving or signing out.

Cell messages are obscured if the current profile's fog covers their screen,
or if any puzzle at that exact cell is not marked solved. Turning fog off
exposes screen-related messages, but does **not** expose unsolved-puzzle
messages. **Show Spoiler** reveals just that message; **Hide Spoiler** covers it
again. Closing or changing the discussion resets explicit reveals.
General chat has no automatic cell-based spoiler masking.
This is a reading convenience, not a security boundary: signed-in users share
access to the messages, but never to each other's private progress documents.

Enable **Cell Messages** in **Layers** to show small blue corner chits on cells
with discussions. Clicking a chit opens that cell's board, without activating
the level icon. Chits stay in the cell's upper-right corner as you zoom, and
respect fog coverage. The layer uses a lightweight per-map board directory,
not the latest-feed limit, so older discussions still get a chit.

Shared messaging uses the existing OOTSS Firebase project. Publish the updated
rules and create the collection-group index described in
[FIREBASE_SETUP.md](FIREBASE_SETUP.md#shared-messaging-setup-for-existing-projects).
GitHub Pages deployment does not automatically publish database rules/indexes.
Messages are stored separately from settings; importing, exporting, or resetting
map progress does not change anyone's posts.

## GitHub Pages deployment

`.github/workflows/pages.yml` publishes the static app on every push to `main`.
You can also run **Deploy GitHub Pages** from the repository's **Actions** tab
using **Run workflow**, with `main` selected. Guest use needs no configuration.
Google accounts require the six Firebase configuration secrets documented in
[FIREBASE_SETUP.md](FIREBASE_SETUP.md).

Repository configuration:

1. In **Settings > Pages > Build and deployment**, set **Source** to
   **GitHub Actions**.
2. In **Settings > Actions > General**, enable GitHub Actions and allow the
   official `actions/*` actions used by the workflow.
3. If the `github-pages` environment restricts deployment branches, allow `main`
   in **Settings > Environments > github-pages**. Any required environment
   reviewers must approve the deployment before it can publish.

These settings are already configured for `natoverse/ootss`. The workflow grants
its deployment job `pages: write` and `id-token: write`; no personal access token
is required. The deployed URL appears in the workflow's deployment environment.

Only `index.html`, `play.html`, `js/`, `data/`, `assets/`, `.nojekyll`, and `LICENSE` are
published. Export scripts and repository configuration are not included.
The app uses relative paths for its bundled assets, so it works under `/ootss/`.
Map tiles and level screenshots remain hosted at
`https://joric.github.io/ootss_tileset`; this deployment depends on that external
asset host remaining available.
