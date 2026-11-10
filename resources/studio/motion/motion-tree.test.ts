import { describe, it, expect } from 'vitest';
import { animationSupport, readMotion, toMs, writeMotion, VIEW_RANGE, type Motion } from './motion-tree';

const motion: Motion = { name: 'bl-anim-jelly', plays: 'always', duration: 900, delay: 0, loop: true, easing: 'ease-in-out' };

describe( 'writing a block’s animation', () => {
	it( 'writes the controls on the base slot, and reads them back', () => {
		const tree = writeMotion( {}, motion );

		expect( tree ).toEqual( {
			'animation.name': { default: { base: 'bl-anim-jelly' } },
			'animation.duration': { default: { base: '900ms' } },
			'animation.easing': { default: { base: 'ease-in-out' } },
			'animation.fillMode': { default: { base: 'both' } },
			'animation.iteration': { default: { base: 'infinite' } },
		} );
		expect( readMotion( tree ) ).toEqual( motion );
	} );

	it( 'plays in view along the scroll, once', () => {
		const tree = writeMotion( {}, { ...motion, plays: 'view', delay: 200 } );

		expect( tree[ 'animation.timeline' ] ).toEqual( { default: { base: 'view()' } } );
		expect( tree[ 'animation.range' ] ).toEqual( { default: { base: VIEW_RANGE } } );
		expect( tree[ 'animation.iteration' ] ).toBeUndefined();
		expect( readMotion( tree ) ).toMatchObject( { plays: 'view', delay: 200 } );
	} );

	/*
	 * The engine has no state rules for `animation-name`, so a hover animation is a paused one that
	 * runs on hover. This pins that shape: a name on the hover slot would silently do nothing.
	 */
	it( 'plays on hover by pausing at rest and running on hover', () => {
		const tree = writeMotion( {}, { ...motion, plays: 'hover' } );

		expect( tree[ 'animation.name' ] ).toEqual( { default: { base: 'bl-anim-jelly' } } );
		expect( tree[ 'animation.playState' ] ).toEqual( { default: { base: 'paused' }, hover: { base: 'running' } } );
		expect( readMotion( tree )?.plays ).toBe( 'hover' );
	} );

	it( 'clears every animation control, and only those', () => {
		const tree = writeMotion( { ...writeMotion( {}, { ...motion, plays: 'hover', delay: 100 } ), 'spacing.padding': { default: { base: '4' } } }, null );

		expect( tree ).toEqual( { 'spacing.padding': { default: { base: '4' } } } );
		expect( readMotion( tree ) ).toBeNull();
	} );

	it( 'switching how it plays leaves nothing from the old way behind', () => {
		const hover = writeMotion( {}, { ...motion, plays: 'hover' } );
		const view = writeMotion( hover, { ...motion, plays: 'view' } );

		expect( view[ 'animation.playState' ] ).toBeUndefined();
	} );

	it( 'reads an entrance written by the block inspector', () => {
		const entrance = {
			'animation.name': { default: { base: 'bl-rise' } },
			'animation.duration': { default: { base: '600ms' } },
			'animation.easing': { default: { base: 'ease-out' } },
			'animation.fillMode': { default: { base: 'both' } },
			'animation.timeline': { default: { base: 'view()' } },
			'animation.range': { default: { base: 'entry 0% cover 30%' } },
		};

		expect( readMotion( entrance ) ).toMatchObject( { name: 'bl-rise', plays: 'view', duration: 600 } );
	} );
} );

describe( 'reading times', () => {
	it( 'takes ms and s, and falls back on anything else', () => {
		expect( toMs( '600ms', 0 ) ).toBe( 600 );
		expect( toMs( '1.5s', 0 ) ).toBe( 1500 );
		expect( toMs( 'var(--x)', 42 ) ).toBe( 42 );
	} );
} );

describe( 'what a block allows', () => {
	it( 'reads the allow-list with wildcards, and hover from the block’s states', () => {
		expect( animationSupport( { controls: [ 'animation.*' ], states: [ 'default', 'hover' ] } ) ).toEqual( { animate: true, hover: true } );
		expect( animationSupport( { controls: [ 'animation.*' ], states: [ 'default' ] } ) ).toEqual( { animate: true, hover: false } );
		expect( animationSupport( { controls: [ 'animation.name' ] } ) ).toEqual( { animate: false, hover: false } );
		expect( animationSupport( undefined ) ).toEqual( { animate: false, hover: false } );
	} );
} );
