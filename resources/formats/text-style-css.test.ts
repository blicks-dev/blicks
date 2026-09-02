import { describe, expect, it } from 'vitest';
import { buildStyle, styleToTrees, splitTop, type Trees } from './text-style-css';

const GRADIENT = { type: 'linear', angle: '90deg', stops: [ { color: '#ff0080', position: '0%' }, { color: '#7928ca', position: '100%' } ] };

function trees( text: any = {}, highlight: any = {} ): Trees {
	return { text, highlight };
}

/** Shorthand for the `{ default: { base } }` slot the value tree stores. */
function base( value: unknown ) {
	return { default: { base: value } };
}

describe( 'splitTop', () => {
	it( 'ignores separators nested in parens and quotes', () => {
		expect( splitTop( 'rgba(1, 2, 3, .5), url("a,b.png")' ) ).toEqual( [ 'rgba(1, 2, 3, .5)', 'url("a,b.png")' ] );
		expect( splitTop( 'color:red;background:url("a;b.png")', ';' ) ).toEqual( [ 'color:red', 'background:url("a;b.png")' ] );
	} );
} );

describe( 'buildStyle', () => {
	it( 'is empty when neither fill is set', () => {
		expect( buildStyle( trees() ) ).toBe( '' );
	} );

	it( 'paints a solid text fill with plain color — no clip, no layer', () => {
		expect( buildStyle( trees( { 'colors.background': base( '#ff0080' ) } ) ) ).toBe( 'color:#ff0080' );
	} );

	it( 'paints a solid highlight with background-color when nothing is clipped', () => {
		const style = buildStyle( trees( {}, { 'colors.background': base( '#ffe27a' ) } ) );
		expect( style ).toContain( 'background-color:#ffe27a' );
		expect( style ).toContain( 'box-decoration-break:clone' );
		expect( style ).not.toContain( 'background-clip' );
	} );

	it( 'clips a gradient text fill to the glyphs', () => {
		const style = buildStyle( trees( { 'background.gradient': base( GRADIENT ) } ) );
		expect( style ).toContain( 'background-image:linear-gradient(90deg, #ff0080 0%, #7928ca 100%)' );
		expect( style ).toContain( '-webkit-background-clip:text' );
		expect( style ).toContain( 'background-clip:text' );
		expect( style ).toContain( '-webkit-text-fill-color:transparent' );
	} );

	it( 'layers a gradient text fill over a solid highlight, one clip value per layer', () => {
		const style = buildStyle( trees(
			{ 'background.gradient': base( GRADIENT ) },
			{ 'colors.background': base( '#ffe27a' ) }
		) );
		// The highlight becomes a flat gradient layer — `background-color` would be clipped away.
		expect( style ).toContain( 'background-image:linear-gradient(90deg, #ff0080 0%, #7928ca 100%),linear-gradient(#ffe27a,#ffe27a)' );
		expect( style ).toContain( 'background-clip:text,border-box' );
		expect( style ).toContain( '-webkit-background-clip:text,border-box' );
		expect( style ).not.toContain( 'background-color' );
	} );

	it( 'keeps the size/position lists aligned with the layers', () => {
		const style = buildStyle( trees(
			{ 'background.image': base( { url: 'https://example.com/a.png' } ), 'background.size': base( 'contain' ), 'background.position': base( 'left top' ) },
			{ 'colors.background': base( '#ffe27a' ) }
		) );
		expect( style ).toContain( 'background-size:contain,auto' );
		expect( style ).toContain( 'background-position:left top,center' );
		expect( style ).toContain( 'background-clip:text,border-box' );
	} );

	it( 'combines a solid text fill with a highlight without any clipping', () => {
		const style = buildStyle( trees(
			{ 'colors.background': base( '#ffffff' ) },
			{ 'background.gradient': base( GRADIENT ) }
		) );
		expect( style ).toContain( 'color:#ffffff' );
		expect( style ).toContain( 'background-image:linear-gradient(90deg, #ff0080 0%, #7928ca 100%)' );
		expect( style ).not.toContain( 'background-clip' );
		expect( style ).not.toContain( 'text-fill-color' );
	} );

	it( 'renders a theme gradient preset slug as its token var', () => {
		expect( buildStyle( trees( { 'background.gradient': base( 'sunset' ) } ) ) )
			.toContain( 'background-image:var(--blicks-gradient-sunset)' );
	} );

	it( 'resolves a colour token slug to its var()', () => {
		expect( buildStyle( trees( { 'colors.background': base( 'primary' ) } ) ) ).toBe( 'color:var(--blicks-color-primary)' );
	} );
} );

describe( 'styleToTrees', () => {
	it( 'round-trips a layered text fill + highlight', () => {
		const source = trees( { 'background.gradient': base( GRADIENT ) }, { 'colors.background': base( '#ffe27a' ) } );
		const parsed = styleToTrees( buildStyle( source ) );
		expect( parsed.highlight[ 'colors.background' ] ).toEqual( base( '#ffe27a' ) );
		expect( parsed.text[ 'background.gradient' ].default.base ).toMatchObject( {
			type: 'linear',
			angle: '90deg',
			stops: [ { color: '#ff0080', position: '0%' }, { color: '#7928ca', position: '100%' } ],
		} );
		// Re-emitting the parsed trees reproduces the same CSS.
		expect( buildStyle( parsed ) ).toBe( buildStyle( source ) );
	} );

	it( 'round-trips an image text fill with size and position', () => {
		const source = trees(
			{ 'background.image': base( { url: 'https://example.com/a.png' } ), 'background.size': base( 'contain' ), 'background.position': base( 'left top' ) },
			{ 'colors.background': base( '#ffe27a' ) }
		);
		const parsed = styleToTrees( buildStyle( source ) );
		expect( parsed.text[ 'background.image' ] ).toEqual( base( { url: 'https://example.com/a.png' } ) );
		expect( parsed.text[ 'background.size' ] ).toEqual( base( 'contain' ) );
		expect( parsed.text[ 'background.position' ] ).toEqual( base( 'left top' ) );
		expect( parsed.highlight[ 'colors.background' ] ).toEqual( base( '#ffe27a' ) );
	} );

	it( 'round-trips a theme gradient preset slug', () => {
		const parsed = styleToTrees( buildStyle( trees( { 'background.gradient': base( 'sunset' ) } ) ) );
		expect( parsed.text[ 'background.gradient' ] ).toEqual( base( 'sunset' ) );
	} );

	it( 'reads the pre-layer output where a single clipped layer meant "text"', () => {
		const parsed = styleToTrees(
			'background-image:linear-gradient(90deg, #ff0080 0%, #7928ca 100%);-webkit-background-clip:text;background-clip:text;color:transparent'
		);
		expect( parsed.text[ 'background.gradient' ].default.base.type ).toBe( 'linear' );
		expect( parsed.highlight ).toEqual( {} );
	} );

	it( 'reads a plain highlight-only span', () => {
		const parsed = styleToTrees( 'background-color:#ffe27a;padding:0 .15em' );
		expect( parsed.highlight[ 'colors.background' ] ).toEqual( base( '#ffe27a' ) );
		expect( parsed.text ).toEqual( {} );
	} );

	it( 'assigns layers by their clip value, not their order', () => {
		const parsed = styleToTrees(
			'background-image:linear-gradient(#ffe27a,#ffe27a),url("https://example.com/a.png");background-clip:border-box,text'
		);
		expect( parsed.highlight[ 'colors.background' ] ).toEqual( base( '#ffe27a' ) );
		expect( parsed.text[ 'background.image' ] ).toEqual( base( { url: 'https://example.com/a.png' } ) );
	} );

	it( 'returns empty trees for an empty style', () => {
		expect( styleToTrees( '' ) ).toEqual( { text: {}, highlight: {} } );
	} );
} );
