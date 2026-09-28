import { __ } from '@wordpress/i18n';
import { SegmentedSetting, SettingsCard, type Option } from '@/blocks/shared/settings-ui';

/**
 * A scene item is display copy, so the tag choice is about document outline rather than size —
 * the size comes from the Typography facet. Kept to the tags a hero band legitimately needs.
 */
const TAG_OPTIONS: Option[] = [
	{ label: 'P', value: 'p', hint: __( 'default', 'blicks' ) },
	{ label: 'H1', value: 'h1' },
	{ label: 'H2', value: 'h2' },
	{ label: 'H3', value: 'h3' },
	{ label: 'Span', value: 'span' },
];

export function cleanSceneTextTag( tag: unknown ): string {
	const value = String( tag || 'p' );
	return TAG_OPTIONS.some( ( option ) => option.value === value ) ? value : 'p';
}

export function SceneTextControls( {
	attributes,
	setAttributes,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
} ) {
	return (
		<SettingsCard title={ __( 'Text', 'blicks' ) }>
			<SegmentedSetting
				label={ __( 'Tag', 'blicks' ) }
				help={ __( 'Sets the heading level for screen readers and search engines. Visual size lives in Typography.', 'blicks' ) }
				value={ cleanSceneTextTag( attributes.tag ) }
				options={ TAG_OPTIONS }
				onChange={ ( value ) => setAttributes( { tag: cleanSceneTextTag( value ) } ) }
			/>
		</SettingsCard>
	);
}
