import { __ } from '@wordpress/i18n';
import { FieldRow, OptionCards, SegmentedSetting, SettingsCard, useBlockHelp } from '@/blocks/shared/settings-ui';
import { IconPicker } from '@/controls/IconPicker';

const VARIANTS = [ 'default', 'secondary', 'destructive', 'outline', 'ghost', 'link' ];
const SIZES = [ 'sm', 'default', 'lg', 'icon' ];

const PRESETS: Record< string, Record< string, string > > = {
	primary: { variant: 'default', size: 'default', icon: '', iconPosition: 'leading' },
	secondary: { variant: 'secondary', size: 'default', icon: '', iconPosition: 'leading' },
	ghost: { variant: 'ghost', size: 'default', icon: '', iconPosition: 'leading' },
	link: { variant: 'link', size: 'default', icon: '', iconPosition: 'leading' },
	arrow: { variant: 'default', size: 'default', icon: 'arrow-right', iconPosition: 'trailing' },
	icon: { variant: 'outline', size: 'icon', icon: 'plus', iconPosition: 'leading' },
};

export function cleanButtonVariant( value: unknown ): string {
	const variant = String( value || 'default' );
	return VARIANTS.includes( variant ) ? variant : 'default';
}

export function cleanButtonSize( value: unknown ): string {
	const size = String( value || 'default' );
	return SIZES.includes( size ) ? size : 'default';
}

export function ButtonControls( { attributes, setAttributes }: { attributes: any; setAttributes: ( a: any ) => void } ) {
	const variant = cleanButtonVariant( attributes.variant );
	const size = cleanButtonSize( attributes.size );
	const icon = String( attributes.icon || '' );
	const opensNew = attributes.linkTarget === '_blank';
	const selectedPreset = Object.entries( PRESETS ).find( ( [ , preset ] ) =>
		preset.variant === variant
		&& preset.size === size
		&& preset.icon === icon
		&& preset.iconPosition === ( attributes.iconPosition || 'leading' )
	)?.[ 0 ] ?? '';
	const help = useBlockHelp( 'button' );
	const controlHelp = help?.controls ?? {};

	return (
		<>
			<SettingsCard title={ __( 'Action', 'blicks' ) } help={ help?.description }>
				<OptionCards
					label={ __( 'Preset', 'blicks' ) }
					value={ selectedPreset }
					columns={ 2 }
					options={ [
						{ label: __( 'Primary', 'blicks' ), value: 'primary', hint: __( 'Main CTA', 'blicks' ) },
						{ label: __( 'Secondary', 'blicks' ), value: 'secondary', hint: __( 'Quiet action', 'blicks' ) },
						{ label: __( 'Ghost', 'blicks' ), value: 'ghost', hint: __( 'Toolbar', 'blicks' ) },
						{ label: __( 'Link', 'blicks' ), value: 'link', hint: __( 'Inline CTA', 'blicks' ) },
						{ label: __( 'Arrow CTA', 'blicks' ), value: 'arrow', hint: __( 'Next step', 'blicks' ) },
						{ label: __( 'Icon', 'blicks' ), value: 'icon', hint: __( 'Square', 'blicks' ) },
					] }
					onChange={ ( preset ) => setAttributes( PRESETS[ preset ] ) }
				/>
				<SegmentedSetting
					label={ __( 'Variant', 'blicks' ) }
					help={ controlHelp.variant }
					value={ variant }
					options={ VARIANTS.map( ( value ) => ( { label: value, value } ) ) }
					onChange={ ( next ) => setAttributes( { variant: next } ) }
				/>
				<SegmentedSetting
					label={ __( 'Size', 'blicks' ) }
					help={ controlHelp.size }
					value={ size }
					options={ SIZES.map( ( value ) => ( { label: value, value } ) ) }
					onChange={ ( next ) => setAttributes( { size: next } ) }
				/>
			</SettingsCard>
			<SettingsCard title={ __( 'Link', 'blicks' ) }>
				<FieldRow label={ __( 'URL', 'blicks' ) } help={ controlHelp.url }>
					<input value={ attributes.url || '' } onChange={ ( event ) => setAttributes( { url: event.currentTarget.value } ) } />
				</FieldRow>
				<SegmentedSetting
					label={ __( 'Target', 'blicks' ) }
					help={ controlHelp.linkTarget }
					value={ opensNew ? 'blank' : 'same' }
					options={ [
						{ label: __( 'Same tab', 'blicks' ), value: 'same' },
						{ label: __( 'New tab', 'blicks' ), value: 'blank' },
					] }
					onChange={ ( target ) => setAttributes( {
						linkTarget: target === 'blank' ? '_blank' : '',
						rel: target === 'blank' ? 'noreferrer noopener' : '',
					} ) }
				/>
			</SettingsCard>
			<SettingsCard title={ __( 'Icon', 'blicks' ) }>
				<IconPicker
					value={ icon }
					allowNone
					onChange={ ( next ) => setAttributes( { icon: next } ) }
				/>
				<SegmentedSetting
					label={ __( 'Position', 'blicks' ) }
					help={ controlHelp.iconPosition }
					value={ attributes.iconPosition || 'leading' }
					options={ [
						{ label: __( 'Leading', 'blicks' ), value: 'leading' },
						{ label: __( 'Trailing', 'blicks' ), value: 'trailing' },
					] }
					onChange={ ( iconPosition ) => setAttributes( { iconPosition } ) }
				/>
			</SettingsCard>
		</>
	);
}
