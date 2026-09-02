import { getIcon } from './index';

/**
 * Render an icon as a 24×24 stroke-currentColor SVG. Uses `dangerouslySetInnerHTML` because
 * generated icon paths are static, build-time-validated SVG markup from the registry — never
 * user input. The serialized output is identical between editor + save, so block validation
 * is unaffected.
 *
 * Kept in its own JSX file so the pure registry can stay `.ts` (no React dependency in tests).
 */
export function renderIcon( name: unknown, props: Record< string, unknown > = {} ) {
	const def = getIcon( name ) ?? getIcon( 'star' );
	const svg = def?.svg ?? '';
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
			{ ...props }
			dangerouslySetInnerHTML={ { __html: svg } }
		/>
	);
}
