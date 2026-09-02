import { describe, expect, it } from 'vitest';
import {
	TOKEN_CATEGORIES,
	buildPreviewVars,
	buildTypeRolePreview,
	countRecordChanges,
	countTokenChanges,
	countTypeRoleChanges,
	hex8ToCssValue,
	kebabProp,
	normalizeSnapshot,
	normalizeThemes,
	type TokenValues,
} from './design-system';

// Built from the catalogue rather than spelled out, so a new token category doesn't break this file.
const EMPTY_VALUES: TokenValues = Object.fromEntries(
	TOKEN_CATEGORIES.map( category => [ category, {} ] )
) as TokenValues;

describe( 'normalizeSnapshot', () => {
	it( 'returns null for non-object payloads', () => {
		expect( normalizeSnapshot( null ) ).toBeNull();
		expect( normalizeSnapshot( 'nope' ) ).toBeNull();
		expect( normalizeSnapshot( 42 ) ).toBeNull();
	} );

	it( 'defends every shape against partial or malformed data', () => {
		const snapshot = normalizeSnapshot( {
			source: { theme: 'twentytwentyfive', themeJson: 1 },
			tokens: { color: [ 'primary', 7, 'border' ], spacing: 'broken' },
			baseValues: { color: { primary: '#18181b', junk: 9 } },
			values: null,
			overrides: { tokens: { color: { primary: '#abcdef' }, bogus: { x: 'y' } }, breakpoints: { tablet: 900, mobile: '600' } },
			breakpoints: [ { id: 'base', label: 'Desktop', max: null }, { id: 'broken' }, 'junk' ],
		} );

		expect( snapshot ).not.toBeNull();
		expect( snapshot?.source ).toEqual( { theme: 'twentytwentyfive', themeJson: true, globalStyles: false } );
		expect( snapshot?.tokens.color ).toEqual( [ 'primary', 'border' ] );
		expect( snapshot?.tokens.spacing ).toEqual( [] );
		expect( snapshot?.baseValues.color ).toEqual( { primary: '#18181b' } );
		expect( snapshot?.values.color ).toEqual( {} );
		expect( snapshot?.overrides.tokens ).toEqual( { color: { primary: '#abcdef' } } );
		expect( snapshot?.overrides.breakpoints ).toEqual( { tablet: 900 } );
		expect( snapshot?.breakpoints ).toEqual( [ { id: 'base', label: 'Desktop', max: null } ] );
	} );

	it( 'defaults typeRoles to an empty, well-shaped block when absent', () => {
		const snapshot = normalizeSnapshot( { source: { theme: 'x' } } );
		expect( snapshot?.typeRoles ).toEqual( { roles: [], props: [], slots: {}, base: {}, values: {} } );
		expect( snapshot?.overrides.typeRoles ).toEqual( {} );
	} );

	it( 'parses and defends the typeRoles block', () => {
		const snapshot = normalizeSnapshot( {
			source: { theme: 'x' },
			typeRoles: {
				roles: [ 'h1', 'body', 7 ],
				props: [ 'fontSize' ],
				slots: {
					h1: { kind: 'native', stylesPath: [ 'elements', 'h1', 'typography' ] },
					lead: { kind: 'custom', settingsGroup: [ 'custom', 'blicks', 'typeRoles', 'lead' ] },
					junk: 'nope',
				},
				base: { h1: { fontSize: '3rem', bad: 9 } },
				values: { h1: { fontSize: '2.5rem' }, broken: null },
			},
			overrides: { typeRoles: { h1: { fontWeight: '800', bad: 5 }, empty: {} } },
		} );

		expect( snapshot?.typeRoles.roles ).toEqual( [ 'h1', 'body' ] ); // non-strings filtered out
		expect( snapshot?.typeRoles.props ).toEqual( [ 'fontSize' ] );
		expect( snapshot?.typeRoles.slots.h1.kind ).toBe( 'native' );
		expect( snapshot?.typeRoles.slots.lead.kind ).toBe( 'custom' );
		expect( snapshot?.typeRoles.slots.junk ).toBeUndefined();
		expect( snapshot?.typeRoles.base ).toEqual( { h1: { fontSize: '3rem' } } );
		expect( snapshot?.typeRoles.values ).toEqual( { h1: { fontSize: '2.5rem' } } );
		expect( snapshot?.overrides.typeRoles ).toEqual( { h1: { fontWeight: '800' } } );
	} );
} );

describe( 'countTypeRoleChanges', () => {
	it( 'counts changed props across roles', () => {
		expect( countTypeRoleChanges( {}, {} ) ).toBe( 0 );
		expect( countTypeRoleChanges( { h1: { fontWeight: '800' } }, { h1: { fontWeight: '800' } } ) ).toBe( 0 );
		expect( countTypeRoleChanges(
			{ h1: { fontWeight: '900' }, body: { fontSize: '17px' } },
			{ h1: { fontWeight: '800' } }
		) ).toBe( 2 );
	} );
} );

describe( 'draft diffing', () => {
	it( 'counts added, changed, and removed record entries', () => {
		expect( countRecordChanges( {}, {} ) ).toBe( 0 );
		expect( countRecordChanges( { a: '1' }, { a: '1' } ) ).toBe( 0 );
		expect( countRecordChanges( { a: '2' }, { a: '1' } ) ).toBe( 1 );
		expect( countRecordChanges( { a: '1', b: '2' }, { a: '1' } ) ).toBe( 1 );
		expect( countRecordChanges( {}, { a: '1' } ) ).toBe( 1 );
		expect( countRecordChanges( { tablet: 900 }, { tablet: 782 } ) ).toBe( 1 );
	} );

	it( 'counts token changes across categories', () => {
		expect( countTokenChanges( {}, {} ) ).toBe( 0 );
		expect( countTokenChanges(
			{ color: { primary: '#abcdef' }, spacing: { md: '20px' } },
			{ color: { primary: '#abcdef' } }
		) ).toBe( 1 );
		expect( countTokenChanges( {}, { color: { primary: '#abcdef' } } ) ).toBe( 1 );
	} );
} );

describe( 'buildPreviewVars', () => {
	const baseValues: TokenValues = {
		...EMPTY_VALUES,
		color: { primary: '#18181b', border: '#e4e4e7' },
		spacing: { md: '1rem' },
	};

	it( 'returns empty CSS when nothing is overridden', () => {
		expect( buildPreviewVars( {}, {}, baseValues ) ).toBe( '' );
	} );

	it( 'pins draft values', () => {
		const css = buildPreviewVars( { color: { primary: '#4f46e5' } }, {}, baseValues );
		expect( css ).toContain( ':root {' );
		expect( css ).toContain( '--blicks-color-primary: #4f46e5;' );
		expect( css ).not.toContain( '--blicks-color-border' );
	} );

	it( 'pins the base value for saved overrides removed from the draft (reset preview)', () => {
		const css = buildPreviewVars( {}, { color: { primary: '#4f46e5' } }, baseValues );
		expect( css ).toContain( '--blicks-color-primary: #18181b;' );
	} );

	it( 'sanitizes names and values like the PHP emitter', () => {
		const css = buildPreviewVars(
			{ color: { primary: '#fff; } body { background: red' }, spacing: { md: '2rem<script>' } },
			{},
			baseValues
		);
		expect( css ).toContain( '--blicks-color-primary: #fff  body  background: red;' );
		expect( css ).toContain( '--blicks-spacing-md: 2remscript;' );
		expect( css ).not.toContain( '<' );
		expect( css ).not.toContain( '{ background' );
	} );

	it( 'skips slugs with no draft and no base value', () => {
		expect( buildPreviewVars( {}, { color: { ghost: '#000000' } }, EMPTY_VALUES ) ).toBe( '' );
	} );
} );

describe( 'kebabProp', () => {
	it( 'matches the PHP TypeRoles::kebabProp transform', () => {
		expect( kebabProp( 'fontSize' ) ).toBe( 'font-size' );
		expect( kebabProp( 'letterSpacing' ) ).toBe( 'letter-spacing' );
		expect( kebabProp( 'textTransform' ) ).toBe( 'text-transform' );
		expect( kebabProp( 'fontFamily' ) ).toBe( 'font-family' );
	} );
} );

describe( 'buildTypeRolePreview', () => {
	const SLOTS = {
		h2: { kind: 'native' as const, stylesPath: [ 'elements', 'h2', 'typography' ] },
		body: { kind: 'native' as const, stylesPath: [ 'typography' ] },
		caption: { kind: 'native' as const, stylesPath: [ 'elements', 'caption', 'typography' ] },
		lead: { kind: 'custom' as const, settingsGroup: [ 'custom', 'blicks', 'typeRoles', 'lead' ] },
	};
	const BASE = { h2: { fontSize: '1.875rem' }, lead: { fontSize: '1.25rem' } };

	it( 'returns nothing when no role was touched', () => {
		expect( buildTypeRolePreview( {}, {}, BASE, SLOTS ) ).toBe( '' );
	} );

	it( 'pins the --blicks-type-* alias for every touched prop', () => {
		const css = buildTypeRolePreview( { lead: { fontSize: '1.5rem' } }, {}, BASE, SLOTS );
		expect( css ).toContain( '--blicks-type-lead-font-size: 1.5rem;' );
	} );

	it( 'also emits an element rule for a native role, at a specificity that beats :where()', () => {
		const css = buildTypeRolePreview( { h2: { fontSize: '2rem' } }, {}, BASE, SLOTS );
		expect( css ).toContain( '--blicks-type-h2-font-size: 2rem;' );
		expect( css ).toContain( ':root h2 {' );
		expect( css ).toContain( 'font-size: 2rem;' );
	} );

	it( 'maps the root and caption slots onto real selectors', () => {
		expect( buildTypeRolePreview( { body: { lineHeight: '1.7' } }, {}, BASE, SLOTS ) ).toContain( ':root body {' );
		expect( buildTypeRolePreview( { caption: { fontSize: '.8rem' } }, {}, BASE, SLOTS ) )
			.toContain( ':root figcaption, :root .wp-element-caption {' );
	} );

	it( 'previews a reset by falling back to the base value of a saved override', () => {
		const css = buildTypeRolePreview( {}, { h2: { fontSize: '2rem' } }, BASE, SLOTS );
		expect( css ).toContain( '--blicks-type-h2-font-size: 1.875rem;' );
	} );

	it( 'strips CSS-breaking characters out of values', () => {
		const css = buildTypeRolePreview( { lead: { fontSize: '1rem; } body { display: none' } }, {}, BASE, SLOTS );
		expect( css ).not.toContain( '}' + ' body' );
		expect( css ).toContain( '--blicks-type-lead-font-size: 1rem  body  display: none;' );
	} );
} );

describe( 'normalizeThemes', () => {
	it( 'defends the envelope and drops unusable rows', () => {
		const state = normalizeThemes( {
			active: 'indigo',
			themes: [
				{ id: 'indigo', name: 'Indigo', builtin: true, edited: 1, tokens: { tokens: { color: { primary: '#4f46e5' } }, breakpoints: { tablet: 900 }, typeRoles: { h1: { fontWeight: '800' } } } },
				{ id: 'no-name' },
				'junk',
			],
		} );

		expect( state.active ).toBe( 'indigo' );
		expect( state.themes ).toHaveLength( 1 );
		expect( state.themes[ 0 ] ).toMatchObject( { id: 'indigo', name: 'Indigo', builtin: true, edited: true } );
		expect( state.themes[ 0 ].tokens.tokens.color ).toEqual( { primary: '#4f46e5' } );
		expect( state.themes[ 0 ].tokens.breakpoints ).toEqual( { tablet: 900 } );
		expect( state.themes[ 0 ].tokens.typeRoles ).toEqual( { h1: { fontWeight: '800' } } );
	} );

	it( 'accepts a bare list and survives malformed payloads', () => {
		expect( normalizeThemes( [ { id: 'a', name: 'A' } ] ).themes ).toHaveLength( 1 );
		expect( normalizeThemes( null ) ).toEqual( { active: '', themes: [] } );
	} );
} );

describe( 'hex8ToCssValue', () => {
	it( 'passes through non-hex8 values', () => {
		expect( hex8ToCssValue( '#4f46e5' ) ).toBe( '#4f46e5' );
		expect( hex8ToCssValue( 'rgba(0, 0, 0, 0.5)' ) ).toBe( 'rgba(0, 0, 0, 0.5)' );
	} );

	it( 'drops the alpha channel when fully opaque', () => {
		expect( hex8ToCssValue( '#4f46e5ff' ) ).toBe( '#4f46e5' );
	} );

	it( 'converts translucent hex8 to rgba', () => {
		expect( hex8ToCssValue( '#4f46e580' ) ).toBe( 'rgba(79, 70, 229, 0.5)' );
	} );
} );
