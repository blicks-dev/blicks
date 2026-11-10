import { describe, expect, it } from 'vitest';
import { buildElementStyle, findStyleProblems } from '@/framework/css/vars';
import { PRESETS, hasDecoration, readDecoration, writeDecoration } from './decor-model';

describe( 'decorations', () => {
	it.each( Object.entries( PRESETS ) )( 'the %s preset reads back as written', ( _name, { part, deco } ) => {
		const tree = writeDecoration( {}, part, deco );
		expect( readDecoration( tree, part ) ).toEqual( deco );
	} );

	it.each( Object.entries( PRESETS ) )( 'the %s preset writes only values the engine accepts', ( _name, { part, deco } ) => {
		const tree = writeDecoration( {}, part, deco );
		expect( findStyleProblems( tree ) ).toEqual( [] );
		expect( buildElementStyle( tree, { uniqueId: 'x1' } ).scopedCss?.join( '' ) ).toContain( `.bl-x1::${ part }` );
	} );

	it( 'places a dot from its anchor, centring on the middle axis', () => {
		const tree = writeDecoration( {}, 'before', { ...PRESETS.dot.deco, anchor: 'ml', offset: 16, size: 10 } );
		expect( tree[ 'position.inset' ]?.before?.base ).toEqual( { top: 'calc(50% - 5px)', left: '16px' } );
	} );

	it( 'positions the block and isolates it for a shape behind, without overriding its own values', () => {
		const tree = writeDecoration( { 'position.type': { default: { base: 'sticky' } } }, 'before', PRESETS.glow.deco );
		expect( tree[ 'position.type' ]?.default?.base ).toBe( 'sticky' );
		expect( tree[ 'layout.isolation' ]?.default?.base ).toBe( 'isolate' );
	} );

	it( 'removes only its own part, and keeps what the author set on the part that it has no control for', () => {
		const start = writeDecoration( writeDecoration( {}, 'before', PRESETS.dot.deco ), 'after', PRESETS.shine.deco );
		const withExtra = { ...start, 'effects.mask': { after: { base: 'linear-gradient(#000, transparent)' } } };
		const cleared = writeDecoration( withExtra, 'after', null );
		expect( hasDecoration( cleared, 'before' ) ).toBe( true );
		expect( readDecoration( cleared, 'before' ) ).toEqual( PRESETS.dot.deco );
		expect( cleared[ 'effects.mask' ] ).toEqual( withExtra[ 'effects.mask' ] );
		expect( cleared[ 'colors.background' ]?.after ).toBeUndefined();
	} );

	it( 'opens a decoration an agent wrote by hand', () => {
		// live-dot-pill's ping, as the QA build wrote it through the MCP.
		const tree = {
			'decoration.content': { after: { base: '""' } },
			'position.type': { after: { base: 'absolute' } },
			'position.inset': { after: { base: { top: 'calc(50% - 5px)', left: '20px', right: 'auto', bottom: 'auto' } } },
			'layout.width': { after: { base: '10px' } },
			'layout.height': { after: { base: '10px' } },
			'colors.background': { after: { base: '#34e08a' } },
			'border.radius': { after: { base: '50%' } },
			'effects.opacity': { after: { base: '0.7' } },
			'animation.name': { after: { base: 'bl-anim-btn-ping' } },
		};
		expect( readDecoration( tree, 'after' ) ).toMatchObject( { place: 'spot', anchor: 'ml', offset: 20, size: 10, fill: '#34e08a', opacity: 70, motion: 'bl-anim-btn-ping' } );
	} );

	it( 'keeps an animation it has no chip for when the decoration is edited', () => {
		const tree = {
			...writeDecoration( {}, 'after', PRESETS.dot.deco ),
			'animation.name': { after: { base: 'bl-anim-btn-ping' } },
			'animation.duration': { after: { base: '1.6s' } },
			'animation.iteration': { after: { base: 'infinite' } },
		};
		const edited = writeDecoration( tree, 'after', { ...readDecoration( tree, 'after' )!, opacity: 50 } );
		expect( edited[ 'animation.name' ]?.after?.base ).toBe( 'bl-anim-btn-ping' );
		expect( edited[ 'animation.duration' ]?.after?.base ).toBe( '1.6s' );
		expect( edited[ 'effects.opacity' ]?.after?.base ).toBe( '0.5' );
		const replaced = writeDecoration( tree, 'after', { ...readDecoration( tree, 'after' )!, motion: 'bl-spin' } );
		expect( replaced[ 'animation.name' ]?.after?.base ).toBe( 'bl-spin' );
		expect( replaced[ 'animation.duration' ]?.after?.base ).toBe( '8s' );
	} );
} );
