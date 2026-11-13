import { MediaPlaceholder, store as blockEditorStore } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock, type RenderCtx } from '@/framework/define-block';
import { cleanHref } from '@/framework/sanitize';
import { ImageMotion, ImageSettings, ImageStyle, ImageToolbar } from './controls';
import { cleanAdjust, cleanAspectRatio, cleanFocus, cleanObjectFit, figureLook, filterCss, needsFrame } from './model';
import { DuotoneFilter, duotoneFilterId, isDuotone } from './duotone';
import { WithBound, bindingOf } from '@/blocks/loop/binding';

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

/**
 * Where the Image waits for a picture. In a preview (a Loop's card designs, the inserter) nothing can
 * be clicked, and the upload buttons would sit inside the preview's own button: an empty frame
 * stands in for them.
 */
function ImagePlaceholder( { blockProps, ratio, children }: { blockProps: any; ratio: string; children: JSX.Element } ): JSX.Element {
	const preview = useSelect( ( select: any ) => !! select( blockEditorStore ).getSettings().isPreviewMode, [] );
	if ( preview ) {
		const style = { ...blockProps.style, aspectRatio: 'auto' === ratio ? '4 / 3' : ratio };
		return <div { ...blockProps } className={ [ blockProps.className, 'bl-image-placeholder', 'is-preview' ].filter( Boolean ).join( ' ' ) } style={ style } aria-hidden="true" />;
	}
	return <div { ...blockProps }>{ children }</div>;
}

/** The Image's markup, editor and save alike. */
function drawImage( { attributes, setAttributes, blockProps, richText, isEdit }: RenderCtx ): JSX.Element | null {
		if ( isEdit && ! attributes.url ) {
			return (
				<ImagePlaceholder blockProps={ blockProps } ratio={ cleanAspectRatio( attributes.aspectRatio ) }>
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
				</ImagePlaceholder>
			);
		}
		// Bound to an item field (a Loop card), the picture is filled per item on the server
		// (`Bindings::write()` sets `src`), so the figure is saved even before it has an address.
		const bound = !! attributes.metadata?.bindings?.url;
		if ( ! attributes.url && ! bound ) return null;

		const ratio = cleanAspectRatio( attributes.aspectRatio );
		const href = imageHref( attributes );
		const duotone = isDuotone( attributes.duotone ) ? attributes.duotone : null;
		const filterId = duotoneFilterId( attributes.uniqueId || '' );
		const fit = cleanObjectFit( attributes.objectFit );
		// The focus point only matters where the frame crops the picture.
		const focus = ratio !== 'auto' && fit === 'cover' ? cleanFocus( attributes.focus ) : '';
		const img = (
			<img
				src={ attributes.url || undefined }
				alt={ attributes.decorative ? '' : attributes.alt || '' }
				style={ {
					aspectRatio: ratio === 'auto' ? undefined : ratio,
					objectFit: fit as any,
					objectPosition: focus || undefined,
					filter: filterCss( duotone ? filterId : null, cleanAdjust( attributes.adjust ) ),
				} }
				// The first image people see loads before the rest; WordPress lazy-loads the others.
				{ ...( attributes.eager ? { loading: 'eager', fetchpriority: 'high' } as any : {} ) }
			/>
		);
		// Inline, inside a Button: a span holding the picture, with no caption and no link of its
		// own — a figure, a figcaption or a second link is invalid inside the button's link.
		if ( attributes.inline ) {
			return (
				<span { ...blockProps } className={ [ blockProps.className, 'bl-image--inline' ].join( ' ' ) }>
					{ duotone && <DuotoneFilter id={ filterId } value={ duotone } /> }
					{ img }
				</span>
			);
		}

		const look = figureLook( attributes );
		const className = [
			blockProps.className,
			ratio !== 'auto' ? 'has-aspect-ratio' : '',
			...look.classes,
		].filter( Boolean ).join( ' ' );
		const style = Object.keys( look.style ).length ? { ...blockProps.style, ...look.style } : blockProps.style;
		const newTab = attributes.linkTo === 'custom' && attributes.linkTarget === '_blank';
		const linked = href ? <a href={ href } { ...( newTab ? { target: '_blank', rel: 'noreferrer noopener' } : {} ) }>{ img }</a> : img;
		const over = attributes.capPos === 'over';
		const caption = ( isEdit || attributes.caption ) && richText( {
			attr: 'caption',
			tagName: 'figcaption',
			// `wp-element-caption` opts the figcaption into the native theme.json caption
			// element styles edited via the design-system "caption" type role.
			className: 'wp-element-caption',
			placeholder: __( 'Caption...', 'blicks' ),
			allowedFormats: [ 'core/bold', 'core/italic', 'core/link' ],
		} );

		return (
			<figure { ...blockProps } className={ className } style={ style }>
				{ duotone && <DuotoneFilter id={ filterId } value={ duotone } /> }
				{ needsFrame( attributes ) ? (
					<span className="bl-image__frame">
						{ linked }
						{ over && caption }
					</span>
				) : linked }
				{ ! ( over && needsFrame( attributes ) ) && caption }
			</figure>
		);
}

defineBlock( metadata, {
	panels: {
		Settings: ImageSettings,
		Style: ImageStyle,
		Motion: ImageMotion,
		describe: ( attributes ) => ( attributes.url ? String( attributes.url ).split( '/' ).pop()?.split( '?' )[ 0 ] ?? '' : '' ),
	},
	Toolbar: ImageToolbar,
	render( ctx ) {
		// Inside a Loop with its picture or alt text bound to a field, the live card draws the
		// current item's values (loop/binding.tsx). Saved markup is unchanged.
		if ( ctx.isEdit && ( bindingOf( ctx.attributes, 'url' ) || bindingOf( ctx.attributes, 'alt' ) ) ) {
			return <WithBound attributes={ ctx.attributes } clientId={ ctx.clientId } kinds={ { url: 'image', alt: 'text' } }>{ ( attributes ) => drawImage( { ...ctx, attributes } ) }</WithBound>;
		}
		return drawImage( ctx );
	},
} );
