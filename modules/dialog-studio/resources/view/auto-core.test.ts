import { describe, expect, it } from 'vitest';
import { converts, DAY, flungUp, readConfig, recall, refusal, remember, screenOf, scrolledPast, type AutoConfig, type Visitor } from './auto-core';

const config = ( patch: Partial< AutoConfig > = {} ): AutoConfig => ( {
	id: 7,
	triggers: { load: { on: true, delay: 3 }, scroll: { on: false, percent: 50 }, exit: { on: false }, idle: { on: false, seconds: 30 } },
	visitors: 'all',
	screens: { desktop: true, tablet: true, phone: true },
	frequency: 'view',
	days: 7,
	stopAfterConvert: true,
	from: 0,
	until: 0,
	...patch,
} );

const NOW = Date.UTC( 2026, 10, 25 );
const visitor = ( patch: Partial< Visitor > = {} ): Visitor => ( { loggedIn: false, width: 1280, now: NOW, memory: {}, seenThisVisit: false, ...patch } );

describe( 'who may see it', () => {
	it( 'checks logged in or out', () => {
		expect( refusal( config( { visitors: 'out' } ), visitor( { loggedIn: true } ) ) ).toBe( 'logged-in' );
		expect( refusal( config( { visitors: 'in' } ), visitor() ) ).toBe( 'logged-out' );
		expect( refusal( config( { visitors: 'in' } ), visitor( { loggedIn: true } ) ) ).toBe( '' );
	} );

	it( 'checks the screen', () => {
		expect( screenOf( 390 ) ).toBe( 'phone' );
		expect( screenOf( 768 ) ).toBe( 'tablet' );
		expect( screenOf( 1280 ) ).toBe( 'desktop' );
		expect( refusal( config( { screens: { desktop: true, tablet: true, phone: false } } ), visitor( { width: 390 } ) ) ).toBe( 'screen' );
	} );

	it( 'rechecks the schedule a cached page may have outlived', () => {
		expect( refusal( config( { from: NOW + 1 } ), visitor() ) ).toBe( 'not-yet' );
		expect( refusal( config( { until: NOW - 1 } ), visitor() ) ).toBe( 'over' );
		expect( refusal( config( { from: NOW - 1, until: NOW + 1 } ), visitor() ) ).toBe( '' );
	} );

	it( 'keeps to how often', () => {
		expect( refusal( config( { frequency: 'once' } ), visitor( { memory: { shown: 1 } } ) ) ).toBe( 'seen' );
		expect( refusal( config( { frequency: 'session' } ), visitor( { seenThisVisit: true } ) ) ).toBe( 'seen-this-visit' );
		expect( refusal( config( { frequency: 'days', days: 7 } ), visitor( { memory: { shown: NOW - 6 * DAY } } ) ) ).toBe( 'seen-recently' );
		expect( refusal( config( { frequency: 'days', days: 7 } ), visitor( { memory: { shown: NOW - 8 * DAY } } ) ) ).toBe( '' );
		expect( refusal( config( { frequency: 'view' } ), visitor( { memory: { shown: NOW }, seenThisVisit: true } ) ) ).toBe( '' );
		expect( refusal( config(), visitor( { memory: { converted: 1 } } ) ) ).toBe( 'converted' );
		expect( refusal( config( { stopAfterConvert: false } ), visitor( { memory: { converted: 1 } } ) ) ).toBe( '' );
	} );
} );

describe( 'memory', () => {
	it( 'is per dialog, and survives storage that throws', () => {
		const data = new Map< string, string >();
		const storage = { getItem: ( k: string ) => data.get( k ) ?? null, setItem: ( k: string, v: string ) => void data.set( k, v ) };
		remember( storage, 7, 'shown', 10 );
		remember( storage, 7, 'closed', 11 );
		expect( recall( storage, 7 ) ).toEqual( { shown: 10, closed: 11 } );
		expect( recall( storage, 8 ) ).toEqual( {} );

		const broken = { getItem: () => { throw new Error( 'blocked' ); }, setItem: () => { throw new Error( 'blocked' ); } };
		expect( () => remember( broken, 7, 'shown', 1 ) ).not.toThrow();
		expect( recall( broken, 7 ) ).toEqual( {} );
		expect( recall( null, 7 ) ).toEqual( {} );
	} );
} );

describe( 'triggers', () => {
	it( 'scroll counts what can be scrolled', () => {
		expect( scrolledPast( 50, 500, 1000, 2000 ) ).toBe( true );
		expect( scrolledPast( 50, 400, 1000, 2000 ) ).toBe( false );
		expect( scrolledPast( 90, 0, 1000, 900 ) ).toBe( true );
	} );

	it( 'a quick scroll back up on a phone is leaving', () => {
		expect( flungUp( [ [ 0, 900 ], [ 200, 700 ] ], 200 ) ).toBe( true );
		expect( flungUp( [ [ 0, 300 ], [ 200, 100 ] ], 200 ) ).toBe( false );
		expect( flungUp( [ [ 0, 900 ], [ 1000, 700 ] ], 1000 ) ).toBe( false );
	} );

	it( 'reads a config, or refuses junk', () => {
		expect( readConfig( JSON.stringify( config() ) )?.id ).toBe( 7 );
		expect( readConfig( '{bad' ) ).toBeNull();
		expect( readConfig( null ) ).toBeNull();
	} );

	it( 'counts a form sent or a link followed, not a dialog opener', () => {
		const a = ( href: string ) => ( { closest: () => ( { getAttribute: () => href } ) } ) as unknown as EventTarget;
		expect( converts( null, 'submit' ) ).toBe( true );
		expect( converts( a( '/shop' ), 'click' ) ).toBe( true );
		expect( converts( a( '#dialog-other' ), 'click' ) ).toBe( false );
	} );
} );
