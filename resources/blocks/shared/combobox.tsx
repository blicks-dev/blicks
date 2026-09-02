import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { Popover } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useCloseOnOutsideClick } from '@/controls/common';
import { HelpTip, type Option } from './settings-ui';

const CHECK_ICON = (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		<path d="m5 12 5 5L20 6" />
	</svg>
);

/** Return `true`/empty for a valid value, or a message string / `false` when invalid. */
export type ComboboxValidator = ( value: string ) => boolean | string;

export interface ComboboxProps {
	label?: string;
	/** Names the field for assistive tech when there is no visible `label` — four identical
	 *  inputs ringing a box-model cross are only distinguishable by position otherwise. */
	ariaLabel?: string;
	help?: string;
	value: string;
	options: Option[];
	placeholder?: string;
	/** Called on every keystroke and on option select. Free-form text is allowed. */
	onChange: ( value: string ) => void;
	/** Called when the field is committed (blur / Enter). Use to sanitize. */
	onCommit?: ( value: string ) => void;
	/** Validate the current value; invalid returns a message (or `false`) → shown inline. */
	validate?: ComboboxValidator;
	/**
	 * Dense inspector styling: a 24px field with the option list behind an explicit `▾` trigger,
	 * and the option rows plain (the current value is tinted rather than ticked).
	 *
	 * A variant rather than the default because the Settings tab uses the roomier form, and every
	 * `TokenCombobox` in the style facets renders through this same component — flipping the base
	 * styling would silently restyle facets that have not been converted yet.
	 */
	compact?: boolean;
	/** Micro-caps caption above the option list, e.g. "VALUES". Compact variant only. */
	listLabel?: string;
	/**
	 * Extra controls rendered inside the field, between the input and the `▾` trigger — a reset,
	 * typically. They sit inside rather than beside the combobox so the trigger stays the last
	 * thing on the row, where the eye looks for it.
	 */
	actions?: React.ReactNode;
}

/**
 * A datalist-style combobox that ALWAYS exposes the full option list — even once the
 * current value already matches an option. Native `<datalist>` collapses to the single
 * matching entry the moment the value equals an option, so you can't re-pick a sibling
 * without clearing the field first. This keeps every option reachable while still
 * accepting free-form text (e.g. `640px`, `100%`, `auto`, a CSS var).
 */
export function Combobox( { label, help, ariaLabel, value, options, placeholder, onChange, onCommit, validate, compact, listLabel, actions }: ComboboxProps ) {
	const [ open, setOpen ] = useState( false );
	const [ active, setActive ] = useState( -1 );
	const wrapperRef = useRef< HTMLDivElement | null >( null );
	const inputRef = useRef< HTMLInputElement | null >( null );

	// Validation is debounced so we don't nag mid-typing: the message reflects the value
	// once the user pauses (or blurs). A live-valid value clears the error immediately.
	const [ settled, setSettled ] = useState( value );
	useEffect( () => {
		const id = setTimeout( () => setSettled( value ), 500 );
		return () => clearTimeout( id );
	}, [ value ] );

	const isValid = ( candidate: string ) => {
		if ( ! validate ) return true;
		const result = validate( candidate );
		return result === true || result === '' || result === undefined;
	};

	const error = useMemo( () => {
		if ( ! validate || isValid( value ) || isValid( settled ) ) return '';
		const result = validate( settled );
		return typeof result === 'string' ? result : __( 'Invalid value', 'blicks' );
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ validate, value, settled ] );

	// Show all options when the field is empty or the value already matches an option
	// (i.e. the user has "selected" one) — only narrow the list while actively typing a
	// value that isn't yet a known option.
	const matchesOption = options.some( ( o ) => o.value === value );
	const visible = useMemo( () => {
		const q = value.trim().toLowerCase();
		if ( ! q || matchesOption ) return options;
		const hit = options.filter(
			( o ) => o.value.toLowerCase().includes( q ) || o.label.toLowerCase().includes( q )
		);
		return hit.length ? hit : options;
	}, [ options, value, matchesOption ] );

	// The list renders in a portaled `<Popover>` (spacious, unclipped by the sidebar's own
	// overflow) — closing on outside click/escape is handled the same way every other Blicks
	// popover does it (Popover's `onClose` below), plus this shared hook for the mousedown case.
	useCloseOnOutsideClick( open, () => setOpen( false ), wrapperRef.current );

	function commit( next: string ) {
		onChange( next );
		onCommit?.( next );
	}

	function pick( option: Option ) {
		commit( option.value );
		setOpen( false );
		setActive( -1 );
		inputRef.current?.focus();
	}

	function onKeyDown( event: React.KeyboardEvent< HTMLInputElement > ) {
		if ( event.key === 'ArrowDown' || ( event.key === 'ArrowUp' && ! open ) ) {
			event.preventDefault();
			if ( ! open ) {
				setOpen( true );
				return;
			}
		}
		if ( ! open ) return;
		if ( event.key === 'ArrowDown' ) {
			event.preventDefault();
			setActive( ( i ) => ( i + 1 ) % visible.length );
		} else if ( event.key === 'ArrowUp' ) {
			event.preventDefault();
			setActive( ( i ) => ( i <= 0 ? visible.length - 1 : i - 1 ) );
		} else if ( event.key === 'Enter' && active >= 0 && visible[ active ] ) {
			event.preventDefault();
			pick( visible[ active ] );
		} else if ( event.key === 'Escape' ) {
			setOpen( false );
			setActive( -1 );
		}
	}

	const field = (
		<div
			className={ [
				'bl-combobox',
				compact ? 'bl-combobox--compact' : '',
				error ? 'is-invalid' : '',
			].filter( Boolean ).join( ' ' ) }
			ref={ wrapperRef }
		>
			<div className="bl-combobox__field">
				<input
					ref={ inputRef }
					className="bl-combobox__input"
					value={ value }
					placeholder={ placeholder }
					aria-label={ ariaLabel }
					role="combobox"
					aria-expanded={ open }
					aria-invalid={ error ? true : undefined }
					aria-autocomplete="list"
					onFocus={ () => setOpen( true ) }
					onClick={ () => setOpen( true ) }
					onChange={ ( event ) => {
						onChange( event.currentTarget.value );
						setOpen( true );
						setActive( -1 );
					} }
					onBlur={ () => {
						setSettled( value );
						onCommit?.( value );
					} }
					onKeyDown={ onKeyDown }
				/>
				{ actions }
				{ /* No trigger on a field with nothing to offer — a free-text value (a container
				     name, an intrinsic size) would otherwise carry a `▾` that opens nothing. */ }
				{ compact && options.length > 0 && (
					<button
						type="button"
						className="bl-combobox__toggle"
						tabIndex={ -1 }
						aria-hidden="true"
						title={ __( 'Pick from value library', 'blicks' ) }
						// The input already opens the list on focus; this is a visible affordance for
						// people who would not think to click a field that looks like plain text. It is
						// hidden from assistive tech because it duplicates the combobox's own behaviour.
						onMouseDown={ ( event ) => event.preventDefault() }
						onClick={ () => {
							setOpen( ( isOpen ) => ! isOpen );
							inputRef.current?.focus();
						} }
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
							<path d="m6 9 6 6 6-6" />
						</svg>
					</button>
				) }
			</div>
			{ open && visible.length > 0 && (
				<Popover
					anchor={ wrapperRef.current }
					placement="bottom-start"
					offset={ 4 }
					flip
					resize
					noArrow
					focusOnMount={ false }
					// Hand focus back to the field. The popover is a portal, so when it unmounts
					// with focus inside it (Escape, or a click that dismisses it) focus falls to
					// <body> and the next keystroke lands wherever the panel puts it — in the
					// inspector that is the property-search box, several controls away.
					onClose={ () => {
						setOpen( false );
						inputRef.current?.focus();
					} }
					className="bl-floating-popover bl-ins"
					variant="unstyled"
				>
					{ /* the panel owns the frame (border/background/shadow) and the inset; the `<ul>`
					     inside it is the scroll region, so a half-scrolled option clips against the
					     panel's padding rather than hard against its border. */ }
					<div className="bl-combobox__panel">
						{ compact && listLabel && (
							<div className="bl-combobox__list-title">{ listLabel }</div>
						) }
						<ul className="bl-combobox__list" role="listbox">
							{ visible.map( ( option, index ) => (
								<li key={ option.value }>
									<button
										type="button"
										role="option"
										aria-selected={ option.value === value }
										className={ [
											'bl-combobox__option',
											option.value === value ? 'is-active' : '',
											index === active ? 'is-highlighted' : '',
										].filter( Boolean ).join( ' ' ) }
										onMouseEnter={ () => setActive( index ) }
										onMouseDown={ ( event ) => event.preventDefault() }
										onClick={ () => pick( option ) }
									>
										<span className="bl-combobox__check">{ option.value === value ? CHECK_ICON : null }</span>
										<span className="bl-combobox__option-label">{ option.label }</span>
										{ option.hint && <span className="bl-combobox__option-hint">{ option.hint }</span> }
									</button>
								</li>
							) ) }
						</ul>
					</div>
				</Popover>
			) }
			{ error && <p className="bl-combobox__error">{ error }</p> }
		</div>
	);

	if ( ! label ) return field;

	return (
		<div className="bl-setting">
			<div className="bl-setting__label">
				<span>{ label }</span>
				<HelpTip text={ help } />
			</div>
			{ field }
		</div>
	);
}
