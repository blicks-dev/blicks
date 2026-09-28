import { __ } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';

interface Props {
	/** The Scene itself — the root of the breadcrumb. */
	clientId: string;
}

const TYPE_LABEL: Record< string, string > = {
	'blicks/scene-text': __( 'Text', 'blicks' ),
	'blicks/scene-image': __( 'Image', 'blicks' ),
};

/** The same label the layers panel shows, so one item reads identically in both places. */
function itemLabel( block: any ): string {
	const explicit = String( block?.attributes?.metadata?.name ?? '' ).trim();
	if ( explicit ) return explicit;

	const content = String( block?.attributes?.content ?? '' ).replace( /<[^>]*>/g, '' ).trim();
	if ( content ) return content.length > 24 ? `${ content.slice( 0, 24 ) }…` : content;

	const alt = String( block?.attributes?.alt ?? '' ).trim();
	if ( alt ) return alt;

	return TYPE_LABEL[ block?.name ] ?? __( 'Item', 'blicks' );
}

/**
 * What is selected, as a breadcrumb.
 *
 * On a stage, items overlap and sit anywhere, so "which thing am I about to change" is a real
 * question the canvas alone cannot answer — the selection outline may be under something else or
 * off-screen at the current zoom. The Scene chip is also the way back out: clicking it reselects
 * the stage, which is otherwise awkward once every pixel is covered by an item.
 */
export function SceneSelection( { clientId }: Props ) {
	const { selectedId, block, isScene } = useSelect(
		( select: any ) => {
			const store = select( 'core/block-editor' );
			const id = store.getSelectedBlockClientId();
			return {
				selectedId: id,
				block: id ? store.getBlock( id ) : null,
				// A descendant of this Scene, rather than the Scene itself or some other block.
				isScene: id === clientId,
			};
		},
		[ clientId ]
	);

	const { selectBlock } = useDispatch( 'core/block-editor' ) as any;

	const inScene = Boolean( selectedId ) && ! isScene && Boolean( TYPE_LABEL[ block?.name ] );

	return (
		<span className="bl-scene-selection">
			<span className="bl-scene-selection__label">{ __( 'Selected', 'blicks' ) }</span>
			<button
				type="button"
				className={ `bl-scene-selection__chip${ isScene ? ' is-current' : '' }` }
				onClick={ () => selectBlock( clientId ) }
			>
				{ __( 'Scene', 'blicks' ) }
			</button>
			{ inScene && (
				<>
					<span className="bl-scene-selection__sep" aria-hidden="true">/</span>
					<span className="bl-scene-selection__chip is-current">
						<span className="bl-scene-selection__type">{ TYPE_LABEL[ block.name ] }</span>
						{ itemLabel( block ) }
					</span>
				</>
			) }
		</span>
	);
}
