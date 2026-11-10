import { describe, expect, it } from 'vitest';
import {
	COALESCE_WINDOW,
	amend,
	canRedo,
	canUndo,
	commit,
	createHistory,
	current,
	jumpTo,
	redo,
	undo,
} from './history';

/**
 * These pin the rules the prototype settled, not the implementation.
 *
 * Every one of them describes something a person would notice: a drag costing one press, a held key
 * costing one, undo never emptying the canvas. If a rewrite keeps those true it is free to hold the
 * steps however it likes.
 */
describe( 'studio history', () => {
	it( 'starts at the mounted tree, with nothing to undo', () => {
		const history = createHistory( [ 'a' ] );

		expect( current( history ) ).toEqual( [ 'a' ] );
		expect( canUndo( history ) ).toBe( false );
		expect( canRedo( history ) ).toBe( false );
	} );

	it( 'walks back and forward one step at a time', () => {
		let history = createHistory( 0 );
		history = commit( history, 1, { label: 'one', at: 1_000 } );
		history = commit( history, 2, { label: 'two', at: 2_000 } );

		expect( current( history ) ).toBe( 2 );

		history = undo( history );
		expect( current( history ) ).toBe( 1 );

		history = undo( history );
		expect( current( history ) ).toBe( 0 );
		expect( canUndo( history ) ).toBe( false );

		history = redo( history );
		expect( current( history ) ).toBe( 1 );
	} );

	it( 'never undoes past the mount', () => {
		let history = createHistory( 'mounted' );
		history = commit( history, 'edited', { label: 'edit', at: 1_000 } );

		history = undo( undo( undo( history ) ) );

		expect( current( history ) ).toBe( 'mounted' );
		expect( history.index ).toBe( 0 );
	} );

	it( 'folds repeats of one intent into a single step', () => {
		let history = createHistory( 0 );

		// A held arrow key: four commits, each inside the window of the last.
		history = commit( history, 1, { label: 'Nudged', coalesceKey: 'nudge:x', at: 1_000 } );
		history = commit( history, 2, { label: 'Nudged', coalesceKey: 'nudge:x', at: 1_200 } );
		history = commit( history, 3, { label: 'Nudged', coalesceKey: 'nudge:x', at: 1_400 } );
		history = commit( history, 4, { label: 'Nudged', coalesceKey: 'nudge:x', at: 1_600 } );

		expect( current( history ) ).toBe( 4 );
		expect( history.steps ).toHaveLength( 2 );

		history = undo( history );
		expect( current( history ) ).toBe( 0 );
	} );

	it( 'keeps extending the window while the repeats keep coming', () => {
		let history = createHistory( 0 );
		let at = 1_000;

		// Three seconds of holding, in 200ms repeats: still one step, because each repeat moves the
		// window forward. A fixed window measured from the first commit would break this into eight.
		for ( let i = 1; i <= 15; i++ ) {
			at += 200;
			history = commit( history, i, { label: 'Nudged', coalesceKey: 'nudge:x', at } );
		}

		expect( history.steps ).toHaveLength( 2 );
		expect( current( history ) ).toBe( 15 );
	} );

	it( 'starts a new step once the gap is longer than the window', () => {
		let history = createHistory( 0 );
		history = commit( history, 1, { label: 'Typed', coalesceKey: 'text:abc', at: 1_000 } );
		history = commit( history, 2, {
			label: 'Typed',
			coalesceKey: 'text:abc',
			at: 1_000 + COALESCE_WINDOW + 1,
		} );

		expect( history.steps ).toHaveLength( 3 );
	} );

	it( 'does not fold two different intents that happen to be close together', () => {
		let history = createHistory( 0 );
		history = commit( history, 1, { label: 'Nudged', coalesceKey: 'nudge:x', at: 1_000 } );
		history = commit( history, 2, { label: 'Typed', coalesceKey: 'text:abc', at: 1_050 } );

		expect( history.steps ).toHaveLength( 3 );
	} );

	it( 'treats a step with no key as never coalescing', () => {
		let history = createHistory( 0 );
		history = commit( history, 1, { label: 'Moved', at: 1_000 } );
		history = commit( history, 2, { label: 'Moved', at: 1_010 } );

		expect( history.steps ).toHaveLength( 3 );
	} );

	it( 'drops the redo tail once something else is done', () => {
		let history = createHistory( 0 );
		history = commit( history, 1, { label: 'one', at: 1_000 } );
		history = commit( history, 2, { label: 'two', at: 2_000 } );
		history = undo( history );

		expect( canRedo( history ) ).toBe( true );

		history = commit( history, 9, { label: 'elsewhere', at: 3_000 } );

		expect( canRedo( history ) ).toBe( false );
		expect( current( history ) ).toBe( 9 );
	} );

	it( 'does not fold into a step it has already walked back from', () => {
		let history = createHistory( 0 );
		history = commit( history, 1, { label: 'Nudged', coalesceKey: 'nudge:x', at: 1_000 } );
		history = undo( history );

		// Same key, inside the window — but the top of the stack is no longer where we are, so
		// folding would silently rewrite a step that is currently in the redo tail.
		history = commit( history, 5, { label: 'Nudged', coalesceKey: 'nudge:x', at: 1_100 } );

		expect( current( history ) ).toBe( 5 );
		expect( canRedo( history ) ).toBe( false );
	} );

	it( 'keeps the newest steps once it is full, and the oldest kept step is a real tree', () => {
		let history = createHistory( 'mount', 5 );

		for ( let i = 1; i <= 20; i++ ) {
			history = commit( history, `edit-${ i }`, { label: `edit ${ i }`, at: i * 10_000 } );
		}

		expect( history.steps ).toHaveLength( 5 );
		expect( current( history ) ).toBe( 'edit-20' );
		expect( history.steps[ 0 ]!.value ).toBe( 'edit-16' );

		// Walking all the way back lands on a tree, never on nothing.
		for ( let i = 0; i < 10; i++ ) {
			history = undo( history );
		}

		expect( current( history ) ).toBe( 'edit-16' );
	} );

	it( 'labels an assistant step without touching the value', () => {
		let history = createHistory( 0 );
		history = commit( history, 1, { label: 'Applied 3 changes', byAi: true, at: 1_000 } );

		expect( history.steps[ 1 ]!.byAi ).toBe( true );
		expect( current( history ) ).toBe( 1 );
	} );

	it( 'applies a whole proposal as one step', () => {
		let history = createHistory( { blocks: 0 } );
		history = commit( history, { blocks: 7 }, { label: 'Applied 3 changes', byAi: true, at: 1 } );

		history = undo( history );

		expect( current( history ) ).toEqual( { blocks: 0 } );
	} );

	it( 'jumps to a row, clamping one that is no longer there', () => {
		let history = createHistory( 0 );
		history = commit( history, 1, { label: 'one', at: 1_000 } );
		history = commit( history, 2, { label: 'two', at: 2_000 } );

		expect( current( jumpTo( history, 0 ) ) ).toBe( 0 );
		expect( current( jumpTo( history, 99 ) ) ).toBe( 2 );
		expect( current( jumpTo( history, -5 ) ) ).toBe( 0 );
	} );
} );

describe( 'amend', () => {
	it( 'replaces the current tree without adding a step', () => {
		let h = commit( createHistory( 'a' ), 'b', { label: 'Inserted', at: 1_000 } );
		h = amend( h, 'b+id' );

		expect( current( h ) ).toBe( 'b+id' );
		expect( h.index ).toBe( 1 );
		expect( h.steps ).toHaveLength( 2 );
		expect( current( undo( h ) ) ).toBe( 'a' );
	} );

	it( 'keeps the redo branch', () => {
		let h = commit( createHistory( 'a' ), 'b', { label: 'Edited', at: 1_000 } );
		h = undo( h );
		h = amend( h, 'a+id' );

		expect( current( h ) ).toBe( 'a+id' );
		expect( current( redo( h ) ) ).toBe( 'b' );
	} );
} );
