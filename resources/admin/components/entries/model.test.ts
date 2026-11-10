import { describe, expect, it } from 'vitest';
import { csvHref, defaultStatuses, fieldRows, listPath, mailtoHref, normalizeEntry, normalizeList, receivedLabel, shiftCounts, statusLabel, withStatus } from './model';

const raw = {
	id: 7,
	form: 'abc',
	formTitle: 'Contact',
	post: 3,
	page: '/contact',
	fields: { name: 'Sita', email: 'sita@example.com', topics: [ 'a', 'b' ], message: 'Line one\nLine two' },
	labels: { name: 'Name', email: 'Email' },
	status: 'new',
	notes: [],
	received: '2026-11-05T10:42:00+00:00',
	log: [ 'Saved' ],
	from: 'Sita',
	email: 'sita@example.com',
	says: 'Line one Line two',
	challenge: 'none',
};

describe( 'normalizeList', () => {
	it( 'reads the list route', () => {
		const list = normalizeList( { items: [ raw, { nope: true } ], total: 1, pages: 1, forms: [ { id: 'abc', title: 'Contact', count: 1 }, { title: 'no id' } ], counts: { new: 1 }, csvUrl: 'x?a=1' } );

		expect( list.items ).toHaveLength( 1 );
		expect( list.items[ 0 ].fields.topics ).toEqual( [ 'a', 'b' ] );
		expect( list.forms ).toEqual( [ { id: 'abc', title: 'Contact', count: 1 } ] );
		expect( list.counts ).toEqual( { new: 1, handled: 0, spam: 0 } );
	} );

	it( 'answers an empty list for anything else', () => {
		expect( normalizeList( null ).items ).toEqual( [] );
		expect( normalizeEntry( { id: 'x' } ) ).toBeNull();
		expect( normalizeEntry( { ...raw, status: 'Not A Slug!' } )?.status ).toBe( 'new' );
		expect( normalizeEntry( { ...raw, status: 7 } )?.status ).toBe( 'new' );
		expect( normalizeList( {} ).statuses ).toEqual( [] );
	} );

	it( 'keeps a status a plugin added, and reads the route’s statuses and counts', () => {
		const list = normalizeList( {
			items: [ { ...raw, status: 'paid' } ],
			counts: { new: 2, paid: 1 },
			statuses: [ { slug: 'new', label: 'New', count: 2 }, { slug: 'paid', label: 'Paid', count: 1 }, { slug: 'pending', label: 'Pending', count: 4 }, { slug: 'BAD' }, { slug: 'paid', label: 'twice' } ],
		} );

		expect( list.items[ 0 ].status ).toBe( 'paid' );
		expect( list.statuses.map( ( s ) => s.slug ) ).toEqual( [ 'new', 'paid', 'pending' ] );
		expect( list.counts ).toEqual( { new: 2, handled: 0, spam: 0, paid: 1, pending: 4 } );
	} );

	it( 'labels a status from the route, else free’s own name, else its slug', () => {
		const statuses = [ { slug: 'paid', label: 'Bezahlt', count: 0 } ];
		const own = ( s: string ) => `own:${ s }`;

		expect( statusLabel( 'paid', statuses, own ) ).toBe( 'Bezahlt' );
		expect( statusLabel( 'spam', statuses, own ) ).toBe( 'own:spam' );
		expect( statusLabel( 'failed', statuses, own ) ).toBe( 'failed' );
		expect( defaultStatuses( own ).map( ( s ) => s.label ) ).toEqual( [ 'own:new', 'own:handled', 'own:spam' ] );
	} );
} );

describe( 'paths and links', () => {
	it( 'leaves empty filters out of the list path', () => {
		expect( listPath( { form: '', status: '', search: ' ', page: 1 } ) ).toBe( '/blicks/v1/forms/entries?per_page=20' );
		expect( listPath( { form: 'abc', status: 'spam', search: 'a b', page: 2 } ) ).toBe( '/blicks/v1/forms/entries?form=abc&status=spam&search=a+b&page=2&per_page=20' );
	} );

	it( 'narrows the CSV link to the form', () => {
		expect( csvHref( 'https://x.test/wp-admin/admin-post.php?action=a&_wpnonce=n', 'abc' ) ).toBe( 'https://x.test/wp-admin/admin-post.php?action=a&_wpnonce=n&form=abc' );
		expect( csvHref( 'u?x=1', '' ) ).toBe( 'u?x=1' );
		expect( csvHref( '', 'abc' ) ).toBe( '' );
	} );

	it( 'builds a reply link only for an address', () => {
		expect( mailtoHref( 'sita@example.com', 'Re: Contact' ) ).toBe( 'mailto:sita@example.com?subject=Re%3A%20Contact' );
		expect( mailtoHref( 'not an email', '' ) ).toBe( '' );
		expect( mailtoHref( 'a@b.c?bcc=x@y.z', '' ) ).toBe( '' );
		expect( mailtoHref( 'a+b@x.test', '' ) ).toBe( 'mailto:a%2Bb@x.test' );
	} );
} );

describe( 'entry helpers', () => {
	it( 'splits fields into short rows and long blocks, labels first', () => {
		const entry = normalizeEntry( raw )!;
		const { short, long } = fieldRows( entry );

		expect( short.map( ( r ) => r.label ) ).toEqual( [ 'Name', 'Email', 'topics' ] );
		expect( short[ 2 ].value ).toBe( 'a, b' );
		expect( long.map( ( r ) => r.name ) ).toEqual( [ 'message' ] );
	} );

	it( 'shows a value’s display text when the server gives one, else the raw value', () => {
		const entry = normalizeEntry( { ...raw, fields: { ...raw.fields, file: 'f_81', rating: '4' }, display: { file: 'cv.pdf', rating: 42 } } )!;
		const { short } = fieldRows( entry );

		expect( short.find( ( r ) => r.name === 'file' )?.value ).toBe( 'cv.pdf' );
		expect( short.find( ( r ) => r.name === 'rating' )?.value ).toBe( '4' );
		expect( normalizeEntry( raw )!.display ).toEqual( {} );
	} );

	it( 'moves status and counts together for the optimistic change', () => {
		const a = normalizeEntry( raw )!;
		const b = { ...a, id: 8, status: 'handled' as const };
		const items = [ a, b ];

		expect( withStatus( items, [ 7 ], 'spam' ).map( ( e ) => e.status ) ).toEqual( [ 'spam', 'handled' ] );
		expect( shiftCounts( { new: 1, handled: 1, spam: 0 }, items, [ 7, 8 ], 'spam' ) ).toEqual( { new: 0, handled: 0, spam: 2 } );
		expect( shiftCounts( { new: 1, handled: 1, spam: 0 }, items, [ 7 ], 'paid' ) ).toEqual( { new: 0, handled: 1, spam: 0, paid: 1 } );
	} );

	it( 'shows the time for today and the date before', () => {
		const now = new Date( '2026-11-05T12:00:00Z' );
		expect( receivedLabel( '', now ).short ).toBe( '' );
		expect( receivedLabel( '2025-01-02T10:00:00Z', now, 'en-GB' ).short ).toMatch( /2025/ );
	} );
} );
