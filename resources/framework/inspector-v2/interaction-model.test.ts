import { describe, expect, it } from 'vitest';
import { buildElementStyle } from '@/framework/css/vars';
import { FOLLOW_MOVE, NO_INTERACTIONS, readInteractions, writeInteractions } from './interaction-model';

describe( 'interactions model', () => {
	it( 'writes the runtime attributes and the style each needs, and reads them back', () => {
		const next = { follow: 16, move: true, replay: { name: 'bl-anim-btn-jelly', duration: '620ms' }, toggle: 'card' as const, keep: true, set: 'on' as const };
		const { htmlAttributes, blicks } = writeInteractions( [ { name: 'data-track', value: 'cta' } ], {}, next );
		expect( htmlAttributes ).toEqual( [
			{ name: 'data-track', value: 'cta' },
			{ name: 'data-bl-do', value: 'follow replay toggle' },
			{ name: 'data-bl-follow', value: '16' },
			{ name: 'data-bl-toggle', value: 'card' },
			{ name: 'data-bl-keep', value: '' },
			{ name: 'data-bl-set', value: 'on' },
		] );
		expect( blicks[ 'animation.name' ] ).toEqual( { play: { base: 'bl-anim-btn-jelly' } } );
		expect( blicks[ 'effects.transform' ] ).toEqual( { default: { base: FOLLOW_MOVE } } );
		expect( readInteractions( htmlAttributes, blicks ) ).toEqual( next );
	} );

	it( 'turning everything off leaves the author\'s own attributes and transform alone', () => {
		const own = { 'effects.transform': { default: { base: 'rotate(4deg)' } } };
		const { htmlAttributes, blicks } = writeInteractions( [ { name: 'data-track', value: 'cta' } ], own, NO_INTERACTIONS );
		expect( htmlAttributes ).toEqual( [ { name: 'data-track', value: 'cta' } ] );
		expect( blicks ).toEqual( own );
	} );

	it( 'plays the replay animation only in the play state', () => {
		const { blicks } = writeInteractions( [], {}, { ...NO_INTERACTIONS, replay: { name: 'bl-zoom-in', duration: '500ms' } } );
		const out = buildElementStyle( blicks, { uniqueId: 'x1' } );
		expect( out.classes ).toContain( 'bl-anim-name--ply' );
		expect( out.vars[ '--bl-anim-name-ply' ] ).toBe( 'bl-zoom-in' );
	} );
} );
