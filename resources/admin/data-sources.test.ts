import { afterEach, describe, expect, it, vi } from 'vitest';
import { fieldErrors, normalizeDataSources, normalizeTest, normalizeUsage, removeWarning, shortUrl, statusAfterTest, statusLine, testSummary } from './data-sources';

describe( 'normalizeDataSources', () => {
	it( 'reads the list every route answers with', () => {
		expect( normalizeDataSources( { endpoints: [ { id: 'cards', name: 'Cards', url: 'https://api.test/cards', cache: '6h', keepLastGood: false } ] } ) )
			.toEqual( [ { id: 'cards', name: 'Cards', url: 'https://api.test/cards', cache: '6h', keepLastGood: false } ] );
	} );

	it( 'drops malformed entries and fills what an editor-level answer leaves out', () => {
		const list = normalizeDataSources( { endpoints: [ null, { name: 'No id' }, { id: 'a', name: 'A', cache: '2w' } ] } );

		expect( list ).toEqual( [ { id: 'a', name: 'A', url: '', cache: '1h', keepLastGood: true } ] );
	} );

	it( 'answers an empty list for anything that is not one', () => {
		expect( normalizeDataSources( undefined ) ).toEqual( [] );
		expect( normalizeDataSources( { endpoints: 'nope' } ) ).toEqual( [] );
	} );
} );

describe( 'fieldErrors', () => {
	it( 'puts each refusal from a 422 on its own field', () => {
		const error = { code: 'blicks_endpoint_invalid', message: 'Give the endpoint a name. Use an https:// address.', errors: { name: 'Give the endpoint a name.', url: 'Use an https:// address. Plain http is refused.' } };

		expect( fieldErrors( error ) ).toEqual( {
			fields: { name: 'Give the endpoint a name.', url: 'Use an https:// address. Plain http is refused.' },
			message: '',
		} );
	} );

	it( 'keeps a failure with no field as one message on the form', () => {
		expect( fieldErrors( { message: 'Sorry, you are not allowed to do that.' } ) ).toEqual( { fields: {}, message: 'Sorry, you are not allowed to do that.' } );
		expect( fieldErrors( new TypeError() ).message ).not.toBe( '' );
	} );
} );

describe( 'testSummary', () => {
	it( 'says how fast and how big a good answer was', () => {
		expect( testSummary( normalizeTest( { ok: true, ms: 240, bytes: 12800, fetchedAt: 1 } ) ) ).toContain( '240 ms with 13 KB' );
		expect( testSummary( normalizeTest( { ok: true, ms: 9, bytes: 512 } ) ) ).toContain( '512 bytes' );
	} );

	it( 'passes on what the server said went wrong', () => {
		expect( testSummary( normalizeTest( { ok: false, ms: 8000, message: 'The endpoint took longer than 8 seconds.' } ) ) ).toBe( 'The endpoint took longer than 8 seconds.' );
		expect( testSummary( normalizeTest( {} ) ) ).not.toBe( '' );
	} );
} );

describe( 'shortUrl', () => {
	it( 'drops the scheme, which is always https', () => {
		expect( shortUrl( 'https://api.test/cards?limit=12' ) ).toBe( 'api.test/cards?limit=12' );
	} );
} );

describe( 'fetch status', () => {
	afterEach( () => {
		vi.useRealTimers();
	} );

	const now = Date.parse( '2026-08-01T10:00:00Z' ) / 1000;

	it( 'reads an administrator\'s status and drops a malformed one', () => {
		const [ withStatus, without ] = normalizeDataSources( { endpoints: [
			{ id: 'a', name: 'A', status: { state: 'failed', fetchedAt: now - 600, failedAt: now - 60, error: 'The endpoint answered with status 503.' } },
			{ id: 'b', name: 'B', status: { state: 'broken' } },
		] } );

		expect( withStatus.status ).toEqual( { state: 'failed', fetchedAt: now - 600, failedAt: now - 60, error: 'The endpoint answered with status 503.' } );
		expect( without.status ).toBeUndefined();
	} );

	it( 'says when it was fetched, that it is stale, or why it failed', () => {
		vi.useFakeTimers();
		vi.setSystemTime( now * 1000 );

		expect( statusLine( { state: 'fresh', fetchedAt: now - 300, failedAt: 0, error: '' } ) ).toBe( 'Fetched 5 minutes ago' );
		expect( statusLine( { state: 'stale', fetchedAt: now - 2 * 86400, failedAt: 0, error: '' } ) ).toContain( 'last fetched 2 days ago' );
		expect( statusLine( { state: 'failed', fetchedAt: 0, failedAt: now - 3600, error: 'Status 503.' } ) ).toBe( 'Failed 1 hour ago: Status 503.' );
		expect( statusLine( { state: 'never', fetchedAt: 0, failedAt: 0, error: '' } ) ).toBe( 'Not fetched yet' );
	} );

	it( 'follows a test without asking the server again', () => {
		expect( statusAfterTest( undefined, { ok: true, ms: 1, bytes: 2, fetchedAt: now }, now ).state ).toBe( 'fresh' );
		expect( statusAfterTest( { state: 'fresh', fetchedAt: now - 60, failedAt: 0, error: '' }, { ok: false, ms: 1, message: 'Down' }, now ) )
			.toEqual( { state: 'failed', fetchedAt: now - 60, failedAt: now, error: 'Down' } );
	} );
} );

describe( 'removeWarning', () => {
	it( 'says how many pages go empty', () => {
		expect( removeWarning( 'Cards', 3 ) ).toContain( 'Used on 3 pages' );
		expect( removeWarning( 'Cards', 1 ) ).toContain( 'Used on 1 page.' );
		expect( removeWarning( 'Cards', 0 ) ).toContain( 'No posts use it' );
	} );

	it( 'still warns while the count loads or when it cannot be read', () => {
		expect( removeWarning( 'Cards', 'loading' ) ).toContain( 'go empty' );
		expect( removeWarning( 'Cards', normalizeUsage( { code: 'rest_forbidden' } ) ) ).toContain( 'go empty' );
		expect( normalizeUsage( { count: 4 } ) ).toBe( 4 );
	} );
} );
