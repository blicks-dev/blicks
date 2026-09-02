import { useEffect, useState } from '@wordpress/element';
import { Popover } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { setValue } from '@/framework/values';

export const LENGTH_PATTERN = /^(auto|0|-?\d+(\.\d+)?(px|%|em|rem|vh|vw|fr))$/;
export const LENGTH_SUGGESTIONS = [
	'auto',
	'0',
	'8px',
	'1rem',
	'50%',
	'100vh',
	'1fr',
];

export const LINE_HEIGHT_PATTERN = /^(normal|0|[1-9]\d*(\.\d+)?|-?\d+(\.\d+)?(px|%|em|rem))$/;
export const LINE_HEIGHT_SUGGESTIONS = [ 'normal', '1', '1.5', '20px', '1.5rem' ];

export const Z_INDEX_PATTERN = /^(auto|-?\d+)$/;
export const Z_INDEX_SUGGESTIONS = [ 'auto', '0', '10', '999' ];

// Re-exported so every existing `from '@/controls/common'` import site is unaffected by the split;
// also imported, because a re-export does not put the name in this module's own scope.
import { validateOrEmpty } from '@/controls/validate';
export { cleanValue, keywordPattern, validateOrEmpty, validateSpaced } from '@/controls/validate';

/** ↺ — a full counter-clockwise turn, i.e. "put it back", rather than the one-step undo arrow. */
const UNDO_ICON = (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
		<path d="M3 3v5h5" />
	</svg>
);

/**
 * Reset affordance for a field header.
 *
 * Icon, not the word "Reset": the label only exists while the field holds a value, and a word
 * appearing and vanishing at the end of a row visibly shoved the header around every time you
 * typed the first character. An icon is narrower and, more to the point, `idle` keeps its slot
 * reserved — the button stays laid out and just turns invisible, so nothing moves.
 */
export function ResetButton( { onClick, idle }: { onClick: () => void; idle?: boolean } ) {
	const label = __( 'Reset', 'blicks' );
	return (
		<button
			type="button"
			className={ `reset${ idle ? ' is-idle' : '' }` }
			title={ label }
			aria-label={ label }
			disabled={ idle }
			aria-hidden={ idle || undefined }
			tabIndex={ idle ? -1 : undefined }
			onClick={ onClick }
		>
			{ UNDO_ICON }
		</button>
	);
}

/** Icon-only reset for a `.sub-row` label (Width/Height-style compact 2-up fields). Absolutely
 *  positioned by `.reset-btn`'s CSS so it never adds width to the row — a text "Reset" button
 *  there pushed/wrapped the row in narrow 2-column layouts. */
export function SubReset( { onClick, label = __( 'Reset', 'blicks' ) }: { onClick: () => void; label?: string } ) {
	return (
		<button type="button" className="reset-btn" title={ label } aria-label={ label } onClick={ onClick }>
			{ UNDO_ICON }
		</button>
	);
}

/** Mockup `.lbl-row`: mono uppercase `.lbl` + optional electric-blue `.reset`. Shared by every
 *  control so labels read consistently across the inspector. */
export function FieldHead( {
	label,
	showReset,
	onReset,
	modified,
	children,
}: {
	label: string;
	showReset?: boolean;
	onReset?: () => void;
	/** Renders the "this section holds a value" dot beside the label. */
	modified?: boolean;
	children?: React.ReactNode;
} ) {
	return (
		<div className="lbl-row">
			<span className="lbl">{ label }</span>
			{ modified && <span className="bl-mod-dot" aria-hidden="true" /> }
			{ children }
			{ /* Rendered whenever the field CAN reset, not only when it currently has something to
			     reset — the slot then holds its width and the header stops jumping as values come
			     and go. */ }
			{ onReset && <ResetButton idle={ ! showReset } onClick={ onReset } /> }
		</div>
	);
}

/**
 * Build a keyword matcher for the inspector's property search. Each section in a facet body
 * declares the terms it should answer to; an empty query matches everything.
 *
 * Facet bodies own this rather than the shell because only the body knows what it renders —
 * the shell's registry keywords are deliberately coarse (they only decide which facet shows).
 */
export function makeMatcher( query?: string ): ( keywords: string[] ) => boolean {
	const q = ( query ?? '' ).trim().toLowerCase();
	if ( ! q ) return () => true;
	return ( keywords ) => keywords.some( ( k ) => k.toLowerCase().includes( q ) );
}

/** Shown when a search hides every section in the open facet. */
export function NoMatches( { query }: { query: string } ) {
	return (
		<p className="bl-ins-note">
			{ /* translators: %s: the user's search term */
			  __( 'No properties match “%s”.', 'blicks' ).replace( '%s', query.trim() ) }
		</p>
	);
}

/** Write a control value, treating '' as "clear this slot". */
export function setOrClear(
	attributes: any,
	setAttributes: ( a: any ) => void,
	controlId: string,
	state: string,
	breakpoint: string,
	value: string
) {
	setValue( attributes, setAttributes, controlId, state, breakpoint, value || undefined );
}

/** Clear several controls at one (state, breakpoint) in a single batched write. */
export function clearSlots(
	attributes: any,
	setAttributes: ( a: any ) => void,
	controlIds: string[],
	state: string,
	breakpoint: string
) {
	const blicks = { ...( attributes.blicks ?? {} ) };
	for ( const controlId of controlIds ) {
		const control = { ...( blicks[ controlId ] ?? {} ) };
		const stateSlot = { ...( control[ state ] ?? {} ) };
		delete stateSlot[ breakpoint ];
		if ( Object.keys( stateSlot ).length ) {
			control[ state ] = stateSlot;
		} else {
			delete control[ state ];
		}
		if ( Object.keys( control ).length ) {
			blicks[ controlId ] = control;
		} else {
			delete blicks[ controlId ];
		}
	}
	setAttributes( { blicks } );
}

export function IconBtn( {
	active,
	title,
	className,
	onClick,
	children,
}: {
	active?: boolean;
	title: string;
	/** Extra state the caller needs to mark on the button — Border flags the sides already
	 *  carrying a value, so switching away from one is never a silent loss. */
	className?: string;
	onClick: () => void;
	children: React.ReactNode;
} ) {
	return (
		<button
			type="button"
			role="radio"
			aria-checked={ !! active }
			title={ title }
			aria-label={ title }
			className={ [ active ? 'on' : '', className ].filter( Boolean ).join( ' ' ) }
			onClick={ onClick }
		>
			{ children }
		</button>
	);
}

/** Mockup `.seg-row` (icon/segmented row). `fill` is a no-op now — seg-row is always flex-fill. */
export function IconSeg( {
	children,
}: {
	fill?: boolean;
	children: React.ReactNode;
} ) {
	return (
		<div className="seg-row" role="radiogroup">
			{ children }
		</div>
	);
}

/** Bare numeric/length input used across the styling facets. */
export function Dim( {
	value,
	placeholder,
	list,
	pattern = LENGTH_PATTERN,
	onChange,
	onBlur,
}: {
	value: string;
	placeholder?: string;
	list?: string;
	pattern?: RegExp;
	onChange: ( v: string ) => void;
	onBlur: ( v: string ) => void;
} ) {
	return (
		<div className="inp-num bare">
			<input
				className="inp center"
				list={ list }
				value={ value }
				placeholder={ placeholder }
				onChange={ ( e ) => onChange( e.target.value ) }
				onBlur={ ( e ) => onBlur( validateOrEmpty( e.target.value, pattern ) ) }
			/>
		</div>
	);
}

export function ValueDatalist( {
	id,
	values,
}: {
	id: string;
	values: string[];
} ) {
	return (
		<datalist id={ id }>
			{ values.map( ( value ) => (
				<option key={ value } value={ value } />
			) ) }
		</datalist>
	);
}

const POPOVER_OPEN_EVENT = 'blicks:popover-open';

export function announcePopoverOpen( id: string ) {
	if ( typeof window === 'undefined' ) return;
	window.dispatchEvent(
		new CustomEvent( POPOVER_OPEN_EVENT, {
			detail: { id },
		} )
	);
}

/**
 * Dismiss a popover when the user mousedowns outside it. Ignores clicks inside any portaled
 * Blicks popover (`.bl-floating-popover`) and on the trigger/anchor itself (so the trigger's
 * own toggle handler stays in charge, no close-then-reopen). Pass the anchor element the
 * popover is positioned against.
 */
export function useCloseOnOutsideClick(
	isOpen: boolean,
	close: () => void,
	anchor?: Element | null
) {
	useEffect( () => {
		if ( ! isOpen || typeof document === 'undefined' ) return;

		const onPointerDown = ( event: Event ) => {
			const target = event.target as Element | null;
			if ( ! target ) return;
			// inside any open Blicks popover, or a WP modal/media frame the popover spawned
			// (the media library, FontsManager, etc.) → keep open. Closing here would unmount
			// the trigger and destroy the just-opened frame.
			if (
				target.closest?.(
					'.bl-floating-popover, .media-modal, .media-modal-backdrop, .components-modal__frame, .components-modal__screen-overlay'
				)
			) {
				return;
			}
			// on the trigger/anchor → let its own onClick toggle handle it
			if ( anchor && anchor.contains?.( target ) ) return;
			close();
		};

		document.addEventListener( 'mousedown', onPointerDown, true );
		return () => document.removeEventListener( 'mousedown', onPointerDown, true );
	}, [ isOpen, close, anchor ] );
}

export function useCloseOnOtherPopover( id: string, close: () => void ) {
	useEffect( () => {
		if ( typeof window === 'undefined' ) return;

		const onOpen = ( event: Event ) => {
			const detail = ( event as CustomEvent< { id?: string } > ).detail;
			if ( detail?.id && detail.id !== id ) {
				close();
			}
		};

		window.addEventListener( POPOVER_OPEN_EVENT, onOpen );
		return () => window.removeEventListener( POPOVER_OPEN_EVENT, onOpen );
	}, [ id, close ] );
}

/**
 * A compact summary trigger (`.fx-field`: current value + chevron) that opens its full editor in a
 * floating popover, never inline — so the inspector list stays a fixed height. Shared by every
 * multi-setting field (Effects shadows/motion/filters, Border, …); editing happens in the portaled
 * panel, which the caller styles via its own wrapper class inside `children`.
 *
 * Two open-state modes:
 *  - **Controlled** — pass `isOpen` + `onToggle` + `onClose`. The parent owns the open state (e.g.
 *    Effects' single `openPanel`, which already gives one-open-at-a-time + `announcePopoverOpen`).
 *  - **Self-managed** — pass `popoverId` instead. The component runs its own open state and joins
 *    the single-open bus (`announcePopoverOpen` on open + `useCloseOnOtherPopover` to yield). Best
 *    for single-instance callers that shouldn't hand-roll the plumbing.
 */
export function PopoverField( {
	label,
	summary,
	hasValue,
	onReset,
	children,
	isOpen,
	onToggle,
	onClose,
	popoverId,
}: {
	label: string;
	summary: string;
	hasValue: boolean;
	onReset: () => void;
	children: React.ReactNode;
	isOpen?: boolean;
	onToggle?: () => void;
	onClose?: () => void;
	popoverId?: string;
} ) {
	const [ anchor, setAnchor ] = useState< Element | null >( null );
	const [ selfOpen, setSelfOpen ] = useState( false );

	const controlled = isOpen !== undefined;
	const open = controlled ? Boolean( isOpen ) : selfOpen;

	const close = controlled
		? onClose ?? ( () => {} )
		: () => setSelfOpen( false );
	const toggle = controlled
		? onToggle ?? ( () => {} )
		: () =>
				setSelfOpen( ( cur ) => {
					const next = ! cur;
					if ( next && popoverId ) announcePopoverOpen( popoverId );
					return next;
				} );

	useCloseOnOutsideClick( open, close, anchor );
	// Self-managed instances yield when another popover opens. Controlled callers own this already,
	// so the close here is a no-op for them (their `selfOpen` is unused).
	useCloseOnOtherPopover( popoverId ?? '', () => {
		if ( ! controlled ) setSelfOpen( false );
	} );

	return (
		<div className="field" ref={ ( node ) => setAnchor( node ) }>
			<FieldHead label={ label } showReset={ hasValue } onReset={ onReset } />
			<button
				type="button"
				className={ `fx-field ${ ! hasValue ? 'is-none' : '' } ${ open ? 'is-open' : '' }` }
				onClick={ toggle }
			>
				<span className="fx-field__val">{ hasValue ? summary : __( 'None', 'blicks' ) }</span>
				<span className="fx-field__chevron">▾</span>
			</button>
			{ open && (
				<Popover
					anchor={ anchor }
					placement="left-start"
					offset={ 12 }
					flip
					resize
					noArrow
					focusOnMount={ false }
					onClose={ close }
					className="bl-floating-popover bl-ins"
					variant="unstyled"
				>
					<div className="bl-fx-popover">{ children }</div>
				</Popover>
			) }
		</div>
	);
}

/**
 * Essentials-vs-advanced disclosure for *inside* a popover or panel, so a control's primary surface
 * stays calm but nothing is removed. Collapsed by default; pass `defaultOpen` (typically
 * `hasAdvancedValue`) so a user never loses sight of a value they already set. Renders the existing
 * `.reveal` box body — styles live once in the foundation under `.bl-ins`.
 */
export function MoreSettings( {
	label = __( 'More options', 'blicks' ),
	defaultOpen = false,
	forceOpen = false,
	badge,
	children,
}: {
	label?: string;
	defaultOpen?: boolean;
	/** Held open regardless of user state — used while a search is active, so a matching field
	 *  is never hidden behind a collapsed disclosure. */
	forceOpen?: boolean;
	/** How many values are set inside. Shown on the toggle so a collapsed section still says
	 *  whether it is carrying anything; falsy values render nothing. */
	badge?: number;
	children: React.ReactNode;
} ) {
	const [ open, setOpen ] = useState( defaultOpen );
	const isOpen = open || forceOpen;

	return (
		<div className={ `bl-more ${ isOpen ? 'is-open' : '' }` }>
			<button
				type="button"
				className="bl-more__toggle"
				aria-expanded={ isOpen }
				disabled={ forceOpen }
				onClick={ () => setOpen( ( v ) => ! v ) }
			>
				<span>{ label }</span>
				{ Boolean( badge ) && <span className="bl-more__badge">{ badge }</span> }
				<svg
					className="bl-more__chev"
					viewBox="0 0 24 24"
					width="14"
					height="14"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<path d="m6 9 6 6 6-6" />
				</svg>
			</button>
			{ isOpen && <div className="bl-more__body">{ children }</div> }
		</div>
	);
}
