<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->
## Database migrations

- The Drizzle migration set is intentionally empty (no migration files, zero journal entries, zero applied rows); the database's online-rooms tables and functions predate Drizzle and are read by the `/ruang` routes, so keep them and write new changes as fresh custom migrations instead of re-deriving a baseline snapshot from the live schema.

## Game architecture

- Online rooms use authenticated membership and server-authoritative, versioned turn-boundary replay; private RNG, decks and answer transcripts never reach clients, so reconnect does not depend on a host browser.
- Online room metadata and seats are member-readable with RLS; runtime is reachable only via SECURITY DEFINER RPCs gated by the `ONLINE_ROOM_SECRET` hash in `online_server_key` (no service role needed, so non-Lovable hosts work; Lovable hosting re-registers the hash), with revision compare-and-swap rejecting stale submissions.
- Game UI inherits the site palette inside `game-ui-theme`, while the player top bar uses its own board-aligned semantic tokens; scoped tokens keep scene materials and printed board art isolated from interface theme changes.

- Game rules live in `src/game/sim/` as pure TypeScript (no React/three); the turn flow is a generator (`playTurn`) that yields requests, so the UI controller (`src/game/store.ts`) and vitest share one rule path.
- The 3D scene (`src/game/scene/`) only draws store state; the `/` route uses `ssr: false` because the canvas is browser-only.
- The canvas wrapper gets `data-scene-ready` once tile textures have drawn; screenshot checks wait for it.
- Rule tests: `bunx vitest run src/game` (includes full bot-only games as invariants).
- Dev builds expose the zustand store as `window.__game` (state + actions) so browser checks can force UI states like banners.
- Transient per-frame visual impulses (camera shake, dice throw power) live in `src/game/fx.ts`, outside React state.
- Living-city visuals stay in `src/game/scene/`: GLB instances share immutable geometry/materials, normalize once per instance, and use ref-driven construction and traffic; they never write simulation state. City material colors use `--city-*` semantic CSS tokens because Three.js does not parse OKLCH.
- Scene quality defaults to the phone-safe tier (no live reflections, shadows or composer); desktop enhancement uses device hints and resolution adapts using measured frame intervals. Milestone cinematics observe existing banners in a separate presentation store and never change turn pacing; skip only dismisses visuals. Dev `window.__gamePerformance.report()/markdown()` counts all renderer passes for comparable measurements.
- Temporary board events use a deterministic round schedule separate from dice RNG; their rent modifiers are shared by payments, bots and per-level previews through `tollAtLevel`. World Cup remains a separate modifier. Event graphics are static tile markers to preserve phone performance.
- Realism comes from PBR surface detail (procedural normal maps in `textures.ts`) and shared soft blob shadows under moving pieces, so phone tier stays grounded without shadow maps. N8AO is not used: alongside drei `<Environment>` it crashed the cube render target and blanked the scene.
- Camera shots are chosen by pure rules in `scene/director.ts` (priority + which builds earn a showcase, unit-tested); `CameraRig` only eases toward the chosen shot and never affects turn pacing. Table drag captures the pointer only after a small movement threshold, because capturing on press retargets clicks away from the canvas and breaks tile picking.
- Player pieces reflect their own PMREM `RoomEnvironment` probe (built once per renderer in `Tokens.tsx`), because the table's sparse Lightformer environment leaves mirror metal nearly black; seat identity stays readable through player-coloured enamel bands and a gem.
- Board topology lives only in `sim/board.ts` (per-area outer loops, gate segments, shared Pentagon ring, addressed by helper ids); `scene/layout.ts` derives every world position from it, so rule changes never hand-place 3D tiles.
- Board art and city GLB models are bundled project files (not `/__l5e/` CDN pointers), because the app is also hosted outside Lovable where those relative CDN URLs 404; each city model sits in a `ModelBoundary` so one failed model never blanks the board.
- Official printed art (board background, logo) is painted into the canvas textures, with the procedural art as the fallback until it loads; vote coins use shared per-area materials from `scene/coins.ts`.
- Official non-quiz cards are attributed data in `sim/official-cards.json`; the generator draws shuffled subdecks without replacement and yields private voting/debate requests so bots, UI, and tests share one resolution path.
- Vote origins travel with player hands and plot investments; all rewards, transfers and returns use the simulation helpers to conserve the finite per-area supply.
- Site pages (Beranda, Tentang, Kunci Jawaban, Peringkat) come from the 100-suara-bangun-bangsa repo; their data helpers live in src/site/ and styles in src/site.css, separate from the 3D game in src/game/ which is served at /main.
- Offline bot setup lives in GameState via createGame's setup; the `/main` lobby (`src/game/ui/Lobby.tsx`, tabs via `?mode=bersama|bot`; Main Bersama offers online or same-device, both seat lineups share one component) passes an explicit five-seat human/bot lineup, while the older opponent-count path marks unused seats absent so the 5-area board and seat=index mapping stay intact.
- Avatars are indexes into the append-only `AVATAR_LIST` (`src/game/ui/avatars.ts`); seats store them (browser storage offline, `online_members.avatar` online), and online rooms take a preferred seat that falls back to the next free one.
