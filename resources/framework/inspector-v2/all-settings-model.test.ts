import { describe, expect, it } from 'vitest';
import { EMPTY_LOOK, writeStyle } from './style-model';
import { addableOf, asLength, CHOICES, doorFor, quickSourceOf, entriesOf, hiddenFor, hiddenOf, kindOf, msOf, timeOf, labelOf, problemOf, propertyOf, setEntry, slotKey, splitSlot, textOf, valueOf } from './all-settings-model';

const conic = {
	'position.type': { default: { base: 'relative' }, before: { base: 'absolute' } },
	'spacing.padding': { default: { base: { top: '18px', right: '30px', bottom: '18px', left: '30px' }, mobile: '12px' } },
	'effects.transform': { hover: { base: 'translateY(-1px)' } },
	'effects.outline': { 'before:focus': { base: '2px solid #fff' } },
	'meta.look': { fill: 'accent' },
};

describe( 'slots', () => {
	it( 'round-trips parts and states', () => {
		for ( const [ part, state, key ] of [ [ 'element', 'default', 'default' ], [ 'element', 'hover', 'hover' ], [ 'before', 'default', 'before' ], [ 'after', 'focus', 'after:focus' ] ] ) {
			expect( slotKey( part, state ) ).toBe( key );
			expect( splitSlot( key ) ).toEqual( [ part, state ] );
		}
	} );
} );

describe( 'entriesOf', () => {
	it( 'lists every stored value and skips the look', () => {
		const list = entriesOf( conic );
		expect( list ).toHaveLength( 6 );
		expect( list ).toContainEqual( { id: 'position.type', part: 'before', state: 'default', breakpoint: 'base', value: 'absolute' } );
		expect( list ).toContainEqual( { id: 'effects.outline', part: 'before', state: 'focus', breakpoint: 'base', value: '2px solid #fff' } );
		expect( list.some( ( e ) => e.id === 'meta.look' ) ).toBe( false );
	} );
} );

describe( 'setEntry', () => {
	it( 'sets one value and leaves the rest', () => {
		const next = setEntry( conic, 'effects.transform', 'element', 'active', 'base', 'scale(.98)' );
		expect( next[ 'effects.transform' ] ).toEqual( { hover: { base: 'translateY(-1px)' }, active: { base: 'scale(.98)' } } );
		expect( next[ 'spacing.padding' ] ).toBe( conic[ 'spacing.padding' ] );
	} );

	it( 'drops empty levels on remove', () => {
		const next = setEntry( conic, 'effects.transform', 'element', 'hover', 'base', undefined );
		expect( 'effects.transform' in next ).toBe( false );
		const pad = setEntry( conic, 'spacing.padding', 'element', 'default', 'mobile', undefined );
		expect( pad[ 'spacing.padding' ] ).toEqual( { default: { base: conic[ 'spacing.padding' ].default.base } } );
	} );
} );

describe( 'text and values', () => {
	it( 'writes sides as shorthand and reads shorthand back', () => {
		expect( textOf( 'spacing.padding', conic[ 'spacing.padding' ].default.base ) ).toBe( '18px 30px 18px 30px' );
		expect( valueOf( 'spacing.padding', '18px 30px' ) ).toEqual( { top: '18px', right: '30px', bottom: '18px', left: '30px' } );
		expect( valueOf( 'spacing.padding', 'md' ) ).toBe( 'md' );
	} );

	it( 'reads elliptical corners', () => {
		expect( valueOf( 'border.radius', '4% 8% / 6%' ) ).toEqual( { topLeft: '4% 6%', topRight: '8% 6%', bottomRight: '4% 6%', bottomLeft: '8% 6%' } );
	} );

	it( 'round-trips layered shadows', () => {
		const css = '0 8px 24px -12px rgba(0, 0, 0, .4), inset 0 1px 0 #fff';
		const layers = valueOf( 'effects.boxShadow', css );
		expect( layers ).toEqual( [ { x: '0', y: '8px', blur: '24px', spread: '-12px', color: 'rgba(0, 0, 0, .4)' }, { x: '0', y: '1px', blur: '0', color: '#fff', inset: true } ] );
		expect( valueOf( 'effects.boxShadow', textOf( 'effects.boxShadow', layers ) ) ).toEqual( layers );
		expect( valueOf( 'effects.boxShadow', 'md' ) ).toBe( 'md' );
		expect( valueOf( 'effects.textShadow', '0 0 8px #0ff, 0 0 2px #fff' ) ).toEqual( [ { x: '0', y: '0', blur: '8px', color: '#0ff' }, { x: '0', y: '0', blur: '2px', color: '#fff' } ] );
	} );

	it( 'keeps CSS as text, structured values as JSON, empty as remove', () => {
		expect( valueOf( 'background.gradient', 'conic-gradient(red, blue)' ) ).toBe( 'conic-gradient(red, blue)' );
		expect( valueOf( 'background.layers', '[{"type":"gradient","value":"linear-gradient(red, blue)"}]' ) ).toEqual( [ { type: 'gradient', value: 'linear-gradient(red, blue)' } ] );
		expect( valueOf( 'background.layers', '[{oops' ) ).toBeNull();
		expect( valueOf( 'colors.text', '  ' ) ).toBeUndefined();
	} );
} );

describe( 'names and checks', () => {
	it( 'names a control plainly and by its CSS property', () => {
		expect( labelOf( 'layout.alignItems' ) ).toBe( 'Align items' );
		expect( propertyOf( 'spacing.padding' ) ).toBe( 'padding' );
	} );

	it( 'reports what the engine would refuse', () => {
		expect( problemOf( 'colors.text', 'element', 'default', 'base', '#fff' ) ).toBeNull();
		expect( problemOf( 'colors.text', 'element', 'default', 'base', 'url(javascript:x)' ) ).toBe( 'invalid-value' );
		expect( problemOf( 'colors.text', 'element', 'default', 'base', '#fff', [ 'spacing.*' ] ) ).toBe( 'not-allowed' );
	} );

	it( 'offers only what a part can take on a part', () => {
		const onElement = addableOf( undefined, 'element' );
		const onPart = addableOf( undefined, 'before' );
		expect( onPart.length ).toBeLessThan( onElement.length );
		expect( addableOf( [ 'spacing.*' ], 'element' ).every( ( id ) => id.startsWith( 'spacing.' ) ) ).toBe( true );
	} );
} );

describe( 'hidden values', () => {
	it( 'counts what the look does not reproduce, and sorts it by section', () => {
		const tree = {
			'colors.background': { default: { base: 'accent' } },
			'background.gradient': { default: { base: 'linear-gradient(red, blue)' } },
			'effects.transform': { hover: { base: 'translateY(-2px)' } },
			'spacing.padding': { default: { mobile: '8px' } },
		};
		const hidden = hiddenOf( tree, { default: { 'colors.background': 'accent' } } );
		expect( hidden.map( ( e ) => e.id ) ).toEqual( [ 'background.gradient', 'effects.transform', 'spacing.padding' ] );
		expect( hiddenFor( hidden, 'fill' ).map( ( e ) => e.id ) ).toEqual( [ 'background.gradient' ] );
		expect( hiddenFor( hidden, 'hover' ).map( ( e ) => e.id ) ).toEqual( [ 'effects.transform' ] );
		expect( hiddenFor( hidden, 'space' ).map( ( e ) => e.breakpoint ) ).toEqual( [ 'mobile' ] );
		expect( hiddenFor( hidden, 'depth' ) ).toEqual( [] );
	} );
} );

describe( 'kinds', () => {
	it( 'picks an editor for each kind of value', () => {
		expect( kindOf( 'colors.text' ) ).toBe( 'colour' );
		expect( kindOf( 'spacing.padding' ) ).toBe( 'sides' );
		expect( kindOf( 'border.radius' ) ).toBe( 'sides' );
		expect( kindOf( 'layout.alignItems' ) ).toBe( 'choice' );
		expect( kindOf( 'layout.gapColumn' ) ).toBe( 'length' );
		expect( kindOf( 'typography.fontSize' ) ).toBe( 'length' );
		expect( kindOf( 'animation.duration' ) ).toBe( 'motion' );
		expect( kindOf( 'effects.boxShadow' ) ).toBe( 'shadow' );
		expect( kindOf( 'effects.textShadow' ) ).toBe( 'shadow' );
		expect( kindOf( 'background.gradient' ) ).toBe( 'css' );
		expect( kindOf( 'effects.transform' ) ).toBe( 'css' );
	} );

	it( 'every keyword list names a real setting', () => {
		for ( const id of Object.keys( CHOICES ) ) expect( addableOf( undefined, 'element' ) ).toContain( id );
	} );

	it( 'reads and writes lengths and times', () => {
		expect( asLength( '18' ) ).toBe( '18px' );
		expect( asLength( '0' ) ).toBe( '0' );
		expect( asLength( '-0.02em' ) ).toBe( '-0.02em' );
		expect( msOf( '4s' ) ).toBe( 4000 );
		expect( msOf( '.35s' ) ).toBe( 350 );
		expect( msOf( '600ms' ) ).toBe( 600 );
		expect( msOf( 'var(--x)' ) ).toBeNull();
		expect( timeOf( 4000 ) ).toBe( '4s' );
		expect( timeOf( 650 ) ).toBe( '650ms' );
	} );
} );

describe( 'doors into the design panel', () => {
	const tree = {
		'colors.background': { default: { base: 'accent' } },
		'background.gradient': { default: { base: 'linear-gradient(red, blue)' } },
		'spacing.padding': { default: { mobile: '8px' } },
	};
	const hidden = hiddenOf( tree, { default: { 'colors.background': 'accent' } } );

	it( 'opens on the value the quick choices cannot show, in its own slot', () => {
		expect( doorFor( 'fill', hidden ) ).toEqual( { id: 'background.gradient', part: 'element', state: 'default', breakpoint: 'base' } );
		expect( doorFor( 'space', hidden ) ).toEqual( { id: 'spacing.padding', part: 'element', state: 'default', breakpoint: 'mobile' } );
	} );

	it( 'opens on the section\'s own setting when nothing is hidden', () => {
		expect( doorFor( 'corners', hidden ) ).toEqual( { id: 'border.radius', part: 'element', state: 'default', breakpoint: 'base' } );
		expect( doorFor( 'entrance', [] )?.id ).toBe( 'animation.name' );
	} );

	it( 'carries the state, so the hover and click doors land on those states', () => {
		expect( doorFor( 'hover', [] ) ).toMatchObject( { id: 'colors.background', state: 'hover' } );
		expect( doorFor( 'press', [] ) ).toMatchObject( { state: 'active' } );
	} );

	it( 'has no door for a section with no engine row', () => {
		expect( doorFor( 'width', [] ) ).toBeNull();
	} );
} );

describe( 'values Quick wrote', () => {
	const opts = { kind: 'button', linked: true };
	const base = { part: 'element', state: 'default', breakpoint: 'base' };
	const tree = writeStyle( {}, { ...EMPTY_LOOK, radius: 'full', hover: 'lift' }, opts );

	it( 'names the section a Quick choice wrote the value from', () => {
		expect( quickSourceOf( tree, opts, 'border.radius', base ) ).toBe( 'Corners' );
		expect( quickSourceOf( tree, opts, 'effects.transform', { ...base, state: 'hover' } ) ).toBe( 'On hover' );
	} );

	it( 'stops claiming a value once it was changed by hand', () => {
		const edited = { ...tree, 'border.radius': { default: { base: { topLeft: '3px', topRight: '3px', bottomRight: '3px', bottomLeft: '3px' } } } };
		expect( quickSourceOf( edited, opts, 'border.radius', base ) ).toBeNull();
	} );

	it( 'says nothing for a smaller screen, a part, or a tree Quick never wrote', () => {
		expect( quickSourceOf( tree, opts, 'border.radius', { ...base, breakpoint: 'mobile' } ) ).toBeNull();
		expect( quickSourceOf( tree, opts, 'border.radius', { ...base, part: 'before' } ) ).toBeNull();
		expect( quickSourceOf( { 'border.radius': tree[ 'border.radius' ] }, opts, 'border.radius', base ) ).toBeNull();
	} );
} );
