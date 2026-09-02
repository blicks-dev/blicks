import { __ } from '@wordpress/i18n';

export interface Duotone {
	shadows: string;
	highlights: string;
}

/** Quick-pick duotone pairs (shadows → highlights). `null` = clear/none. */
export const DUOTONE_PRESETS: Array< { name: string; value: Duotone | null } > = [
	{ name: __( 'None', 'blicks' ), value: null },
	{ name: __( 'Grayscale', 'blicks' ), value: { shadows: '#000000', highlights: '#ffffff' } },
	{ name: __( 'Dusk', 'blicks' ), value: { shadows: '#0f172a', highlights: '#fde68a' } },
	{ name: __( 'Ocean', 'blicks' ), value: { shadows: '#082f49', highlights: '#bae6fd' } },
	{ name: __( 'Berry', 'blicks' ), value: { shadows: '#3b0764', highlights: '#fbcfe8' } },
	{ name: __( 'Forest', 'blicks' ), value: { shadows: '#052e16', highlights: '#bbf7d0' } },
];

/** A duotone value is usable only when it carries both hex colors. */
export function isDuotone( value: unknown ): value is Duotone {
	return (
		!! value &&
		typeof value === 'object' &&
		typeof ( value as any ).shadows === 'string' &&
		typeof ( value as any ).highlights === 'string'
	);
}

/** Stable per-instance SVG filter id. */
export function duotoneFilterId( uniqueId: string ): string {
	return `bl-duotone-${ uniqueId }`;
}

/** Parse `#rgb` / `#rrggbb` into [r, g, b] floats in 0..1 (falls back to black). */
function hexToUnit( hex: string ): [ number, number, number ] {
	let h = String( hex || '' ).trim().replace( /^#/, '' );
	if ( h.length === 3 ) {
		h = h.split( '' ).map( ( c ) => c + c ).join( '' );
	}
	if ( ! /^[0-9a-fA-F]{6}$/.test( h ) ) {
		return [ 0, 0, 0 ];
	}
	return [
		parseInt( h.slice( 0, 2 ), 16 ) / 255,
		parseInt( h.slice( 2, 4 ), 16 ) / 255,
		parseInt( h.slice( 4, 6 ), 16 ) / 255,
	];
}

/**
 * Hidden SVG that defines the duotone filter referenced by `filter: url(#id)`. Output in both the
 * editor preview and the saved markup (the Image block is static), so the effect renders on the
 * front end without any runtime JS. The luminance matrix flattens the image to grayscale, then the
 * component-transfer tables remap shadows → `shadows` colour and highlights → `highlights` colour.
 */
export function DuotoneFilter( { id, value }: { id: string; value: Duotone } ) {
	const s = hexToUnit( value.shadows );
	const h = hexToUnit( value.highlights );
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 0 0"
			width="0"
			height="0"
			focusable="false"
			role="none"
			aria-hidden="true"
			style={ { visibility: 'hidden', position: 'absolute', left: '-9999px', overflow: 'hidden', width: 0, height: 0 } }
		>
			<defs>
				<filter id={ id }>
					<feColorMatrix
						colorInterpolationFilters="sRGB"
						type="matrix"
						values="0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0.299 0.587 0.114 0 0 0 0 0 1 0"
					/>
					<feComponentTransfer colorInterpolationFilters="sRGB">
						<feFuncR type="table" tableValues={ `${ s[ 0 ] } ${ h[ 0 ] }` } />
						<feFuncG type="table" tableValues={ `${ s[ 1 ] } ${ h[ 1 ] }` } />
						<feFuncB type="table" tableValues={ `${ s[ 2 ] } ${ h[ 2 ] }` } />
					</feComponentTransfer>
				</filter>
			</defs>
		</svg>
	);
}
