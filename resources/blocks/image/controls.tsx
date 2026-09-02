import { Button } from '@wordpress/components';
import { MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { FieldRow, OptionCards, SegmentedSetting, SettingsCard, useBlockHelp } from '@/blocks/shared/settings-ui';
import { DUOTONE_PRESETS, isDuotone, type Duotone } from './duotone';

const ASPECTS = [ 'auto', '1/1', '16/9', '4/3', '3/4' ];
const FITS = [ 'cover', 'contain', 'fill' ];

export function cleanAspectRatio( value: unknown ): string {
	const ratio = String( value || 'auto' ).trim();
	return ASPECTS.includes( ratio ) || /^\d+(\.\d+)?\/\d+(\.\d+)?$/.test( ratio ) ? ratio : 'auto';
}

export function cleanObjectFit( value: unknown ): string {
	const fit = String( value || 'cover' );
	return FITS.includes( fit ) ? fit : 'cover';
}

function mediaAttrs( media: any ) {
	return {
		id: media?.id,
		url: media?.url || media?.sizes?.full?.url || '',
		alt: media?.alt || media?.alt_text || '',
		sizeSlug: 'full',
	};
}

export function ImageControls( { attributes, setAttributes }: { attributes: any; setAttributes: ( a: any ) => void } ) {
	const help = useBlockHelp( 'image' );
	const controlHelp = help?.controls ?? {};

	// Available image sizes (thumbnail/medium/large/full) registered for the selected attachment.
	const sizes = useSelect(
		( select: any ) =>
			attributes.id ? select( 'core' ).getMedia( attributes.id )?.media_details?.sizes ?? null : null,
		[ attributes.id ]
	) as Record< string, { source_url?: string } > | null;
	const sizeSlugs = sizes ? Object.keys( sizes ) : [];

	const chooseSize = ( slug: string ) => {
		const src = sizes?.[ slug ]?.source_url;
		if ( ! src ) return;
		setAttributes( { sizeSlug: slug, url: src } );
	};

	const duotone = isDuotone( attributes.duotone ) ? attributes.duotone : null;
	const sameDuotone = ( a: Duotone | null, b: Duotone | null ) =>
		( ! a && ! b ) || !! ( a && b && a.shadows === b.shadows && a.highlights === b.highlights );
	const setDuotone = ( next: Duotone | null ) => setAttributes( { duotone: next ?? undefined } );

	return (
		<>
			<SettingsCard title={ __( 'Media', 'blicks' ) } help={ help?.description }>
				<div className={ `bl-media-summary ${ attributes.url ? 'has-image' : '' }` }>
					<div className="bl-media-summary__thumb" style={ attributes.url ? { backgroundImage: `url("${ attributes.url }")` } : undefined } />
					<div className="bl-media-summary__body">
						<div className="bl-media-summary__title">{ attributes.url ? __( 'Image selected', 'blicks' ) : __( 'No image selected', 'blicks' ) }</div>
						<MediaUploadCheck>
							<MediaUpload
								allowedTypes={ [ 'image' ] }
								value={ attributes.id }
								onSelect={ ( media: any ) => setAttributes( mediaAttrs( media ) ) }
								render={ ( { open }: { open: () => void } ) => (
									<Button variant="link" onClick={ open }>
										{ attributes.url ? __( 'Replace', 'blicks' ) : __( 'Choose', 'blicks' ) }
									</Button>
								) }
							/>
						</MediaUploadCheck>
						{ attributes.url && (
							<Button variant="link" isDestructive onClick={ () => setAttributes( { id: undefined, url: '', alt: '' } ) }>
								{ __( 'Remove', 'blicks' ) }
							</Button>
						) }
					</div>
				</div>
				<FieldRow label={ __( 'Alt text', 'blicks' ) } help={ controlHelp.alt }>
					<input value={ attributes.alt || '' } onChange={ ( event ) => setAttributes( { alt: event.currentTarget.value } ) } />
				</FieldRow>
			</SettingsCard>
			<SettingsCard title={ __( 'Frame', 'blicks' ) }>
				<OptionCards
					label={ __( 'Aspect ratio', 'blicks' ) }
					help={ controlHelp.aspectRatio }
					value={ cleanAspectRatio( attributes.aspectRatio ) }
					columns={ 3 }
					options={ ASPECTS.map( ( value ) => ( { label: value === 'auto' ? __( 'Original', 'blicks' ) : value, value } ) ) }
					onChange={ ( aspectRatio ) => setAttributes( { aspectRatio } ) }
				/>
				<SegmentedSetting
					label={ __( 'Object fit', 'blicks' ) }
					help={ controlHelp.objectFit }
					value={ cleanObjectFit( attributes.objectFit ) }
					options={ FITS.map( ( value ) => ( { label: value, value } ) ) }
					onChange={ ( objectFit ) => setAttributes( { objectFit } ) }
				/>
				{ sizeSlugs.length > 1 && (
					<FieldRow label={ __( 'Resolution', 'blicks' ) } help={ __( 'Source size loaded for this image.', 'blicks' ) }>
						<select
							value={ sizeSlugs.includes( attributes.sizeSlug ) ? attributes.sizeSlug : 'full' }
							onChange={ ( event ) => chooseSize( event.currentTarget.value ) }
						>
							{ sizeSlugs.map( ( slug ) => (
								<option key={ slug } value={ slug }>{ slug }</option>
							) ) }
						</select>
					</FieldRow>
				) }
			</SettingsCard>
			<SettingsCard title={ __( 'Duotone', 'blicks' ) } help={ __( 'Two-tone color effect — maps shadows and highlights to colors without altering the original image.', 'blicks' ) }>
				<div className="bl-duotone-presets">
					{ DUOTONE_PRESETS.map( ( preset ) => {
						const active = sameDuotone( duotone, preset.value );
						return (
							<button
								type="button"
								key={ preset.name }
								className={ `bl-duotone-presets__item${ active ? ' is-active' : '' }` }
								title={ preset.name }
								onClick={ () => setDuotone( preset.value ) }
							>
								<span
									className="bl-duotone-presets__swatch"
									style={ preset.value
										? { background: `linear-gradient(135deg, ${ preset.value.shadows } 0 50%, ${ preset.value.highlights } 50% 100%)` }
										: undefined }
								/>
								<span className="bl-duotone-presets__label">{ preset.name }</span>
							</button>
						);
					} ) }
				</div>
				<FieldRow label={ __( 'Shadows', 'blicks' ) }>
					<input
						type="color"
						value={ duotone?.shadows || '#000000' }
						onChange={ ( event ) => setDuotone( { shadows: event.currentTarget.value, highlights: duotone?.highlights || '#ffffff' } ) }
					/>
				</FieldRow>
				<FieldRow label={ __( 'Highlights', 'blicks' ) }>
					<input
						type="color"
						value={ duotone?.highlights || '#ffffff' }
						onChange={ ( event ) => setDuotone( { shadows: duotone?.shadows || '#000000', highlights: event.currentTarget.value } ) }
					/>
				</FieldRow>
				{ duotone && (
					<Button variant="link" isDestructive onClick={ () => setDuotone( null ) }>
						{ __( 'Clear duotone', 'blicks' ) }
					</Button>
				) }
			</SettingsCard>
			<SettingsCard title={ __( 'Link', 'blicks' ) }>
				<SegmentedSetting
					label={ __( 'Link to', 'blicks' ) }
					help={ controlHelp.linkTo }
					value={ attributes.linkTo || 'none' }
					options={ [
						{ label: __( 'None', 'blicks' ), value: 'none' },
						{ label: __( 'Media', 'blicks' ), value: 'media' },
						{ label: __( 'Custom', 'blicks' ), value: 'custom' },
					] }
					onChange={ ( linkTo ) => setAttributes( { linkTo } ) }
				/>
				{ attributes.linkTo === 'custom' && (
					<FieldRow label={ __( 'Custom URL', 'blicks' ) } help={ controlHelp.href }>
						<input value={ attributes.href || '' } onChange={ ( event ) => setAttributes( { href: event.currentTarget.value } ) } />
					</FieldRow>
				) }
			</SettingsCard>
		</>
	);
}
