/**
 * The editor's half of tests/fixtures/loop-cases.json. tests/Unit/Data/LoopCasesTest.php runs the
 * same cases against the PHP that renders the page; a case passing on one side only is a preview
 * that shows something the page will not.
 */
import { describe, expect, it } from 'vitest';
import cases from '../../../tests/fixtures/loop-cases.json';
import { effects, format, lists, matches, resolve, run, slotSpan, upgrade, type BindingArgs } from './data';
import { sequence } from './pager';

const named = ( list: any[], fallback: string ) => list.map( ( c, i ) => [ `${ c.name ?? fallback } #${ i }`, c ] as const );

describe( 'loop data, shared with the PHP renderer', () => {
	it.each( named( cases.format, 'format' ) )( 'format %s', ( _n, c: any ) => {
		expect( format( c.value, c.format, c.arg, c.opts ?? {}, c.item ?? {} ) ).toBe( c.out );
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

describe( 'upgrade: a binding saved before format options', () => {
	const item = { title: 'Everest Base Camp', price: 1290, start: '2026-11-03', n: 1234.5 };
	it.each( [
		[ 'upper', { key: 'title', format: 'upper' }, { key: 'title', format: 'case', opts: { case: 'upper' } } ],
		[ 'prefix', { key: 'title', format: 'prefix', formatArg: 'Trip: ' }, { key: 'title', before: 'Trip: ' } ],
		[ 'suffix', { key: 'title', format: 'suffix', formatArg: ' →' }, { key: 'title', after: ' →' } ],
		[ 'currency', { key: 'price', format: 'currency', formatArg: '€' }, { key: 'price', format: 'currency', opts: { currency: '€' } } ],
		[ 'number', { key: 'n', format: 'number', formatArg: '2' }, { key: 'n', format: 'number', opts: { decimals: '2' } } ],
		[ 'number, more decimals than offered', { key: 'n', format: 'number', formatArg: '4' }, { key: 'n', format: 'number', formatArg: '4' } ],
		[ 'date', { key: 'start', format: 'date', formatArg: 'long' }, { key: 'start', format: 'date', opts: { style: 'long' } } ],
		[ 'nothing to move', { key: 'title', format: 'truncate', formatArg: '8' }, { key: 'title', format: 'truncate', formatArg: '8' } ],
	] )( '%s keeps its text', ( _name, saved: BindingArgs, want ) => {
		expect( upgrade( saved ) ).toEqual( want );
		expect( resolve( item, upgrade( saved ) ) ).toEqual( resolve( item, saved ) );
	} );
} );
