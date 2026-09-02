import { useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Combobox } from '@/blocks/shared/combobox';
import { ResetButton } from '@/controls/common';
import { tokenComboboxOptions } from '@/controls/TokenCombobox';
import { keywordPattern, validateOrEmpty, validateSpaced } from '@/controls/common';
import type { TokenCategory } from '@/framework/types';
import './value-field.scss';

interface Props {
	/** Extra class on the frame. */
	className?: string;
	/**
	 * Rendered inside the frame, left of the input: a short caption (`W`, `MIN H`) or a row of
	 * icon buttons. Whatever it is, it belongs to the same property as the field.
	 */
	affix?: React.ReactNode;
	/** Names the field for assistive tech when the affix does not (a cross cell says "top" by
	 *  where it sits, which a screen reader cannot see). */
	ariaLabel?: string;
	value: string;
	options: { value: string; label: string; hint?: string }[];
	placeholder?: string;
	/** Micro-caps caption above the dropdown. */
	listLabel?: string;
	/** Draws the frame and the caption in the accent colour — "this one is set". */
	modified?: boolean;
	/** Rendered inside the frame, between the value and the reset — a library trigger, typically.
	 *  Same slot `SliderField` gives its actions, so a trigger sits in the same place either way. */
	actions?: React.ReactNode;
	/** Renders an inline reset inside the frame. The slot is reserved either way, so the field
	 *  does not resize the first time a value is typed. */
	onReset?: () => void;
	onChange: ( value: string ) => void;
	onCommit?: ( value: string ) => void;
	/**
	 * Value space for the property. Given one, a typed value that does not match is dropped on
	 * commit (blur / Enter) instead of being written — the same contract `LengthField` has always
	 * had, available to the plain field. An explicit `onCommit` wins.
	 */
	pattern?: RegExp;
}

/**
 * One property, one control: an affix and a value field sharing a single frame.
 *
 * The frame lives on the wrapper rather than on the input, so the caption (or the icon row), the
 * text and the reset all read as one thing instead of a label sitting above a box. That is what
 * lets a pair of these sit side by side in the width of one ordinary field.
 *
 * `IconValueField` is this component with icons for an affix; the two share the frame styling so
 * an icon row and a lettered field line up exactly when they appear in the same facet.
 */
export function ValueField( {
	className = '',
	affix,
	ariaLabel,
	value,
	options,
	placeholder,
	listLabel = 'VALUES',
	modified,
	actions,
	onReset,
	onChange,
	onCommit,
	pattern,
}: Props ) {
	const commit = ( raw: string ) => {
		if ( onCommit ) return onCommit( raw );
		onChange( pattern ? validateSpaced( raw, pattern ) : raw.trim() );
	};

	return (
		<div className={ `bl-valuefield ${ className } ${ modified ? 'is-set' : '' }` }>
			{ affix }
			{ /* No wrapper around the combobox: an extra flex level between the frame and the field
			     left the input unable to claim the free space, which collapsed it to a bare caret
			     and stranded the `▾` mid-frame.

			     The reset goes *through* the combobox rather than beside it, so it lands between the
			     value and the `▾` — the trigger stays the last thing on the row, which is where the
			     eye looks for it. */ }
			<Combobox
				compact
				ariaLabel={ ariaLabel }
				listLabel={ listLabel }
				value={ value }
				options={ options }
				placeholder={ placeholder }
				actions={
					actions || onReset ? (
						<>
							{ actions }
							{ onReset && <ResetButton idle={ ! modified } onClick={ onReset } /> }
						</>
					) : undefined
				}
				onChange={ onChange }
				onCommit={ commit }
			/>
		</div>
	);
}

interface OptionProps {
	/** The short caption inside the frame. */
	label: string;
	/** Spelled-out name, shown on hover — `RATIO` is only legible once you know it. */
	hint?: string;
	values: readonly string[];
	/** Token-backed options listed after the literals (aspect ratio's theme scale, say). */
	extra?: { value: string; label: string; hint?: string }[];
	value: string;
	placeholder?: string;
	/**
	 * Value space for the property, checked on commit. Pass one for a property whose values are
	 * not the plain keyword list — a number (`line-clamp`), a ratio, a length. Pass `null` to keep
	 * the field free-text (a container name, an intrinsic size). Omitted, the field accepts its own
	 * `values` plus CSS-wide keywords and `var()`/`calc()`, and drops anything else.
	 */
	pattern?: RegExp | null;
	onChange: ( value: string ) => void;
	onReset: () => void;
}

/**
 * An enum property as a single captioned field: the same shape as `LengthField`, for the values
 * that used to be bare `<select>`s. Still a combobox, so a value the list does not know
 * (`aspect-ratio: 1.618`) can be typed — but not one from another property's value space; see
 * `pattern`.
 */
export function OptionField( {
	label,
	hint,
	values,
	extra = [],
	value,
	placeholder,
	pattern,
	onChange,
	onReset,
}: OptionProps ) {
	const guard = useMemo( () => {
		if ( pattern === null ) return undefined;
		if ( pattern ) return pattern;
		// A field with no list of its own is free text by definition (a container name, an
		// intrinsic size) — there is no value space to check it against.
		const listed = [ ...values, ...extra.map( ( option ) => option.value ) ];
		return listed.length ? keywordPattern( listed ) : undefined;
	}, [ pattern, values, extra ] );

	return (
		<ValueField
			affix={ <span className="bl-valuefield__cap" title={ hint }>{ label }</span> }
			value={ value }
			options={ [ ...values.map( ( v ) => ( { value: v, label: v } ) ), ...extra ] }
			placeholder={ placeholder }
			modified={ Boolean( value ) }
			pattern={ guard }
			onChange={ onChange }
			onReset={ onReset }
		/>
	);
}

interface LengthProps {
	label: string;
	/** Rendered inside the frame, ahead of the caption — a disclosure toggle, typically. */
	before?: React.ReactNode;
	/** Spelled-out name, shown on hover. */
	hint?: string;
	category: TokenCategory;
	literals: readonly string[];
	pattern: RegExp;
	/** Micro-caps caption above the option list. Names the catalogue the values come from. */
	listLabel?: string;
	value: string;
	placeholder?: string;
	onChange: ( value: string ) => void;
	/** Omit in a two-up row: the inline reset costs 16px the value cannot spare, and the section
	 *  head above already carries one. Clearing the text still clears the property. */
	onReset?: () => void;
}

/**
 * A length property as a single lettered field — the shape the Size section is built from.
 * Wraps `ValueField` with the token list for its category and the category's own validation, so a
 * caller only says which property it is.
 */
export function LengthField( {
	label,
	before,
	hint,
	category,
	literals,
	pattern,
	listLabel = 'SIZE LIBRARY',
	value,
	placeholder,
	onChange,
	onReset,
}: LengthProps ) {
	return (
		<ValueField
			affix={ <>{ before }<span className="bl-valuefield__cap" title={ hint }>{ label }</span></> }
			listLabel={ listLabel }
			value={ value }
			options={ tokenComboboxOptions( category, literals ) }
			placeholder={ placeholder }
			modified={ Boolean( value ) }
			onChange={ onChange }
			onCommit={ ( raw ) => onChange( validateOrEmpty( raw, pattern ) ) }
			onReset={ onReset }
		/>
	);
}

interface FieldGroupProps {
	/** Something is set inside — surfaces a dot so a collapsed group still says so. */
	constrained?: boolean;
	defaultOpen?: boolean;
	/** Held open while a search is active, so a matching child is never hidden. */
	forceOpen?: boolean;
	/** What the toggle reveals, for the tooltip. */
	title?: string;
	/** Renders the parent field, given the toggle to place in its `before` slot. */
	field: ( toggle: React.ReactNode ) => React.ReactNode;
	children: React.ReactNode;
}

/**
 * A field that owns a few subordinate fields.
 *
 * The relationship is the point: min and max belong to the length they bound, per-axis overflow to
 * the shorthand it overrides. Read as siblings in a flat list, each pair costs you two lookups to
 * learn one thing.
 *
 * The toggle goes left of the caption, inside the frame, and is a plus/minus rather than a
 * chevron: the `▾` on the right already means "pick a value", and two carets on one row read as
 * the same affordance twice. Plus/minus says "there is more of this control", which is what it
 * does.
 */
export function FieldGroup( {
	constrained,
	defaultOpen = false,
	forceOpen = false,
	title = __( 'More', 'blicks' ),
	field,
	children,
}: FieldGroupProps ) {
	const [ open, setOpen ] = useState( defaultOpen );
	const isOpen = open || forceOpen;

	const toggle = (
		<button
			type="button"
			className="bl-fieldgroup__toggle"
			aria-expanded={ isOpen }
			disabled={ forceOpen }
			title={ title }
			aria-label={ title }
			onClick={ () => setOpen( ( v ) => ! v ) }
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
				<path d="M5 12h14" />
				{ ! isOpen && <path d="M12 5v14" /> }
			</svg>
			{ constrained && <span className="bl-fieldgroup__dot" /> }
		</button>
	);

	return (
		<div className={ `bl-fieldgroup ${ isOpen ? 'is-open' : '' }` }>
			{ field( toggle ) }
			{ isOpen && <div className="bl-fieldgroup__body">{ children }</div> }
		</div>
	);
}

type GroupProps = LengthProps & Omit< FieldGroupProps, 'field' >;

/** A length field that owns its own min and max. */
export function LengthFieldGroup( {
	constrained,
	defaultOpen,
	forceOpen,
	title = __( 'Min and max', 'blicks' ),
	children,
	...field
}: GroupProps ) {
	return (
		<FieldGroup
			constrained={ constrained }
			defaultOpen={ defaultOpen }
			forceOpen={ forceOpen }
			title={ title }
			field={ ( toggle ) => <LengthField { ...field } before={ toggle } /> }
		>
			{ children }
		</FieldGroup>
	);
}


interface SliderProps {
	/** Short caption inside the frame. */
	label: string;
	/** Spelled-out name, shown on hover. */
	hint?: string;
	min: number;
	max: number;
	step?: number;
	/** Where the handle sits. */
	value: number;
	/** What the readout shows — the value in whatever unit the user thinks in. Keep it populated
	 *  even when nothing is set: the inherited value tells you where you are starting from, and a
	 *  blank half-row reads as broken. */
	display: string;
	/** Something is actually stored. Drives the accent and the reset; `display` alone cannot,
	 *  since it also shows the inherited value. */
	modified?: boolean;
	/**
	 * The stored value is something the slider cannot represent (a token slug, say). The track
	 * goes inert and the readout shows the stored value instead of lying about a position.
	 */
	frozen?: boolean;
	/** Rendered between the readout and the reset — a token-library trigger, typically. */
	actions?: React.ReactNode;
	onChange: ( value: number ) => void;
	onReset: () => void;
}

/**
 * A continuous property as a track you drag.
 *
 * For the handful of values that are genuinely a *quantity* rather than a choice — opacity is the
 * one this was built for. A combobox can hold `0.6`, but it cannot answer "a bit more than half"
 * without arithmetic, and it gives no feel for the range. The readout keeps the exact number
 * visible, so nothing is lost by dragging.
 *
 * Same frame as every other field, so a slider sitting among comboboxes still reads as one row in
 * one column of controls.
 */
export function SliderField( {
	label,
	hint,
	min,
	max,
	step = 1,
	value,
	display,
	modified,
	frozen,
	actions,
	onChange,
	onReset,
}: SliderProps ) {
	return (
		<div className={ `bl-valuefield bl-valuefield--slider ${ modified ? 'is-set' : '' }` }>
			<span className="bl-valuefield__cap" title={ hint }>{ label }</span>
			<input
				type="range"
				className="bl-valuefield__range"
				min={ min }
				max={ max }
				step={ step }
				value={ value }
				disabled={ frozen }
				aria-label={ hint ?? label }
				onChange={ ( event ) => onChange( Number( event.currentTarget.value ) ) }
			/>
			<span className="bl-valuefield__readout">{ display }</span>
			{ actions }
			<ResetButton idle={ ! modified } onClick={ onReset } />
		</div>
	);
}
