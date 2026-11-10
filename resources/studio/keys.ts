/**
 * What a keystroke means inside the Studio.
 *
 * **⌘Z is the one that matters.** The post editor registers it globally, and the Studio's own
 * history is not core's — so without claiming the key, undo inside a mount walks the POST's history
 * instead. The surface looks isolated while a keystroke edits the document behind it, which is the
 * same class of leak as reaching for the global block store, arriving through the keyboard.
 *
 * Resolution is kept apart from the handler so the decisions are testable without a DOM, and so the
 * one genuinely subtle rule — what counts as "typing" — is written down rather than buried in an
 * event listener.
 */

/** Everything the Studio claims. Anything else is left to the editor underneath. */
export type StudioAction =
	| 'undo'
	| 'redo'
	| 'insert'
	| 'escape'
	| 'cycle-width'
	| 'toggle-left'
	| 'toggle-right'
	| 'group'
	| 'ungroup';

export interface KeyEvent {
	key: string;
	metaKey: boolean;
	ctrlKey: boolean;
	shiftKey: boolean;
	altKey: boolean;
	/**
	 * The physical key, when the event has one. Option rewrites `key` on a Mac — ⌥[ arrives as
	 * "“" — so a combination that includes it is matched on the key's position as well.
	 */
	code?: string;
}

/**
 * The platform's own modifier.
 *
 * Both are accepted rather than sniffing the platform: a Mac user on an external PC keyboard
 * presses Control and means it, and `navigator.platform` has been unreliable for years.
 */
function primary( event: KeyEvent ): boolean {
	return event.metaKey || event.ctrlKey;
}

/**
 * Which Studio action a keystroke means, or `null` to leave it alone.
 *
 * Deliberately small. Every key claimed here is a key the editor underneath no longer gets, so the
 * list is the shortcuts the Studio genuinely owns and nothing speculative.
 */
export function resolveKey( event: KeyEvent ): StudioAction | null {
	if ( 'Escape' === event.key ) {
		return 'escape';
	}

	if ( primary( event ) && 'Enter' === event.key ) {
		return 'insert';
	}

	if ( primary( event ) && event.altKey && ',' === event.key ) {
		return 'cycle-width';
	}

	// The brackets point at the sidebar they toggle: [ the tree on the left, ] the inspector.
	if ( primary( event ) && event.altKey && ( '[' === event.key || 'BracketLeft' === event.code ) ) {
		return 'toggle-left';
	}

	if ( primary( event ) && event.altKey && ( ']' === event.key || 'BracketRight' === event.code ) ) {
		return 'toggle-right';
	}

	// Group the selected layers into a Box, or lift a Box's children out — the design-tool keys.
	if ( primary( event ) && ! event.altKey && 'g' === event.key.toLowerCase() ) {
		return event.shiftKey ? 'ungroup' : 'group';
	}

	if ( primary( event ) && 'z' === event.key.toLowerCase() ) {
		return event.shiftKey ? 'redo' : 'undo';
	}

	// `⌘Y` is redo on Windows keyboards and costs nothing to honour.
	if ( primary( event ) && ! event.altKey && 'y' === event.key.toLowerCase() ) {
		return 'redo';
	}

	return null;
}

/**
 * Whether a keystroke is ordinary typing that must not be intercepted.
 *
 * The subtle part: **⌘Z while typing is still the Studio's undo**, not the browser's text undo, so
 * this does NOT exempt modified keys. What it exempts is the unmodified stream — letters, Enter,
 * Escape's cousins — reaching a field. Getting this backwards either eats people's typing or lets
 * the post's history swallow an edit made in the mount.
 *
 * Escape is the exception in the other direction: inside a text field it should blur or close
 * something, and the Studio only claims it when nothing nearer wants it.
 */
export function isTypingTarget( tag: string, isContentEditable: boolean ): boolean {
	return isContentEditable || 'INPUT' === tag || 'TEXTAREA' === tag || 'SELECT' === tag;
}

/**
 * Whether the Studio should act on this key at all, given where it landed.
 *
 * `insert` is withheld inside a field so ⌘Enter can mean "submit this" where a field defines it;
 * everything else the Studio claims is claimed everywhere, because undo must behave the same
 * wherever the caret happens to be.
 */
export function shouldClaim(
	action: StudioAction,
	tag: string,
	isContentEditable: boolean
): boolean {
	if ( ! isTypingTarget( tag, isContentEditable ) ) {
		return true;
	}

	return 'insert' !== action;
}
