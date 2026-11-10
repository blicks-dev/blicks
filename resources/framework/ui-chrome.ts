/**
 * The chrome variables: Blicks' own interface palette as a contract a companion plugin can paint
 * with, so a Pro panel, sheet or admin view reads as part of Blicks without copying hex values.
 *
 * Declared once, in `resources/framework/_ui-tokens.scss` (`@mixin palette`), and emitted on the
 * roots of Blicks' chrome: the admin app (`.blicks-admin`) and the block inspector (`.bl-ins`).
 * Read them with `var()` inside one of those roots, always with a fallback:
 *
 * ```css
 * .my-pro-panel { color: var( --bl-ui-fg-muted, #5a5a5a ); border-color: var( --bl-ui-border, #e2e8f0 ); }
 * ```
 *
 * What the names promise (values may be retuned; contrast floors may not be broken):
 *
 * - `--bl-ui-paper | canvas | surface-alt | surface-sunk` — the four light grounds.
 * - `--bl-ui-fg | fg-2 | fg-muted | fg-subtle | fg-faint` — ink, darkest first. `fg-subtle` is the
 *   last step legal for text (≥ 4.5:1 on every ground); `fg-faint` is for non-text UI only (≥ 3:1).
 * - `--bl-ui-border | border-strong | divider` — lines.
 * - `--bl-ui-brand | brand-bold | brand-soft | brand-tint` — follow the user's wp-admin colour
 *   scheme. Accents, focus and fills only; never small text on brand.
 * - `--bl-ui-danger | warn | success` (text-safe) and `--bl-ui-danger-soft`.
 * - `--bl-ui-code-*` — the one inverted panel (generated CSS output). Names are specific to it.
 * - `--bl-ui-dark-*` — the dark chrome family: three grounds (`canvas`, `surface`, `raised`),
 *   ink (`fg`, `fg-muted`, `fg-subtle`, the last holding the AA floor on `dark-canvas`) and two
 *   lines. For a companion surface that goes dark (Studio, Scene).
 * - `--bl-ui-checker` — the transparency checkerboard behind swatches.
 * - `--bl-ui-frost-blue | navy | acc-magenta | acc-violet` — decorative accents, not for text.
 * - `--bl-ui-dur-* | ease | ease-out` — motion. Honour `prefers-reduced-motion` yourself.
 * - `--bl-ui-font-*`, `--bl-ui-text-*`, `--bl-ui-display-*`, `--bl-ui-label-*` — type.
 * - `--bl-ui-field-h | field-h-sm | radius` — control metrics.
 *
 * Not in the contract: the Blueprint role names (`--bl-ui-primary`, `--bl-ui-selected`, `--bl-ui-r`…)
 * and the `--bui-*` system — both are the v2 inspector's skin and still moving. And the short local
 * aliases each root keeps (`--fg`, `--faint`…), which are private to that root.
 *
 * Pinned by `ui-chrome.test.ts` against the stylesheet both ways: a renamed or removed name fails
 * it (a breaking change: move `API_VERSION`), and an added one fails it until it is listed here.
 */
export const UI_VARS = Object.freeze( [
	'--bl-ui-paper',
	'--bl-ui-canvas',
	'--bl-ui-surface-alt',
	'--bl-ui-surface-sunk',
	'--bl-ui-fg',
	'--bl-ui-fg-2',
	'--bl-ui-fg-muted',
	'--bl-ui-fg-subtle',
	'--bl-ui-fg-faint',
	'--bl-ui-border',
	'--bl-ui-border-strong',
	'--bl-ui-divider',
	'--bl-ui-brand',
	'--bl-ui-brand-bold',
	'--bl-ui-brand-soft',
	'--bl-ui-brand-tint',
	'--bl-ui-danger',
	'--bl-ui-warn',
	'--bl-ui-success',
	'--bl-ui-danger-soft',
	'--bl-ui-code-bg',
	'--bl-ui-code-fg',
	'--bl-ui-code-label',
	'--bl-ui-code-prop',
	'--bl-ui-code-val',
	'--bl-ui-dark-canvas',
	'--bl-ui-dark-surface',
	'--bl-ui-dark-raised',
	'--bl-ui-dark-fg',
	'--bl-ui-dark-fg-muted',
	'--bl-ui-dark-fg-subtle',
	'--bl-ui-dark-border',
	'--bl-ui-dark-border-strong',
	'--bl-ui-checker',
	'--bl-ui-frost-blue',
	'--bl-ui-navy',
	'--bl-ui-acc-magenta',
	'--bl-ui-acc-violet',
	'--bl-ui-dur-fast',
	'--bl-ui-dur-base',
	'--bl-ui-dur-slow',
	'--bl-ui-ease',
	'--bl-ui-ease-out',
	'--bl-ui-font-sans',
	'--bl-ui-font-mono',
	'--bl-ui-text-2xs',
	'--bl-ui-text-xs',
	'--bl-ui-text-sm',
	'--bl-ui-text-md',
	'--bl-ui-text-lg',
	'--bl-ui-text-xl',
	'--bl-ui-text-2xl',
	'--bl-ui-display-sm',
	'--bl-ui-display-md',
	'--bl-ui-display-lg',
	'--bl-ui-display-xl',
	'--bl-ui-display-xl-narrow',
	'--bl-ui-label-size',
	'--bl-ui-label-tracking',
	'--bl-ui-label-size-sm',
	'--bl-ui-label-tracking-sm',
	'--bl-ui-field-h',
	'--bl-ui-field-h-sm',
	'--bl-ui-radius',
] as const );

/** The dark chrome family, a subset of `UI_VARS`. */
export const UI_DARK_VARS = Object.freeze( UI_VARS.filter( ( name ) => name.startsWith( '--bl-ui-dark-' ) ) );
