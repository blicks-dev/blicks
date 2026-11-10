import { describe, it, expect } from 'vitest';
import { isTypingTarget, resolveKey, shouldClaim, type KeyEvent } from './keys';

const press = ( key: string, mods: Partial< KeyEvent > = {} ): KeyEvent => ( {
	key,
	metaKey: false,
	ctrlKey: false,
	shiftKey: false,
	altKey: false,
	...mods,
} );

describe( 'resolveKey', () => {
	it( 'claims undo and redo on either modifier', () => {
		expect( resolveKey( press( 'z', { metaKey: true } ) ) ).toBe( 'undo' );
		expect( resolveKey( press( 'z', { ctrlKey: true } ) ) ).toBe( 'undo' );
		expect( resolveKey( press( 'z', { metaKey: true, shiftKey: true } ) ) ).toBe( 'redo' );
		expect( resolveKey( press( 'y', { ctrlKey: true } ) ) ).toBe( 'redo' );
	} );

	it( 'claims group and ungroup', () => {
		expect( resolveKey( press( 'g', { metaKey: true } ) ) ).toBe( 'group' );
		expect( resolveKey( press( 'G', { ctrlKey: true, shiftKey: true } ) ) ).toBe( 'ungroup' );
		expect( resolveKey( press( 'g' ) ) ).toBeNull();
	} );

	it( 'is not confused by a capital Z from the shift key', () => {
		expect( resolveKey( press( 'Z', { metaKey: true, shiftKey: true } ) ) ).toBe( 'redo' );
	} );

	it( 'leaves an unmodified z alone, which is someone typing', () => {
		expect( resolveKey( press( 'z' ) ) ).toBeNull();
	} );

	it( 'claims escape, insert and the width cycle', () => {
		expect( resolveKey( press( 'Escape' ) ) ).toBe( 'escape' );
		expect( resolveKey( press( 'Enter', { metaKey: true } ) ) ).toBe( 'insert' );
		expect( resolveKey( press( ',', { metaKey: true, altKey: true } ) ) ).toBe( 'cycle-width' );
	} );

	it( 'claims the sidebar toggles by key or, under Option, by position', () => {
		expect( resolveKey( press( '[', { metaKey: true, altKey: true } ) ) ).toBe( 'toggle-left' );
		expect( resolveKey( press( ']', { ctrlKey: true, altKey: true } ) ) ).toBe( 'toggle-right' );
		expect( resolveKey( press( '“', { metaKey: true, altKey: true, code: 'BracketLeft' } ) ) ).toBe( 'toggle-left' );
		expect( resolveKey( press( '‘', { metaKey: true, altKey: true, code: 'BracketRight' } ) ) ).toBe( 'toggle-right' );
	} );

	it( 'leaves ⌘[ alone, which is the browser going back', () => {
		expect( resolveKey( press( '[', { metaKey: true } ) ) ).toBeNull();
	} );

	it( 'leaves a plain Enter alone, which is a new paragraph', () => {
		expect( resolveKey( press( 'Enter' ) ) ).toBeNull();
	} );

	/** Every key claimed is a key the editor underneath stops getting, so the list stays small. */
	it( 'claims nothing it has not been told to', () => {
		expect( resolveKey( press( 's', { metaKey: true } ) ) ).toBeNull();
		expect( resolveKey( press( 'a', { metaKey: true } ) ) ).toBeNull();
		expect( resolveKey( press( 'Tab' ) ) ).toBeNull();
	} );
} );

describe( 'isTypingTarget', () => {
	it( 'knows the places text goes', () => {
		expect( isTypingTarget( 'INPUT', false ) ).toBe( true );
		expect( isTypingTarget( 'TEXTAREA', false ) ).toBe( true );
		expect( isTypingTarget( 'SELECT', false ) ).toBe( true );
		expect( isTypingTarget( 'P', true ) ).toBe( true );
		expect( isTypingTarget( 'DIV', false ) ).toBe( false );
	} );
} );

describe( 'shouldClaim', () => {
	/**
	 * The rule that is easy to get backwards. Undo inside a RichText must still be the STUDIO's
	 * undo: the mount has no history of its own in `core/block-editor`, so letting the keystroke
	 * through means the post's history answers it — a keystroke in the Studio editing the document
	 * behind it.
	 */
	it( 'claims undo even while someone is typing', () => {
		expect( shouldClaim( 'undo', 'P', true ) ).toBe( true );
		expect( shouldClaim( 'undo', 'INPUT', false ) ).toBe( true );
		expect( shouldClaim( 'redo', 'TEXTAREA', false ) ).toBe( true );
	} );

	/** ⌘Enter inside a field may mean "submit this", which is nearer than "leave the Studio". */
	it( 'yields insert inside a field, and claims it outside one', () => {
		expect( shouldClaim( 'insert', 'TEXTAREA', false ) ).toBe( false );
		expect( shouldClaim( 'insert', 'DIV', false ) ).toBe( true );
	} );

	it( 'claims escape everywhere, leaving nearer handlers to go first', () => {
		expect( shouldClaim( 'escape', 'INPUT', false ) ).toBe( true );
		expect( shouldClaim( 'escape', 'DIV', false ) ).toBe( true );
	} );
} );
