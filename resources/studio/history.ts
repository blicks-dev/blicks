/**
 * The Studio's own undo.
 *
 * Not a preference — a consequence. `BlockEditorProvider` wraps itself in a sub-registry holding a
 * fresh `core/block-editor`, which is exactly the isolation the Studio wants, but post history
 * lives in `core/editor` and that store is *not* shadowed. Measured in a real editor: with focus
 * inside an isolated mount, the sub-registry's `core/block-editor` has no `undo` action and no
 * `hasUndo` selector, and ⌘Z changes neither the mount nor the post. There is no leak in either
 * direction, and there is also no undo at all until something brings one.
 *
 * Snapshots rather than inverse operations. A mounted tree is small and a session is short, which
 * makes the cheap answer the right one here — and it is precisely the trade the post editor cannot
 * make, which is why core does something more careful.
 *
 * **The whole design question is what counts as one step.** Get it wrong and a drag across the
 * stage costs forty presses to undo, which does not read as a bug so much as undo being broken.
 * Two rules do the work:
 *
 * - A gesture commits on `pointerup`, never per move. That is the caller's responsibility, not
 *   something this file can enforce, and it is the one worth being careful about.
 * - Repeats of the same intent coalesce by key within a short window: a held arrow key, typing into
 *   one block. The window is extended by each repeat, so holding a key for three seconds is still
 *   one step rather than seven.
 *
 * View state — pan, zoom, mode, selection — is never committed. Burying a real change under six
 * pans is the other way undo stops being trusted.
 */

/** How long a repeat of the same intent keeps folding into the step before it, in milliseconds. */
export const COALESCE_WINDOW = 400;

/** How many steps are kept before the oldest falls off. */
export const DEFAULT_DEPTH = 50;

/** One committed step. `value` is the whole mounted tree, snapshotted. */
export interface Step< T > {
	value: T;
	/** What the history panel shows. Written for a person: "Moved Hero band", not "setAttributes". */
	label: string;
	/** `Date.now()` at commit, used for coalescing and for the panel's relative times. */
	at: number;
	/** Applied from an assistant proposal. Labels the step, never the blocks. */
	byAi: boolean;
	/** Repeats sharing this key fold together. `null` never coalesces. */
	coalesceKey: string | null;
}

export interface History< T > {
	steps: Step< T >[];
	/** Index of the step currently showing. Everything after it is redoable. */
	index: number;
	depth: number;
}

export interface CommitOptions {
	label: string;
	byAi?: boolean;
	coalesceKey?: string | null;
	/** Injectable for tests; defaults to now. */
	at?: number;
}

/**
 * Start a history at the mounted tree.
 *
 * The first step is the mount itself, so there is always something to be at. Undo can walk back to
 * it and stops there: unmounting is not an edit, and a canvas that empties itself on one press too
 * many is worse than a disabled button.
 */
export function createHistory< T >( initial: T, depth: number = DEFAULT_DEPTH ): History< T > {
	return {
		steps: [ { value: initial, label: 'Mounted', at: 0, byAi: false, coalesceKey: null } ],
		index: 0,
		depth: Math.max( 1, depth ),
	};
}

/** The tree as it currently stands. */
export function current< T >( history: History< T > ): T {
	return history.steps[ history.index ]!.value;
}

export function canUndo< T >( history: History< T > ): boolean {
	return history.index > 0;
}

export function canRedo< T >( history: History< T > ): boolean {
	return history.index < history.steps.length - 1;
}

/**
 * Record a step.
 *
 * Committing after an undo drops the redo tail, as every editor does: the branch you walked back
 * from is gone the moment you do something else, and offering to redo into it would be offering a
 * tree that no longer follows from what is on screen.
 */
export function commit< T >( history: History< T >, value: T, options: CommitOptions ): History< T > {
	const at = options.at ?? Date.now();
	const coalesceKey = options.coalesceKey ?? null;
	const top = history.steps[ history.index ]!;

	// A repeat of the same intent, soon enough after the last one: replace the step rather than add
	// to it. `at` moves forward so a held key keeps extending its own window instead of breaking
	// into a second step after the first 400ms.
	const coalesces =
		coalesceKey !== null &&
		coalesceKey === top.coalesceKey &&
		at - top.at <= COALESCE_WINDOW &&
		history.index === history.steps.length - 1;

	if ( coalesces ) {
		const steps = history.steps.slice( 0, history.index );
		steps.push( { ...top, value, at } );

		return { ...history, steps };
	}

	const steps = history.steps.slice( 0, history.index + 1 );
	steps.push( {
		value,
		label: options.label,
		at,
		byAi: options.byAi ?? false,
		coalesceKey,
	} );

	// Trim from the front. The mount may eventually fall off the end of a long session, which is
	// fine — what matters is that undo never lands on "nothing mounted", and the oldest kept step
	// is always a real tree.
	while ( steps.length > history.depth ) {
		steps.shift();
	}

	return { ...history, steps, index: steps.length - 1 };
}

/**
 * Replace the tree at the current step without making a new one.
 *
 * For writes nobody made: a block filling in its own `uniqueId` after it lands. Those arrive through
 * the same `onChange` as an edit, and committing one made every insert cost two undos — the first
 * took back an id nobody had asked for, the second the block. Folding it into the step it follows
 * keeps one gesture one step. The redo branch is kept: an id is not a change of direction.
 */
export function amend< T >( history: History< T >, value: T ): History< T > {
	const steps = history.steps.slice();
	steps[ history.index ] = { ...steps[ history.index ]!, value };

	return { ...history, steps };
}

export function undo< T >( history: History< T > ): History< T > {
	return canUndo( history ) ? { ...history, index: history.index - 1 } : history;
}

export function redo< T >( history: History< T > ): History< T > {
	return canRedo( history ) ? { ...history, index: history.index + 1 } : history;
}

/**
 * Go straight to a step, for the history panel's rows.
 *
 * Out-of-range is clamped rather than thrown: the panel renders from the same array, so an index it
 * offers is always valid, and a stale click after a trim should land somewhere sensible instead of
 * taking the Studio down.
 */
export function jumpTo< T >( history: History< T >, index: number ): History< T > {
	const clamped = Math.min( Math.max( index, 0 ), history.steps.length - 1 );

	return clamped === history.index ? history : { ...history, index: clamped };
}
