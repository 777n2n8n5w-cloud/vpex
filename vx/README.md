# VPEX Experience layer (vx)

One system on top of all 107 public themes: **light**, **material** and **motion**. Built into `index.html` by `python3 vx/build.py` (run it after editing anything here; `--check` fails if `index.html` is stale, and `tests/vx_experience.js` runs that check).

| File | What it holds |
| --- | --- |
| `core.css` | The system. `@MO(name)` and `@DET(name)` expand to the themes that use that motion personality or card detail. |
| `themes.py` | One identity recipe per public theme: ambient lights, texture, grain, vignette, motion personality, card detail, foil colors. The build fails if a theme is missing. |
| `vx.js` | The interaction engine. Runs inside the app's main script, so it can wrap `setTheme`, `openCommand` and `featOpen`. |

## Light
Each theme has up to three ambient lights that drift slowly (transform only) and brighten as calling momentum (`--heat`) builds; a logged call flares them. Dark themes use colors pre-screened over the theme's background, so plain alpha compositing reads as light without blend modes (cheap on phones). Everything ambient pauses after 90 seconds without input.

## Material
Fine grain over the whole app (below sheets), a vignette, an optional texture (linen, brushed metal, guilloché, topo lines, waves, stars, sparkle, confetti, bokeh, carbon, stucco), a lit top edge and an accent bounce on every card. Card details: `hair` (inner hairline), `stitch` (seam), `corners` (brackets), `foil` (a sweep when the next lead deals in). Swiss, Minimalism, High contrast and Neo-Brutalism stay unlit on purpose.

## Motion personalities
`silk` (luxury), `glide` (everyday), `snap` (sports, neon, tech), `bounce` (playful), `float` (nature), `step` (retro screens), `hard` (Swiss, Neo-Brutalism), `still` (Minimalism, Editorial, High contrast). They set how views arrive, how the next lead deals in, how sheets rise and how buttons press.

## Interactions
Tab ink glides between tabs; views arrive from the side you moved toward; rows rise in sequence; bars and charts draw in; key numbers count up; today's count rolls when it climbs; a touch light blooms where you tap; the Call button carries a light that follows your finger or cursor; sheets rise and fade; Command powers up panel by panel; switching themes from the picker opens the new theme out from the card you tapped (View Transitions, where supported).

## Rules
- Transform and opacity only; no filters or blend modes on full-screen layers.
- Reduce Motion (system) and the in-app Motion switch stop every vx animation; nothing waits on one.
- Under automation (`navigator.webdriver`) vx motion is off (`html.vx-auto`) so the functional tests see settled layout; `window.__vxForce` turns it on for `tests/vx_experience.js`.
- Signature themes keep their own world (no shared lights or grain) and move with `silk`.
