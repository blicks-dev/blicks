/**
 * Guards the Inspector's `SECTIONS` registry against drifting away from the controls it
 * renders.
 *
 * The registry's `controlIds` are not decoration: they drive the facet allow-list, the rail's
 * "styled" dot (`facetHasValue`), the per-facet Reset affordance (`facetSlotHasValue`) and what
 * `resetFacet` clears. A control that renders a field whose id is missing from its facet's list
 * still writes CSS, so the bug is invisible in the canvas — it shows up as a Reset button that
 * never appears and a value the facet cannot clear.
 *
 * Both sides are read from source rather than imported: importing the Inspector pulls in
 * @wordpress/block-editor for what is a pure data assertion.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const CONTROLS = resolve( __dirname, '../../controls' );
const INSPECTOR = resolve( __dirname, 'Inspector.tsx' );

/** Every control-id literal (`section.property`) in a source file. */
const CONTROL_ID = /'([a-z][a-zA-Z]*\.[a-zA-Z]+)'/g;

const SECTION_PREFIXES = [
	'layout', 'gridChild', 'flexChild', 'columns', 'spacing', 'border', 'position',
	'colors', 'background', 'typography', 'effects', 'animation', 'decoration',
];

const isControlId = ( value: string ): boolean =>
	SECTION_PREFIXES.includes( value.split( '.' )[ 0 ] );

const idsIn = ( source: string ): string[] =>
	[ ...new Set( [ ...source.matchAll( CONTROL_ID ) ].map( ( m ) => m[ 1 ] ).filter( isControlId ) ) ];

/**
 * Facet id → the source files whose fields that facet's body renders. A facet that nests another
 * control (Layout renders the grid track editor; Typography and Background share the fill editor)
 * lists the nested file too, because those fields land in the nesting facet's body.
 */
const FACET_SOURCES: Record< string, string[] > = {
	layout: [ 'layout/LayoutControl.tsx', 'grid/GridControl.tsx' ],
	spacing: [ 'spacing/SpacingControl.tsx' ],
	typography: [ 'typography/TypographyControl.tsx', 'fill/types.ts' ],
	background: [ 'fill/FillControl.tsx', 'fill/FillEditor.tsx', 'fill/types.ts' ],
	borders: [ 'border/BorderControl.tsx' ],
	position: [ 'position/PositionControl.tsx' ],
	columns: [ 'columns/ColumnsControl.tsx' ],
	gridChild: [ 'grid-child/GridChildControl.tsx' ],
	flexChild: [ 'flex-child/FlexChildControl.tsx' ],
	effects: [ 'effects/EffectsControl.tsx' ],
	animation: [ 'animation/AnimationControl.tsx' ],
	decoration: [ 'decoration/DecorationControl.tsx' ],
	states: [ 'states/StatesControl.tsx' ],
};

/**
 * Ids a control *reads* but does not own — it branches on another facet's value (Columns and the
 * grid editor both key off the display mode; Decoration needs a positioned box for its pseudo-
 * elements). Registering them would put one control's value under another facet's Reset.
 */
const BORROWED: Record< string, string[] > = {
	layout: [],
	columns: [ 'layout.display' ],
	decoration: [ 'position.type' ],
	// The fill editor is shared: Typography renders only its text slots, Background only its
	// background slots, but both read the same slot table.
	typography: [
		'colors.background', 'colors.clipText', 'background.gradient', 'background.image',
		'background.size', 'background.position', 'background.repeat', 'background.attachment',
		'background.blendMode',
	],
	background: [ 'colors.text', 'colors.border' ],
};

/** Parse `SECTIONS` out of Inspector.tsx: one entry per `id: '…' … Control: X,` block. */
function registry(): Record< string, string[] > {
	const source = readFileSync( INSPECTOR, 'utf8' );
	const entries: Record< string, string[] > = {};
	const block = /\{\s*\n\s*id: '([a-zA-Z]+)',[\s\S]*?Control: \w+,/g;
	for ( const match of source.matchAll( block ) ) {
		entries[ match[ 1 ] ] = idsIn( match[ 0 ] );
	}
	return entries;
}

describe( 'inspector control registry', () => {
	const SECTIONS = registry();

	it( 'parses every facet out of SECTIONS', () => {
		expect( Object.keys( SECTIONS ).sort() ).toEqual( Object.keys( FACET_SOURCES ).sort() );
	} );

	for ( const [ facet, files ] of Object.entries( FACET_SOURCES ) ) {
		it( `registers every control the ${ facet } facet renders`, () => {
			const rendered = idsIn(
				files.map( ( file ) => readFileSync( resolve( CONTROLS, file ), 'utf8' ) ).join( '\n' )
			);
			const borrowed = BORROWED[ facet ] ?? [];
			const unregistered = rendered.filter(
				( id ) => ! SECTIONS[ facet ].includes( id ) && ! borrowed.includes( id )
			);

			// A miss here means the facet's Reset, its "styled" dot and `resetFacet` are all blind
			// to a field the user can see and set. Add the id to that facet's `controlIds`, or to
			// `BORROWED` above if the control only reads it.
			expect( unregistered ).toEqual( [] );
		} );
	}
} );
