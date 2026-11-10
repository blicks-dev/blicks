/**
 * One stroke glyph, at whatever size the control around it uses.
 *
 * Drawn here rather than taken from `@wordpress/icons` for one reason: these are the Studio's own
 * chrome, and core's set is drawn on a different grid with a different weight. Mixing the two puts
 * two icon languages in one 64px bar, which reads as a bug long before anyone works out why.
 *
 * Stroke, not fill, and `currentColor` throughout — so a disabled button, a selected row and a
 * button on a collection's own accent all get the right ink from the rule that already set their
 * text colour, with no icon variant to keep in step.
 */

interface Props {
	/** The `d` of a single path. Several subpaths in one `d` is how a multi-stroke glyph is drawn. */
	path: string;
	size?: number;
}

export function Glyph( { path, size = 16 }: Props ): JSX.Element {
	return (
		<svg
			viewBox="0 0 24 24"
			width={ size }
			height={ size }
			fill="none"
			stroke="currentColor"
			strokeWidth="1.7"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d={ path } />
		</svg>
	);
}
