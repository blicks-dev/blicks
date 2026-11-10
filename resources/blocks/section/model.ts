import { __, sprintf } from '@wordpress/i18n';
import type { Option } from '@/framework/inspector-v2/kit';

/** The attribute defaults, as block.json declares them. */
export const SECTION_DEFAULTS = {
	align: 'full',
	sectionWidth: 'auto',
	sectionHeight: 'auto',
	contentWidth: '100%',
	contentMinWidth: '0',
	contentMaxWidth: 'var(--blicks-content-size, var(--wp--style--global--content-size, 1200px))',
	surface: 'plain',
	sectionSpace: 'md',
} as const;

export const SURFACES: Option[] = [
	[ 'plain', __( 'Plain', 'blicks' ) ],
	[ 'muted', __( 'Muted', 'blicks' ) ],
	[ 'card', __( 'Card', 'blicks' ) ],
	[ 'outline', __( 'Outline', 'blicks' ) ],
];

export const SPACES: Option[] = [
	[ 'none', __( 'None', 'blicks' ) ],
	[ 'sm', __( 'Small', 'blicks' ) ],
	[ 'md', __( 'Medium', 'blicks' ) ],
	[ 'lg', __( 'Large', 'blicks' ) ],
];

const pick = ( options: Option[], value: unknown, fallback: string ): string => {
	const v = String( value || fallback );
	return options.some( ( [ o ] ) => o === v ) ? v : fallback;
};

export const cleanSectionSurface = ( surface: unknown ): string => pick( SURFACES, surface, SECTION_DEFAULTS.surface );
export const cleanSectionSpace = ( space: unknown ): string => pick( SPACES, space, SECTION_DEFAULTS.sectionSpace );

const DIMENSION_KEYWORDS = [
	'auto', 'none', 'fit-content', 'max-content', 'min-content',
	// CSS-wide global keywords
	'inherit', 'initial', 'unset', 'revert', 'revert-layer',
];
const UNITS = 'px|%|em|rem|vw|vh|svh|dvh|lvh|ch|fr';

/** Any CSS function call with balanced parens — `calc()`, `clamp()`, `min()`, `max()`, `var()`, `env()`, … */
function isCssFunction( raw: string ): boolean {
	if ( ! /^[a-z][a-z0-9-]*\(/i.test( raw ) || ! raw.endsWith( ')' ) ) return false;
	let depth = 0;
	for ( const char of raw ) {
		if ( char === '(' ) depth++;
		else if ( char === ')' && --depth < 0 ) return false;
	}
	return depth === 0;
}

/**
 * One CSS size from a stored or typed value — a bare number is px — or the fallback. Mirrors
 * `Blicks\Style\Dimension::clean()`, which the PHP render uses on the same attributes.
 */
export function cleanSectionDimension( value: unknown, fallback: string ): string {
	const raw = String( value ?? '' ).trim();
	if ( raw === '' ) return fallback;
	if ( raw === '0' ) return '0';
	if ( DIMENSION_KEYWORDS.includes( raw ) || isCssFunction( raw ) ) return raw;
	if ( new RegExp( `^-?\\d*\\.?\\d+(${ UNITS })$` ).test( raw ) ) return raw;
	if ( /^-?\d*\.?\d+$/.test( raw ) ) return `${ raw }px`;
	return fallback;
}

/** True for any CSS length, keyword or function `cleanSectionDimension` keeps as typed. */
export function isSectionDimension( value: string ): boolean {
	const raw = value.trim();
	if ( raw === '' ) return false;
	if ( raw === '0' || DIMENSION_KEYWORDS.includes( raw ) || isCssFunction( raw ) ) return true;
	return new RegExp( `^-?\\d*\\.?\\d+(${ UNITS })?$` ).test( raw );
}

/** The band's one-word description for the inspector header, e.g. "Muted band". */
export function describeSection( attributes: any ): string {
	const surface = cleanSectionSurface( attributes?.surface );
	const name = SURFACES.find( ( [ v ] ) => v === surface )?.[ 1 ] ?? '';
	return sprintf( /* translators: %s: a surface name such as "Muted" */ __( '%s band', 'blicks' ), name );
}
