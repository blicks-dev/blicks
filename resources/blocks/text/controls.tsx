import { ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { SettingsCard, SegmentedSetting, useBlockHelp } from '@/blocks/shared/settings-ui';
import { TypographyControl } from '@/controls/typography/TypographyControl';

// Semantic element for the text. `p` for paragraphs (default); `span` for inline labels/badges,
// `small` for fine print, `div` for a generic block — so tiny UI text isn't forced into a <p>.
const TAG_OPTIONS = [
	{ label: __( 'Paragraph', 'blicks' ), value: 'p' },
	{ label: __( 'Span', 'blicks' ), value: 'span' },
	{ label: __( 'Div', 'blicks' ), value: 'div' },
	{ label: __( 'Small', 'blicks' ), value: 'small' },
];

export function cleanTextTag( tag: unknown ): string {
	const value = String( tag || 'p' );
	return TAG_OPTIONS.some( ( option ) => option.value === value ) ? value : 'p';
}

// Variant applies a design-system type role. `lead` consumes the editable Lead role tokens.
const VARIANT_OPTIONS = [
	{ label: __( 'Default', 'blicks' ), value: 'default' },
	{ label: __( 'Lead', 'blicks' ), value: 'lead' },
];

export function cleanTextVariant( variant: unknown ): string {
	const value = String( variant || 'default' );
	return VARIANT_OPTIONS.some( ( option ) => option.value === value ) ? value : 'default';
}

export function TextControls( {
	attributes,
	setAttributes,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
} ) {
	const help = useBlockHelp( 'text' );

	return (
		<>
			<SettingsCard title={ __( 'Typography', 'blicks' ) } help={ help?.description }>
				<TypographyControl
					attributes={ attributes }
					setAttributes={ setAttributes }
					state="default"
					breakpoint="base"
				/>
			</SettingsCard>
			<SettingsCard title={ __( 'Format', 'blicks' ) }>
				<SegmentedSetting
					label={ __( 'HTML tag', 'blicks' ) }
					value={ cleanTextTag( attributes.tag ) }
					options={ TAG_OPTIONS }
					onChange={ ( tag ) => setAttributes( { tag } ) }
				/>
				<SegmentedSetting
					label={ __( 'Variant', 'blicks' ) }
					value={ cleanTextVariant( attributes.variant ) }
					options={ VARIANT_OPTIONS }
					onChange={ ( variant ) => setAttributes( { variant } ) }
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __( 'Drop cap', 'blicks' ) }
					help={ __( 'Enlarge the first letter of the paragraph.', 'blicks' ) }
					checked={ !! attributes.dropCap }
					onChange={ ( dropCap ) => setAttributes( { dropCap } ) }
				/>
			</SettingsCard>
		</>
	);
}
