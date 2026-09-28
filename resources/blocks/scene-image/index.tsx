import { MediaPlaceholder } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { SceneHandles, sceneDragProps } from '@/blocks/scene-shared/scene-item';
import { SceneImageControls, cleanObjectFit } from './controls';

const imageGlyph = (
	<svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
		<g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
			<rect x="4" y="5" width="16" height="14" rx="3" />
			<circle cx="9" cy="10" r="1.4" />
			<path d="M6.5 17l4.2-4.2 2.6 2.6 1.7-1.7 2.5 3.3" />
		</g>
	</svg>
);

defineBlock( metadata, {
	Controls: SceneImageControls,
	render( { attributes, setAttributes, blockProps, isEdit } ) {
		const className = [ blockProps.className, 'bl-scene-item' ].filter( Boolean ).join( ' ' );
		const drag = sceneDragProps( { attributes, setAttributes, isEdit } );

		if ( isEdit && ! attributes.url ) {
			// The placeholder is still a positioned item — it has to be draggable before it has a
			// picture, or an author cannot compose the layout until every image is chosen.
			return (
				<div { ...blockProps } className={ className } { ...drag }>
					<MediaPlaceholder
						icon={ imageGlyph }
						labels={ {
							title: __( 'Scene image', 'blicks' ),
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
					<SceneHandles attributes={ attributes } setAttributes={ setAttributes } isEdit={ isEdit } />
				</div>
			);
		}

		if ( ! attributes.url ) return null;

		return (
			<div { ...blockProps } className={ className } { ...drag }>
				<img
					src={ attributes.url }
					alt={ attributes.alt || '' }
					style={ { objectFit: cleanObjectFit( attributes.objectFit ) as any } }
				/>
				<SceneHandles attributes={ attributes } setAttributes={ setAttributes } isEdit={ isEdit } />
			</div>
		);
	},
} );
