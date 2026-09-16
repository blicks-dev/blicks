/**
 * The Blicks logo — three stacked bars with an accent tick — for the editor.
 *
 * **This is a deliberate second copy of `resources/admin/icons.tsx` → `StackBMark`, and it must
 * stay one.** Every Vite entry in this build is self-contained: the `blicks-iife-wrap` plugin in
 * `vite.config.mjs` wraps each entry in an IIFE because WordPress enqueues them as classic
 * scripts, which forbids `import`. The moment a module is imported by two entries, Rollup hoists
 * it into `chunks/`, the entry emits an `import` for it, and the build fails outright
 * (`admin.js:2:7: ERROR: Unexpected "{"`) — the admin app and the editor cannot share a module.
 * `brand.test.ts` holds this copy, the admin copy and `docs/favicon.svg` to the same geometry
 * instead.
 *
 * `tone` picks what the bars are painted with: `light` inherits (`currentColor`), so the mark
 * takes the colour of whatever chrome hosts it; `dark` forces white for a dark surface and
 * lightens the tick to stay visible against it.
 *
 * Props spread onto the `<svg>`, which is what lets WordPress size it: `PluginSidebar` and the
 * other icon slots clone the element with `width`/`height`, and those land on the element itself.
 */
export const BRAND_ACCENT = '#002bff';
const BRAND_ACCENT_DARK = '#b3d5ff';

type MarkProps = React.SVGProps< SVGSVGElement > & { tone?: 'light' | 'dark' };

export function BlicksMark( { tone = 'light', ...props }: MarkProps ): JSX.Element {
	const fill = tone === 'dark' ? '#ffffff' : 'currentColor';
	const accent = tone === 'dark' ? BRAND_ACCENT_DARK : BRAND_ACCENT;

	return (
		<svg viewBox="0 0 180 180" aria-hidden="true" focusable="false" { ...props }>
			<g fill={ fill }>
				<rect x="20" y="20" width="100" height="40" />
				<rect x="20" y="70" width="80" height="40" />
				<rect x="20" y="120" width="110" height="40" />
			</g>
			<rect x="135" y="120" width="20" height="40" fill={ accent } />
		</svg>
	);
}

/**
 * The mark as a ready-made element for WordPress icon slots. Carries an explicit 24×24 so it has
 * a size even where nothing clones it with one.
 */
export const blicksMarkIcon = <BlicksMark width={ 24 } height={ 24 } />;
