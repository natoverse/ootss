# Order of the Sinking Star Interactive Map

* Live app: https://natoverse.github.io/ootss/
* Upstream demo: https://joric.github.io/ootss
* Project wiki: https://github.com/joric/ootss/wiki

## Grid addresses

Enable **grid** in the map's layer selector to show screen addresses, a lighter
19-by-13 cell grid inside each screen, and a live **Cell** address while hovering.
This applies to the overworld, sky, and underworld maps.

Addresses combine signed screen X/Y coordinates with cell X/Y letters.
Crossroads is screen `+0+0`, at zero-based screen `(5,5)` from the lower left
of the 10-by-12 screen grid. Screen X ranges from `-5` to `+4`, and screen Y
from `-5` to `+6`. Within each screen, letters increase right (`A` through `S`)
and up (`A` through `M`) from `AA` at the lower left.
The center cell of Crossroads is `+0+0JG`; zero always displays with a `+` sign.

## GitHub Pages deployment

`.github/workflows/pages.yml` publishes the static app on every push to `main`.
You can also run **Deploy GitHub Pages** from the repository's **Actions** tab
using **Run workflow**, with `main` selected. No build tools or secrets are needed.

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

Only `index.html`, `play.html`, `js/`, `data/`, `.nojekyll`, and `LICENSE` are
published. Export scripts and repository configuration are not included.
The app uses relative paths for its bundled assets, so it works under `/ootss/`.
Map tiles and level screenshots remain hosted at
`https://joric.github.io/ootss_tileset`; this deployment depends on that external
asset host remaining available.
