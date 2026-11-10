/**
 * The editor's half of tests/fixtures/loop-cases.json. tests/Unit/Data/LoopCasesTest.php runs the
 * same cases against the PHP that renders the page; a case passing on one side only is a preview
 * that shows something the page will not.
 */
import { describe, expect, it } from 'vitest';
import cases from '../../../tests/fixtures/loop-cases.json';
import { effects, format, lists, matches, resolve, run, slotSpan } from './data';
import { sequence } from './pager';

const named = ( list: any[], fallback: string ) => list.map( ( c, i ) => [ `${ c.name ?? fallback } #${ i }`, c ] as const );

describe( 'loop data, shared with the PHP renderer', () => {
	it.each( named( cases.format, 'format' ) )( 'format %s', ( _n, c: any ) => {
		expect( format( c.value, c.format, c.arg ) ).toBe( c.out );
	} );

	it.each( named( cases.resolve, 'resolve' ) )( 'resolve %s', ( _n, c: any ) => {
		expect( resolve( c.item, c.args, c.kind ) ).toEqual( c.out );
	} );

	it.each( named( cases.match, 'match' ) )( 'match %s', ( _n, c: any ) => {
		expect( matches( c.value, c.op, c.want ) ).toBe( c.out );
	} );

	it.each( named( cases.pipeline, 'pipeline' ) )( 'pipeline %s', ( _n, c: any ) => {
		const out = run( c.items, c.config );
		expect( out.items.map( ( i: any ) => i.id ) ).toEqual( c.out.ids );
		expect( out.total ).toBe( c.out.total );
		expect( out.matched ).toBe( c.out.matched );
	} );

	it.each( named( cases.rules, 'rules' ) )( 'rules %s', ( _n, c: any ) => {
		expect( effects( c.rules, c.item, c.position, c.span ) ).toEqual( c.out );
	} );

	it.each( named( cases.slotSpan, 'slotSpan' ) )( 'slotSpan %s', ( _n, c: any ) => {
		expect( slotSpan( c.tiles, c.slot, c.repeat ) ).toEqual( c.out );
	} );

	it.each( named( cases.lists, 'lists' ) )( 'lists %s', ( _n, c: any ) => {
		expect( lists( c.value ) ).toEqual( c.out );
	} );

	it.each( named( cases.pages, 'pages' ) )( 'pages %s', ( _n, c: any ) => {
		expect( sequence( c.current, c.count ) ).toEqual( c.out );
	} );
} );
