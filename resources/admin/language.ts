/**
 * What a design language looks like in the admin's sample site. The server sends each language's
 * `sample` (DesignLanguages::summary()): a few token values plus its component variables, where
 * `{color.x}` stands for the palette's colour. This turns one into the sample's CSS variables.
 */

/** Component variable → the sample's own variable that draws it (see `.site` in _design.scss). */
const COMPONENT_VARS: Record< string, string > = {
	'button-sheen': '--lk-btn-sheen',
	'button-border-color': '--lk-btn-border',
	'button-shadow': '--lk-btn-shadow',
	'button-text-shadow': '--lk-btn-ts',
	'button-secondary-background': '--lk-sec-bg',
	'button-secondary-sheen': '--lk-sec-sheen',
	'button-secondary-border-color': '--lk-sec-border',
	'button-secondary-shadow': '--lk-sec-shadow',
	'surface-sheen': '--lk-card-sheen',
	'surface-blur': '--lk-card-blur',
	'surface-opacity': '--lk-card-opacity',
	'surface-tint': '--lk-card-tint',
	'surface-border-color': '--lk-card-border',
};

/**
 * @param sample   The language's sample.
 * @param color    The palette colour for a slug, as the page shows it.
 * @param withBase Also draw its corners, shadows, border and headings — for a language that is not
 *                 the chosen one, whose token values the page does not hold.
 */
export function languageVars( sample: Record< string, string >, color: ( slug: string ) => string, withBase: boolean ): Record< string, string > {
	const out: Record< string, string > = {};
	const resolve = ( value: string ): string => value.replace( /\{color\.([a-z0-9-]+)\}/g, ( _, slug: string ) => color( slug ) || 'currentColor' );
	for ( const [ name, cssVar ] of Object.entries( COMPONENT_VARS ) ) {
		if ( sample[ name ] ) out[ cssVar ] = resolve( sample[ name ] );
	}
	if ( withBase ) {
		const base: Array< [ string, string | undefined ] > = [
			[ '--r-md', sample.radius ], [ '--r-lg', sample.cardRadius ], [ '--sh-sm', sample.shadow ], [ '--sh-md', sample.cardShadow ],
			[ '--bw-hair', sample.border ], [ '--t-h1-weight', sample.headingWeight ], [ '--t-h1-track', sample.headingSpacing ],
		];
		for ( const [ key, value ] of base ) {
			if ( value ) out[ key ] = value;
		}
		// Colors the language itself sets (Neumorphism's one soft tone for page and surfaces).
		for ( const [ key, value ] of Object.entries( sample ) ) {
			if ( key.startsWith( 'color.' ) && value ) out[ `--c-${ key.slice( 6 ) }` ] = value;
		}
	}
	// A serif heading names the site's serif token, which this page does not define; draw a serif.
	// Another language's sample must not inherit the chosen one's serif, so it goes back to the
	// page's own face.
	if ( sample.headingSerif ) out[ '--t-h1-family' ] = 'Georgia, "Times New Roman", serif';
	else if ( withBase ) out[ '--t-h1-family' ] = 'inherit';
	// A language drawn on its own tone (Neumorphism) shows its cards on that, not on the gradient.
	if ( sample.backdrop === 'plain' ) out[ '--lk-backdrop' ] = 'var(--c-background)';
	return out;
}
