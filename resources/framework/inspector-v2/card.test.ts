import { describe, it, expect } from 'vitest';
import { RULES, STATE_ANCESTOR } from '@/engine/schema.gen';
import { buildElementStyle } from '@/framework/css/vars';
import { CARD_CONTROL, CARD_VALUE, canBeCard, cardToMark, isCard, markCard, needsCard } from './card';

const box = ( id: string, blicks?: any ) => ( { clientId: id, controls: [ 'layout.*' ], blicks } );
const text = ( id: string ) => ( { clientId: id, controls: [ 'typography.*' ], blicks: undefined } );

describe( 'the card a block reacts to', () => {
	it( 'marks the nearest container that can be a card, skipping ones that cannot', () => {
		expect( cardToMark( [ text( 'inline' ), box( 'card' ), box( 'section' ) ] )?.clientId ).toBe( 'card' );
	} );

	it( 'marks nothing when that container already is a card', () => {
		expect( cardToMark( [ box( 'card', markCard( undefined ) ), box( 'section' ) ] ) ).toBeNull();
	} );

	it( 'marks nothing when there is no container', () => {
		expect( cardToMark( [ text( 'a' ) ] ) ).toBeNull();
	} );

	it( 'reads the allow-list exactly or by wildcard', () => {
		expect( canBeCard( [ 'layout.group' ] ) ).toBe( true );
		expect( canBeCard( [ 'layout.width' ] ) ).toBe( false );
		expect( canBeCard( undefined ) ).toBe( false );
	} );

	it( 'keeps the rest of the tree when marking', () => {
		const next = markCard( { 'spacing.padding': { default: { base: '4' } } } );

		expect( isCard( next ) ).toBe( true );
		expect( next[ 'spacing.padding' ] ).toEqual( { default: { base: '4' } } );
	} );

	it( 'knows which states need a card, with or without a part', () => {
		for ( const state of [ 'group', 'groupActive', 'groupOn', 'before:groupOn', 'after:group' ] ) expect( needsCard( state ) ).toBe( true );
		for ( const state of [ 'default', 'hover', 'on', 'active', 'before:hover', 'constructor' ] ) expect( needsCard( state ) ).toBe( false );
	} );

	// The card switch and the card states are two ends of one contract: the class the switch
	// emits is the one every card state's selectors look for.
	it( 'marks with the class the card states select', () => {
		const rule = RULES.find( ( r ) => r.attr === CARD_CONTROL );
		const { classes } = buildElementStyle( markCard( undefined ) as any );
		const cls = `bl-${ rule?.cls }--${ CARD_VALUE }`;

		expect( classes ).toContain( cls );
		for ( const { on, off } of Object.values( STATE_ANCESTOR ) ) {
			expect( on ).toContain( `.${ cls }` );
			expect( off ).toContain( `.${ cls }` );
		}
	} );
} );
