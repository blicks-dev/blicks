import { __ } from '@wordpress/i18n';
import { FieldRow, OptionCards, SegmentedSetting, SettingsCard, useBlockHelp } from '@/blocks/shared/settings-ui';

const SIZE_PRESETS = [
	{ label: __( 'XS', 'blicks' ), value: '16px', hint: __( 'Tight', 'blicks' ) },
	{ label: __( 'SM', 'blicks' ), value: '32px', hint: __( 'Small gap', 'blicks' ) },
	{ label: __( 'MD', 'blicks' ), value: '64px', hint: __( 'Section', 'blicks' ) },
	{ label: __( 'LG', 'blicks' ), value: '96px', hint: __( 'Hero', 'blicks' ) },
];

export function cleanSpacerSize( value: unknown ): string {
	const raw = String( value || '64px' ).trim().replace( /\s+/g, '' );
	if ( /^-?\d*\.?\d+(px|%|em|rem|vh|vw)$/.test( raw ) ) return raw;
	if ( /^-?\d*\.?\d+$/.test( raw ) ) return `${ raw }px`;
	return '64px';
}

export function cleanSpacerOrientation( value: unknown ): string {
	return value === 'horizontal' ? 'horizontal' : 'vertical';
}

export function SpacerControls( { attributes, setAttributes }: { attributes: any; setAttributes: ( a: any ) => void } ) {
	const orientation = cleanSpacerOrientation( attributes.orientation );
	const size = cleanSpacerSize( attributes.size );
	const help = useBlockHelp( 'spacer' );
	const controlHelp = help?.controls ?? {};

	return (
		<SettingsCard title={ __( 'Space', 'blicks' ) } help={ help?.description }>
			<OptionCards
				label={ __( 'Preset', 'blicks' ) }
				help={ controlHelp.size }
				value={ SIZE_PRESETS.some( ( option ) => option.value === size ) ? size : '' }
				columns={ 2 }
				options={ SIZE_PRESETS }
				onChange={ ( nextSize ) => setAttributes( { size: nextSize } ) }
			/>
			<FieldRow label={ __( 'Custom size', 'blicks' ) } help={ controlHelp.size }>
				<input
					value={ attributes.size || '64px' }
					onChange={ ( event ) => setAttributes( { size: event.currentTarget.value } ) }
					onBlur={ () => setAttributes( { size: cleanSpacerSize( attributes.size ) } ) }
				/>
			</FieldRow>
			<SegmentedSetting
				label={ __( 'Orientation', 'blicks' ) }
				help={ controlHelp.orientation }
				value={ orientation }
				options={ [
					{ label: __( 'Vertical', 'blicks' ), value: 'vertical' },
					{ label: __( 'Horizontal', 'blicks' ), value: 'horizontal' },
				] }
				onChange={ ( next ) => setAttributes( { orientation: next } ) }
			/>
		</SettingsCard>
	);
}
