// @vitest-environment jsdom
/**
 * The block toolbars render outside the editor and write what their Settings tab writes. Each one
 * is drawn on its own, a choice is opened and picked, and the write is checked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ButtonsToolbar } from '@/blocks/buttons/controls';
import { DialogToolbar } from '@/blocks/dialog/controls';
import { ListToolbar } from '@/blocks/list/controls';
import { IconToolbar } from '@/blocks/icon/controls';
import { FieldToolbar } from '@/blocks/field/controls';
import { BoxToolbar } from '@/blocks/box/controls';
import { SectionToolbar } from '@/blocks/section/controls';

( globalThis as any ).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement;

function draw( el: JSX.Element ) {
	host = document.createElement( 'div' );
	document.body.appendChild( host );
	root = createRoot( host );
	act( () => root!.render( el ) );
}

afterEach( () => {
	act( () => root?.unmount() );
	document.body.innerHTML = '';
	root = null;
} );

const button = ( label: string ) => document.querySelector< HTMLButtonElement >( `button[aria-label="${ label }"]` );
const pick = ( menu: string, item: string ) => {
	act( () => button( menu )!.click() );
	const row = [ ...document.querySelectorAll< HTMLButtonElement >( '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]' ) ].find( ( b ) => b.textContent?.includes( item ) );
	expect( row, `${ menu } → ${ item }` ).toBeTruthy();
	act( () => row!.click() );
};

describe( 'block toolbars', () => {
	it( 'Buttons goes to a grid of three, as Settings does', () => {
		const set = vi.fn();
		draw( <ButtonsToolbar attributes={ {} } setAttributes={ set } /> );
		act( () => button( 'Grid' )!.click() );
		const tree = set.mock.lastCall![ 0 ].blicks;
		expect( tree[ 'layout.display' ].default.base ).toBe( 'grid' );
		expect( tree[ 'layout.gridColumns' ].default.base ).toBe( 'repeat(3, minmax(0, 1fr))' );
	} );

	it( 'Dialog shows Start/End only for a drawer', () => {
		const set = vi.fn();
		draw( <DialogToolbar attributes={ { kind: 'drawer' } } setAttributes={ set } /> );
		act( () => button( 'Start' )!.click() );
		expect( set ).toHaveBeenLastCalledWith( { side: 'start' } );
		expect( button( 'Top' ) ).toBeNull();
	} );

	it( 'List has no toolbar when nested, and writes kind otherwise', () => {
		const set = vi.fn();
		draw( <ListToolbar attributes={ { nested: true } } setAttributes={ set } /> );
		expect( host.innerHTML ).toBe( '' );
		act( () => root!.render( <ListToolbar attributes={ {} } setAttributes={ set } /> ) );
		pick( 'Kind', 'Numbers' );
		expect( set ).toHaveBeenLastCalledWith( { kind: 'numbers' } );
	} );

	it( 'Icon turns a quarter and switches to filled', () => {
		const set = vi.fn();
		draw( <IconToolbar attributes={ { turn: 270 } } setAttributes={ set } /> );
		act( () => button( 'Turn a quarter' )!.click() );
		expect( set ).toHaveBeenLastCalledWith( { turn: 0 } );
		act( () => button( 'Filled' )!.click() );
		expect( set ).toHaveBeenLastCalledWith( { filled: true } );
	} );

	it( 'Field toggles required and hides for a hidden field', () => {
		const set = vi.fn();
		draw( <FieldToolbar attributes={ { type: 'text' } } setAttributes={ set } /> );
		act( () => button( 'Required' )!.click() );
		expect( set ).toHaveBeenLastCalledWith( { required: true } );
		act( () => root!.render( <FieldToolbar attributes={ { type: 'hidden' } } setAttributes={ set } /> ) );
		expect( host.innerHTML ).toBe( '' );
	} );

	it( 'Box arranges side by side through the same helper as Settings', () => {
		const set = vi.fn();
		draw( <BoxToolbar attributes={ { kind: 'plain' } } setAttributes={ set } /> );
		act( () => button( 'Side by side' )!.click() );
		const { blicks, layers } = set.mock.lastCall![ 0 ];
		expect( layers ).toBe( false );
		expect( blicks[ 'layout.display' ].default.base ).toBe( 'flex' );
	} );

	it( 'Section sets surface, space and height, as Settings does', () => {
		const set = vi.fn();
		draw( <SectionToolbar attributes={ {} } setAttributes={ set } /> );
		pick( 'Surface', 'Muted' );
		expect( set ).toHaveBeenLastCalledWith( { surface: 'muted' } );
		pick( 'Space above and below', 'Large' );
		expect( set ).toHaveBeenLastCalledWith( { sectionSpace: 'lg' } );
		pick( 'Height, at least', 'Full screen' );
		expect( set ).toHaveBeenLastCalledWith( { sectionHeight: '100svh' } );
	} );
} );
