/**
 * Automatic dialogs in the browser: whether this visitor may see one, and when it opens.
 *
 * The server printed every automatic dialog its server rules let onto the page, each with a
 * `data-bl-auto` attribute that is the same for every visitor (`Printer::autoConfig()`). Everything
 * about the visitor is decided here, so a page cache that serves one HTML to everyone still shows
 * each visitor the right thing:
 *
 *  - logged in or out, by WordPress's `logged-in` body class;
 *  - screen size;
 *  - how often, from `localStorage` (per dialog: last shown, closed, converted) and, for "once per
 *    visit", `sessionStorage`. No cookie, nothing sent anywhere;
 *  - the schedule again, for a page cached before its window closed.
 *
 * Then the triggers: page load + delay, scroll %, about to leave, no activity. The first to fire
 * wins, and at most one automatic dialog opens per page view.
 *
 * Plain functions with their inputs passed in, so they run under test without a browser.
 */

export interface AutoConfig {
	id: number;
	triggers: {
		load: { on: boolean; delay: number };
		scroll: { on: boolean; percent: number };
		exit: { on: boolean };
		idle: { on: boolean; seconds: number };
	};
	visitors: 'all' | 'out' | 'in';
	screens: { desktop: boolean; tablet: boolean; phone: boolean };
	frequency: 'view' | 'session' | 'days' | 'once';
	days: number;
	stopAfterConvert: boolean;
	/** The schedule as milliseconds; 0 is an open end. */
	from: number;
	until: number;
}

/** What one visitor's browser remembers about one dialog. */
export interface Memory {
	shown?: number;
	closed?: number;
	converted?: number;
}

/** The visitor, as this page view sees them. */
export interface Visitor {
	loggedIn: boolean;
	/** The viewport's width in CSS pixels. */
	width: number;
	now: number;
	memory: Memory;
	/** Shown already in this visit (sessionStorage). */
	seenThisVisit: boolean;
}

export const DAY = 86_400_000;

/** Below these widths a screen is a phone, then a tablet: the editor's own preview widths. */
export const PHONE_BELOW = 600;
export const TABLET_BELOW = 1024;

export function screenOf( width: number ): 'phone' | 'tablet' | 'desktop' {
	return width < PHONE_BELOW ? 'phone' : width < TABLET_BELOW ? 'tablet' : 'desktop';
}

/** A dialog's `data-bl-auto`, read; null when it is missing or not one. */
export function readConfig( raw: string | null ): AutoConfig | null {
	if ( ! raw ) return null;

	try {
		const c = JSON.parse( raw ) as AutoConfig;
		return c && Number.isInteger( c.id ) && c.triggers && c.screens ? c : null;
	} catch {
		return null;
	}
}

/** Why this visitor may not see it, or '' when they may. */
export function refusal( c: AutoConfig, v: Visitor ): string {
	if ( 'out' === c.visitors && v.loggedIn ) return 'logged-in';
	if ( 'in' === c.visitors && ! v.loggedIn ) return 'logged-out';
	if ( ! c.screens[ screenOf( v.width ) ] ) return 'screen';
	if ( c.from > 0 && v.now < c.from ) return 'not-yet';
	if ( c.until > 0 && v.now > c.until ) return 'over';
	if ( c.stopAfterConvert && v.memory.converted ) return 'converted';

	switch ( c.frequency ) {
		case 'once':
			return v.memory.shown ? 'seen' : '';
		case 'session':
			return v.seenThisVisit ? 'seen-this-visit' : '';
		case 'days':
			return v.memory.shown && v.now - v.memory.shown < c.days * DAY ? 'seen-recently' : '';
		default:
			return '';
	}
}

/* ------------------------------------------------------------------ memory */

export const memoryKey = ( id: number ): string => `blicks-dialog:${ id }`;

interface StorageLike {
	getItem: ( key: string ) => string | null;
	setItem: ( key: string, value: string ) => void;
}

/** Storage can be missing or throw (private windows, blocked site data): then nothing is remembered. */
export function recall( storage: StorageLike | null, id: number ): Memory {
	try {
		const raw = storage?.getItem( memoryKey( id ) );
		const m = raw ? ( JSON.parse( raw ) as Memory ) : {};
		return m && 'object' === typeof m ? m : {};
	} catch {
		return {};
	}
}

export function remember( storage: StorageLike | null, id: number, event: keyof Memory, now: number ): void {
	try {
		storage?.setItem( memoryKey( id ), JSON.stringify( { ...recall( storage, id ), [ event ]: now } ) );
	} catch {}
}

/* ------------------------------------------------------------------ triggers */

/** Scrolled at least `percent` of what can be scrolled. A page that cannot scroll has read it all. */
export function scrolledPast( percent: number, scrollY: number, viewport: number, height: number ): boolean {
	const room = height - viewport;
	return room <= 0 || ( scrollY / room ) * 100 >= percent;
}

/**
 * About to leave on a phone: a quick scroll back up, after reading some of the page. `samples` are
 * `[ time, scrollY ]`, oldest first.
 */
export function flungUp( samples: [ number, number ][], now: number ): boolean {
	const recent = samples.filter( ( [ t ] ) => now - t <= 300 );
	if ( recent.length < 2 ) return false;
	const top = Math.max( ...recent.map( ( [ , y ] ) => y ) );
	const last = recent[ recent.length - 1 ][ 1 ];
	return top >= 400 && top - last >= 120;
}

/** About to leave on a desktop: the pointer leaves the window through its top edge. */
export const leftThroughTop = ( e: { clientY: number; relatedTarget: unknown } ): boolean => null === e.relatedTarget && e.clientY <= 0;

/**
 * A conversion inside a dialog: a form sent from it, or a link in it followed (not one that opens
 * or closes a dialog).
 */
export function converts( target: EventTarget | null, type: string ): boolean {
	if ( 'submit' === type ) return true;
	const link = ( target as Element | null )?.closest?.( 'a[href]' ) as HTMLAnchorElement | null;
	const href = link?.getAttribute( 'href' ) ?? '';
	return !! link && '' !== href && ! href.startsWith( '#' );
}
