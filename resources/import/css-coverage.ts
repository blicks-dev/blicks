/**
 * CSS coverage analyzer (Mockup→Blicks, Phase A).
 *
 * Answers, for any CSS declaration: does Blicks have a dedicated CONTROL for it (→ which section +
 * `blicks` attr), or is it a CUSTOM-CSS fallback (valid CSS, no control — goes to the per-block
 * import report)? This is the engine behind "flag unsupported CSS" + "suggest controls".
 *
 * `PROPERTY_MAP` is generated from the engine schema alongside `STYLE_MAP`, so the two cannot drift.
 */

import { IMPORT_PROPERTIES } from '@/engine/schema.gen';

export type Section =
	| 'layout'
	| 'spacing'
	| 'border'
	| 'position'
	| 'colors'
	| 'background'
	| 'typography'
	| 'effects'
	| 'animation'
	| 'gridChild'
	| 'flexChild'
	| 'columns'
	| 'decoration';

export interface ControlRef {
	section: Section;
	attr: string;
}

/**
 * Base CSS property → the Blicks control that produces it. Generated: each control's `import`
 * list in resources/engine/schema.json names the properties a pasted declaration maps to.
 */
export const PROPERTY_MAP: Record< string, ControlRef > = Object.fromEntries(
	Object.entries( IMPORT_PROPERTIES ).map( ( [ property, attr ] ) => [
		property,
		{ section: attr.split( '.' )[ 0 ] as Section, attr },
	] )
);

/**
 * Reduce a longhand/side/corner property to the base property a control covers
 * (`padding-top`→`padding`, `border-top-left-radius`→`border-radius`, `top`→`inset`, `font`→handled).
 */
export function normalizeProperty( property: string ): string {
	const p = property.trim().toLowerCase();

	// Physical inset longhands → the `inset` control.
	if ( p === 'top' || p === 'right' || p === 'bottom' || p === 'left' ) {
		return 'inset';
	}
	// padding-*/margin-* → padding/margin.
	const box = p.match( /^(padding|margin)-(top|right|bottom|left|block|inline)/ );
	if ( box ) {
		return box[ 1 ];
	}
	// border radius corners → border-radius.
	if ( /^border-(top|bottom)-(left|right)-radius$/.test( p ) ) {
		return 'border-radius';
	}
	// border side longhands → the matching border sub-property (width/style/color). Style and colour
	// are per-side attributes now, so this fold is lossier than it needs to be — a paste of
	// `border-top-color` could carry the side through. Follow-up, not a blocker: the fold still
	// classifies the declaration into the right control.
	const borderSide = p.match( /^border-(top|right|bottom|left|block|inline)(?:-\w+)?-(width|style|color)$/ );
	if ( borderSide ) {
		return `border-${ borderSide[ 2 ] }`;
	}
	// font / background shorthands → a representative covered base.
	if ( p === 'font' ) {
		return 'font-size';
	}
	// `flex` shorthand isn't a single control; leave as-is (→ custom).
	return p;
}

export type Classification =
	| { property: string; value: string; kind: 'control'; section: Section; attr: string }
	| { property: string; value: string; kind: 'custom' };

/** Classify one declaration against the control map. */
export function classifyDeclaration( property: string, value: string ): Classification {
	const ref = PROPERTY_MAP[ normalizeProperty( property ) ];
	if ( ref ) {
		return { property, value, kind: 'control', section: ref.section, attr: ref.attr };
	}
	return { property, value, kind: 'custom' };
}

export interface CoverageReport {
	controlled: Extract< Classification, { kind: 'control' } >[];
	custom: Extract< Classification, { kind: 'custom' } >[];
	summary: { total: number; controlled: number; custom: number; coverage: number };
}

/** Analyze a set of declarations into a fidelity report. */
export function analyzeDeclarations( declarations: Array< { property: string; value: string } > ): CoverageReport {
	const controlled: CoverageReport[ 'controlled' ] = [];
	const custom: CoverageReport[ 'custom' ] = [];
	for ( const { property, value } of declarations ) {
		const c = classifyDeclaration( property, value );
		if ( c.kind === 'control' ) {
			controlled.push( c );
		} else {
			custom.push( c );
		}
	}
	const total = controlled.length + custom.length;
	return {
		controlled,
		custom,
		summary: {
			total,
			controlled: controlled.length,
			custom: custom.length,
			coverage: total === 0 ? 1 : Math.round( ( controlled.length / total ) * 100 ) / 100,
		},
	};
}

/** Parse a CSS declaration block (`a: b; c: d`) into property/value pairs. */
export function parseDeclarations( cssText: string ): Array< { property: string; value: string } > {
	return String( cssText ?? '' )
		.split( ';' )
		.map( ( d ) => d.trim() )
		.filter( Boolean )
		.map( ( d ) => {
			const i = d.indexOf( ':' );
			if ( i < 0 ) {
				return null;
			}
			return { property: d.slice( 0, i ).trim(), value: d.slice( i + 1 ).trim() };
		} )
		.filter( ( x ): x is { property: string; value: string } => !! x && x.property !== '' );
}
