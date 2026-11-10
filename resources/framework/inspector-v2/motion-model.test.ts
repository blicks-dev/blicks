import { describe, expect, it } from 'vitest';
import { buildElementStyle } from '@/framework/css/vars';
import { loops, readCalm, readEntrance, withCalm, withEntrance } from './motion-model';

describe( 'entrances', () => {
	it( 'round-trips and clears', () => {
		for ( const e of [ 'fade', 'rise', 'zoom' ] as const ) expect( readEntrance( withEntrance( {}, e ) ) ).toBe( e );
		expect( withEntrance( withEntrance( {}, 'fade' ), 'none' ) ).toEqual( {} );
	} );

	it( 'drives a built-in keyframe from a view timeline', () => {
		const { vars, classes } = buildElementStyle( withEntrance( {}, 'zoom' ) );
		expect( vars ).toMatchObject( { '--bl-anim-name': 'bl-zoom-in', '--bl-anim-tl': 'view()', '--bl-anim-range': 'entry 0% cover 30%', '--bl-anim-fill': 'both' } );
		expect( classes ).toContain( 'bl-anim-name' );
	} );
} );

describe( 'when motion is reduced', () => {
	const pinging = { 'animation.name': { default: { base: 'bl-ping' } } };

	it( 'is offered for a block that keeps moving, not for a scroll entrance', () => {
		expect( loops( pinging ) ).toBe( true );
		expect( loops( withEntrance( {}, 'rise' ) ) ).toBe( false );
		expect( loops( {} ) ).toBe( false );
	} );

	it( 'reads back each mode it writes', () => {
		expect( readCalm( pinging ).mode ).toBe( 'still' );
		expect( readCalm( withCalm( pinging, { mode: 'hide', size: 100, opacity: 100 } ) ).mode ).toBe( 'hide' );
		expect( readCalm( withCalm( pinging, { mode: 'custom', size: 180, opacity: 25 } ) ) ).toEqual( { mode: 'custom', size: 180, opacity: 25 } );
		expect( withCalm( withCalm( pinging, { mode: 'hide', size: 100, opacity: 0 } ), { mode: 'still', size: 100, opacity: 100 } ) ).toEqual( pinging );
	} );

	it( 'rests a custom look under the reduced-motion query', () => {
		const out = buildElementStyle( withCalm( pinging, { mode: 'custom', size: 180, opacity: 25 } ), { uniqueId: 'x1' } );
		expect( out.classes ).toEqual( expect.arrayContaining( [ 'bl-op--rdm', 'bl-tfm--rdm' ] ) );
		expect( out.vars[ '--bl-op-rdm' ] ).toBe( '0.25' );
		expect( out.vars[ '--bl-tfm-rdm' ] ).toContain( 'scale(1.8)' );
	} );
} );
