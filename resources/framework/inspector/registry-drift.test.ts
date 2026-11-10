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
 * The registry is the generated `SECTION_CONTROLS` (from resources/engine/schema.json); the
 * controls are read from source, since importing them pulls in @wordpress/block-editor for what is
 * a pure data assertion. The Inspector's own `SECTIONS` list is parsed only for its facet ids.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULES, SECTION_CONTROLS } from '@/engine/schema.gen';

const CONTROLS = resolve( __dirname, '../../controls' );
const INSPECTOR = resolve( __dirname, 'Inspector.tsx' );

/** Every control-id literal (`section.property`) in a source file. */
const CONTROL_ID = /'([a-z][a-zA-Z]*\.[a-zA-Z]+)'/g;

/** Control families — every id prefix the engine declares. */
const SECTION_PREFIXES = [ ...new Set( RULES.map( ( rule ) => rule.attr.split( '.' )[ 0 ] ) ) ];

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
	// Two facets, two files: the grid belongs to the stage, the placement to its children. They
	// share their validators through `scene-child/cells.ts` so one cannot accept a span the other
	// rejects.
	scene: [ 'scene-grid/SceneGridControl.tsx' ],
	sceneChild: [ 'scene-child/SceneChildControl.tsx' ],
	// The other placement model: a box occupies cells, what goes inside one is placed freely.
	sceneItem: [ 'scene-item/SceneItemControl.tsx' ],
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
	// A span is clamped to the stage's track count, which belongs to the stage's Grid facet.
	sceneChild: [ 'scene.cols' ],
	// The fill editor is shared: Typography renders only its text slots, Background only its
	// background slots, but both read the same slot table.
	typography: [
		'colors.background', 'colors.clipText', 'background.gradient', 'background.image',
		'background.size', 'background.position', 'background.repeat', 'background.attachment',
		'background.blendMode',
	],
	background: [ 'colors.text', 'colors.border' ],
};

/** The facet ids the Inspector's `SECTIONS` list renders, in rail order. */
function inspectorFacets(): string[] {
	const source = readFileSync( INSPECTOR, 'utf8' );
	return [ ...source.matchAll( /\{\s*\n\s*id: '([a-zA-Z]+)',[\s\S]*?Control: \w+,/g ) ].map( ( m ) => m[ 1 ] );
}

describe( 'inspector control registry', () => {
	const SECTIONS = SECTION_CONTROLS;

	it( 'renders exactly the facets the schema declares', () => {
		expect( inspectorFacets().sort() ).toEqual( Object.keys( SECTIONS ).sort() );
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
			// to a field the user can see and set. Set that control's `section` in schema.json, or
			// add it to `BORROWED` above if the control only reads it.
			expect( unregistered ).toEqual( [] );
		} );
	}
} );
