import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { ColorPopover, THEME_COLORS } from '@/controls/color/ColorControl';
import { FieldRow } from '@/blocks/shared/settings-ui';

/** A token slug resolves to its `var()` for the preview swatch; anything else passes through. */
function toCss( value: string ): string {
	return THEME_COLORS.find( ( c ) => c.slug === value )?.color ?? value;
}

/**
 * A compact, token-aware color picker for Settings-tab block attributes (value = a token slug or a
 * literal CSS color). Reuses the shared `ColorPopover` — the same picker the Styles tab uses — so
 * block settings get consistent theme-color selection instead of raw text inputs.
 */
export function ColorField( {
	label,
	value,
	onChange,
	help,
}: {
	label: string;
	value: string;
	onChange: ( v: string ) => void;
	help?: string;
} ) {
	const [ open, setOpen ] = useState( false );
	const [ anchor, setAnchor ] = useState< Element | null >( null );
	const active = THEME_COLORS.find( ( c ) => c.slug === value );
	const swatch = value ? toCss( value ) : 'transparent';

	return (
		<FieldRow label={ label } help={ help }>
			<span className="bl-color-field" ref={ ( n ) => setAnchor( n ) }>
				<button
					type="button"
					className={ `bl-color-field__swatch ${ value ? '' : 'is-empty' }` }
					style={ { background: swatch } }
					onClick={ () => setOpen( ( c ) => ! c ) }
				/>
				<span className="bl-color-field__name" onClick={ () => setOpen( ( c ) => ! c ) }>
					{ active ? active.name : ( value || __( 'Not set', 'blicks' ) ) }
				</span>
				{ value && (
					<button type="button" className="bl-color-field__reset" onClick={ () => onChange( '' ) }>
						{ __( 'Reset', 'blicks' ) }
					</button>
				) }
				{ open && (
					<ColorPopover
						anchor={ anchor }
						value={ value }
						onClose={ () => setOpen( false ) }
						onChange={ onChange }
					/>
				) }
			</span>
		</FieldRow>
	);
}
