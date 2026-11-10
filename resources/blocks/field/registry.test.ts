// @vitest-environment jsdom
/**
 * A fixture companion plugin, written only against the published surface (`window.blicks.forms`,
 * the `blicks.form.allowedBlocks` filter and the form's DOM events), to show the Form's extension
 * points hold without any Pro code.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { addAction, addFilter, removeFilter } from '@wordpress/hooks';
import { getBlockType } from '@wordpress/blocks';
import * as core from '@/behaviours/form-core';
import { cleanType, isKnownType, moreFieldsLine, typeGroups, typeInfo } from './model';
import { definitionProblem, getFieldTypes, resetFieldTypes } from './registry';
import { createField, fieldSpec } from './create';
import { formAllowedBlocks } from '@/blocks/form/model';
import { newFieldAttributes } from '@/blocks/form/controls';
import { templateBlocks } from '@/blocks/form/templates';

type Forms = {
	registerFieldType: ( def: Record< string, unknown > ) => boolean;
	unregisterFieldType: ( type: string ) => boolean;
	isKnownType: ( type: string ) => boolean;
	subscribe: ( fn: () => void ) => () => void;
	filters: { allowedBlocks: string };
	events: Record< string, string >;
};

let ready: Forms | null = null;
const forms = () => ( window as unknown as { blicks: { forms: Forms } } ).blicks.forms;

// The companion's filter is added before the editor bundle runs, as the docs ask.
addFilter( 'blicks.form.allowedBlocks', 'fixture/step', ( blocks: string[] ) => [ ...blocks, 'fixture/step' ] );
addAction( 'blicks.forms.ready', 'fixture/ready', ( api: Forms ) => {
	ready = api;
} );

beforeAll( async () => {
	vi.spyOn( console, 'warn' ).mockImplementation( () => {} );
	await import( '@/block-library' );
} );

afterEach( () => resetFieldTypes() );

describe( 'window.blicks.forms', () => {
	it( 'is published, and blicks.forms.ready runs with it', () => {
		expect( forms() ).toBeDefined();
		expect( ready ).toBe( forms() );
		expect( forms().filters.allowedBlocks ).toBe( 'blicks.form.allowedBlocks' );
		expect( forms().events ).toEqual( { input: 'blicks:form-input', validate: 'blicks:form-validate', beforeSend: 'blicks:form-beforesend', sent: 'blicks:form-sent' } );
	} );

	it( 'refuses a bad definition with a warning, never a throw', () => {
		expect( forms().registerFieldType( { type: 'Rating', label: 'x' } ) ).toBe( false );
		expect( forms().registerFieldType( { type: 'email', label: 'Mine' } ) ).toBe( false );
		expect( forms().registerFieldType( { type: 'rating', label: '' } ) ).toBe( false );
		expect( forms().registerFieldType( { type: 'rating', label: 'R', defaults: [] } ) ).toBe( false );
		expect( definitionProblem( null ) ).not.toBe( '' );
		expect( getFieldTypes() ).toEqual( [] );
	} );

	it( 'registers a type and a group: pickers group it, the Pro line goes, listeners hear it', () => {
		const heard = vi.fn();
		const stop = forms().subscribe( heard );
		expect( moreFieldsLine() ).toBe( 'More fields in Blicks Pro' );
		expect( typeGroups().map( ( g ) => g.heading ) ).toEqual( [ '' ] );

		const Controls = () => null;
		expect(
			forms().registerFieldType( {
				type: 'rating',
				label: 'Rating',
				description: 'Stars from 1 to 5',
				group: 'Fixture fields',
				icon: 'M0 0h24',
				controls: Controls,
				defaults: { label: 'Rate us', extensions: { fixture: { stars: 5 } } },
			} )
		).toBe( true );
		expect( forms().registerFieldType( { type: 'nps', label: 'Score', group: 'Fixture fields' } ) ).toBe( true );
		expect( forms().registerFieldType( { type: 'colour', label: 'Colour' } ) ).toBe( true );
		expect( heard ).toHaveBeenCalledTimes( 3 );
		stop();

		const groups = typeGroups();
		expect( groups.map( ( g ) => g.heading ) ).toEqual( [ 'Fields', 'Fixture fields' ] );
		expect( groups[ 0 ].types.map( ( t ) => t.type ) ).toContain( 'email' );
		expect( groups[ 0 ].types.at( -1 )?.type ).toBe( 'colour' );
		expect( groups[ 1 ].types.map( ( t ) => t.type ) ).toEqual( [ 'rating', 'nps' ] );
		expect( moreFieldsLine() ).toBe( '' );
		expect( forms().isKnownType( 'rating' ) ).toBe( true );
		expect( typeInfo( 'rating' ) ).toEqual( { label: 'Rating', hint: 'Stars from 1 to 5' } );

		// "Add a field" seeds the type's defaults.
		const attrs = newFieldAttributes( groups[ 1 ].types[ 0 ] );
		expect( attrs ).toEqual( { label: 'Rate us', extensions: { fixture: { stars: 5 } }, type: 'rating' } );
		expect( createField( attrs ).attributes.extensions ).toEqual( { fixture: { stars: 5 } } );
	} );

	it( 'a group with no companion type left brings the line back', () => {
		forms().registerFieldType( { type: 'colour', label: 'Colour' } );
		expect( moreFieldsLine() ).toBe( 'More fields in Blicks Pro' );
		expect( typeGroups().map( ( g ) => g.heading ) ).toEqual( [ '' ] );
	} );
} );

describe( 'a type whose plugin is off', () => {
	it( 'is kept as saved, never coerced to text', () => {
		expect( cleanType( 'rating' ) ).toBe( 'rating' );
		expect( isKnownType( 'rating' ) ).toBe( false );
		expect( typeInfo( 'rating' ).label ).toBe( 'rating' );
		expect( cleanType( undefined ) ).toBe( 'text' );
		expect( cleanType( 'Not valid' ) ).toBe( 'text' );
	} );
} );

describe( 'extensions', () => {
	it( 'pass through specs, blocks and templates untouched', () => {
		const extensions = { pro: { logic: { match: 'all', when: [] } } };
		expect( fieldSpec( { type: 'text', label: 'A', extensions } )[ 1 ].extensions ).toBe( extensions );
		expect( createField( { type: 'text', label: 'A', extensions } ).attributes.extensions ).toEqual( extensions );
		expect( ( getBlockType( 'blicks/field' ) as any )?.attributes.extensions.default ).toEqual( {} );
		expect( ( getBlockType( 'blicks/form' ) as any )?.attributes.extensions.default ).toEqual( {} );
		// A template's Field starts with the default, and keeps the attribute.
		const field = templateBlocks( 'contact' ).find( ( b: any ) => b.name === 'blicks/field' );
		expect( field.attributes.extensions ).toEqual( {} );
	} );
} );

describe( 'blicks.form.allowedBlocks', () => {
	it( 'is resolved as the Form registers', () => {
		expect( ( getBlockType( 'blicks/form' ) as any )?.allowedBlocks ).toContain( 'fixture/step' );
		expect( formAllowedBlocks() ).toContain( 'blicks/field' );
	} );

	it( 'is re-read later, so a filter added after the editor loaded still counts', () => {
		const before = formAllowedBlocks();
		expect( formAllowedBlocks() ).toBe( before );
		addFilter( 'blicks.form.allowedBlocks', 'fixture/late', ( blocks: string[] ) => [ ...blocks, 'fixture/late', 7 ] );
		expect( formAllowedBlocks() ).toContain( 'fixture/late' );
		expect( formAllowedBlocks() ).not.toContain( 7 );
		removeFilter( 'blicks.form.allowedBlocks', 'fixture/late' );
		expect( formAllowedBlocks() ).not.toContain( 'fixture/late' );
	} );
} );

/* -------------------------------------------------------------------------------------------- */
/* The companion's front-end half                                                                */
/* -------------------------------------------------------------------------------------------- */

const FORM = `
<form class="bl-form">
	<div class="bl-form__summary" tabindex="-1" hidden></div>
	<div class="bl-field bl-field--text is-required" data-bl-field="name" data-bl-error="Fill in name.">
		<label class="bl-field__label" for="blf-a1">Name</label>
		<input id="blf-a1" name="name" type="text" required>
		<p class="bl-field__error" id="blf-a1-err" hidden></p>
	</div>
	<div class="fixture-step" hidden>
		<div class="bl-field bl-field--email is-required" data-bl-field="later" data-bl-error="Bad later.">
			<input id="blf-a2" name="later" type="email" required>
			<p class="bl-field__error" id="blf-a2-err" hidden></p>
		</div>
	</div>
	<div class="bl-field bl-field--rating is-required" data-bl-field="stars" data-bl-error="Rate us." inert>
		<input id="blf-a3" name="stars" type="text" required>
		<p class="bl-field__error" id="blf-a3-err" hidden></p>
	</div>
	<button type="submit">Send</button>
	<p class="bl-form__retry" hidden></p>
</form>`;

const CTX: core.FormContext = { form: 'f1', post: 5, token: 'http://localhost/t', entries: 'http://localhost/e', challenge: { kind: 'none' } };

function deps() {
	const bodies: any[] = [];
	const d: core.Deps = {
		fetch: ( async ( url: string, init: RequestInit = {} ) => {
			if ( url.includes( '/t' ) && ! init.method ) return { ok: true, status: 200, json: async () => ( { token: 'tk' } ) };
			bodies.push( JSON.parse( String( init.body ) ) );
			return { ok: true, status: 200, json: async () => ( { status: 'sent', step: 2 } ) };
		} ) as unknown as typeof fetch,
		now: () => 0,
		wait: async () => {},
		assign: () => {},
		openDialog: () => false,
		win: {},
	};
	return { d, bodies };
}

describe( 'the form’s events', () => {
	it( 'fire in order; a listener adds an error, then a payload key; hidden and inert fields are not checked', async () => {
		document.body.innerHTML = FORM;
		const form = document.querySelector( 'form' )!;
		const order: string[] = [];
		const { events } = forms();
		let sent: unknown = null;

		form.addEventListener( events.input, ( e ) => order.push( `input:${ ( e as CustomEvent ).detail.name }=${ ( e as CustomEvent ).detail.value }` ) );
		let refuse = true;
		form.addEventListener( events.validate, ( e ) => {
			const { errors } = ( e as CustomEvent< core.ValidateDetail > ).detail;
			order.push( `validate:${ Object.keys( errors ).join( ',' ) }` );
			if ( refuse ) errors.name = 'Fixture says no.';
		} );
		form.addEventListener( events.beforeSend, ( e ) => {
			const detail = ( e as CustomEvent< core.BeforeSendDetail > ).detail;
			order.push( 'beforesend' );
			detail.wait = Promise.resolve().then( () => {
				detail.payload.fixture = { step: 2 };
			} );
		} );
		form.addEventListener( events.sent, ( e ) => {
			order.push( 'sent' );
			sent = ( e as CustomEvent< core.SentDetail > ).detail.response;
		} );

		const input = document.getElementById( 'blf-a1' ) as HTMLInputElement;
		input.value = 'Ada';
		core.announceInput( form, input.closest( '[data-bl-field]' ) as HTMLElement );

		const first = deps();
		expect( await core.submit( form, CTX, first.d ) ).toBe( 'invalid' );
		expect( first.bodies ).toEqual( [] );
		expect( document.getElementById( 'blf-a1-err' )!.textContent ).toBe( 'Fixture says no.' );

		refuse = false;
		const second = deps();
		expect( await core.submit( form, CTX, second.d ) ).toBe( 'sent' );
		// The hidden and inert fields were not checked (no `later` / `stars` errors), but are sent.
		expect( order ).toEqual( [ 'input:name=Ada', 'validate:', 'validate:', 'beforesend', 'sent' ] );
		expect( second.bodies[ 0 ] ).toEqual( { post: 5, fields: { name: 'Ada', later: '', stars: '' }, hp: '', challenge: '', fixture: { step: 2 }, token: 'tk' } );
		expect( sent ).toEqual( { status: 'sent', step: 2 } );
	} );
} );
