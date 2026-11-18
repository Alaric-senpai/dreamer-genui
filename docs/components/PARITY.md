# shadcn/ui parity

`dreamer-genui` ships a component set with **parity of capability, not pixel identity**, to
[shadcn/ui](https://ui.shadcn.com/docs/components). This page records the inventory we compared
against, what we ship for each entry, and why an entry is absent.

## Inventory snapshot

- Source: <https://ui.shadcn.com/docs/components> (the "base" variant list; the "aria" variant
  documents the same components over React Aria).
- Snapshot date: **2026-11-18**.
- Entries at snapshot: **68**.

Re-run the inventory when shadcn adds components; CI cannot track an external site, so this file is
the reviewed record (see `DECISIONS.md`, "shadcn inventory snapshot").

## Status legend

| Status | Meaning |
| :--- | :--- |
| **Tutor** | A protocol block/mark the tutor may emit (registered by the default `ui-kit` plugin). Rendered by the board with its motion presets, enter triggers, slots and events. |
| **Host** | Host-application chrome, exported from `dreamer-genui/ui` as a tree-shakeable component. Not reachable from tutor JSON. |
| **Board** | Covered by an existing board type rather than a standalone component. |
| **N/A** | Deliberately out of scope for v1, with the reason recorded. |

A component can be both **Tutor** and **Host**: the tutor-addressable block and the host component
share tokens and anatomy, but the block adds protocol validation, cue-driven entrance and event
emission.

## Covered inventory

| shadcn/ui | Board counterpart | Status | Notes |
| :--- | :--- | :--- | :--- |
| Accordion | `accordion` block; `Accordion` | Tutor + Host | Radix; `multiple`; toggling emits `action: "toggle"` with `detail.open`. |
| Alert | `alert` block; `Alert` | Tutor + Host | Tone tokens; optional dismiss emits `action: "dismiss"`. `callout` remains the minimal form. |
| Alert Dialog | `AlertDialog` family | Host | Radix; destructive confirm pattern. |
| Aspect Ratio | `AspectRatio` | Host | Radix. |
| Attachment | — | N/A | AI-chat attachment chip. v1 excludes chat UI ("Out of v1"); hosts compose their own. |
| Avatar | `avatar` block; `Avatar` | Tutor + Host | Image with initials fallback; `src` may be an asset reference. |
| Badge | `badge` block; `Badge` | Tutor + Host | Tone tokens; inline `Inline[]` text. |
| Breadcrumb | `Breadcrumb` family | Host | Includes ellipsis. |
| Bubble | — | N/A | Chat message bubble. v1 excludes chat UI. |
| Button | `Button` | Host | Variants: default, secondary, outline, ghost, destructive. `asChild` via Radix Slot. |
| Button Group | `ButtonGroup` family | Host | Joined radii, text and separator parts. |
| Calendar | `Calendar` | Host | Dependency-free 42-day grid; Intl labels; roving tabindex; arrows/Home/End/PageUp/PageDown; min/max; Monday-first default. |
| Card | `card` block; `Card` family | Tutor + Host | `interactive` cards emit `select`; host card adds `CardMedia`. |
| Carousel | `carousel` block | Tutor | Slide selection emits `select` with the slide `ref`; host app composes Scroll Area if needed. |
| Chart | `chart` figure | Board | M6a plugin. No host chart primitives in v1. |
| Checkbox | `Checkbox` | Host | Radix; indeterminate supported. |
| Code Block | `code` block | Board | M6a plugin with lazy highlighter and copy affordance. |
| Collapsible | `collapsible` block; `Collapsible` | Tutor + Host | Toggle emits `action: "toggle"`. |
| Combobox | `Combobox` | Host | Popover + Command composition; single-select, searchable, keyboard-first, tap-first. |
| Command | `Command` family, `CommandDialog` | Host | `cmdk`; dialog composition uses our Dialog. |
| Context Menu | `ContextMenu` family | Host | Radix; reuses the menu item styles. |
| Data Table | `table` block | Board | M6a plugin adds sorting-ready markup; host `Table` covers static tables. |
| Date Picker | `DatePicker` | Host | Popover + Calendar; hidden ISO input for forms. |
| Dialog | `Dialog` family | Host | Radix; focus trap and escape handled by the primitive. |
| Direction | `dir` provider prop | Board | 7.11: logical properties everywhere; no standalone component. |
| Drawer | `Drawer` family | Host | Radix dialog rendered as a bottom sheet with grip and safe-area padding. |
| Dropdown Menu | `DropdownMenu` family | Host | Radix; checkbox/radio items, submenus, shortcuts. |
| Empty | `Empty` family | Host | Header/media/title/description/content parts. |
| Field | `Field` family | Host | FieldSet, legend, group, label, description, error (`role="alert"`). The form primitive set. |
| Hover Card | `HoverCard`; `term` mark | Host + Tutor | The tutor equivalent is the richer `term` mark, which is tap-first on touch. |
| Input | `Input` | Host | Token-styled; invalid state via `aria-invalid`. |
| Input Group | `InputGroup` family | Host | Addons, inline text, input and textarea variants; focus-within ring. |
| Input OTP | `InputOTP` family | Host | Group/slot/separator parts plus a convenience wrapper. |
| Item | `Item` family | Host | Generic list row: media, content, title, description, actions, header/footer. |
| Kbd | `kbd` block; `Kbd` | Tutor + Host | Renders an ordered key sequence. |
| Label | `Label` | Host | Radix label; used by Field. |
| Marker | — | N/A | AI-conversation inline status row. v1 excludes chat UI; hosts use Badge/Separator. |
| Menubar | `Menubar` family | Host | Radix; full menu family with shortcuts. |
| Message | — | N/A | Chat message. v1 excludes chat UI. |
| Message Scroller | — | N/A | Chat transcript scroller. v1 excludes chat UI. |
| Native Select | `NativeSelect` family | Host | Styled native `<select>` for mobile-friendly forms. |
| Navigation Menu | `NavigationMenu` family | Host | Radix; viewport, indicator and links. |
| Pagination | `Pagination` family | Host | Links, previous/next, ellipsis, spacer. |
| Popover | `Popover` family | Host | Radix; used by `term`, Combobox and Date Picker. |
| Progress | `progress` block; `Progress` | Tutor + Host | Animated fill on enter; bar, ring and pill variants on the block. |
| Questionnaire | `assessment` plugin | Board | M6b: question kinds, modes, timer, navigator, review. |
| Radio Group | `RadioGroup` family | Host | Radix; large-target items. |
| Resizable | `ResizablePanelGroup` family | Host | `react-resizable-panels` primitives with keyboard handles. |
| Scroll Area | `ScrollArea` family | Host | Radix; thin token-styled scrollbar. |
| Select | `Select` family | Host | Radix; groups, labels, separators. |
| Separator | `separator` block; `Separator` | Tutor + Host | Orientation and optional label. |
| Sheet | `Sheet` family | Host | Radix dialog from any edge; mobile navigation pattern. |
| Sidebar | `Sidebar` family | Host | Provider + collapsible rail, groups, menu buttons, trigger, inset. |
| Skeleton | `Skeleton` | Host | Reduced-motion aware pulse. |
| Slider | `Slider` | Host | Radix; single and range values. |
| Spinner | `Spinner` | Host | Reduced-motion aware. |
| Switch | `Switch` | Host | Radix. |
| Table | `Table` family; `table` block | Host + Board | Host markup is static; the board block ships in M6a. |
| Tabs | `tabs` block; `Tabs` family | Tutor + Host | Selecting emits `select` with the tab `ref`. |
| Textarea | `Textarea` | Host | Token-styled; invalid state. |
| Toast | `Toast` family, `Toaster` | Host | Radix; provider/viewport/action/close. |
| Toggle | `Toggle` | Host | Variants and sizes. |
| Toggle Group | `ToggleGroup` family | Host | Single and multiple. |
| Tooltip | `Tooltip` family; `term` mark | Host + Tutor | `term` is the tutor-addressable tooltip/hover-card, tap-first on touch. |
| Trace | — | N/A | AI run trace panel (devtools surface). v1 has no AI tracing UI. |
| Typography | `Heading`, `Text`, `Lead`, `Muted`, `Blockquote`, `Code`, `InlineCode` | Host | Mirrors the shadcn typography set without Tailwind classes. |

## Board additions beyond the shadcn inventory

| Component | Status | Why |
| :--- | :--- | :--- |
| `counter` block | Tutor | Count-up number with number/percent/time/currency formatting; no shadcn counterpart. |
| `term` mark | Tutor | Tooltip + hover card + optional rich `detail`; the tutor-addressable form of Tooltip/Hover Card. |
| `CardMedia` | Host | Media slot used by lesson cards and host cards. |
| `cx` | Host | The internal class-name join helper, exported because component overrides need it. |
| `InputOTPWithSeparator`, `PaginationSpacer`, `DropdownMenuPortal`, `ScrollArea*` wrappers | Host | Thin compositions kept in the kit so consumers do not re-implement layout glue. |

## Verification

- `tests/react/ui-kit.test.tsx` renders every tutor-addressable block from
  `fixtures/ui-kit-blocks.json`, asserts events, keyboard access, axe and per-part overrides.
- `tests/react/host-kit.test.tsx` covers keyboard and screen-reader behaviour for the interactive
  host components, runs axe over a representative kit page, and checks the customization surface.
- `tests/build/tree-shaking.test.ts` builds the package and asserts that a single component entry
  imports only its own primitives, and that no `dg-ui-` class appears in the core renderer bundle.
- `docs/components/<name>.md` is generated from component metadata by `pnpm dg:component-docs`.

## Known gaps

- The host kit is CSS-only themed; it does not ship a Tailwind plugin of its own. Tailwind hosts can
  still style it through `className`, and the board's Tailwind bridge maps the shared `--dg-*`
  tokens.
- `carousel` is tutor-addressable but has no host-side component in v1 (hosts use Scroll Area).
- Chart, Code Block and Data Table gain their board implementations in M6a; until then their rows
  describe the planned type, and the corresponding fixtures are not shipped.

