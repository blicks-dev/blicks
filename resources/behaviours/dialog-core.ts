/**
 * What a `blicks/dialog` needs that the browser does not do yet, as plain functions on one dialog.
 * The `dialog` behaviour (./dialog.ts) calls them from the dialog's Interactivity directives; they
 * import nothing, so they are tested without the Interactivity runtime.
 *
 * The saved markup is the platform's own: a Button opens a dialog with `commandfor` and
 * `command="show-modal"`, and the dialog closes on outside clicks with `closedby="any"`. Where the
 * browser has both, a dialog works with no script. This fills in the rest:
 *
 * - Invoker commands (`commandfor` / `command`) and `closedby`, where the browser lacks them.
 * - A dialog without **Blocks the page** opens with `show()`, not `showModal()`, however a Button
 *   asks: the native `command` event is cancelled and the dialog opened in place. It is rendered
 *   with `popover="manual"` (Blicks\Blocks\Dialogs), and shown as a popover too, so it is in the
 *   top layer: `position: fixed` alone would pin it to a transformed ancestor, not the screen.
 * - Links to `#dialog-<address>`, and a page loaded with that address.
 * - A Loop card whose Loop opens a dialog: the card's link opens the dialog with that item's
 *   blocks, rendered on the server into a `<template>` in the card (LoopRenderer). With the Loop's
 *   "Put the item in the address", `?item=<key>` is pushed while it is open, Back closes it, and a
 *   page loaded with it opens that item.
 * - Focus back to whatever opened it, for every way of opening.
 * - `bl:dialog-open` / `bl:dialog-close` events, so a companion plugin hears when one opens and
 *   closes, and why.
 */

export type Source = 'click' | 'hash' | 'loop' | 'auto' | 'api';
export type Reason = 'button' | 'esc' | 'outside' | 'back' | 'api';

export interface OpenOptions {
	source?: Source;
	/** What to give focus back to on close. Defaults to the element focused when it opened. */
	opener?: Element | null;
}

export const supports = {
	commands: () => typeof HTMLButtonElement !== 'undefined' && 'commandForElement' in HTMLButtonElement.prototype,
	closedBy: () => typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype,
};

const openers = new WeakMap< HTMLDialogElement, Element | null >();
const reasons = new WeakMap< HTMLDialogElement, Reason >();
const sources = new WeakMap< HTMLDialogElement, Source >();
/** Dialogs that pushed `?item=` onto the history when they opened. */
const pushed = new WeakSet< HTMLDialogElement >();

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const isBlicksDialog = ( el: unknown ): el is HTMLDialogElement =>
	el instanceof HTMLDialogElement && el.classList.contains( 'bl-dialog' );

export function find( id: string ): HTMLDialogElement | null {
	const el = id ? document.getElementById( id ) : null;
	return isBlicksDialog( el ) ? el : null;
}

/** Open a dialog, modal or not as it was saved, and say so. */
export function open( dialog: HTMLDialogElement, { source = 'api', opener }: OpenOptions = {} ): void {
	if ( dialog.open ) return;
	openers.set( dialog, opener ?? document.activeElement );
	sources.set( dialog, source );
	reasons.delete( dialog );
	const modal = dialog.classList.contains( 'is-modal' );
	if ( modal ) dialog.showModal();
	else {
		dialog.show();
		if ( dialog.hasAttribute( 'popover' ) && typeof dialog.showPopover === 'function' ) dialog.showPopover();
	}
	// `show()` does not move focus as `showModal()` does; the dialog's own choice comes first.
	if ( ! modal ) ( dialog.querySelector< HTMLElement >( '[autofocus]' ) ?? dialog.querySelector< HTMLElement >( FOCUSABLE ) )?.focus();
	dialog.dispatchEvent( new CustomEvent( 'bl:dialog-open', { bubbles: true, detail: { id: dialog.id, source } } ) );
}

/** Close a dialog, remembering why, so the close event can tell. */
export function close( dialog: HTMLDialogElement, reason: Reason = 'api' ): void {
	if ( ! dialog.open ) return;
	reasons.set( dialog, reason );
	dialog.close();
}

/** The dialog closed, however: give focus back, drop its address, and say why. */
export function closed( dialog: HTMLDialogElement ): void {
	const reason = reasons.get( dialog ) ?? 'button';
	reasons.delete( dialog );
	// Closing a dialog leaves the popover it was shown as in the top layer.
	if ( dialog.hasAttribute( 'popover' ) && typeof dialog.hidePopover === 'function' ) dialog.hidePopover();

	// Unless the visitor has already moved focus somewhere else on the page.
	const opener = openers.get( dialog );
	const active = document.activeElement;
	const lost = ! active || active === document.body || dialog.contains( active );
	if ( lost && opener instanceof HTMLElement && opener.isConnected ) opener.focus();

	// A dialog opened from its address drops the address on close, so Back does not reopen it.
	if ( location.hash === `#${ dialog.id }` ) history.replaceState( history.state, '', location.pathname + location.search );

	// An item in the address: undo the entry its opening pushed, or drop the one the page loaded with.
	if ( pushed.has( dialog ) ) {
		pushed.delete( dialog );
		if ( history.state?.blDialog === dialog.id ) history.back();
	} else if ( itemOf( dialog ) ) {
		const url = new URL( location.href );
		url.searchParams.delete( 'item' );
		history.replaceState( history.state, '', url );
	}

	dialog.dispatchEvent( new CustomEvent( 'bl:dialog-close', { bubbles: true, detail: { id: dialog.id, source: sources.get( dialog ), reason } } ) );
}

/**
 * Esc on a modal dialog: the browser closes it; this only records why. A browser with `closedby`
 * fires `cancel` for a click outside too, after the press that {@see pressed} has already noted.
 */
export function cancelled( dialog: HTMLDialogElement ): void {
	if ( reasons.get( dialog ) !== 'outside' ) reasons.set( dialog, 'esc' );
}

/**
 * A native `command` aimed at the dialog. Opening goes through `open()`, so a dialog saved without
 * Blocks the page opens with `show()`, and the opener and source are recorded either way.
 */
export function command( dialog: HTMLDialogElement, e: Event & { command?: string; source?: Element | null } ): void {
	if ( e.command === 'show-modal' ) {
		e.preventDefault();
		open( dialog, { source: 'click', opener: e.source ?? null } );
	} else if ( e.command === 'close' || e.command === 'request-close' ) {
		reasons.set( dialog, 'button' );
	}
}

/** A click outside a modal's box lands on the dialog itself, at a point outside its rectangle. */
function outside( dialog: HTMLDialogElement, e: MouseEvent ): boolean {
	const r = dialog.getBoundingClientRect();
	return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}

/** A plain click: no modifier and the main button, so Ctrl/Cmd-click still opens a new tab. */
const plain = ( e: MouseEvent ) => e.button === 0 && ! e.metaKey && ! e.ctrlKey && ! e.shiftKey && ! e.altKey;

/** The Loop item in the address that this dialog shows, if any. */
function itemOf( dialog: HTMLDialogElement ): HTMLElement | null {
	const key = new URLSearchParams( location.search ).get( 'item' );
	if ( ! key ) return null;
	return [ ...document.querySelectorAll< HTMLElement >( '[data-bl-item]' ) ].find( ( el ) => el.dataset.blDialog === dialog.id && el.dataset.blItem === key ) ?? null;
}

/** Put a Loop item's blocks, rendered into its card's `<template>`, in the dialog. */
function fill( dialog: HTMLDialogElement, template: HTMLTemplateElement ): void {
	let body = dialog.querySelector( ':scope > .bl-dialog__item' );
	if ( ! body ) {
		body = document.createElement( 'div' );
		body.className = 'bl-dialog__item';
		dialog.append( body );
	}
	// What the card's rules set for this item (badge and heading colours), for the dialog's blocks.
	body.className = `bl-dialog__item ${ template.dataset.rules ?? '' }`.trim();
	body.replaceChildren( template.content.cloneNode( true ) );
	// The shell was rendered without a heading to be named by: name it by this item's.
	const heading = body.querySelector< HTMLElement >( 'h1, h2, h3, h4, h5, h6' );
	if ( heading && ! dialog.hasAttribute( 'aria-label' ) ) {
		heading.id ||= `${ dialog.id }-title`;
		dialog.setAttribute( 'aria-labelledby', heading.id );
	}
}

const itemTemplate = ( item: HTMLElement ) => item.querySelector< HTMLTemplateElement >( ':scope > template.bl-loop__dialog' );

/**
 * A link in the card that goes to the card's item: to its `url` field, or, for items without one,
 * to where the card's first link goes. A picture and a title both open it; an author or a tag
 * link goes where it says.
 */
function toItem( item: HTMLElement, link: HTMLAnchorElement ): boolean {
	const target = item.dataset.blUrl ?? item.querySelector< HTMLAnchorElement >( 'a[href]' )?.href;
	if ( ! target ) return false;
	try {
		return new URL( target, location.href ).href === link.href;
	} catch {
		return false;
	}
}

/**
 * A Loop card's link to its item, when the card's Loop opens this dialog: fill the dialog with
 * that item's blocks. Without the script, or with a modified click, the link still goes to the item.
 */
function loopCard( dialog: HTMLDialogElement, link: HTMLAnchorElement, e: MouseEvent ): boolean {
	const item = link.closest< HTMLElement >( '[data-bl-dialog]' );
	if ( ! item || item.dataset.blDialog !== dialog.id ) return false;
	const template = itemTemplate( item );
	if ( ! template || ! toItem( item, link ) || ! plain( e ) ) return false;

	fill( dialog, template );
	e.preventDefault();
	open( dialog, { source: 'loop', opener: link } );

	if ( item.dataset.blItem ) {
		const url = new URL( location.href );
		url.searchParams.set( 'item', item.dataset.blItem );
		history.pushState( { blDialog: dialog.id }, '', url );
		pushed.add( dialog );
	}
	return true;
}

/** Any click on the page: is it aimed at this dialog? */
export function clicked( dialog: HTMLDialogElement, e: MouseEvent ): void {
	const target = e.target as Element | null;
	if ( ! target?.closest ) return;

	// Invoker commands, for browsers without them.
	const button = target.closest< HTMLButtonElement >( 'button[commandfor]' );
	if ( button && button.getAttribute( 'commandfor' ) === dialog.id && ! supports.commands() ) {
		const cmd = button.getAttribute( 'command' );
		if ( cmd === 'show-modal' ) open( dialog, { source: 'click', opener: button } );
		else if ( cmd === 'close' || cmd === 'request-close' ) close( dialog, 'button' );
		else return;
		e.preventDefault();
		return;
	}

	const link = target.closest< HTMLAnchorElement >( 'a[href]' );
	if ( link ) {
		if ( link.getAttribute( 'href' ) === `#${ dialog.id }` && plain( e ) ) {
			e.preventDefault();
			open( dialog, { source: 'click', opener: link } );
			return;
		}
		if ( loopCard( dialog, link, e ) ) return;
	}

	// `closedby="any"`, for browsers without it: a click on the backdrop of the open modal.
	if ( ! supports.closedBy() && target === dialog && dialog.open && dialog.getAttribute( 'closedby' ) === 'any' && outside( dialog, e ) ) {
		close( dialog, 'outside' );
	}
}

/** Where the browser has `closedby`, it closes on the backdrop itself: note why first. */
export function pressed( dialog: HTMLDialogElement, e: PointerEvent ): void {
	if ( ! supports.closedBy() || ! dialog.open ) return;
	// A press inside forgets an earlier one outside that did not close it (a drag, `closerequest`).
	if ( e.target === dialog && outside( dialog, e ) ) reasons.set( dialog, 'outside' );
	else if ( reasons.get( dialog ) === 'outside' ) reasons.delete( dialog );
}

/** Esc for an open non-modal dialog, which the browser closes itself only where it has `closedby`. */
export function keyed( dialog: HTMLDialogElement, e: KeyboardEvent ): void {
	if ( e.key !== 'Escape' || supports.closedBy() || ! dialog.open || dialog.classList.contains( 'is-modal' ) ) return;
	// Only the last one opened, if several are.
	const last = [ ...document.querySelectorAll( 'dialog.bl-dialog[open]:not(.is-modal)' ) ].pop();
	if ( last === dialog && dialog.getAttribute( 'closedby' ) !== 'none' ) close( dialog, 'esc' );
}

/** The address's fragment, decoded; as it is when it is not valid percent-encoding. */
function hash(): string {
	const raw = location.hash.slice( 1 );
	try {
		return decodeURIComponent( raw );
	} catch {
		return raw;
	}
}

/** A page loaded, or moved, to this dialog's address: `#dialog-<address>`, or a Loop's `?item=`. */
export function addressed( dialog: HTMLDialogElement ): void {
	if ( hash() === dialog.id ) {
		open( dialog, { source: 'hash', opener: null } );
		return;
	}

	const item = itemOf( dialog );
	const template = item && itemTemplate( item );
	if ( template && ! dialog.open ) {
		fill( dialog, template );
		open( dialog, { source: 'hash', opener: [ ...item.querySelectorAll< HTMLAnchorElement >( 'a[href]' ) ].find( ( a ) => toItem( item, a ) ) ?? null } );
	}
}

/** Back or Forward: close an item dialog whose entry was left, open the one arrived at. */
export function moved( dialog: HTMLDialogElement ): void {
	if ( dialog.open && pushed.has( dialog ) && history.state?.blDialog !== dialog.id ) {
		pushed.delete( dialog );
		close( dialog, 'back' );
		return;
	}
	addressed( dialog );
}
