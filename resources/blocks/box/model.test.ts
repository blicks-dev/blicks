import { describe, expect, it } from 'vitest';
import { buildElementStyle, STYLE_MAP } from '@/framework/css/vars';
import { readStyle, writeStyle } from '@/framework/inspector-v2/style-model';
import {
	applyArrange,
	arrangeDefaults,
	isCustomArrange,
	applyExactHeight,
	applyExactWidth,
	applyHeight,
	applyExactLength,
	applyExactRoom,
	applyPhoneRoom,
	applyKind,
	applyLength,
	applyLengthPhoneFull,
	applyThickness,
	applyThicknessPx,
	applyRoom,
	applySticky,
	applyWidth,
	BOX_KINDS,
	DEFAULT_ARRANGE,
	readArrange,
	readHeight,
	readLength,
	readLengthPhoneFull,
	readThickness,
	readThicknessPx,
	readRoom,
	readSticky,
	readWidth,
	withValue,
	type ArrangeOptions,
	type Arrangement,
} from './model';

describe( 'Box model', () => {
	it( 'round-trips every arrangement', () => {
		const options = { ...DEFAULT_ARRANGE, x: 'center' as const, y: 'end' as const, gap: 'lg', cols: 4 };
		for ( const arrangement of [ 'none', 'stack', 'row', 'grid', 'layers' ] as Arrangement[] ) {
			const { tree, layers } = applyArrange( {}, arrangement, options );
			const back = readArrange( tree, layers );
			expect( back.arrangement ).toBe( arrangement );
			if ( arrangement === 'stack' || arrangement === 'row' || arrangement === 'layers' ) {
				expect( [ back.options.x, back.options.y ] ).toEqual( [ 'center', 'end' ] );
			}
			if ( arrangement === 'grid' ) expect( back.options.cols ).toBe( 4 );
		}
	} );

	it( 'round-trips every second-level arrange option', () => {
		const cases: Array< [ Arrangement, Partial< ArrangeOptions > ] > = [
			[ 'stack', { rev: true, spread: 'between', stretch: 'yes', gap: 'xl' } ],
			[ 'row', { rev: true, spread: 'evenly', stretch: 'base', wrap: false, gapC: '2xl', stackPhone: true } ],
			// Stretch replaces the cross-axis placement, so only the main-axis one survives it.
			[ 'row', { stretch: 'yes', x: 'center' } ],
			[ 'grid', { gmode: 'fit', minW: 240, rowsEq: true, flow: 'dense', gapC: 'sm', colsPhone: false } ],
			[ 'grid', { cols: 5, tabCols: 2, flow: 'column', stretch: 'no', x: 'center', y: 'end' } ],
			[ 'layers', { stretch: 'yes' } ],
		];
		for ( const [ arrangement, patch ] of cases ) {
			const options = { ...DEFAULT_ARRANGE, ...patch };
			const { tree, layers } = applyArrange( {}, arrangement, options );
			const back = readArrange( tree, layers );
			expect( back.arrangement ).toBe( arrangement );
			for ( const [ k, v ] of Object.entries( patch ) ) expect( back.options[ k as keyof ArrangeOptions ], `${ arrangement }.${ k }` ).toEqual( v );
		}
	} );

	it( 'round-trips an exact space between and writes it as a length', () => {
		const { tree } = applyArrange( {}, 'row', { ...DEFAULT_ARRANGE, gap: '18px', gapC: '2.5rem' } );
		expect( readArrange( tree, false ).options ).toMatchObject( { gap: '18px', gapC: '2.5rem' } );
		expect( buildElementStyle( tree ).vars ).toMatchObject( { '--bl-gap-c': '18px', '--bl-gap-r': '2.5rem' } );
	} );

	it( 'writes the second-level options as engine values', () => {
		const row = buildElementStyle( applyArrange( {}, 'row', { ...DEFAULT_ARRANGE, rev: true, wrap: false, gapC: '2xl', stackPhone: true } ).tree );
		expect( row.vars ).toMatchObject( { '--bl-fd': 'row-reverse', '--bl-fw': 'nowrap', '--bl-gap-r': 'var(--blicks-spacing-2xl)', '--bl-gap-c': 'var(--blicks-spacing-md)', '--bl-fd-mob': 'column' } );
		const grid = buildElementStyle( applyArrange( {}, 'grid', { ...DEFAULT_ARRANGE, gmode: 'fit', minW: 240, rowsEq: true, flow: 'dense', tabCols: 2 } ).tree );
		expect( grid.vars ).toMatchObject( { '--bl-cols': 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', '--bl-gar': '1fr', '--bl-gaf': 'row dense' } );
		const counted = buildElementStyle( applyArrange( {}, 'grid', { ...DEFAULT_ARRANGE, cols: 4, tabCols: 2 } ).tree );
		expect( counted.vars[ '--bl-cols-tab' ] ).toBe( 'repeat(2, minmax(0, 1fr))' );
	} );

	it( 'keeps grid cells filled by default, so cards stay full width', () => {
		const { vars } = buildElementStyle( applyArrange( {}, 'grid', arrangeDefaults( 'grid' ) ).tree );
		expect( vars[ '--bl-ji' ] ).toBeUndefined();
		expect( isCustomArrange( 'grid', arrangeDefaults( 'grid' ) ) ).toBe( false );
	} );

	it( 'clears the previous arrangement instead of mixing modes', () => {
		const grid = applyArrange( {}, 'grid', DEFAULT_ARRANGE ).tree;
		const { tree } = applyArrange( grid, 'stack', DEFAULT_ARRANGE );
		expect( tree[ 'layout.gridColumns' ] ).toBeUndefined();
		expect( tree[ 'layout.gapColumn' ] ).toBeUndefined();
	} );

	it( 'collapses a grid to one column on phones', () => {
		const { tree } = applyArrange( {}, 'grid', { ...DEFAULT_ARRANGE, cols: 3, colsPhone: true } );
		const { vars } = buildElementStyle( tree );
		expect( vars[ '--bl-cols' ] ).toBe( 'repeat(3, minmax(0, 1fr))' );
		expect( vars[ '--bl-cols-mob' ] ).toBe( 'repeat(1, minmax(0, 1fr))' );
		expect( readArrange( tree, false ).options.colsPhone ).toBe( true );
	} );

	it( 'round-trips width, height and sticky', () => {
		for ( const w of [ 'fit', 'prose', 'content', 'fill' ] as const ) expect( readWidth( applyWidth( {}, w ) ) ).toBe( w );
		for ( const h of [ 'auto', 'half', 'full', 'square' ] as const ) expect( readHeight( applyHeight( {}, h ) ) ).toBe( h );
		expect( readSticky( applySticky( {}, true ) ) ).toBe( true );
		expect( applySticky( applySticky( {}, true ), false ) ).toEqual( {} );
	} );

	it( 'writes a typed width and height, and reads them as no preset', () => {
		const tree = applyExactHeight( applyExactWidth( applyHeight( {}, 'square' ), '640px' ), '25rem' );
		expect( readWidth( tree ) ).toBe( '' );
		expect( readHeight( tree ) ).toBe( '' );
		expect( buildElementStyle( tree ).vars ).toMatchObject( { '--bl-w': '640px', '--bl-maw': '100%', '--bl-mih': '25rem' } );
		// A preset picked afterwards replaces the typed value.
		expect( readWidth( applyWidth( tree, 'fill' ) ) ).toBe( 'fill' );
		expect( readHeight( applyHeight( tree, 'auto' ) ) ).toBe( 'auto' );
	} );

	it( 'tunes a divider past its steps', () => {
		const tree = applyLengthPhoneFull( applyExactLength( applyThicknessPx( applyKind( 'divider' ).blicks, 6 ), '40%' ), true );
		expect( [ readThickness( tree ), readThicknessPx( tree ) ] ).toEqual( [ '', 6 ] );
		expect( [ readLength( tree ), readLengthPhoneFull( tree ) ] ).toEqual( [ '', true ] );
		expect( buildElementStyle( tree ).vars ).toMatchObject( { '--bl-h': '6px', '--bl-w': '40%', '--bl-w-mob': '100%' } );
		// A step brings the preset back without dropping the phone rule.
		const short = applyLength( applyThickness( tree, 'thick' ), 'short' );
		expect( [ readThickness( short ), readLength( short ), readLengthPhoneFull( short ) ] ).toEqual( [ 'thick', 'short', true ] );
	} );

	it( 'gives a divider its space, placement and round ends', () => {
		const opts = { kind: 'divider' };
		const base = applyKind( 'divider' ).blicks;
		expect( buildElementStyle( base ).vars ).toMatchObject( { '--bl-mt': '16px', '--bl-mb': '16px' } );
		const { look } = readStyle( base, opts );
		const tree = writeStyle( base, { ...look, dalign: 'center', radius: 'full' }, opts );
		expect( buildElementStyle( tree ).vars ).toMatchObject( { '--bl-ml': 'auto', '--bl-mr': 'auto', '--bl-mt': '16px', '--bl-brtl': 'var(--blicks-radius-full)' } );
		expect( readStyle( tree, opts ) ).toMatchObject( { look: { dalign: 'center', radius: 'full' }, stale: false } );
	} );

	it( 'halves a spacer on phones', () => {
		const tree = applyRoom( {}, 'xl', true );
		expect( buildElementStyle( tree ).vars ).toMatchObject( { '--bl-h': '4rem', '--bl-h-mob': '2rem' } );
		expect( readRoom( tree ) ).toMatchObject( { room: 'xl', lessPhone: true, phone: 'half' } );
	} );

	it( 'takes a typed room, with its own phone rule', () => {
		const half = applyPhoneRoom( applyExactRoom( {}, '40px' ), 'half' );
		expect( readRoom( half ) ).toMatchObject( { room: '', height: '40px', phone: 'half', phoneHeight: '20px' } );
		// Half follows a new height; a typed phone value stays put.
		expect( readRoom( applyExactRoom( half, '3rem' ) ) ).toMatchObject( { phone: 'half', phoneHeight: '1.5rem' } );
		const typed = applyPhoneRoom( half, '12px' );
		expect( readRoom( applyExactRoom( typed, '80px' ) ) ).toMatchObject( { phone: '', phoneHeight: '12px' } );
		expect( buildElementStyle( applyPhoneRoom( half, 'none' ) ).vars ).toMatchObject( { '--bl-h': '40px', '--bl-h-mob': '0' } );
		expect( readRoom( applyPhoneRoom( half, 'same' ) ).phone ).toBe( 'same' );
	} );

	it( 'gives every kind a look the engine renders without dropping a value', () => {
		for ( const kind of BOX_KINDS ) {
			const { blicks } = applyKind( kind );
			const { vars } = buildElementStyle( blicks );
			// Every single-value control a kind sets must reach its own var; a missing one means a
			// token slug the engine does not know, which would silently do nothing on the page.
			for ( const id of Object.keys( blicks ) ) {
				const rule = STYLE_MAP.find( ( r ) => r.attr === id );
				if ( rule?.kind !== 'single' ) continue;
				expect( vars[ rule.v ], `${ kind }: ${ id }` ).toBeTruthy();
			}
		}
	} );

	it( 'resolves a card to tokens', () => {
		const { vars } = buildElementStyle( applyKind( 'card' ).blicks );
		expect( vars ).toMatchObject( {
			'--bl-bg': 'var(--blicks-color-background)',
			'--bl-pt': 'var(--blicks-spacing-xl)',
			'--bl-brtl': 'var(--blicks-radius-lg)',
			'--bl-bwt': '1px',
			'--bl-d': 'flex',
			'--bl-gap-r': 'var(--blicks-spacing-md)',
		} );
		expect( applyKind( 'card' ).tag ).toBe( 'article' );
	} );

	it( 'prunes empty branches when a value is cleared', () => {
		expect( withValue( withValue( {}, 'layout.width', '1px' ), 'layout.width', undefined ) ).toEqual( {} );
	} );
} );
