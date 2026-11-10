import { describe, expect, it } from 'vitest';
import { PART_CONTROLS, SECTION_CONTROLS, STATE_CONTROLS } from '@/engine/schema.gen';
import box from '@/blocks/box/block.json';
import text from '@/blocks/text/block.json';
import button from '@/blocks/button/block.json';
import { ELEMENT, problemOf, setEntry } from './all-settings-model';
import {
	allowedIds,
	BASE,
	COMPOSITES,
	everySide,
	FREE_IDS,
	GROUPS,
	infoOf,
	matchesOf,
	narrower,
	parseInput,
	readTransition,
	resolveTab,
	setCountOf,
	tabCountOf,
	visibleIds,
	withSide,
	writeTransition,
	mootOf,
} from './design-model';

const sides = ( t: string, r = t, b = t, l = r ) => ( { top: t, right: r, bottom: b, left: l } );

// The blicks.dev pricing pattern's Download button, its Plans grid and the Section around them.
const section = {
	'colors.text': { default: { base: 'var(--blicks-color-foreground)' } },
	'typography.fontFamily': { default: { base: 'body' } },
	'spacing.padding': { default: { base: sides( '64px', '48px' ), mobile: sides( '40px', '20px' ) } },
};
const plans = {
	'layout.gridColumns': { default: { base: '1fr 1fr', mobile: '1fr' } },
	'border.width': { default: { base: sides( '1px', '0', '0', '0' ) } },
};
const download = {
	'typography.fontSize': { default: { base: '14.5px' } },
	'colors.background': { default: { base: 'var(--blicks-color-foreground)' }, hover: { base: 'var(--blicks-color-primary)' } },
	'effects.transform': { hover: { base: { translateY: '-1px' } } },
	'effects.transition': { default: { base: 'background 160ms ease-out, transform 160ms ease-out' } },
	'decoration.content': { before: { base: '→' } },
	'meta.look': { fill: 'ink' },
};

const controlsOf = ( json: { supports?: { blicks?: { controls?: string[] } } } ) => json.supports?.blicks?.controls;

describe( 'grouping', () => {
	it( 'places every free engine control exactly once', () => {
		const placed = GROUPS.flatMap( ( g ) => g.ids );
		expect( new Set( placed ).size ).toBe( placed.length );
		expect( [ ...placed ].sort() ).toEqual( [ ...FREE_IDS ].sort() );
	} );

	it( 'covers the 124 free controls and none of the Scene families', () => {
		const free = Object.entries( SECTION_CONTROLS ).filter( ( [ s ] ) => ! s.startsWith( 'scene' ) ).flatMap( ( [ , ids ] ) => ids );
		expect( FREE_IDS ).toHaveLength( new Set( free ).size );
		expect( FREE_IDS.some( ( id ) => id.startsWith( 'scene' ) ) ).toBe( false );
	} );

	it( 'never names a section "Advanced"', () => {
		expect( GROUPS.map( ( g ) => g.title.toLowerCase() ) ).not.toContain( 'advanced' );
	} );

	it( 'keeps effects and motion out of the Design tab', () => {
		const design = GROUPS.filter( ( g ) => g.tab === 'design' ).flatMap( ( g ) => g.ids );
		expect( design.some( ( id ) => id.startsWith( 'effects.' ) || id.startsWith( 'animation.' ) ) ).toBe( false );
	} );
} );

describe( 'filtering', () => {
	it( 'takes the allow-list from block.json, wildcards included', () => {
		const forText = allowedIds( controlsOf( text ) );
		expect( forText.has( 'typography.fontSize' ) ).toBe( true );
		expect( forText.has( 'layout.lineClamp' ) ).toBe( true );
		expect( forText.has( 'layout.gridColumns' ) ).toBe( false );
		expect( allowedIds( controlsOf( box ) ).has( 'layout.gridColumns' ) ).toBe( true );
	} );

	it( 'narrows to what a state may change', () => {
		const reduced = visibleIds( controlsOf( button ), 'reduced', ELEMENT );
		expect( [ ...reduced ].every( ( id ) => STATE_CONTROLS.reduced!.includes( id ) ) ).toBe( true );
		expect( reduced.has( 'typography.fontSize' ) ).toBe( false );
		// A state with no list of its own takes everything the block allows.
		expect( visibleIds( controlsOf( button ), 'hover', ELEMENT ) ).toEqual( allowedIds( controlsOf( button ) ) );
	} );

	it( 'narrows to what a decoration takes', () => {
		const before = visibleIds( controlsOf( box ), 'default', 'before' );
		expect( [ ...before ].every( ( id ) => PART_CONTROLS.includes( id ) ) ).toBe( true );
		expect( before.has( 'columns.breakInside' ) ).toBe( false );
		expect( before.has( 'decoration.content' ) ).toBe( true );
	} );
} );

describe( 'fallback resolution', () => {
	it( 'reads a value set here', () => {
		expect( infoOf( download, 'typography.fontSize', BASE ) ).toEqual( { set: true, value: '14.5px' } );
	} );

	it( 'falls back to the wider screen', () => {
		expect( infoOf( plans, 'layout.gridColumns', { ...BASE, breakpoint: 'tablet' } ) ).toEqual( { set: false, value: '1fr 1fr', why: 'bp', breakpoint: 'base' } );
		expect( infoOf( plans, 'layout.gridColumns', { ...BASE, breakpoint: 'mobile' } ) ).toEqual( { set: true, value: '1fr' } );
	} );

	it( 'falls back to Normal in another state', () => {
		expect( infoOf( download, 'typography.fontSize', { ...BASE, state: 'hover' } ) ).toEqual( { set: false, value: '14.5px', why: 'normal' } );
		expect( infoOf( download, 'colors.background', { ...BASE, state: 'hover' } ).set ).toBe( true );
	} );

	it( 'takes text settings from the nearest parent that sets them', () => {
		const info = infoOf( download, 'colors.text', BASE, [ {}, plans, section ] );
		expect( info ).toEqual( { set: false, value: 'var(--blicks-color-foreground)', why: 'parent', from: 2 } );
		// Only inherited properties: a border is not.
		expect( infoOf( download, 'border.width', BASE, [ plans ] ).value ).toBeUndefined();
		// Not on a decoration.
		expect( infoOf( download, 'colors.text', { ...BASE, part: 'before' }, [ section ] ).why ).toBeUndefined();
	} );

	it( 'marks a value a narrower screen changes', () => {
		expect( narrower( section, 'spacing.padding', BASE ) ).toBe( true );
		expect( narrower( section, 'colors.text', BASE ) ).toBe( false );
		expect( narrower( section, 'spacing.padding', { ...BASE, breakpoint: 'mobile' } ) ).toBe( false );
	} );
} );

describe( 'writes', () => {
	it( 'touch only their id, slot and screen', () => {
		const next = setEntry( download, 'colors.background', 'element', 'hover', 'mobile', 'var(--blicks-color-muted)' );
		expect( next[ 'colors.background' ] ).toEqual( {
			default: { base: 'var(--blicks-color-foreground)' },
			hover: { base: 'var(--blicks-color-primary)', mobile: 'var(--blicks-color-muted)' },
		} );
		// Every other setting is the same object, untouched — the look included.
		for ( const id of Object.keys( download ) ) if ( id !== 'colors.background' ) expect( next[ id ] ).toBe( ( download as Record< string, unknown > )[ id ] );
		expect( download[ 'colors.background' ].hover ).toEqual( { base: 'var(--blicks-color-primary)' } );
	} );

	it( 'remove one value and drop the empty levels', () => {
		const next = setEntry( download, 'effects.transform', 'element', 'hover', 'base', undefined );
		expect( next ).not.toHaveProperty( [ 'effects.transform' ] );
		expect( Object.keys( next ) ).toHaveLength( Object.keys( download ).length - 1 );
	} );

	it( 'change one side of a four-sided value', () => {
		const current = section[ 'spacing.padding' ].default.base;
		expect( withSide( 'spacing.padding', current, 'left', '12px' ) ).toEqual( { ...current, left: '12px' } );
		expect( withSide( 'spacing.padding', undefined, 'top', '8px' ) ).toEqual( sides( '8px', '0', '0', '0' ) );
		expect( everySide( 'border.radius', '6px' ) ).toEqual( { topLeft: '6px', topRight: '6px', bottomRight: '6px', bottomLeft: '6px' } );
	} );

	it( 'add the unit a bare number means', () => {
		expect( parseInput( 'typography.fontSize', '16' ) ).toBe( '16px' );
		expect( parseInput( 'typography.lineHeight', '1.4' ) ).toBe( '1.4' );
		expect( parseInput( 'animation.duration', '300' ) ).toBe( '300ms' );
		expect( parseInput( 'layout.width', '0' ) ).toBe( '0' );
		expect( parseInput( 'layout.width', '' ) ).toBeUndefined();
	} );

	it( 'are refused by the engine validator when the value is wrong', () => {
		expect( problemOf( 'typography.fontSize', 'element', 'default', 'base', '12px; color: red', controlsOf( text ) ) ).toBe( 'invalid-value' );
		expect( problemOf( 'layout.gridColumns', 'element', 'default', 'base', '1fr', controlsOf( text ) ) ).toBe( 'not-allowed' );
		expect( problemOf( 'typography.fontSize', 'element', 'default', 'base', '18px', controlsOf( text ) ) ).toBeNull();
	} );
} );

describe( 'settings edited as parts', () => {
	it( 'change one transform part and keep the rest', () => {
		const t = COMPOSITES[ 'effects.transform' ]!;
		expect( t.read( { translateY: '-1px', skewX: '4deg' } ).translateY ).toBe( '-1px' );
		expect( t.write( { translateY: '-1px', skewX: '4deg' }, 'rotate', '2deg' ) ).toEqual( { translateY: '-1px', skewX: '4deg', rotate: '2deg' } );
		expect( t.write( { rotate: '2deg' }, 'rotate', undefined ) ).toBeUndefined();
		expect( t.read( 'translateY(-1px) scale(1.02)' ) ).toEqual( { translateX: '', translateY: '-1px', rotate: '', scale: '1.02' } );
	} );

	it( 'change one filter function and keep the others in place', () => {
		const f = COMPOSITES[ 'effects.filter' ]!;
		expect( f.write( 'contrast(1.1) blur(2px)', 'blur', '6px' ) ).toBe( 'contrast(1.1) blur(6px)' );
		expect( f.write( 'blur(2px)', 'blur', undefined ) ).toBeUndefined();
		expect( f.write( undefined, 'saturate', '120%' ) ).toBe( 'saturate(120%)' );
	} );

	it( 'edit the first shadow layer only', () => {
		const s = COMPOSITES[ 'effects.boxShadow' ]!;
		const two = [ { x: '0', y: '1px', blur: '2px', color: '#0002' }, { x: '0', y: '8px', blur: '24px' } ];
		expect( s.write( two, 'blur', '4px' ) ).toEqual( [ { ...two[ 0 ], blur: '4px' }, two[ 1 ] ] );
		expect( s.write( 'md', 'y', '4px' ) ).toEqual( { x: '0', y: '4px' } );
	} );

	it( 'read and write a transition by what it changes', () => {
		const parts = readTransition( download[ 'effects.transition' ].default.base );
		expect( parts ).toEqual( { duration: '160ms', ease: 'ease-out', changes: [ 'colours', 'movement' ] } );
		expect( writeTransition( { ...parts, changes: [ 'shadow' ] } ) ).toBe( 'box-shadow 160ms ease-out' );
		expect( writeTransition( { ...parts, changes: [] } ) ).toBeUndefined();
	} );
} );

describe( 'counts and Find', () => {
	it( 'counts settings, not the look', () => {
		expect( setCountOf( download ) ).toBe( 5 );
		expect( tabCountOf( download, 'effects' ) ).toBe( 1 );
		expect( tabCountOf( download, 'motion' ) ).toBe( 1 );
	} );

	it( 'finds values by name, property, state and value', () => {
		expect( matchesOf( plans, 'border' ).map( ( m ) => m.id ) ).toEqual( [ 'border.width' ] );
		expect( matchesOf( download, 'hover' ).map( ( m ) => m.id ) ).toEqual( [ 'colors.background', 'effects.transform' ] );
		expect( matchesOf( section, 'phone' ) ).toEqual( [ expect.objectContaining( { id: 'spacing.padding', breakpoint: 'mobile', text: '40px 20px', label: 'Space · Padding' } ) ] );
		const lines = { 'border.color': { default: { base: sides( 'var(--blicks-color-border)' ) } } };
		expect( matchesOf( lines, 'border' ) ).toEqual( [ expect.objectContaining( { label: 'Border · Color', text: 'border' } ) ] );
		expect( matchesOf( download, '14.5' ) ).toHaveLength( 1 );
		expect( matchesOf( download, '' ) ).toEqual( [] );
	} );
} );

describe( 'the tab a panel opens on', () => {
	it( 'keeps an engine tab as it was', () => {
		expect( resolveTab( 'effects', { quick: true, settings: false } ) ).toBe( 'effects' );
	} );

	it( 'opens a v2 block on Quick when the last block was on its own controls', () => {
		expect( resolveTab( 'quick', { quick: true, settings: false } ) ).toBe( 'quick' );
		expect( resolveTab( 'settings', { quick: true, settings: false } ) ).toBe( 'quick' );
	} );

	it( 'opens a rail block on Settings in place of Quick', () => {
		expect( resolveTab( 'quick', { quick: false, settings: true } ) ).toBe( 'settings' );
	} );

	it( 'falls back to Design when the block has neither', () => {
		expect( resolveTab( 'quick', { quick: false, settings: false } ) ).toBe( 'design' );
	} );
} );

describe( 'mootOf', () => {
	const tree = ( values: Record< string, unknown > ) => ( id: string ) => values[ id ];
	const none = () => undefined;

	it( 'turns flex fields off until the block is flex', () => {
		expect( mootOf( 'layout.flexDirection', none, none )?.kind ).toBe( 'off' );
		expect( mootOf( 'layout.flexDirection', tree( { 'layout.display': 'grid' } ), none )?.kind ).toBe( 'off' );
		expect( mootOf( 'layout.flexDirection', tree( { 'layout.display': 'flex' } ), none ) ).toBeNull();
		expect( mootOf( 'layout.gapRow', tree( { 'layout.display': 'grid' } ), none ) ).toBeNull();
	} );

	it( 'reads a grid child setting off the parent block', () => {
		expect( mootOf( 'gridChild.columnSpan', none, none )?.kind ).toBe( 'off' );
		expect( mootOf( 'gridChild.columnSpan', none, tree( { 'layout.display': 'grid' } ) ) ).toBeNull();
		expect( mootOf( 'flexChild.grow', none, tree( { 'layout.display': 'grid' } ) )?.kind ).toBe( 'off' );
	} );

	it( 'needs a positioned box for offsets, and a real value for the rest', () => {
		expect( mootOf( 'position.inset', tree( { 'position.type': 'static' } ), none )?.kind ).toBe( 'off' );
		expect( mootOf( 'position.inset', tree( { 'position.type': 'absolute' } ), none ) ).toBeNull();
		expect( mootOf( 'animation.target', tree( { 'animation.name': 'bl-rise' } ), none )?.kind ).toBe( 'off' );
		expect( mootOf( 'animation.target', tree( { 'animation.name': 'bl-fill' } ), none ) ).toBeNull();
	} );

	it( 'reports a clash once the overriding value is set', () => {
		expect( mootOf( 'typography.fontSize', none, none ) ).toBeNull();
		expect( mootOf( 'typography.fontSize', tree( { 'typography.role': 'h2' } ), none ) ).toMatchObject( { kind: 'clash', from: 'typography.role' } );
		expect( mootOf( 'columns.columnCount', tree( { 'layout.display': 'block' } ), none ) ).toBeNull();
		expect( mootOf( 'columns.columnCount', tree( { 'layout.display': 'flex' } ), none )?.kind ).toBe( 'clash' );
	} );
} );
