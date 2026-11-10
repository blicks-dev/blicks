// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { NAME_PATTERN } from '@/blocks/field/model';
import { FORM_CHILDREN } from './model';
import { TEMPLATES, findTemplate, templateAttributes, templateName, type BlockSpec } from './templates';
import { findProblems, renamesFor } from './editor';
import { problemLines } from './controls';

// A Field's own parts (its label, Input and help) are the Field's business, not the Form's.
const flat = ( specs: BlockSpec[] ): BlockSpec[] => specs.flatMap( ( s ) => [ s, ...( s[ 0 ] === 'blicks/field' ? [] : flat( s[ 2 ] ?? [] ) ) ] );
const fieldsOf = ( key: string ) => flat( findTemplate( key )!.blocks() ).filter( ( s ) => s[ 0 ] === 'blicks/field' ).map( ( s ) => s[ 1 ] );

describe( 'form templates', () => {
	it( 'are the five, in the picker’s order', () => {
		expect( TEMPLATES.map( ( t ) => t.key ) ).toEqual( [ 'contact', 'newsletter', 'newsletter-card', 'callback', 'blank' ] );
		expect( templateName( 'callback' ) ).toBe( 'Call back' );
		expect( templateName( 'nope' ) ).toBe( '' );
	} );

	it( 'each hold only allowed blocks, one Send button, and fields with unique, valid names', () => {
		for ( const t of TEMPLATES ) {
			const blocks = flat( t.blocks() );
			for ( const [ name ] of blocks ) expect( FORM_CHILDREN ).toContain( name );
			const submits = blocks.filter( ( [ name, a ] ) => name === 'blicks/button' && a.action === 'submit' );
			expect( submits ).toHaveLength( 1 );
			const names = fieldsOf( t.key ).map( ( a ) => a.name as string );
			for ( const n of names ) expect( n ).toMatch( NAME_PATTERN );
			expect( new Set( names ).size ).toBe( names.length );
			expect( t.skeleton.rows.length ).toBeGreaterThan( 0 );
		}
	} );

	it( 'contact has the prototype’s six fields', () => {
		expect( fieldsOf( 'contact' ).map( ( a ) => [ a.name, a.type, a.width, !! a.required ] ) ).toEqual( [
			[ 'name', 'text', 'half', true ],
			[ 'email', 'email', 'half', true ],
			[ 'phone', 'tel', 'half', false ],
			[ 'topic', 'select', 'half', false ],
			[ 'message', 'textarea', 'full', true ],
			[ 'consent', 'consent', 'full', true ],
		] );
		expect( fieldsOf( 'contact' )[ 3 ].options ).toEqual( [ 'General question', 'Sales', 'Support' ] );
		expect( fieldsOf( 'contact' )[ 4 ].errorMessage ).toBe( 'Write a message.' );
	} );

	it( 'newsletter puts the email and a two-column button in one row', () => {
		const blocks = findTemplate( 'newsletter' )!.blocks();
		expect( blocks[ 0 ][ 1 ] ).toMatchObject( { type: 'email', width: 'two', required: true } );
		expect( blocks[ 1 ][ 1 ] ).toMatchObject( { text: 'Subscribe', action: 'submit' } );
		expect( ( blocks[ 1 ][ 1 ].blicks as any )[ 'gridChild.columnSpan' ].default.base ).toBe( '2' );
		expect( blocks[ 2 ] ).toEqual( [ 'blicks/text', { content: 'We use your email for this newsletter only.' } ] );
	} );

	it( 'call back offers three times', () => {
		expect( fieldsOf( 'callback' )[ 2 ] ).toMatchObject( { type: 'choice', name: 'time', options: [ 'Morning', 'Afternoon', 'Evening' ] } );
	} );

	it( 'sets the template, and its sent message only while the author has none', () => {
		expect( templateAttributes( 'contact', {} ) ).toEqual( { template: 'contact' } );
		expect( templateAttributes( 'callback', { kind: 'message', title: '', message: '' } ) ).toEqual( {
			template: 'callback',
			after: { kind: 'message', title: 'We will call you back', message: 'Expect a call in the time you picked.' },
		} );
		expect( templateAttributes( 'callback', { title: 'Mine' } ) ).toEqual( { template: 'callback' } );
	} );
} );

const field = ( clientId: string, name: string, innerBlocks: any[] = [] ) => ( { clientId, name: 'blicks/field', attributes: { name }, innerBlocks } );
const button = ( action: string ) => ( { clientId: 'b', name: 'blicks/button', attributes: { action }, innerBlocks: [] } );

describe( 'form problems', () => {
	it( 'finds a missing Send button, shared names and nameless fields', () => {
		const p = findProblems( [ field( '1', 'email' ), field( '2', 'email' ), field( '3', '' ), button( 'link' ) ] );
		expect( p ).toEqual( { noSubmit: true, duplicates: [ 'email' ], unnamed: 1 } );
		expect( problemLines( p ) ).toHaveLength( 3 );
	} );

	it( 'looks inside Boxes but not inside a nested form', () => {
		const stack = { clientId: 's', name: 'blicks/box', attributes: {}, innerBlocks: [ field( '1', 'name' ), button( 'submit' ) ] };
		const nested = { clientId: 'f', name: 'blicks/form', attributes: {}, innerBlocks: [ field( '2', 'name' ), button( 'submit' ) ] };
		expect( findProblems( [ stack, nested ] ) ).toEqual( { noSubmit: false, duplicates: [], unnamed: 0 } );
		expect( findProblems( [ nested ] ).noSubmit ).toBe( true );
		expect( problemLines( findProblems( [ stack ] ) ) ).toEqual( [] );
	} );
} );

describe( 'unique names for new fields', () => {
	it( 'renames only fields that just arrived', () => {
		const known = new Set( [ 'a', 'b' ] );
		const fields = [
			{ clientId: 'a', name: 'email' },
			{ clientId: 'b', name: 'email' },
			{ clientId: 'c', name: 'email' },
			{ clientId: 'd', name: 'email' },
			{ clientId: 'e', name: '' },
		];
		expect( renamesFor( fields, known ) ).toEqual( [
			{ clientId: 'c', name: 'email_2' },
			{ clientId: 'd', name: 'email_3' },
		] );
		expect( known.has( 'c' ) && known.has( 'd' ) ).toBe( true );
		// A nameless field waits until it has a name.
		expect( known.has( 'e' ) ).toBe( false );
		expect( renamesFor( [ ...fields.slice( 0, 4 ), { clientId: 'e', name: 'phone' } ], known ) ).toEqual( [] );
	} );
} );

describe( 'Form name, error colour and space between fields', () => {
	it( 'keeps the name to one trimmed line and the colour to a slug', async () => {
		const { cleanName, cleanErrorColour, withErrorColour } = await import( './model' );
		expect( cleanName( '  Contact,\n home page ' ) ).toBe( 'Contact, home page' );
		expect( cleanName( 3 ) ).toBe( '' );
		expect( cleanErrorColour( 'Destructive' ) ).toBe( 'destructive' );
		expect( cleanErrorColour( 'red;}body{x' ) ).toBe( 'redbodyx' );
		expect( withErrorColour( { color: 'red' }, 'primary' ) ).toEqual( { color: 'red', '--bl-form-error': 'var(--blicks-color-primary)' } );
		expect( withErrorColour( undefined, '' ) ).toBeUndefined();
	} );

	it( 'writes the gaps as one step, and reads a typed size as none of them', async () => {
		const { fieldGap, withFieldGap } = await import( './controls' );
		expect( fieldGap( {} ) ).toBe( '' );
		const small = withFieldGap( {}, 'sm' );
		expect( small[ 'layout.gapRow' ] ).toEqual( { default: { base: '10px' } } );
		expect( small[ 'layout.gapColumn' ] ).toEqual( { default: { base: '12px' } } );
		expect( fieldGap( small ) ).toBe( 'sm' );
		expect( fieldGap( withFieldGap( small, '' ) ) ).toBe( '' );
		expect( fieldGap( { 'layout.gapRow': { default: { base: '40px' } } } ) ).toBeNull();
	} );
} );
