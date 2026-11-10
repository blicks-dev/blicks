/**
 * The generated engine tables must match resources/engine/schema.json byte for byte — a hand edit
 * to one of them, or a schema change without `pnpm gen:engine`, is what reintroduces the drift the
 * generator exists to remove. CI also runs `gen-engine.mjs --check`; this makes `pnpm test` catch
 * it locally first.
 */

import { describe, expect, it } from 'vitest';
import { RULES } from './schema.gen';
import { render, stale, validate } from '../../scripts/gen-engine.mjs';
import schema from './schema.json';

describe( 'engine schema', () => {
	it( 'is valid', () => {
		expect( () => validate( schema ) ).not.toThrow();
	} );

	it( 'matches every generated file', () => {
		expect( stale() ).toEqual( [] );
	} );

	it( 'rejects a control the runtime stylesheet would never style', () => {
		const broken = structuredClone( schema );
		delete broken.controls.find( ( c: any ) => c.id === 'layout.width' )!.runtime;
		expect( () => validate( broken ) ).toThrow( /layout\.width: no runtime rule/ );
	} );

	it( 'rejects a duplicate class', () => {
		const broken = structuredClone( schema );
		broken.controls[ 1 ].cls = broken.controls[ 0 ].cls;
		expect( () => validate( broken ) ).toThrow( /duplicate cls/ );
	} );

	it( 'rejects a CSS property that imports to two controls', () => {
		const broken = structuredClone( schema );
		broken.controls.find( ( c: any ) => c.id === 'spacing.margin' )!.import = [ 'padding' ];
		expect( () => validate( broken ) ).toThrow( /"padding" already imports to spacing\.padding/ );
	} );

	it( 'rejects a relation to a control that does not exist', () => {
		const broken = structuredClone( schema );
		broken.relations.push( { kind: 'enables', from: 'layout.display', to: [ 'layout.float' ], note: '' } );
		expect( () => validate( broken ) ).toThrow( /unknown control "layout\.float"/ );
	} );

	it( 'rejects a part-only control that would also reach the element', () => {
		const broken = structuredClone( schema );
		broken.controls.find( ( c: any ) => c.id === 'decoration.content' )!.var = '--bl-deco-c';
		expect( () => validate( broken ) ).toThrow( /partOnly control takes a part\.prop and no var/ );
	} );

	it( 'writes corner radii as longhands, so a two-value (elliptical) corner is valid', () => {
		const scss = render()[ 'resources/runtime/_engine.scss' ] as string;
		expect( scss ).toContain( "'br': ( prop: border-radius, vars: ('brtl', 'brtr', 'brbr', 'brbl'), fallback: 0, longhands: (border-top-left-radius, border-top-right-radius, border-bottom-right-radius, border-bottom-left-radius) )" );
	} );

	it( 'emits one rule per control, in schema order', () => {
		expect( RULES.map( ( r ) => r.attr ) ).toEqual( schema.controls.map( ( c: any ) => c.id ) );
		expect( Object.keys( render() ) ).toHaveLength( 3 );
	} );
} );
