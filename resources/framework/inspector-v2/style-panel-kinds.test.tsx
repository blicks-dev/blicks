// @vitest-environment jsdom
/**
 * What each kind's Style tab offers in Shadow and depth. An image is framed like a box, so it gets
 * the depth tiles too (dropped once, restored for 2.0).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { StylePanel } from './StylePanel';

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

const tiles = () => [ ...host.querySelectorAll( '.opt' ) ].map( ( b ) => b.getAttribute( 'aria-label' ) );

describe( 'Shadow and depth', () => {
	it( 'offers an image the depth tiles', () => {
		act( () => root.render( <StylePanel attributes={ { blicks: {} } } setAttributes={ () => {} } kind="image" linked={ false } /> ) );
		expect( tiles() ).toEqual( expect.arrayContaining( [ 'Flat', '3D edge', 'Block', 'Frame' ] ) );
	} );
} );
