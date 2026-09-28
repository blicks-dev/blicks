import { __ } from '@wordpress/i18n';
import { MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { Button } from '@wordpress/components';
import { FieldRow, SegmentedSetting, SettingsCard, type Option } from '@/blocks/shared/settings-ui';

const FIT_OPTIONS: Option[] = [
	{ label: __( 'Cover', 'blicks' ), value: 'cover', hint: __( 'default', 'blicks' ) },
	{ label: __( 'Contain', 'blicks' ), value: 'contain' },
	{ label: __( 'Fill', 'blicks' ), value: 'fill' },
	{ label: __( 'None', 'blicks' ), value: 'none' },
];

export function cleanObjectFit( fit: unknown ): string {
	const value = String( fit || 'cover' );
	return FIT_OPTIONS.some( ( option ) => option.value === value ) ? value : 'cover';
}

export function SceneImageControls( {
	attributes,
	setAttributes,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
} ) {
	return (
		<>
			<SettingsCard title={ __( 'Media', 'blicks' ) }>
				<MediaUploadCheck>
					<MediaUpload
						allowedTypes={ [ 'image' ] }
						value={ attributes.id }
						onSelect={ ( media: any ) =>
							setAttributes( {
								id: media?.id,
								url: media?.url || '',
								alt: media?.alt || media?.alt_text || '',
							} )
						}
						render={ ( { open }: { open: () => void } ) => (
							<Button variant="secondary" onClick={ open }>
								{ attributes.url ? __( 'Replace image', 'blicks' ) : __( 'Choose image', 'blicks' ) }
							</Button>
						) }
					/>
				</MediaUploadCheck>
				<FieldRow
					label={ __( 'Alt text', 'blicks' ) }
					help={ __( 'Describe the image for screen readers. Leave empty only if it is purely decorative.', 'blicks' ) }
				>
					<input
						type="text"
						value={ attributes.alt || '' }
						onChange={ ( event ) => setAttributes( { alt: event.currentTarget.value } ) }
					/>
				</FieldRow>
			</SettingsCard>

			<SettingsCard title={ __( 'Display', 'blicks' ) }>
				<SegmentedSetting
					label={ __( 'Fit', 'blicks' ) }
					help={ __( 'How the picture fills the item box when you give it an explicit width and height.', 'blicks' ) }
					value={ cleanObjectFit( attributes.objectFit ) }
					options={ FIT_OPTIONS }
					onChange={ ( value ) => setAttributes( { objectFit: cleanObjectFit( value ) } ) }
				/>
			</SettingsCard>
		</>
	);
}
