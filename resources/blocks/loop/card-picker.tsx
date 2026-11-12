/**
 * The Loop's Kind section in the sidebar — its card design: which design the card came from, which fields
 * its blocks show, and a way back to the shelf. The designs themselves are chosen on the canvas
 * (`card-shelf.tsx`), where they can be previewed on the Loop's own items.
 */
import { useSelect } from '@wordpress/data';
import { getBlockType } from '@wordpress/blocks';
import { __, sprintf } from '@wordpress/i18n';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { Note, Row, Sec } from '@/framework/inspector-v2/kit';
import { cardDesigns } from './cards';
import { loopSource } from '@/framework/loop-sources';
import { closeCardShelf, openCardShelf, useShelfView } from './card-shelf';

/** Second fields a block can show, named after the block: "%s alt text", "%s link". */
const ATTR_LABELS: Record< string, () => string > = {
	/* translators: %s: block name, e.g. "Image". */
	alt: () => __( '%s alt text', 'blicks' ),
	/* translators: %s: block name, e.g. "Button". */
	url: () => __( '%s link', 'blicks' ),
	/* translators: %s: block name, e.g. "Image". */
	href: () => __( '%s link', 'blicks' ),
};

/** Every binding in the card, top to bottom: the block's title and the field it shows. */
function bindings( blocks: any[] ): Array< { block: string; field: string } > {
	return blocks.flatMap( ( b ) => {
		const title = ( getBlockType( b.name ) as any )?.title ?? b.name;
		const own = Object.entries< any >( b.attributes?.metadata?.bindings ?? {} )
			.filter( ( [ , binding ] ) => binding?.source === 'blicks/item' && typeof binding.args?.key === 'string' )
			.map( ( [ attr, binding ] ) => ( {
				// A block showing two fields says which is which: "Image" for the picture, "Image alt text".
				block: ATTR_LABELS[ attr ] && ! ( attr === 'url' && b.name === 'blicks/image' ) ? sprintf( ATTR_LABELS[ attr ](), title ) : title,
				field: binding.args.key as string,
			} ) );
		return [ ...own, ...bindings( b.innerBlocks ?? [] ) ];
	} );
}

export function CardSec( { clientId, attributes }: PanelProps ) {
	// A source another plugin adds may bring its own starter cards: the shelf opens for those even
	// where the Studio (and so the built-in designs) is not loaded.
	const canPick = !! cardDesigns() || ( loopSource( attributes?.source )?.cards?.length ?? 0 ) > 0;
	const card = useSelect( ( select: any ) => ( clientId ? select( 'core/block-editor' ).getBlocks( clientId ) : [] ), [ clientId ] );
	const view = useShelfView( clientId ?? '' );
	const name: string | undefined = card[ 0 ]?.attributes?.metadata?.name;
	const shown = bindings( card );

	return (
		<Sec title={ __( 'Kind', 'blicks' ) } icon="category" value={ name ?? __( 'Your own', 'blicks' ) }>
			<Row
				label={ __( 'Card design', 'blicks' ) }
				stack
				set={ !! name }
				note={ canPick ? undefined : __( 'Card designs come with the Studio, which is not loaded in this editor.', 'blicks' ) }
				noteIcon="info"
			>
				{ canPick ? (
					<button
						type="button"
						className="link-btn"
						aria-expanded={ view.open }
						onClick={ () => clientId && ( view.open ? closeCardShelf( clientId ) : openCardShelf( clientId ) ) }
					>
						{ view.open ? __( 'Close the designs', 'blicks' ) : __( 'Choose a design on the canvas', 'blicks' ) }
					</button>
				) : <span>{ name ?? __( 'Your own', 'blicks' ) }</span> }
			</Row>
			{ shown.length > 0 ? (
				<Row label={ __( 'Fields shown', 'blicks' ) } stack>
					<ul className="loop-fields" aria-label={ __( 'Fields the card shows', 'blicks' ) }>
						{ shown.map( ( { block, field }, i ) => (
							<li key={ i }><span>{ block }</span><code>{ field }</code></li>
						) ) }
					</ul>
				</Row>
			) : (
				<Note>{ __( 'No block in the card shows an item field yet. Select one and choose a field in its Data section.', 'blicks' ) }</Note>
			) }
		</Sec>
	);
}
