import { describe, expect, it } from 'vitest';
import '@/framework/icons/bootstrap';
import { colourValue, iconClass, itemClasses, itemVars, listClasses, listTag, listVars } from './model';

describe( 'List classes', () => {
	it( 'draws dots by default', () => {
		expect( listClasses( {} ) ).toEqual( [ 'bl-list--bullets', 'bl-list--m-dot' ] );
		expect( listTag( {} ) ).toBe( 'ul' );
	} );

	it( 'numbers as an <ol>, outline numbering included', () => {
		expect( listTag( { kind: 'numbers' } ) ).toBe( 'ol' );
		expect( listClasses( { kind: 'numbers', numbering: '1.1' } ) ).toContain( 'bl-list--n-1-1' );
	} );

	it( 'names an icon list by its icon, resolving aliases, and draws something behind it only for icons and numbers', () => {
		expect( listClasses( { kind: 'icons', icon: 'bolt', markerBehind: 'tint' } ) ).toEqual( [ 'bl-list--icons', 'bl-li-ic-zap', 'bl-list--b-tint' ] );
		expect( listClasses( { kind: 'bullets', markerBehind: 'tint' } ) ).not.toContain( 'bl-list--b-tint' );
	} );

	it( 'keeps separators to a row and lines out of one', () => {
		expect( listClasses( { arrange: 'row', separator: 'dot', lines: true } ) ).toEqual( [ 'bl-list--bullets', 'bl-list--m-dot', 'bl-list--row', 'bl-list--sep-dot' ] );
		expect( listClasses( { separator: 'dot', lines: true } ) ).toContain( 'bl-list--lines' );
		expect( listClasses( { separator: 'dot' } ) ).not.toContain( 'bl-list--sep-dot' );
	} );

	it( 'holds columns to two to four', () => {
		expect( listClasses( { arrange: 'cols', columns: 9 } ) ).toContain( 'bl-list--cols-4' );
		expect( listClasses( { arrange: 'cols' } ) ).toContain( 'bl-list--cols-2' );
	} );

	it( 'drops values it does not know', () => {
		expect( listClasses( { kind: 'stars', bullet: 'blob', gap: 'huge', look: 'glass' } ) ).toEqual( [ 'bl-list--bullets', 'bl-list--m-dot' ] );
	} );

	it( 'gives an inner list nothing of its own: it inherits the outer list', () => {
		expect( listClasses( { nested: true, kind: 'icons', look: 'cards' } ) ).toEqual( [] );
		expect( listVars( { nested: true, markerColour: 'primary' } ) ).toEqual( {} );
	} );
} );

describe( 'List custom properties', () => {
	it( 'writes only what differs from the stylesheet', () => {
		expect( listVars( { markerSize: 100, markerSpace: 10 } ) ).toEqual( {} );
		expect( listVars( { markerColour: 'primary', markerSize: 150, markerSpace: 16 } ) ).toEqual( {
			'--bl-li-mc': 'var(--blicks-color-primary)', '--bl-li-ms': '1.5', '--bl-li-mg': '16px',
		} );
	} );

	it( 'writes card fill and corners only for cards', () => {
		expect( listVars( { look: 'cards', cardFill: 'accent', cardCorners: 'lg' } ) ).toEqual( { '--bl-li-card': 'var(--blicks-color-accent)', '--bl-li-cr': '16px' } );
		expect( listVars( { look: 'cards', cardFill: 'background' } ) ).toEqual( { '--bl-li-card': 'var(--blicks-color-background)', '--bl-li-cb': '1px solid var(--blicks-color-border)' } );
		expect( listVars( { cardFill: 'accent' } ) ).toEqual( {} );
	} );

	it( 'takes theme slugs and plain colours, nothing else', () => {
		expect( colourValue( 'muted-foreground' ) ).toBe( 'var(--blicks-color-muted-foreground)' );
		expect( colourValue( '#1f2937' ) ).toBe( '#1f2937' );
		expect( colourValue( 'red;background:url(x)' ) ).toBe( '' );
	} );
} );

describe( 'List item', () => {
	it( 'saves its state and its own icon as classes, and its marker colour as a property', () => {
		expect( itemClasses( { state: 'out', icon: 'star' } ) ).toEqual( [ 'bl-list-item--out', 'bl-li-ic-star' ] );
		expect( itemClasses( { state: 'gone' } ) ).toEqual( [] );
		expect( itemVars( { markerColour: 'destructive' } ) ).toEqual( { '--bl-li-mc': 'var(--blicks-color-destructive)' } );
	} );

	it( 'falls back to the registry’s star for an unknown icon, as the Icon block does', () => {
		expect( iconClass( 'no-such-icon' ) ).toBe( 'bl-li-ic-star' );
	} );
} );

describe( 'List additions', () => {
	it( 'marks a titled list, crossing out done items, and inner levels — only when set', () => {
		expect( listClasses( { content: 'titled', strikeDone: true } ) ).toEqual( expect.arrayContaining( [ 'bl-list--titled', 'bl-list--strike-done' ] ) );
		expect( listClasses( { kind: 'numbers', innerMarkerColour: 'muted-foreground', innerMono: true } ) ).toEqual( expect.arrayContaining( [ 'bl-list--inner-mc', 'bl-list--inner-mono' ] ) );
		expect( listVars( { innerMarkerColour: 'muted-foreground' } ) ).toEqual( { '--bl-li-mc2': 'var(--blicks-color-muted-foreground)' } );
	} );

	it( 'sets mono numbers only on a numbered list', () => {
		expect( listClasses( { kind: 'bullets', innerMono: true } ) ).not.toContain( 'bl-list--inner-mono' );
	} );

	it( 'knows the Done state', () => {
		expect( itemClasses( { state: 'done' } ) ).toEqual( [ 'bl-list-item--done' ] );
	} );
} );
