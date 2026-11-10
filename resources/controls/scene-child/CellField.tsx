import { SubReset } from '@/controls/common';

/**
 * One integer field.
 *
 * `inputMode="numeric"` rather than `decimal`: a cell index has no fractional part, and the
 * keypad a phone offers should say so.
 */
export function CellField( {
	label,
	value,
	placeholder,
	onCommit,
	onReset,
}: {
	label: string;
	value: string;
	placeholder: string;
	onCommit: ( v: string ) => void;
	onReset: () => void;
} ) {
	return (
		<div>
			<div className="sub-row">
				<span className="sub">{ label }</span>
				{ value && <SubReset onClick={ onReset } /> }
			</div>
			<div className="dim">
				<input
					type="text"
					inputMode="numeric"
					value={ value }
					placeholder={ placeholder }
					onChange={ ( event ) => onCommit( event.currentTarget.value ) }
					onBlur={ ( event ) => onCommit( event.currentTarget.value ) }
				/>
			</div>
		</div>
	);
}
