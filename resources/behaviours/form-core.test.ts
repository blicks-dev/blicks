/**
 * @vitest-environment jsdom
 *
 * The fixtures are the contract's markup (FieldRenderer / FormRenderer), written out by hand.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as core from './form-core';

const text = ( uid: string, name: string, label: string, extra = '', cls = '' ) => `
	<div class="bl-field bl-${ uid } bl-field--text bl-field--w-full${ cls }" data-bl-field="${ name }" data-bl-error="Fill in ${ label.toLowerCase() }.">
		<label class="bl-field__label" for="blf-${ uid }">${ label }${ cls ? '' : '<span class="bl-field__opt"> (optional)</span>' }</label>
		<input class="bl-field__control" id="blf-${ uid }" name="${ name }" type="text" ${ extra } aria-describedby="blf-${ uid }-help">
		<p class="bl-field__help" id="blf-${ uid }-help">Help</p>
		<p class="bl-field__error" id="blf-${ uid }-err" hidden></p>
	</div>`;

const line = ( type: string, uid: string, name: string, attrs = '', required = true ) => `
	<div class="bl-field bl-${ uid } bl-field--${ type } bl-field--w-half${ required ? ' is-required' : '' }" data-bl-field="${ name }" data-bl-error="Bad ${ name }.">
		<label class="bl-field__label" for="blf-${ uid }">${ name }</label>
		<input class="bl-field__control" id="blf-${ uid }" name="${ name }" type="${ type }" ${ required ? 'required' : '' } ${ attrs }>
		<p class="bl-field__error" id="blf-${ uid }-err" hidden></p>
	</div>`;

const FORM = `
<form class="bl-form bl-f1 bl-form--filled bl-form--labels-above" id="blform-f1" method="post" action="/wp-json/blicks/v1/forms/f1/entries" novalidate>
	<div class="bl-form__summary" id="blform-f1-summary" tabindex="-1" hidden></div>
	${ text( 'a1', 'name', 'Name', 'required', ' is-required' ) }
	<div class="bl-field bl-a2 bl-field--email bl-field--w-full is-required" data-bl-field="email" data-bl-error="Enter an email address like name@example.com.">
		<label class="bl-field__label" for="blf-a2">Email</label>
		<input class="bl-field__control" id="blf-a2" name="email" type="email" required autocomplete="email">
		<p class="bl-field__error" id="blf-a2-err" hidden></p>
	</div>
	<div class="bl-field bl-a3 bl-field--select bl-field--w-full" data-bl-field="topic" data-bl-error="Choose an option.">
		<label class="bl-field__label" for="blf-a3">Topic<span class="bl-field__opt"> (optional)</span></label>
		<select class="bl-field__control" id="blf-a3" name="topic"><option value="">Choose one</option><option value="Sales">Sales</option></select>
		<p class="bl-field__error" id="blf-a3-err" hidden></p>
	</div>
	<fieldset class="bl-field bl-a4 bl-field--choice bl-field--w-full is-required is-multiple" data-bl-field="times" data-bl-error="Choose an option." aria-describedby="blf-a4-help">
		<legend class="bl-field__label">Times</legend>
		<div class="bl-field__choices">
			<label class="bl-field__choice"><input type="checkbox" name="times[]" value="Morning"> <span>Morning</span></label>
			<label class="bl-field__choice"><input type="checkbox" name="times[]" value="Evening"> <span>Evening</span></label>
		</div>
		<p class="bl-field__help" id="blf-a4-help">Pick any</p>
		<p class="bl-field__error" id="blf-a4-err" hidden></p>
	</fieldset>
	<div class="bl-field bl-a5 bl-field--consent bl-field--w-full is-required" data-bl-field="agree" data-bl-error="Tick this box to send the form.">
		<label class="bl-field__choice" for="blf-a5"><input type="checkbox" id="blf-a5" name="agree" value="yes" required> <span>I agree</span></label>
		<p class="bl-field__error" id="blf-a5-err" hidden></p>
	</div>
	<input type="hidden" class="bl-field bl-field--hidden" name="source" value="" data-bl-field="source" data-bl-fill="utm_source">
	<input type="hidden" class="bl-field bl-field--hidden" name="ref" value="" data-bl-field="ref" data-bl-fill="referrer">
	<input type="hidden" class="bl-field bl-field--hidden" name="page" value="Home" data-bl-field="page">
	<button class="bl-button" type="submit">Send</button>
	<p class="bl-form__retry" hidden></p>
	<div class="bl-form__trap" aria-hidden="true"><label>Leave this field empty<input type="text" name="_bl_hp" value="" tabindex="-1" autocomplete="off"></label></div>
	<input type="hidden" name="_bl_post" value="123">
	<div class="bl-form__sent" id="blform-f1-sent" tabindex="-1" role="status" hidden>
		<p class="bl-form__sent-title">Thanks</p><p class="bl-form__sent-text"></p>
	</div>
</form>`;

const CTX: core.FormContext = {
	form: 'f1',
	post: 123,
	token: 'http://localhost/wp-json/blicks/v1/forms/f1/token',
	entries: 'http://localhost/wp-json/blicks/v1/forms/f1/entries',
	nonce: '',
	after: { kind: 'message' },
	challenge: { kind: 'none', siteKey: '' },
};

let form: HTMLFormElement;
const $ = < T extends Element = HTMLInputElement >( sel: string ) => form.querySelector( sel ) as unknown as T;
const field = ( name: string ) => form.querySelector( `[data-bl-field="${ name }"]:not(input)` ) as HTMLElement;

function page( html = FORM ) {
	document.body.innerHTML = html;
	form = document.querySelector( 'form' ) as HTMLFormElement;
}

function fillValid() {
	$( '#blf-a1' ).value = 'Ada';
	$( '#blf-a2' ).value = 'ada@example.com';
	( form.querySelector( '[name="times[]"]' ) as HTMLInputElement ).checked = true;
	$( '#blf-a5' ).checked = true;
}

const json = ( status: number, body: unknown ) => ( { ok: status >= 200 && status < 300, status, json: async () => body } ) as Response;

function deps( responses: Array< Response | Error >, over: Partial< core.Deps > = {} ) {
	const calls: Array< { url: string; init: RequestInit } > = [];
	let token = 0;
	const fetch = vi.fn( async ( url: string, init: RequestInit = {} ) => {
		calls.push( { url, init } );
		if ( url.includes( '/token' ) ) return json( 200, { token: `t${ ++token }`, expires: 0 } );
		const next = responses.shift();
		if ( ! next || next instanceof Error ) throw next ?? new Error( 'none' );
		return next;
	} );
	const d: core.Deps = {
		fetch: fetch as unknown as typeof globalThis.fetch,
		now: () => 1_000_000,
		wait: vi.fn( async () => {} ),
		assign: vi.fn(),
		openDialog: vi.fn( () => true ),
		win: {},
		...over,
	};
	return { d, calls, posts: () => calls.filter( ( c ) => ! c.url.includes( '/token' ) ) };
}

beforeEach( () => page() );

describe( 'validate', () => {
	it( 'required text, and optional empty is fine', () => {
		expect( core.validate( field( 'name' ) ) ).toBe( 'Fill in name.' );
		$( '#blf-a1' ).value = '  ';
		expect( core.validate( field( 'name' ) ) ).toBe( 'Fill in name.' );
		$( '#blf-a1' ).value = 'Ada';
		expect( core.validate( field( 'name' ) ) ).toBe( '' );
		expect( core.validate( field( 'topic' ) ) ).toBe( '' );
	} );

	it( 'email shape', () => {
		const input = $( '#blf-a2' );
		for ( const bad of [ 'ada', 'ada@', 'ada@example', 'a b@example.com' ] ) {
			input.value = bad;
			expect( core.validate( field( 'email' ) ) ).not.toBe( '' );
		}
		input.value = 'ada.l+x@mail.example.co.uk';
		expect( core.validate( field( 'email' ) ) ).toBe( '' );
	} );

	it( 'tel', () => {
		page( `<form>${ line( 'tel', 'b1', 'phone' ) }</form>` );
		const input = $( '#blf-b1' );
		input.value = '+44 (0)20 7946-0958';
		expect( core.validate( field( 'phone' ) ) ).toBe( '' );
		input.value = '12ab5';
		expect( core.validate( field( 'phone' ) ) ).toBe( 'Bad phone.' );
		input.value = '123';
		expect( core.validate( field( 'phone' ) ) ).toBe( 'Bad phone.' );
	} );

	it( 'number min, max, step', () => {
		page( `<form>${ line( 'number', 'b2', 'guests', 'min="2" max="10" step="2"' ) }</form>` );
		const input = $( '#blf-b2' );
		const ok = ( v: string ) => {
			input.value = v;
			return core.validate( field( 'guests' ) ) === '';
		};
		expect( ok( '4' ) ).toBe( true );
		expect( ok( '10' ) ).toBe( true );
		expect( ok( '1' ) ).toBe( false );
		expect( ok( '12' ) ).toBe( false );
		expect( ok( '5' ) ).toBe( false );
	} );

	it( 'number decimal step', () => {
		page( `<form>${ line( 'number', 'b2', 'price', 'step="0.01"' ) }</form>` );
		$( '#blf-b2' ).value = '19.99';
		expect( core.validate( field( 'price' ) ) ).toBe( '' );
	} );

	it( 'date min and max', () => {
		page( `<form>${ line( 'date', 'b3', 'day', 'min="2026-01-01" max="2026-12-31"' ) }</form>` );
		const input = $( '#blf-b3' );
		// jsdom sanitises date values like a browser, so set the attribute-free value directly.
		Object.defineProperty( input, 'value', { configurable: true, writable: true, value: '2026-06-01' } );
		expect( core.validate( field( 'day' ) ) ).toBe( '' );
		input.value = '2025-12-31';
		expect( core.validate( field( 'day' ) ) ).toBe( 'Bad day.' );
		input.value = '2027-01-01';
		expect( core.validate( field( 'day' ) ) ).toBe( 'Bad day.' );
	} );

	it( 'select required', () => {
		field( 'topic' ).classList.add( 'is-required' );
		expect( core.validate( field( 'topic' ) ) ).toBe( 'Choose an option.' );
		$< HTMLSelectElement >( '#blf-a3' ).value = 'Sales';
		expect( core.validate( field( 'topic' ) ) ).toBe( '' );
	} );

	it( 'choice and consent', () => {
		expect( core.validate( field( 'times' ) ) ).toBe( 'Choose an option.' );
		( form.querySelectorAll( '[name="times[]"]' )[ 1 ] as HTMLInputElement ).checked = true;
		expect( core.validate( field( 'times' ) ) ).toBe( '' );
		expect( core.validate( field( 'agree' ) ) ).toBe( 'Tick this box to send the form.' );
		$( '#blf-a5' ).checked = true;
		expect( core.validate( field( 'agree' ) ) ).toBe( '' );
	} );

	it( 'skips hidden fields', () => {
		expect( core.fields( form ).map( ( f ) => f.dataset.blField ) ).toEqual( [ 'name', 'email', 'topic', 'times', 'agree' ] );
	} );
} );

describe( 'errors', () => {
	it( 'show and clear keep the help id', () => {
		const f = field( 'name' );
		const input = $( '#blf-a1' );
		core.showError( f, 'Fill in name.' );
		const err = $< HTMLElement >( '#blf-a1-err' );
		expect( err.hidden ).toBe( false );
		expect( err.textContent ).toBe( 'Fill in name.' );
		expect( input.getAttribute( 'aria-invalid' ) ).toBe( 'true' );
		expect( input.getAttribute( 'aria-describedby' ) ).toBe( 'blf-a1-help blf-a1-err' );
		core.showError( f, 'Again' );
		expect( input.getAttribute( 'aria-describedby' ) ).toBe( 'blf-a1-help blf-a1-err' );
		core.clearError( f );
		expect( err.hidden ).toBe( true );
		expect( err.textContent ).toBe( '' );
		expect( input.hasAttribute( 'aria-invalid' ) ).toBe( false );
		expect( input.getAttribute( 'aria-describedby' ) ).toBe( 'blf-a1-help' );
	} );

	it( 'a field with no help gets and loses the attribute', () => {
		core.showError( field( 'email' ), 'x' );
		expect( $( '#blf-a2' ).getAttribute( 'aria-describedby' ) ).toBe( 'blf-a2-err' );
		core.clearError( field( 'email' ) );
		expect( $( '#blf-a2' ).hasAttribute( 'aria-describedby' ) ).toBe( false );
	} );

	it( 'a choice marks every box and describes on the fieldset', () => {
		core.showError( field( 'times' ), 'x' );
		const boxes = Array.from( form.querySelectorAll( '[name="times[]"]' ) );
		expect( boxes.every( ( b ) => b.getAttribute( 'aria-invalid' ) === 'true' ) ).toBe( true );
		expect( field( 'times' ).getAttribute( 'aria-describedby' ) ).toBe( 'blf-a4-help blf-a4-err' );
		core.clearError( field( 'times' ) );
		expect( boxes.some( ( b ) => b.hasAttribute( 'aria-invalid' ) ) ).toBe( false );
		expect( field( 'times' ).getAttribute( 'aria-describedby' ) ).toBe( 'blf-a4-help' );
	} );
} );

describe( 'summary', () => {
	it( 'counts, links and focuses', () => {
		const failed = core.checkAll( form );
		expect( failed.length ).toBe( 4 );
		core.summarise( form, failed, CTX );
		const summary = $< HTMLElement >( '.bl-form__summary' );
		expect( summary.hidden ).toBe( false );
		expect( summary.getAttribute( 'role' ) ).toBe( 'alert' );
		expect( document.activeElement ).toBe( summary );
		expect( summary.querySelector( '.bl-form__summary-title' )?.textContent ).toBe( '4 fields need a fix' );
		const links = Array.from( summary.querySelectorAll( 'a' ) );
		expect( links.map( ( a ) => [ a.getAttribute( 'href' ), a.textContent ] ) ).toEqual( [
			[ '#blf-a1', 'Name' ],
			[ '#blf-a2', 'Email' ],
			[ '#blf-a4', 'Times' ],
			[ '#blf-a5', 'I agree' ],
		] );
		links[ 1 ].click();
		expect( document.activeElement ).toBe( $( '#blf-a2' ) );
		links[ 2 ].click();
		expect( document.activeElement ).toBe( form.querySelector( '[name="times[]"]' ) );
	} );

	it( 'one, and translated strings', () => {
		core.summarise( form, [ field( 'name' ) ], CTX );
		expect( $( '.bl-form__summary-title' ).textContent ).toBe( '1 field needs a fix' );
		core.summarise( form, [ field( 'name' ), field( 'email' ) ], { ...CTX, i18n: { fixN: '%d champs à corriger' } } );
		expect( $( '.bl-form__summary-title' ).textContent ).toBe( '2 champs à corriger' );
	} );

	it( 'labels drop "(optional)"', () => {
		core.summarise( form, [ field( 'topic' ) ], CTX );
		expect( form.querySelector( '.bl-form__summary a' )?.textContent ).toBe( 'Topic' );
	} );

	it( 'names a field made of blocks by its label Text, or by aria-label without one', () => {
		form.insertAdjacentHTML(
			'afterbegin',
			`<div class="bl-field bl-b1 bl-field--text bl-field--w-full bl-field--blocks" data-bl-field="city" data-bl-error="Fill in city.">
				<label class="bl-text bl-t1 bl-field__label" for="blf-b1">City<span class="bl-field__opt"> (optional)</span></label>
				<input class="bl-input bl-i1 bl-field__control" id="blf-b1" name="city" type="text">
				<p class="bl-field__error" id="blf-b1-err" hidden></p>
			</div>
			<div class="bl-field bl-b2 bl-field--text bl-field--w-full bl-field--blocks" data-bl-field="town" data-bl-error="Fill in town.">
				<input class="bl-input bl-i2 bl-field__control" id="blf-b2" name="town" type="text" aria-label="Your town">
				<p class="bl-field__error" id="blf-b2-err" hidden></p>
			</div>`
		);
		core.summarise( form, [ field( 'city' ), field( 'town' ) ], CTX );
		expect( Array.from( form.querySelectorAll( '.bl-form__summary a' ) ).map( ( a ) => [ a.getAttribute( 'href' ), a.textContent ] ) ).toEqual( [
			[ '#blf-b1', 'City' ],
			[ '#blf-b2', 'Your town' ],
		] );
	} );
} );

describe( 'collect and fill', () => {
	it( 'arrays for boxes, trap to hp, no _bl_ or foreign names', () => {
		fillValid();
		( form.querySelectorAll( '[name="times[]"]' )[ 1 ] as HTMLInputElement ).checked = true;
		$( '[name="_bl_hp"]' ).value = 'bot';
		form.querySelector( '.bl-form__retry' )!.insertAdjacentHTML( 'beforebegin', '<div class="bl-form__challenge"><textarea name="g-recaptcha-response">x</textarea></div>' );
		const values = core.collect( form );
		expect( values.hp ).toBe( 'bot' );
		expect( values.post ).toBe( 123 );
		expect( values.fields ).toEqual( {
			name: 'Ada',
			email: 'ada@example.com',
			topic: '',
			times: [ 'Morning', 'Evening' ],
			agree: 'yes',
			source: '',
			ref: '',
			page: 'Home',
		} );
	} );

	it( 'an empty box group is an empty list', () => {
		expect( core.collect( form ).fields.times ).toEqual( [] );
	} );

	it( 'fills referrer and utm, keeps a value already there', () => {
		core.fill( form, { search: '?utm_source=news&utm_medium=email', referrer: 'https://example.com/a' } );
		expect( $( '[name="source"]' ).value ).toBe( 'news' );
		expect( $( '[name="ref"]' ).value ).toBe( 'https://example.com/a' );
		core.fill( form, { search: '?utm_source=other', referrer: '' } );
		expect( $( '[name="source"]' ).value ).toBe( 'news' );
	} );
} );

describe( 'token', () => {
	it( 'freshness', () => {
		expect( core.isFresh( undefined, 0 ) ).toBe( false );
		expect( core.isFresh( 0, core.TOKEN_LIFE - 1 ) ).toBe( true );
		expect( core.isFresh( 0, core.TOKEN_LIFE ) ).toBe( false );
	} );

	it( 'fetched once, same-origin, with the post; refetched when old', async () => {
		let now = 0;
		const { d, calls } = deps( [], { now: () => now } );
		const [ a, b ] = await Promise.all( [ core.ensureToken( form, CTX, d ), core.ensureToken( form, CTX, d ) ] );
		expect( [ a, b ] ).toEqual( [ 't1', 't1' ] );
		expect( calls.length ).toBe( 1 );
		expect( calls[ 0 ].url ).toBe( 'http://localhost/wp-json/blicks/v1/forms/f1/token?post=123' );
		expect( calls[ 0 ].init.credentials ).toBe( 'same-origin' );
		now = 89 * 60 * 1000;
		expect( await core.ensureToken( form, CTX, d ) ).toBe( 't1' );
		now = 91 * 60 * 1000;
		expect( await core.ensureToken( form, CTX, d ) ).toBe( 't2' );
	} );

	it( 'a failed fetch is not cached', async () => {
		const fetch = vi.fn().mockRejectedValueOnce( new Error( 'offline' ) ).mockResolvedValue( json( 200, { token: 'ok' } ) );
		const { d } = deps( [], { fetch } );
		await expect( core.ensureToken( form, CTX, d ) ).rejects.toThrow();
		expect( await core.ensureToken( form, CTX, d ) ).toBe( 'ok' );
	} );
} );

describe( 'submit', () => {
	it( 'invalid: no request, summary shown, then fields check on leaving', async () => {
		const { d, calls } = deps( [] );
		expect( core.attempted( form ) ).toBe( false );
		expect( await core.submit( form, CTX, d ) ).toBe( 'invalid' );
		expect( calls.length ).toBe( 0 );
		expect( $< HTMLElement >( '.bl-form__summary' ).hidden ).toBe( false );
		expect( core.attempted( form ) ).toBe( true );
	} );

	it( 'sent: posts the contract body, busy meanwhile, then the message', async () => {
		fillValid();
		let resolve!: ( r: Response ) => void;
		const pending = new Promise< Response >( ( r ) => ( resolve = r ) );
		const { d, posts } = deps( [] );
		( d.fetch as any ).mockImplementation( async ( url: string, init: RequestInit ) => {
			if ( url.includes( '/token' ) ) return json( 200, { token: 'tk' } );
			( posts as any ).last = init;
			return pending;
		} );
		const run = core.submit( form, { ...CTX, nonce: 'n1' }, d );
		await vi.waitFor( () => expect( form.classList.contains( 'is-sending' ) ).toBe( true ) );
		expect( form.getAttribute( 'aria-busy' ) ).toBe( 'true' );
		expect( $< HTMLButtonElement >( 'button' ).disabled ).toBe( true );
		expect( await core.submit( form, CTX, d ) ).toBe( 'sending' );
		await vi.waitFor( () => expect( ( posts as any ).last ).toBeTruthy() );
		resolve( json( 200, { status: 'sent' } ) );
		expect( await run ).toBe( 'sent' );

		const init = ( posts as any ).last as RequestInit;
		expect( init.method ).toBe( 'POST' );
		expect( ( init.headers as any )[ 'Content-Type' ] ).toBe( 'application/json' );
		expect( ( init.headers as any )[ 'X-WP-Nonce' ] ).toBe( 'n1' );
		const body = JSON.parse( init.body as string );
		expect( body ).toEqual( {
			token: 'tk',
			post: 123,
			hp: '',
			challenge: '',
			fields: { name: 'Ada', email: 'ada@example.com', topic: '', times: [ 'Morning' ], agree: 'yes', source: '', ref: '', page: 'Home' },
		} );
		expect( form.classList.contains( 'is-sending' ) ).toBe( false );
		expect( form.hasAttribute( 'aria-busy' ) ).toBe( false );
		expect( $< HTMLButtonElement >( 'button' ).disabled ).toBe( false );
		expect( form.classList.contains( 'is-sent' ) ).toBe( true );
		expect( $< HTMLElement >( '.bl-form__sent' ).hidden ).toBe( false );
		expect( document.activeElement ).toBe( $( '.bl-form__sent' ) );
	} );

	it( 'no nonce header for a visitor', async () => {
		fillValid();
		const { d, posts } = deps( [ json( 200, { status: 'sent' } ) ] );
		await core.submit( form, CTX, d );
		expect( ( posts()[ 0 ].init.headers as any )[ 'X-WP-Nonce' ] ).toBeUndefined();
	} );

	it( 'after: page and dialog', async () => {
		fillValid();
		const page1 = deps( [ json( 200, { status: 'sent' } ) ] );
		await core.submit( form, { ...CTX, after: { kind: 'page', url: '/thanks/' } }, page1.d );
		expect( page1.d.assign ).toHaveBeenCalledWith( '/thanks/' );
		expect( form.classList.contains( 'is-sent' ) ).toBe( false );

		page();
		fillValid();
		const dlg = deps( [ json( 200, { status: 'sent' } ) ] );
		await core.submit( form, { ...CTX, after: { kind: 'dialog', dialog: 'dialog-thanks' } }, dlg.d );
		expect( dlg.d.openDialog ).toHaveBeenCalledWith( 'dialog-thanks' );
		expect( $( '#blf-a1' ).value ).toBe( '' );
		expect( form.classList.contains( 'is-sent' ) ).toBe( false );
		expect( core.attempted( form ) ).toBe( false );
	} );

	it( 'a dialog that is not there falls back to the message', async () => {
		fillValid();
		const { d } = deps( [ json( 200, { status: 'sent' } ) ], { openDialog: () => false } );
		await core.submit( form, { ...CTX, after: { kind: 'dialog', dialog: 'dialog-x' } }, d );
		expect( form.classList.contains( 'is-sent' ) ).toBe( true );
	} );

	it( 'invalid from the server maps onto fields and the summary', async () => {
		fillValid();
		const { d } = deps( [ json( 422, { status: 'invalid', errors: { email: 'Use your work address.' } } ) ] );
		expect( await core.submit( form, CTX, d ) ).toBe( 'rejected' );
		expect( $( '#blf-a2-err' ).textContent ).toBe( 'Use your work address.' );
		expect( $( '#blf-a2' ).getAttribute( 'aria-invalid' ) ).toBe( 'true' );
		expect( $( '.bl-form__summary-title' ).textContent ).toBe( '1 field needs a fix' );
	} );

	it( 'expired: new token, retried once silently', async () => {
		fillValid();
		const { d, posts } = deps( [ json( 403, { status: 'expired' } ), json( 200, { status: 'sent' } ) ] );
		expect( await core.submit( form, CTX, d ) ).toBe( 'sent' );
		expect( posts().map( ( c ) => JSON.parse( c.init.body as string ).token ) ).toEqual( [ 't1', 't2' ] );
		expect( $< HTMLElement >( '.bl-form__retry' ).hidden ).toBe( true );
	} );

	it( 'a stale nonce from a cached page: sent again without it', async () => {
		fillValid();
		const { d, posts } = deps( [ json( 403, { code: 'rest_cookie_invalid_nonce' } ), json( 200, { status: 'sent' } ) ] );
		expect( await core.submit( form, { ...CTX, nonce: 'old' }, d ) ).toBe( 'sent' );
		const headers = posts().map( ( c ) => ( c.init.headers as Record< string, string > )[ 'X-WP-Nonce' ] );
		expect( headers ).toEqual( [ 'old', undefined ] );
	} );

	it( 'expired twice: the retry line', async () => {
		fillValid();
		const { d, posts } = deps( [ json( 403, {} ), json( 403, {} ) ] );
		expect( await core.submit( form, CTX, d ) ).toBe( 'expired' );
		expect( posts().length ).toBe( 2 );
		expect( $< HTMLElement >( '.bl-form__retry' ).hidden ).toBe( false );
		expect( $( '.bl-form__retry' ).textContent ).toBe( core.STRINGS.retry );
	} );

	it( 'busy: wait a moment', async () => {
		fillValid();
		const { d } = deps( [ json( 429, { status: 'busy' } ) ] );
		expect( await core.submit( form, { ...CTX, i18n: { busy: 'Wait.' } }, d ) ).toBe( 'busy' );
		expect( $( '.bl-form__retry' ).textContent ).toBe( 'Wait.' );
	} );

	it( 'network failure keeps the values and shows the retry line', async () => {
		fillValid();
		const { d } = deps( [ new TypeError( 'Failed to fetch' ) ] );
		expect( await core.submit( form, CTX, d ) ).toBe( 'failed' );
		expect( $( '#blf-a1' ).value ).toBe( 'Ada' );
		expect( $< HTMLElement >( '.bl-form__retry' ).hidden ).toBe( false );
		expect( form.classList.contains( 'is-sending' ) ).toBe( false );
		expect( $< HTMLButtonElement >( 'button' ).disabled ).toBe( false );
	} );

	it( 'waits out the form timing after a fresh token', async () => {
		fillValid();
		const { d } = deps( [ json( 200, { status: 'sent' } ) ] );
		await core.submit( form, { ...CTX, minSeconds: 3 }, d );
		expect( d.wait ).toHaveBeenCalledWith( 3000 );
	} );
} );

describe( 'challenge', () => {
	const box = '<div class="bl-form__challenge" data-bl-challenge="recaptcha-v2"></div>';

	it( 'v3 executes with the form action', async () => {
		fillValid();
		const execute = vi.fn( async () => 'v3token' );
		const win = { grecaptcha: { ready: ( fn: () => void ) => fn(), execute } };
		const { d, posts } = deps( [ json( 200, { status: 'sent' } ) ], { win } );
		await core.submit( form, { ...CTX, challenge: { kind: 'recaptcha-v3', siteKey: 'k3' } }, d );
		expect( execute ).toHaveBeenCalledWith( 'k3', { action: 'blicks_form' } );
		expect( JSON.parse( posts()[ 0 ].init.body as string ).challenge ).toBe( 'v3token' );
	} );

	it( 'v2 waits for its API, renders once, sends the response', async () => {
		vi.useFakeTimers();
		form.querySelector( '.bl-form__retry' )!.insertAdjacentHTML( 'beforebegin', box );
		const ctx = { ...CTX, challenge: { kind: 'recaptcha-v2' as const, siteKey: 'k2' } };
		const win: any = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
		core.watchChallenge( form, ctx, win, 100, 10 );
		const render = vi.fn( ( el: HTMLElement, _options: unknown ) => {
			el.innerHTML = '<textarea name="g-recaptcha-response"></textarea>';
			return 7;
		} );
		win.grecaptcha = { render, reset: vi.fn() };
		vi.advanceTimersByTime( 350 );
		expect( render ).toHaveBeenCalledTimes( 1 );
		expect( render.mock.calls[ 0 ][ 1 ] ).toEqual( { sitekey: 'k2' } );
		expect( win.removeEventListener ).toHaveBeenCalled();
		vi.useRealTimers();

		fillValid();
		const none = deps( [], { win } );
		expect( await core.submit( form, ctx, none.d ) ).toBe( 'challenge' );
		expect( none.posts().length ).toBe( 0 );

		$< HTMLTextAreaElement >( '[name="g-recaptcha-response"]' ).value = 'solved';
		const { d, posts } = deps( [ json( 200, { status: 'sent' } ) ], { win } );
		await core.submit( form, ctx, d );
		expect( JSON.parse( posts()[ 0 ].init.body as string ).challenge ).toBe( 'solved' );
		expect( win.grecaptcha.reset ).toHaveBeenCalledWith( 7 );
	} );

	it( 'turnstile renders straight away when its API is there', () => {
		form.querySelector( '.bl-form__retry' )!.insertAdjacentHTML( 'beforebegin', box.replace( 'recaptcha-v2', 'turnstile' ) );
		const render = vi.fn( () => 'w1' );
		core.watchChallenge( form, { ...CTX, challenge: { kind: 'turnstile', siteKey: 'kt' } }, { turnstile: { render } } );
		expect( render ).toHaveBeenCalledWith( form.querySelector( '.bl-form__challenge' ), { sitekey: 'kt' } );
	} );
} );

/* Round 3: stepper, range, counter, reset, time / range / maxLength validation. */

const GAPS = `
<form class="bl-form bl-f2" id="blform-f2" novalidate>
	<div class="bl-form__summary" id="blform-f2-summary" tabindex="-1" hidden></div>
	<div class="bl-field bl-g1 bl-field--number bl-field--w-full bl-field--a-stepper" data-bl-field="guests" data-bl-error="Pick 1 to 4 guests.">
		<label class="bl-field__label" for="blf-g1">Guests</label>
		<span class="bl-stepper"><button type="button" class="bl-stepper__btn" data-bl-step="-1" aria-label="Decrease" aria-controls="blf-g1">−</button><input class="bl-field__control" id="blf-g1" name="guests" type="number" min="1" max="4" step="1" value="2"><button type="button" class="bl-stepper__btn" data-bl-step="1" aria-label="Increase" aria-controls="blf-g1">+</button></span>
		<p class="bl-field__error" id="blf-g1-err" hidden></p>
	</div>
	<div class="bl-field bl-g2 bl-field--range bl-field--w-full" data-bl-field="budget" data-bl-error="Choose a budget.">
		<label class="bl-field__label" for="blf-g2">Budget</label>
		<div class="bl-range"><input class="bl-field__control" id="blf-g2" name="budget" type="range" min="150" max="1500" step="50" value="400"><output class="bl-range__value" for="blf-g2">£400+</output><span class="bl-range__min">£150+</span><span class="bl-range__max">£1,500+</span></div>
		<p class="bl-field__error" id="blf-g2-err" hidden></p>
	</div>
	<div class="bl-field bl-g3 bl-field--textarea bl-field--w-full" data-bl-field="note" data-bl-error="Keep it under 10 characters.">
		<label class="bl-field__label" for="blf-g3">Note</label>
		<textarea class="bl-field__control" id="blf-g3" name="note" maxlength="10" aria-describedby="blf-g3-count"></textarea>
		<p class="bl-field__count" id="blf-g3-count"><span class="bl-field__count-n">0</span> / 10</p>
		<p class="bl-field__error" id="blf-g3-err" hidden></p>
	</div>
	${ line( 'time', 'g4', 'slot', 'min="09:00" max="17:30"' ) }
	<div class="bl-field bl-g5 bl-field--consent bl-field--a-switch bl-field--w-full" data-bl-field="news" data-bl-error="Tick this.">
		<label class="bl-field__choice" for="blf-g5"><input type="checkbox" role="switch" id="blf-g5" name="news" value="yes"> <span>News</span></label>
		<p class="bl-field__error" id="blf-g5-err" hidden></p>
	</div>
	<button class="bl-button" type="reset">Clear form</button>
	<p class="bl-form__retry" hidden></p>
</form>`;

describe( 'stepper', () => {
	beforeEach( () => page( GAPS ) );
	const up = () => form.querySelector( '[data-bl-step="1"]' ) as HTMLElement;
	const down = () => form.querySelector( '[data-bl-step="-1"]' ) as HTMLElement;

	it( 'steps within min/max and fires input', () => {
		const heard = vi.fn();
		$( '#blf-g1' ).addEventListener( 'input', heard );
		expect( core.step( form, up() ) ).toBe( true );
		core.step( form, up() );
		expect( $( '#blf-g1' ).value ).toBe( '4' );
		core.step( form, up() );
		expect( $( '#blf-g1' ).value ).toBe( '4' );
		expect( heard ).toHaveBeenCalledTimes( 2 );
		for ( let i = 0; i < 5; i++ ) core.step( form, down() );
		expect( $( '#blf-g1' ).value ).toBe( '1' );
	} );

	it( 'an empty stepper starts at its minimum; other clicks are not steps', () => {
		$( '#blf-g1' ).value = '';
		core.step( form, up() );
		expect( $( '#blf-g1' ).value ).toBe( '1' );
		expect( core.step( form, form.querySelector( 'label' ) ) ).toBe( false );
	} );

	it( 'a step re-checks a field showing its error', () => {
		$( '#blf-g1' ).value = '9';
		core.check( field( 'guests' ) );
		expect( core.showsError( field( 'guests' ) ) ).toBe( true );
		$( '#blf-g1' ).addEventListener( 'input', () => core.check( field( 'guests' ) ) );
		core.step( form, down() );
		expect( $( '#blf-g1' ).value ).toBe( '4' );
		expect( core.showsError( field( 'guests' ) ) ).toBe( false );
	} );
} );

describe( 'range output and counter', () => {
	beforeEach( () => page( GAPS ) );

	it( 'writes prefix + value + suffix to the output and aria-valuetext', () => {
		core.sync( form );
		expect( $( '#blf-g2' ).getAttribute( 'aria-valuetext' ) ).toBe( '£400+' );
		$( '#blf-g2' ).value = '650';
		core.syncField( field( 'budget' ) );
		expect( form.querySelector( '.bl-range__value' )!.textContent ).toBe( '£650+' );
		expect( $( '#blf-g2' ).getAttribute( 'aria-valuetext' ) ).toBe( '£650+' );
	} );

	it( 'takes the affixes from data attributes when given', () => {
		const out = form.querySelector( '.bl-range__value' ) as HTMLElement;
		out.dataset.blPrefix = '$';
		out.dataset.blSuffix = ' / mo';
		core.sync( form );
		expect( out.textContent ).toBe( '$400 / mo' );
	} );

	it( 'counts a textarea in code points', () => {
		$< HTMLTextAreaElement >( '#blf-g3' ).value = 'héllo 😀';
		core.syncField( field( 'note' ) );
		expect( form.querySelector( '.bl-field__count-n' )!.textContent ).toBe( '7' );
	} );
} );

describe( 'reset', () => {
	beforeEach( () => page( GAPS ) );

	it( 'clears errors, summary and retry, then re-syncs after the native reset', () => {
		$( '#blf-g4' ).value = '08:00';
		const failed = core.checkAll( form );
		core.summarise( form, failed, CTX );
		core.showRetry( form, 'x' );
		$( '#blf-g2' ).value = '1000';
		$< HTMLTextAreaElement >( '#blf-g3' ).value = 'abc';
		core.sync( form );

		let later: () => void = () => {};
		core.reset( form, ( fn ) => ( later = fn ) );
		expect( form.querySelectorAll( '.bl-field__error:not([hidden])' ) ).toHaveLength( 0 );
		expect( form.querySelector( '[aria-invalid]' ) ).toBeNull();
		expect( $( '#blf-g4' ).hasAttribute( 'aria-describedby' ) ).toBe( false );
		expect( $< HTMLElement >( '.bl-form__summary' ).hidden ).toBe( true );
		expect( $< HTMLElement >( '.bl-form__retry' ).hidden ).toBe( true );
		expect( core.attempted( form ) ).toBe( false );

		form.reset(); // the browser puts the values back after the event
		later();
		expect( form.querySelector( '.bl-range__value' )!.textContent ).toBe( '£400+' );
		expect( $( '#blf-g2' ).getAttribute( 'aria-valuetext' ) ).toBe( '£400+' );
		expect( form.querySelector( '.bl-field__count-n' )!.textContent ).toBe( '0' );
	} );

	it( 'defaults to a timeout', () => {
		vi.useFakeTimers();
		try {
			$( '#blf-g2' ).value = '1000';
			core.sync( form );
			core.reset( form );
			form.reset();
			expect( form.querySelector( '.bl-range__value' )!.textContent ).toBe( '£1,000+' );
			vi.runAllTimers();
			expect( form.querySelector( '.bl-range__value' )!.textContent ).toBe( '£400+' );
		} finally {
			vi.useRealTimers();
		}
	} );
} );

describe( 'validate: time, range, maxLength', () => {
	beforeEach( () => page( GAPS ) );

	it( 'time is HH:MM within min/max', () => {
		const slot = field( 'slot' );
		for ( const ok of [ '09:00', '12:45', '17:30' ] ) {
			$( '#blf-g4' ).value = ok;
			expect( core.validate( slot ) ).toBe( '' );
		}
		$( '#blf-g4' ).value = '08:59';
		expect( core.validate( slot ) ).toBe( 'Bad slot.' );
		$( '#blf-g4' ).value = '17:31';
		expect( core.validate( slot ) ).toBe( 'Bad slot.' );
		$( '#blf-g4' ).value = '';
		expect( core.validate( slot ) ).toBe( 'Bad slot.' ); // required
	} );

	it( 'time format is checked even where the browser would not', () => {
		const slot = field( 'slot' );
		const control = $( '#blf-g4' );
		Object.defineProperty( control, 'value', { configurable: true, get: () => '25:00' } );
		expect( core.validate( slot ) ).toBe( 'Bad slot.' );
		Object.defineProperty( control, 'value', { configurable: true, get: () => '9:00' } );
		expect( core.validate( slot ) ).toBe( 'Bad slot.' );
	} );

	it( 'range is within min/max and on a step', () => {
		const budget = field( 'budget' );
		const control = $( '#blf-g2' );
		expect( core.validate( budget ) ).toBe( '' );
		for ( const bad of [ '425', '100', '1550' ] ) {
			Object.defineProperty( control, 'value', { configurable: true, get: () => bad } );
			expect( core.validate( budget ) ).toBe( 'Choose a budget.' );
		}
	} );

	it( 'range without bounds uses 0..100 step 1', () => {
		const control = $( '#blf-g2' );
		[ 'min', 'max', 'step' ].forEach( ( a ) => control.removeAttribute( a ) );
		Object.defineProperty( control, 'value', { configurable: true, get: () => '101' } );
		expect( core.validate( field( 'budget' ) ) ).toBe( 'Choose a budget.' );
		Object.defineProperty( control, 'value', { configurable: true, get: () => '2.5' } );
		expect( core.validate( field( 'budget' ) ) ).toBe( 'Choose a budget.' );
		Object.defineProperty( control, 'value', { configurable: true, get: () => '100' } );
		expect( core.validate( field( 'budget' ) ) ).toBe( '' );
	} );

	it( 'maxLength counts code points on text types', () => {
		const note = $< HTMLTextAreaElement >( '#blf-g3' );
		note.value = '😀'.repeat( 10 );
		expect( core.validate( field( 'note' ) ) ).toBe( '' );
		note.value = 'a'.repeat( 11 );
		expect( core.validate( field( 'note' ) ) ).toBe( 'Keep it under 10 characters.' );
		page();
		$( '#blf-a1' ).setAttribute( 'maxlength', '3' );
		$( '#blf-a1' ).value = 'Adam';
		expect( core.validate( field( 'name' ) ) ).toBe( 'Fill in name.' );
	} );
} );

describe( 'collect: range and switch', () => {
	beforeEach( () => page( GAPS ) );

	it( 'sends a range as its string value and a switch like a consent box', () => {
		expect( core.collect( form ).fields ).toMatchObject( { budget: '400', guests: '2' } );
		expect( core.collect( form ).fields.news ).toBeUndefined();
		$( '#blf-g5' ).checked = true;
		expect( core.collect( form ).fields.news ).toBe( 'yes' );
	} );
} );

describe( 'events for companion plugins', () => {
	it( 'blicks:form-input carries the field, its name and its value', () => {
		const heard: core.InputDetail[] = [];
		form.addEventListener( core.EVENTS.input, ( e ) => heard.push( ( e as CustomEvent< core.InputDetail > ).detail ) );
		( form.querySelector( '[name="times[]"]' ) as HTMLInputElement ).checked = true;
		core.announceInput( form, field( 'times' ) );
		$( '#blf-a3' ).value = 'Sales';
		core.announceInput( form, field( 'topic' ) );
		expect( heard.map( ( d ) => [ d.name, d.value ] ) ).toEqual( [ [ 'times', [ 'Morning' ] ], [ 'topic', 'Sales' ] ] );
		expect( heard[ 0 ].field ).toBe( field( 'times' ) );
	} );

	it( 'blicks:form-validate may remove an error, and the send goes on', async () => {
		fillValid();
		$( '#blf-a2' ).value = 'not an email';
		form.addEventListener( core.EVENTS.validate, ( e ) => {
			const { errors } = ( e as CustomEvent< core.ValidateDetail > ).detail;
			expect( errors ).toEqual( { email: 'Enter an email address like name@example.com.' } );
			delete errors.email;
		} );
		const { d, posts } = deps( [ json( 200, { status: 'sent' } ) ] );
		expect( await core.submit( form, CTX, d ) ).toBe( 'sent' );
		expect( posts() ).toHaveLength( 1 );
	} );

	it( 'blicks:form-beforesend: preventDefault cancels quietly, nothing is posted', async () => {
		fillValid();
		form.addEventListener( core.EVENTS.beforeSend, ( e ) => e.preventDefault() );
		const { d, posts } = deps( [ json( 200, { status: 'sent' } ) ] );
		expect( await core.submit( form, CTX, d ) ).toBe( 'cancelled' );
		expect( posts() ).toHaveLength( 0 );
		expect( $< HTMLElement >( '.bl-form__retry' ).hidden ).toBe( true );
		expect( core.isSending( form ) ).toBe( false );
	} );

	it( 'blicks:form-beforesend: the send waits for detail.wait; a rejected wait cancels', async () => {
		fillValid();
		let release!: () => void;
		const listener = ( e: Event ) => {
			( e as CustomEvent< core.BeforeSendDetail > ).detail.wait = new Promise< void >( ( r ) => ( release = r ) );
		};
		form.addEventListener( core.EVENTS.beforeSend, listener );
		const { d, posts } = deps( [ json( 200, { status: 'sent' } ) ] );
		const run = core.submit( form, CTX, d );
		await vi.waitFor( () => expect( release ).toBeTypeOf( 'function' ) );
		expect( posts() ).toHaveLength( 0 );
		release();
		expect( await run ).toBe( 'sent' );
		form.removeEventListener( core.EVENTS.beforeSend, listener );

		page();
		fillValid();
		form.addEventListener( core.EVENTS.beforeSend, ( e ) => {
			( e as CustomEvent< core.BeforeSendDetail > ).detail.wait = Promise.reject( new Error( 'card declined' ) );
		} );
		const second = deps( [ json( 200, { status: 'sent' } ) ] );
		expect( await core.submit( form, CTX, second.d ) ).toBe( 'cancelled' );
		expect( second.posts() ).toHaveLength( 0 );
	} );

	it( 'blicks:form-sent carries the response, before the after-send choice', async () => {
		fillValid();
		const seen: unknown[] = [];
		form.addEventListener( core.EVENTS.sent, ( e ) => seen.push( [ ( e as CustomEvent< core.SentDetail > ).detail.response, form.classList.contains( 'is-sent' ) ] ) );
		const { d } = deps( [ json( 200, { status: 'sent', id: 4 } ) ] );
		await core.submit( form, CTX, d );
		expect( seen ).toEqual( [ [ { status: 'sent', id: 4 }, false ] ] );
	} );
} );

describe( 'hidden and inert fields', () => {
	it( 'are not checked, on their own or on a send, but their values are sent', async () => {
		fillValid();
		$( '#blf-a1' ).value = '';
		field( 'name' ).setAttribute( 'hidden', '' );
		const wrap = document.createElement( 'div' );
		wrap.setAttribute( 'inert', '' );
		field( 'email' ).before( wrap );
		wrap.append( field( 'email' ) );
		$( '#blf-a2' ).value = 'bad';
		expect( core.isSkipped( field( 'name' ) ) ).toBe( true );
		expect( core.isSkipped( field( 'email' ) ) ).toBe( true );
		expect( core.isSkipped( field( 'topic' ) ) ).toBe( false );
		expect( core.check( field( 'email' ) ) ).toBe( true );

		const { d, posts } = deps( [ json( 200, { status: 'sent' } ) ] );
		expect( await core.submit( form, CTX, d ) ).toBe( 'sent' );
		const body = JSON.parse( posts()[ 0 ].init.body as string );
		expect( body.fields.name ).toBe( '' );
		expect( body.fields.email ).toBe( 'bad' );
	} );

	it( 'a hidden form (after sending) does not count as hiding its fields', () => {
		form.hidden = true;
		expect( core.isSkipped( field( 'name' ) ) ).toBe( false );
	} );
} );
