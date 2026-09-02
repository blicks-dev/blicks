import { IconBtn, IconSeg, ResetButton } from '@/controls/common';
import { ValueField } from '@/controls/ValueField';

export interface IconChoice {
	/** The value this icon writes, and (by default) the value that lights it up. */
	value: string;
	title: string;
	icon: JSX.Element;
	/**
	 * Override "is this icon the current one?" — for properties where several values share a mode.
	 * Display uses it so `inline-flex` still lights the Flex icon.
	 */
	isActive?: ( current: string ) => boolean;
	/**
	 * Override what clicking writes, given the current value. Display uses it to carry an
	 * `inline-` prefix across a mode switch instead of silently dropping it.
	 */
	resolve?: ( current: string ) => string;
}

interface Props {
	value: string;
	/** Extra class on the frame — for a facet that needs its icons drawn at a different size. */
	className?: string;
	/** Short caption inside the frame, naming the property. Needed wherever two of these sit
	 *  together — four icons and a value do not say WHICH property they belong to. */
	label?: string;
	/** Spelled-out name, shown on hover. */
	hint?: string;
	/** Rendered inside the frame, ahead of the icons — a disclosure toggle, typically. */
	before?: React.ReactNode;
	/** One-click targets. Four is the ceiling — past that the targets are narrower than they are
	 *  tall and the row stops reading as a set of choices. */
	choices: IconChoice[];
	/** Everything else the property accepts, listed in the field's dropdown. */
	options: { value: string; label: string; hint?: string }[];
	placeholder?: string;
	/** Micro-caps caption above the dropdown. Defaults to "VALUES". */
	listLabel?: string;
	onChange: ( value: string ) => void;
	/** Called on blur/Enter — sanitize here. Defaults to trimming and lower-casing. */
	onCommit?: ( value: string ) => void;
}

/**
 * Icons plus a value field, editing one property between them.
 *
 * The pairing exists because most CSS properties have a couple of values that carry the design and
 * a long tail that does not. Icons alone force the tail behind a "custom" mode; a field alone makes
 * the common case a typing exercise. Here both are always present and always in sync: the field
 * shows whatever the icons set, so clicking Grid reads back as `grid`, and a value with no icon
 * (`flow-root`) is a first-class answer rather than an escape hatch.
 *
 * Free text stays valid — the dropdown is a shortlist, not an allowlist, because these properties
 * accept far more values than are worth listing.
 *
 * Built on `ValueField`, which owns the shared one-control frame.
 */
export function IconValueField( {
	value,
	className,
	label,
	hint,
	before,
	choices,
	options,
	placeholder,
	listLabel,
	onChange,
	onCommit,
}: Props ) {
	return (
		<ValueField
			className={ className }
			affix={
				<>
				{ before }
				{ label && <span className="bl-valuefield__cap" title={ hint }>{ label }</span> }
				<div className="bl-valuefield__icons">
					<IconSeg>
						{ choices.map( ( choice ) => (
							<IconBtn
								key={ choice.value }
								title={ choice.title }
								active={ choice.isActive ? choice.isActive( value ) : value === choice.value }
								onClick={ () => onChange( choice.resolve ? choice.resolve( value ) : choice.value ) }
							>
								{ choice.icon }
							</IconBtn>
						) ) }
					</IconSeg>
				</div>
				</>
			}
			value={ value }
			options={ options }
			placeholder={ placeholder }
			listLabel={ listLabel }
			onChange={ onChange }
			onCommit={ ( raw ) => ( onCommit ? onCommit( raw ) : onChange( raw.trim().toLowerCase() ) ) }
		/>
	);
}

interface IconFieldProps {
	/** Short caption inside the frame, naming the property. */
	label: string;
	/** Spelled-out name, shown on hover. */
	hint?: string;
	value: string;
	/** Every value the property takes. If there is a value NOT in here, use `IconValueField`. */
	choices: IconChoice[];
	onChange: ( value: string ) => void;
	onReset: () => void;
}

/**
 * Icons only — no value field.
 *
 * For properties whose value set is closed and small enough to draw: `direction` is `ltr` or
 * `rtl` and will never be anything else, so a text field beside the choice is a box that can only
 * ever hold what the icons already say. Anything with a tail of rarer values wants
 * `IconValueField` instead; anything unpicturable wants `OptionField`.
 *
 * Shares the frame with the other two, so a facet mixing all three still reads as one column of
 * controls rather than three different kinds of thing.
 */
export function IconField( { label, hint, value, choices, onChange, onReset }: IconFieldProps ) {
	return (
		<div className={ `bl-valuefield bl-valuefield--icons ${ value ? 'is-set' : '' }` }>
			<span className="bl-valuefield__cap" title={ hint }>{ label }</span>
			<div className="bl-valuefield__icons">
				<IconSeg>
					{ choices.map( ( choice ) => (
						<IconBtn
							key={ choice.value }
							title={ choice.title }
							active={ choice.isActive ? choice.isActive( value ) : value === choice.value }
							onClick={ () =>
								// Clicking the active choice clears it — with no field to empty, this is
								// the only way back to "not set" besides the reset.
								onChange( value === choice.value ? '' : choice.value )
							}
						>
							{ choice.icon }
						</IconBtn>
					) ) }
				</IconSeg>
			</div>
			<ResetButton idle={ ! value } onClick={ onReset } />
		</div>
	);
}
