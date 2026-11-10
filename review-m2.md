# Independent review — dreamer-genui M2: Core

## Re-review (round 1 fix)

- **Range:** `77e8487..30478f5` (commit `30478f5` — "M2: review round 1 — attach.theme detour scope, contrast guardrail rewrite, product-string rename")
- **Re-verified:** 10 Nov 2026, working tree at `30478f5`

### VERDICT: **approve**

All three majors from round 1 are resolved and independently re-verified (details below). The fix is small (213 insertions / 45 deletions across 7 files), correctly scoped, and adds 5 new tests pinning the changed behaviour. Build, types and full suite are green. Two non-blocking observations are recorded at the end.

### Round-1 majors — resolution status

**M1. `attach.theme` applied at board scope — RESOLVED.**
`core/resolver.ts:269-275` now chooses scope by op kind: `theme` ops keep `op.scope ?? 'board'`, `attach` is hard-coded to `'detour'`, everything else `board`. Board-wide events are only emitted for board-scoped application (`resolver.ts:276`). Pinned by two new tests in `tests/core/theme.test.ts:118` (attach with theme → board theme untouched, detour carries the resolved mood) and `:139` (board theme set before attach survives alongside the detour theme — the original failure mode; in the old code `state.theme` would have been overwritten to `eerie`).

**M2. Contrast guardrail could return a worse colour — RESOLVED.**
`theme/contrast.ts` rewritten: every text role is adjusted against **all** backgrounds by trying both directions (toward white and black) in small steps and taking the smallest step that passes, with a best-improvement-only fallback (`adjustText`, `contrast.ts:50-66`; `adjustRole` accepts a fix only if strictly better than the original, `contrast.ts:112`). Infeasible two-background palettes (the reviewer's repro: `#ffffff` bg + `#2e7d32` surface) are handled by moving `surface` toward `bg` (recorded in `adjusted`) until `ink` can pass both, `contrast.ts:81-93`. I re-ran the exact pathological case: every role now meets its target against **both** backgrounds (ink 4.50/19.05, muted 4.56/19.30, accent 3.07/12.97, info 3.37/14.24, success 3.22/13.64, warn 3.45/14.61, danger 3.07/12.98), `surface` was moved to `rgb(67 138 71)` and is reported in `adjusted`, and no role ends worse than it started (no white fallback). Shipped palettes re-checked: `DEFAULT_TOKENS` + all 4 example moods need **zero** adjustment (5/5, with the corrected math). Luminance math verified: `relativeLuminance` (`theme/color.ts:153-158`) is canonical WCAG (`x/255`, then gamma with the 0.03928 threshold — `L(#767676)=0.18116`, giving 4.5422:1 vs white, matching the published WCAG value). Note: `relativeLuminance` itself was already correct at `77e8487`; the flawed duplicate-`/255` arithmetic was the cheap `lum()` direction heuristic in old `contrast.ts`, which the rewrite removed entirely (direction is now found by testing both). Guardrail output round-trips: `parseColor` now accepts the library's own `rgb(r g b)` / `rgb(r, g, b)` / `rgba(... / a)` / percent forms (`color.ts:29-42`) and still rejects `calc()`, `var()`, `url()`; `rgb(300 0 0)` clamps. Verified 10/10 parse cases plus `formatRgb → parseColor` round-trip.

**M3. Product string in `packages/` — RESOLVED.**
`core/generators/json-schema.ts:56`: `name: 'DreamerGenuiReply'`. `grep -rn "Jifunze\|jifunze" packages/dreamer-genui/src` returns nothing (exit 1).

### Verification commands run

| Command | Result |
| --- | --- |
| Repro script (`npx tsx` on the round-1 pathological input through `src/theme/contrast.ts`) | **all 7 text roles pass their target vs BOTH backgrounds**; `adjusted = [surface, ink, muted, accent, info, success, warn, danger]`; ink = `rgb(14 16 19)` — not white |
| Contrast/luminance spot-checks | `contrast(#15181d,#ffffff)=17.79`, `contrast(#15181d,#2e7d32)=3.47`; `L(#767676)=0.1812 → 4.5422:1 vs white` (WCAG reference value) |
| Shipped palettes (`DEFAULT_TOKENS`, calm, solemn, playful, eerie) | 5/5 need zero adjustment |
| `parseColor` rgb() matrix (space/comma/rgba-alpha/percent/decimal + JIT/blocklist/clamp) | 10/10 PASS; `formatRgb → parseColor` round-trip PASS |
| `pnpm test` | **Test Files 19 passed (19), Tests 249 passed (249)** — 244 + 5 new, as expected |
| `npx tsc --noEmit` | clean (no diagnostics) |
| `pnpm --filter dreamer-genui build` | success (tsup + DTS, no warnings) |
| `grep -rn "Jifunze\|jifunze" packages/dreamer-genui/src` | none |
| `grep -rn "from 'react'" packages/dreamer-genui/src/{schema,core,theme}` | none |

Everything else in the fix diff was skimmed: `color.ts` change is the additive `parseRgb` (numeric-only, still no free-form CSS), `resolver.ts` is the 6-line scope fix, `json-schema.ts` the rename, `DECISIONS.md` records the rulings, plus the 5 new tests. Nothing newly broken found.

### Non-blocking observations

1. **Test name overclaim:** `tests/core/theme.test.ts:139` ("detour-scoped theme reverts to the board theme when the detour closes") does not actually close a detour — it only asserts the board theme survives attach. Acceptable at M2 (revert-on-return is an M4 acceptance in §12), but an actual close/return exercise should be added before or at M4; otherwise the passing test creates false confidence in the revert path.
2. **`presets.ts` unchanged in the fix range** — `playful.warn = #b97400` predates this fix (already at `77e8487`), so the `DECISIONS.md` phrasing darkening `warn` "along the way" refers to work folded into the M2 commit, not `30478f5`. Harmless: independently verified that all five shipped palettes hold their targets zero-adjustment.

### Outcome of previous majors (unchanged from round 1 verdict)

- M1 (`attach.theme` board scope): original finding at `core/resolver.ts:269` — **fixed** (now `resolver.ts:269-278`).
- M2 (worse-than-original contrast fallback): original repro `#ffffff` bg + `#2e7d32` surface + `#111111`-family ink returned pure white at 1.00:1 — **fixed** (same input now: `surface → rgb(67 138 71)`, `ink → rgb(14 16 19)`, all targets met).
- M3 (`JifunzeReply`): **fixed** (`DreamerGenuiReply`).

---

## Round 1 report (original findings, preserved)

- **Range:** `2e74456..77e8487` (commit `77e8487` — "M2: core — cue engine, theme resolver, fired cues in state, registry moods, generators")
- **Spec:** `AGENTS.md` §6.1/§6.2/§6.3/§6.8/§6.9/§6.12/§7.1/§7.8/§8, §11, §12 (M2 accept list)
- **Plan:** `AUDIT.md` §3 "Step 2 — M2 Core"; rulings in `DECISIONS.md` §"M2 core — rulings" and §"M2 Rulings During Implementation"

## VERDICT

**fix-first** — three small, well-localized majors (wrong scope for `attach` themes; contrast guardrail can produce a worse-than-original unreadable result, proven with a repro; a product-name string in a generated schema). No structural problems: the architecture, purity, cue semantics and generators are otherwise faithful to the spec and well tested (244/244 passing, tsc clean, React-free core/schema/theme).

---

## MAJOR findings (must fix)

### M1. `attach` op themes are applied at **board** scope (§6.1 violation)

- `packages/dreamer-genui/src/core/resolver.ts:269`

```ts
const scope = (op.op === 'theme' ? op.scope : undefined) ?? 'board';
```

`AttachOp` (per §6.1) may carry `theme: ThemeSpec` — "optional, scoped to the detour", and `DECISIONS.md` ("M2 core — rulings → Theme pipeline layering") says detour-scoped themes "live on the Detour record (revert when the detour closes)". But for an `attach` op the expression above always evaluates to `'board'`, so `{ op: "attach", theme: {...} }`:

1. re-themes the **entire board** (should theme only the open detour), and
2. persists after the detour closes (the board theme never reverts — the exact bug detour-scoping exists to prevent), and
3. emits a board-wide `onThemeChange` for a detour-local change.

The existing test (`tests/core/theme.test.ts:105`, "detour-scoped theme attaches to the open detour, not the board") only exercises the `theme` op with explicit `scope: "detour"`; the `attach.theme` path is untested, which is why this slipped through.

**Fix:** `const scope = op.op === 'theme' ? op.scope ?? 'board' : op.op === 'attach' ? 'detour' : 'board';` (and emit the detour-scoped theme via `themeChangeBus` only if desired — document the choice), plus a test: attach with theme → board theme unchanged, detour record carries it.

### M2. Contrast guardrail can return a **more** unreadable colour than the original (§6.8)

- `packages/dreamer-genui/src/theme/contrast.ts:71-79` (`adjustToTarget`)

The mix direction is chosen from the *darkest* background (`contrast.ts:72-73`), mixing toward WHITE on dark backgrounds. When a text role fails only against a *mid-tone* background whose darkest bg is dark, mixing toward white makes the role monotonically *worse* against the light background it already passed, so no candidate ever passes all backgrounds — and the unconditional fallback `return targetColor;` (line 78) returns **pure white**, which is then written to `tokens` and reported as "adjusted".

Proven by repro (same math as `src/theme/color.ts`):

```
bg #ffffff, surface #2e7d32, ink #111111
  ink vs bg   = 18.88 ✓     ink vs surface = 3.68 ✗
  chosen direction: WHITE (darkest bg = the green surface, isLight → false)
  mixed candidates passing BOTH: none
  fallback = pure WHITE → contrast vs bg = 1.00   // white ink on white bg
```

The palette (`#fff` bg + `#2e7d32` surface) is even *infeasible* for any single ink (white fails vs white bg: 1.00; black fails vs green: 4.09 < 4.5), so the fix must handle the infeasible case, not just direction:

1. test both directions and keep any mixed candidate that passes (direction that produces a pass, preferring the one closest to the original);
2. if no direction passes, never return a colour that is *worse* than the input for the role's remaining backgrounds — keep the original for the backgrounds it was already readable on, or darken/adjust `surface` (it is a background role, fair game) and record via `onThemeAdjusted`.

Also note: darkest-bg selection uses the cheap non-gamma `lum()` (`contrast.ts:81-83`) — fine as an ordering heuristic, but tie the final direction decision to the real `relativeLuminance`/contrast math.

### M3. Product name string inside `packages/`

- `packages/dreamer-genui/src/core/generators/json-schema.ts:56`

```ts
return zodToJsonSchema(Reply, { name: 'JifunzeReply' } as never);
```

AGENTS.md top rule: "The library must stay generic; nothing in `packages/` may reference it." This string is observable in generated output (JSON Schema `$ref`/title) and is a rule violation, not just a cosmetic one. Rename to a neutral name (e.g. `'DreamerReply'` or `'Reply'`) and grep for other product strings (I found no others in `src/`).

---

## MINOR findings (nice to fix)

1. **Pacing `"auto"` also bypasses `event` triggers** — `packages/dreamer-genui/src/core/cues.ts:46-48` returns everything entered when `pacing === 'auto'`, but §6.3 says auto "ignore[s] *cue* triggers". Event-gated nodes (e.g. a choices block waiting on the student) currently auto-enter in text-only hosts. Sensible either way — but it's a deviation, so record it in `DECISIONS.md` or scope auto to cue triggers only. Same question for `serializeBoard`, which hard-codes the default `'cued'` plan (`src/core/generators/serialize-board.ts:50`) — under `auto`, "pending" would list nodes the host considers entered.

2. **`refreshEntry` always recomputes with the default pacing** (`resolver.ts:212`) — under `auto`, cue-gated nodes are entered in the renderer's `getEntry('auto')` plan but stay "pending" in the resolver's `entryPlan`, so `onEnter` is never emitted for them (until a cue happens to fire). Currently harmless (nothing mounts from `entryPlan` until M3), but the M3 `pacing` prop needs one plan to be authoritative. Record the wiring decision now.

3. **`version-mismatch` error code is dead** — `schema/envelope.ts:4` pins `v` with `z.literal(1)`, and a reply with `v: 2` fails validation as a generic `invalid-node` Zod message (`core/validator.ts:67-70`); nothing emits `version-mismatch` (§6.12 lists it). Either emit it deliberately (pre-parse `v` check) or record why it stays dormant.

4. **Runtime numeric clamps partially dead / baseline path unclamped** — `NUMERIC_CLAMPS` in `core/theme.ts:50-55` defines scale/speed/texture bounds but only radius and `intensity` are clamped at runtime; tutor specs are bounded instead by Zod *rejection* (`schema/theme.ts:31-56`, whole-op failure rather than per-piece clamp), while the host **baseline** path (`core/theme.ts:165`, `overlaySpecTokens` for `context.baseline`) is never Zod-validated and can carry out-of-range `space.scale`, `motion.speed`, `texture.*` into `ResolvedTheme` untouched (radius gets clamped). Clamp all numeric groups on the baseline path too.

5. **Allowlist paths have no tests** — `allowedMoods` / `allowedAmbience` / `allowedFonts` (§6.8, and the M2 acceptance bullet "disallowed mood ignored with theme-rejected") are implemented (`core/theme.ts:89-95, 119-120, 232-239`) but no test exercises a *registered-but-disallowed* mood; the `invalid-disallowed-mood.json` fixture actually holds an *unregistered* mood and is only exercised as `theme-rejected` via `fixtures.test.ts:35`. Add allowlist tests (and consider one for `allowedFonts`).

6. **No public plugin/type registration** — `Registry.plugins` is keyed by plugin name and `getManifest(type)` does `plugins.get(type)?.types[type]` (`registry.ts:113-115`); a plugin contributing a type not equal to its own name could never resolve, and there is no `registerPlugin` API (only moods/ambience/surfaces can be contributed). The recorded M3 deferral covers loader/skeleton/fallback wiring, but type registration itself is M2 registry scope — add at least a `registerType(name, manifest)` seam before M3 builds on it.

7. **Prompt guide misses two §8 obligations** — no instruction to "choose figures/effects that match the explanation (draw a diagram while describing structure)" and no explicit `append`-for-continuing-same-line vs `replace`-for-topic-change guidance (`generators/prompt-guide.ts:17, 39-65` cover the rest of §8 well).

8. **`onEntered` is not implemented** — §6.3 lists `onEnter`/`onEntered`/`onCue`; only `onEnter` + `onCue` exist. Defensible (there is no animation/timing source in a headless core, so "entered-after-animation" must come from the renderer), but it is not recorded in `DECISIONS.md` — add a one-line deferral ruling to M3.

9. **`update`/`remove` on a missing node emit `invalid-node`** (`validator.ts:105-115`) where §6.12 arguably wants `bad-target` (used everywhere else for dangling references). Trivial consistency nit.

---

## VERIFIED

| Command | Result |
| --- | --- |
| `bash .../review-package AUDIT.md 2e74456 77e8487 review-m2.md` | OK — wrote 117 KB structured diff review (this file replaces it with the audited report) |
| `pnpm test` | **Test Files 19 passed (19), Tests 244 passed (244)** — matches expected count |
| `npx tsc --noEmit` (grep −v "npm warn") | clean — no errors |
| `grep -rn "from 'react'" packages/dreamer-genui/src/{schema,core,theme}` | **none** (grep exit 1) — schema/core/theme are React-free |
| `grep -rn "dangerouslySetInnerHTML\|innerHTML" packages/dreamer-genui/src` | none |
| `grep -rn "Math.random\|Date.now" packages/dreamer-genui/src` | none — pure reducer/engine confirmed |
| `as any` / `: any` greps in `src/` | none (`as never` only, in a bounded zod-to-json-schema call) |
| Contrast direction bug | repro executed → confirmed (see M2, fallback yields 1.00:1 white-on-white) |

### Verified-good highlights

- **Cue semantics (§6.3)**: entry gates are derived, not stored (`core/cues.ts`, `computeEntryPlan`) — race cue-before-node ✓ (test), fired-cues remembered per board, `replace` resets and history snapshots keep theirs ✓ (test `theme.test.ts:120` restores theme+firedCues+firedEvents+flushed), `flush`/`seek` (incl. unknown-cue-id and shared-cue idempotence) ✓, `after` cycles defensively bounded in-engine and rewritten to `start` at validation with a recorded `cue-cycle` ruling (`validator.ts:138-190` + DECISIONS entry) ✓.
- **Reducer purity/history** (§7.1): `(state, op) => state`, exhaustive switch with no fallthrough; snapshots copy `firedCues`/`firedEvents` (fresh arrays/objects) and `nodes` (shallow) — safe because every state mutation is copy-on-write and post-replace node objects come from freshly Zod-parsed ops, so no shared mutable references survive between snapshot and new state. `update` cannot override `id`/`type`; history capped and tested; `back()` restores full board+theme+cue state.
- **Theme resolver (§6.8)**: policy tiers behave per DECISIONS (`none` rejects all; `moods` strips tokens with warning; `moods+tokens` applies sanitised tokens), per-piece rejection (valid mood survives invalid ambience) ✓ tested, precedence defaults < baseline < mood (blended by intensity in `blendColors`) < spec tokens ✓, colours parsed hex/hsl/oklch only — `parseColor` requires the whole string to match (no `url()`/`var()`/`calc()`/free-form CSS can pass — model CSS interpolation is structurally impossible) ✓, fonts blocked by `UNSAFE_CSS` + allowlist ✓, Zod bounds all protocol numbers ✓.
- **Contrast math is otherwise canonical**: Ottosson oklab→linear-sRGB matrices match the published values exactly; sRGB gamma (0.0031308/12.92 threshold) correct; WCAG relative luminance uses 0.2126/0.7152/0.0722 with the 0.03928 threshold; contrast ratio `(L1+0.05)/(L2+0.05)` correct; `oklch()` hue in degrees → a/b conversion correct; alpha channels ignored for contrast (documented).
- **Registry/generators (§6.8/§8)**: moods are pure data in `theme/presets.ts` with descriptions; nothing in `src/` branches on a mood name; prompt guide is registry-aware (types, moods-with-descriptions, ambience/surfaces, include/exclude/compact/language, worked examples), `serializeBoard` covers id/title/labels/parent-item refs/entered-vs-pending/pending-cues/detours/theme/history ✓; `getCapabilities` derives enums from the canonical schemas (no drift).
- **Zero-config presets** (`DEFAULT_TOKENS`, 4 example moods) ship AA-readable — `tests/theme/palette.test.ts` asserts defaults need no adjustment.

## NOTES

- The previous M1-session review rounds (8 majors fixed, 160 tests) are documented in `DECISIONS.md` §"M2 Review Round" — those findings were genuinely fixed and re-verified; this review found *new* issues that arrived with the M2 commit's theme/cue work.
- Mixed-state observations for the record: an *incomplete* partial block currently parses as a full block if the Zod schema is satisfied at that point (node stored `state: 'complete'`); growing content under `append` re-applies as `duplicate-id` (correct per the ledger ruling — last-write-wins growth is an M3 skeleton concern, not implemented down here).
- `themes` subpath names: ambience/surface example names match the suggested examples in §6.9/§6.8 exactly; `moods` shipped = calm/solemn/playful/eerie as allowed examples, all data-driven, replaceable, tested.
- `camera` op zoom bounds are 0.5–2 vs the spec's illustrative "e.g. 1x–1.6x" — acceptable (spec says "e.g.", and validation is real); no action needed.
- The `review-package` script output (full structured diff) was generated successfully and forms the basis above; this file is the audited final report.
