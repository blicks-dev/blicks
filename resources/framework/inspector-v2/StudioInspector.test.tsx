// @vitest-environment jsdom
/**
 * The Studio's Quick tab is the post editor's own panels, so a Button in the Studio offers Look,
 * Size and Corners by name before any engine row. These pin what Quick holds and in what order.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock( './More', () => ( {
	MorePanel: () => <p data-part="more">more</p>,
	ClearStyles: () => <p data-part="clear">clear</p>,
} ) );
vi.mock( './DesignPanel', () => ( { DesignPanel: () => null } ) );
vi.mock( '@/framework/inspector/Inspector', () => ( { InspectorContent: () => null } ) );

const { QuickPanels } = await import( './StudioInspector' );

( globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean } ).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach( () => {
	host = document.createElement( 'div' );
	document.body.append( host );
	root = createRoot( host );
} );

afterEach( () => {
	act( () => root.unmount() );
	host.remove();
} );

const part = ( name: string ) => () => <p data-part={ name }>{ name }</p>;
const groups = () => [ ...host.querySelectorAll( '[data-quick]' ) ].map( ( g ) => g.getAttribute( 'data-quick' ) );
const parts = () => [ ...host.querySelectorAll( '[data-part]' ) ].map( ( p ) => p.getAttribute( 'data-part' ) );

describe( 'Quick', () => {
	it( 'stacks Settings, Style, Motion and More, in the post editor’s order', () => {
		act( () => root.render( <QuickPanels panels={ { Settings: part( 'settings' ), Style: part( 'style' ), Motion: part( 'motion' ) } } attributes={ {} } setAttributes={ () => {} } clientId="b" /> ) );

		expect( groups() ).toEqual( [ 'settings', 'style', 'motion', 'more' ] );
		// Clear styles stays with Style, as it does in the post editor's Style tab.
		expect( parts() ).toEqual( [ 'settings', 'style', 'clear', 'motion', 'more' ] );
	} );

	it( 'leaves out a panel the block does not have, and always keeps More', () => {
		act( () => root.render( <QuickPanels panels={ { Settings: part( 'settings' ) } } attributes={ {} } setAttributes={ () => {} } clientId="b" /> ) );

		expect( groups() ).toEqual( [ 'settings', 'more' ] );
	} );
} );
