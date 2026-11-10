/**
 * The read-only engine description, pinned against schema.json. `tests/Unit/Style/EngineSchemaTest.php`
 * runs the same checks on the PHP mirror; the two together are the parity guard.
 */

import { describe, expect, it } from 'vitest';
import schema from './schema.json';
import { describeControl, describeEngine, ENGINE_SCHEMA_VERSION } from './describe';

describe( 'describeEngine', () => {
	const engine = describeEngine();

	it( 'has the documented keys, in the order the PHP mirror returns them', () => {
		expect( Object.keys( engine ) ).toEqual( [ 'version', 'controls', 'states', 'stateControls', 'breakpoints', 'parts', 'sections', 'relations', 'valueShapes', 'valueTree', 'typeRoles' ] );
		expect( engine.version ).toBe( ENGINE_SCHEMA_VERSION );
	} );

	it( 'describes every schema control, in order, in its section', () => {
		expect( engine.controls.map( ( c ) => c.id ) ).toEqual( schema.controls.map( ( c ) => c.id ) );

		for ( const declared of schema.controls ) {
			const control = describeControl( declared.id )!;
			expect( control.section, declared.id ).toBe( declared.section );
			expect( Object.keys( control ) ).toEqual( [ 'id', 'section', 'valueShape', 'category', 'scoped', 'parts', 'partOnly', 'flag', 'value' ] );
			expect( [ 'sides', 'corners', 'scalar' ] ).toContain( control.valueShape );
			expect( engine.valueShapes ).toHaveProperty( control.value.shape );
		}
	} );

	it( 'derives the value shape from the rule kind', () => {
		expect( describeControl( 'spacing.padding' )?.valueShape ).toBe( 'sides' );
		expect( describeControl( 'position.inset' )?.valueShape ).toBe( 'sides' );
		expect( describeControl( 'border.radius' )?.valueShape ).toBe( 'corners' );
		expect( describeControl( 'typography.role' )?.valueShape ).toBe( 'scalar' );
		expect( describeControl( 'spacing.padding' )?.category ).toBe( 'spacing' );
	} );

	it( 'marks a part-only control as partable', () => {
		expect( describeControl( 'decoration.content' ) ).toMatchObject( { partOnly: true, parts: true } );
	} );

	it( 'takes states, breakpoints and parts from the schema', () => {
		expect( engine.states.map( ( s ) => s.id ) ).toEqual( Object.keys( schema.states ) );
		expect( engine.breakpoints.map( ( b ) => b.id ) ).toEqual( Object.keys( schema.breakpoints ) );
		expect( engine.breakpoints[ 0 ].maxWidth ).toBeNull();
		expect( engine.parts ).toEqual( Object.keys( schema.parts ) );
		expect( engine.sections.map( ( s ) => s.id ) ).toEqual( schema.sections.map( ( s ) => s.id ) );
		expect( engine.typeRoles ).toEqual( schema.typeRoles );
		expect( engine.relations ).toHaveLength( schema.relations.length );
	} );

	it( 'leaves the v1 controls removed in the clean break out', () => {
		for ( const id of [ 'layout.float', 'layout.clear', 'layout.direction', 'decoration.before', 'decoration.after', 'layout.gridAutoColumns', 'animation.targetAngle' ] ) {
			expect( describeControl( id ), id ).toBeNull();
		}
	} );

	it( 'is deep-frozen and stable, so a caller cannot change what the validator reads', () => {
		expect( describeEngine() ).toBe( engine );
		expect( Object.isFrozen( engine ) ).toBe( true );
		expect( Object.isFrozen( engine.controls[ 0 ] ) ).toBe( true );
		expect( Object.isFrozen( engine.controls[ 0 ].value ) ).toBe( true );
		expect( Object.isFrozen( engine.valueShapes ) ).toBe( true );
	} );
} );
