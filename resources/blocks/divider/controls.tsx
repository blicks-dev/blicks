import { __ } from '@wordpress/i18n';
import { FieldRow, OptionCards, SegmentedSetting, SettingsCard, useBlockHelp } from '@/blocks/shared/settings-ui';
import { ColorField } from '@/blocks/shared/ColorField';
import { THEME_COLORS } from '@/controls/color/ColorControl';

const STYLES = [ 'solid', 'dashed', 'dotted' ];
const ALIGNMENTS = [ 'start', 'center', 'end' ];
const PRESETS = [
	{ label: __( 'Hairline', 'blicks' ), value: 'hairline', hint: '1px solid' },
	{ label: __( 'Dashed', 'blicks' ), value: 'dashed', hint: '1px dashed' },
	{ label: __( 'Strong', 'blicks' ), value: 'strong', hint: '2px solid' },
	{ label: __( 'Dotted', 'blicks' ), value: 'dotted', hint: '2px dotted' },
];

const PRESET_VALUES: Record< string, { thickness: string; lineStyle: string } > = {
	hairline: { thickness: '1px', lineStyle: 'solid' },
	dashed: { thickness: '1px', lineStyle: 'dashed' },
	strong: { thickness: '2px', lineStyle: 'solid' },
	dotted: { thickness: '2px', lineStyle: 'dotted' },
};

export function cleanDividerOrientation( value: unknown ): string {
	return value === 'vertical' ? 'vertical' : 'horizontal';
}

export function cleanDividerStyle( value: unknown ): string {
	const style = String( value || 'solid' );
	return STYLES.includes( style ) ? style : 'solid';
}

export function cleanDividerThickness( value: unknown ): string {
	const raw = String( value || '1px' ).trim().replace( /\s+/g, '' );
	if ( /^-?\d*\.?\d+(px|em|rem)$/.test( raw ) ) return raw;
	if ( /^-?\d*\.?\d+$/.test( raw ) ) return `${ raw }px`;
	return '1px';
}

export function cleanDividerAlign( value: unknown ): string {
	const align = String( value || 'start' );
	return ALIGNMENTS.includes( align ) ? align : 'start';
}

/** Empty = full width (horizontal) / default height (vertical); otherwise a CSS length. */
export function cleanDividerLength( value: unknown ): string {
	const raw = String( value || '' ).trim().replace( /\s+/g, '' );
	if ( raw === '' ) return '';
	if ( /^-?\d*\.?\d+(px|%|em|rem|vh|vw)$/.test( raw ) ) return raw;
	if ( /^-?\d*\.?\d+$/.test( raw ) ) return `${ raw }px`;
	return '';
}

/** Resolve the stored color (token slug or literal CSS) to a concrete CSS value for render. */
export function cleanDividerColor( value: unknown ): string {
	const v = String( value || '' ).trim();
	if ( ! v ) return 'var(--blicks-color-border, #e4e4e7)';
	return THEME_COLORS.find( ( c ) => c.slug === v )?.color ?? v;
}

export function DividerControls( { attributes, setAttributes }: { attributes: any; setAttributes: ( a: any ) => void } ) {
	const orientation = cleanDividerOrientation( attributes.orientation );
	const lineStyle = cleanDividerStyle( attributes.lineStyle );
	const thickness = cleanDividerThickness( attributes.thickness );
	const align = cleanDividerAlign( attributes.align );
	const selectedPreset = Object.entries( PRESET_VALUES ).find( ( [ , preset ] ) =>
		preset.lineStyle === lineStyle && preset.thickness === thickness
	)?.[ 0 ] ?? '';
	const help = useBlockHelp( 'divider' );
	const controlHelp = help?.controls ?? {};

	return (
		<>
			<SettingsCard title={ __( 'Rule', 'blicks' ) } help={ help?.description }>
				<OptionCards
					label={ __( 'Preset', 'blicks' ) }
					value={ selectedPreset }
					columns={ 2 }
					options={ PRESETS }
					onChange={ ( preset ) => setAttributes( PRESET_VALUES[ preset ] ) }
				/>
				<SegmentedSetting
					label={ __( 'Orientation', 'blicks' ) }
					help={ controlHelp.orientation }
					value={ orientation }
					options={ [
						{ label: __( 'Horizontal', 'blicks' ), value: 'horizontal' },
						{ label: __( 'Vertical', 'blicks' ), value: 'vertical' },
					] }
					onChange={ ( next ) => setAttributes( { orientation: next } ) }
				/>
				<SegmentedSetting
					label={ __( 'Style', 'blicks' ) }
					help={ controlHelp.lineStyle }
					value={ lineStyle }
					options={ STYLES.map( ( value ) => ( { label: value, value } ) ) }
					onChange={ ( next ) => setAttributes( { lineStyle: next } ) }
				/>
				<FieldRow label={ __( 'Thickness', 'blicks' ) } help={ controlHelp.thickness }>
					<input
						value={ attributes.thickness || '1px' }
						onChange={ ( event ) => setAttributes( { thickness: event.currentTarget.value } ) }
						onBlur={ () => setAttributes( { thickness: cleanDividerThickness( attributes.thickness ) } ) }
					/>
				</FieldRow>
				<FieldRow
					label={ orientation === 'vertical' ? __( 'Height', 'blicks' ) : __( 'Length', 'blicks' ) }
					help={ __( 'Leave empty for full width (or the default height when vertical).', 'blicks' ) }
				>
					<input
						placeholder={ orientation === 'vertical' ? '4rem' : '100%' }
						value={ attributes.length || '' }
						onChange={ ( event ) => setAttributes( { length: event.currentTarget.value } ) }
						onBlur={ () => setAttributes( { length: cleanDividerLength( attributes.length ) } ) }
					/>
				</FieldRow>
				{ orientation === 'horizontal' && attributes.length && (
					<SegmentedSetting
						label={ __( 'Align', 'blicks' ) }
						value={ align }
						options={ [
							{ label: __( 'Start', 'blicks' ), value: 'start' },
							{ label: __( 'Center', 'blicks' ), value: 'center' },
							{ label: __( 'End', 'blicks' ), value: 'end' },
						] }
						onChange={ ( next ) => setAttributes( { align: next } ) }
					/>
				) }
				<ColorField
					label={ __( 'Color', 'blicks' ) }
					help={ controlHelp.color }
					value={ attributes.color || '' }
					onChange={ ( color ) => setAttributes( { color } ) }
				/>
			</SettingsCard>
		</>
	);
}
