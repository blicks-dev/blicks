import { __ } from '@wordpress/i18n';
import { FieldRow, OptionCards, SegmentedSetting, SettingsCard, useBlockHelp } from '@/blocks/shared/settings-ui';
import { IconPicker } from '@/controls/IconPicker';

const SIZE_PRESETS = [
	{ label: __( 'SM', 'blicks' ), value: '1rem' },
	{ label: __( 'MD', 'blicks' ), value: '1.5rem' },
	{ label: __( 'LG', 'blicks' ), value: '2rem' },
	{ label: __( 'XL', 'blicks' ), value: '3rem' },
];

export function cleanIconSize( value: unknown ): string {
	const raw = String( value || '1.5rem' ).trim().replace( /\s+/g, '' );
	if ( /^-?\d*\.?\d+(px|%|em|rem)$/.test( raw ) ) return raw;
	if ( /^-?\d*\.?\d+$/.test( raw ) ) return `${ raw }px`;
	return '1.5rem';
}

export function cleanStrokeWidth( value: unknown ): number {
	const width = Number( value );
	if ( Number.isNaN( width ) ) return 2;
	return Math.min( 4, Math.max( 1, width ) );
}

export function IconControls( { attributes, setAttributes }: { attributes: any; setAttributes: ( a: any ) => void } ) {
	const icon = String( attributes.icon || 'star' );
	const size = cleanIconSize( attributes.size );
	const help = useBlockHelp( 'icon' );
	const controlHelp = help?.controls ?? {};

	return (
		<>
			<SettingsCard title={ __( 'Icon', 'blicks' ) } help={ controlHelp.icon ?? help?.description }>
				<IconPicker
					value={ icon }
					onChange={ ( next ) => setAttributes( { icon: next || 'star' } ) }
				/>
			</SettingsCard>
			<SettingsCard title={ __( 'Drawing', 'blicks' ) }>
				<OptionCards
					label={ __( 'Size preset', 'blicks' ) }
					help={ controlHelp.size }
					value={ SIZE_PRESETS.some( ( option ) => option.value === size ) ? size : '' }
					columns={ 2 }
					options={ SIZE_PRESETS.map( ( option ) => ( { ...option, hint: option.value } ) ) }
					onChange={ ( nextSize ) => setAttributes( { size: nextSize } ) }
				/>
				<FieldRow label={ __( 'Custom size', 'blicks' ) } help={ controlHelp.size }>
					<input
						value={ attributes.size || '1.5rem' }
						onChange={ ( event ) => setAttributes( { size: event.currentTarget.value } ) }
						onBlur={ () => setAttributes( { size: cleanIconSize( attributes.size ) } ) }
					/>
				</FieldRow>
				<SegmentedSetting
					label={ __( 'Stroke', 'blicks' ) }
					help={ controlHelp.strokeWidth }
					value={ String( cleanStrokeWidth( attributes.strokeWidth ) ) }
					options={ [ 1.5, 2, 2.5, 3 ].map( ( value ) => ( { label: String( value ), value: String( value ) } ) ) }
					onChange={ ( strokeWidth ) => setAttributes( { strokeWidth: Number( strokeWidth ) } ) }
				/>
				<FieldRow label={ __( 'Accessible label', 'blicks' ) } help={ controlHelp.label }>
					<input value={ attributes.label || '' } onChange={ ( event ) => setAttributes( { label: event.currentTarget.value } ) } />
				</FieldRow>
			</SettingsCard>
		</>
	);
}
