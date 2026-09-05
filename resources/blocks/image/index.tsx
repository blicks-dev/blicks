import { MediaPlaceholder } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { cleanHref } from '@/framework/sanitize';
import { ImageControls, cleanAspectRatio, cleanObjectFit } from './controls';
import { DuotoneFilter, duotoneFilterId, isDuotone } from './duotone';

const imageGlyph = (
	<svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
		<g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
			<rect x="4" y="5" width="16" height="14" rx="3" />
			<circle cx="9" cy="10" r="1.4" />
			<path d="M6.5 17l4.2-4.2 2.6 2.6 1.7-1.7 2.5 3.3" />
		</g>
	</svg>
);

// Both sources are user-controlled and neither is scheme-checked upstream: `url` arrives from
// the media library or `onSelectURL`, `href` from the link control or the HTML importer, which
// reads a pasted `src`. Filtering here covers every path into the rendered anchor.
function imageHref( attributes: any ): string {
	if ( attributes.linkTo === 'media' ) return cleanHref( attributes.url );
	if ( attributes.linkTo === 'custom' ) return cleanHref( attributes.href );
	return '';
}

defineBlock( metadata, {
	Controls: ImageControls,
	render( { attributes, setAttributes, blockProps, richText, isEdit } ) {
		if ( isEdit && ! attributes.url ) {
			return (
				<div { ...blockProps }>
					<MediaPlaceholder
						icon={ imageGlyph }
						labels={ {
							title: __( 'Image', 'blicks' ),
							instructions: __( 'Drag and drop an image, upload, or choose one from your library.', 'blicks' ),
						} }
						accept="image/*"
						allowedTypes={ [ 'image' ] }
						value={ { id: attributes.id, src: attributes.url } }
						className="bl-image-placeholder"
						onSelect={ ( media: any ) =>
							setAttributes( {
								id: media?.id,
								url: media?.url || '',
								alt: media?.alt || media?.alt_text || '',
							} )
						}
						onSelectURL={ ( url: string ) =>
							setAttributes( { url, id: undefined, alt: attributes.alt || '' } )
						}
					/>
				</div>
			);
		}
		if ( ! attributes.url ) return null;

		const ratio = cleanAspectRatio( attributes.aspectRatio );
		const href = imageHref( attributes );
		const duotone = isDuotone( attributes.duotone ) ? attributes.duotone : null;
		const filterId = duotoneFilterId( attributes.uniqueId || '' );
		const img = (
			<img
				src={ attributes.url }
				alt={ attributes.alt || '' }
				style={ {
					aspectRatio: ratio === 'auto' ? undefined : ratio,
					objectFit: cleanObjectFit( attributes.objectFit ) as any,
					filter: duotone ? `url(#${ filterId })` : undefined,
				} }
			/>
		);
		const className = [
			blockProps.className,
			ratio !== 'auto' ? 'has-aspect-ratio' : '',
		].filter( Boolean ).join( ' ' );

		return (
			<figure { ...blockProps } className={ className }>
				{ duotone && <DuotoneFilter id={ filterId } value={ duotone } /> }
				{ href ? <a href={ href }>{ img }</a> : img }
				{ ( isEdit || attributes.caption ) && richText( {
					attr: 'caption',
					tagName: 'figcaption',
					// `wp-element-caption` opts the figcaption into the native theme.json caption
					// element styles edited via the design-system "caption" type role.
					className: 'wp-element-caption',
					placeholder: __( 'Caption...', 'blicks' ),
					allowedFormats: [ 'core/bold', 'core/italic', 'core/link' ],
				} ) }
			</figure>
		);
	},
} );
