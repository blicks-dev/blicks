import { __ } from '@wordpress/i18n';
import { BlockIcon } from '@wordpress/block-editor';
import { getBlockType } from '@wordpress/blocks';
import { createCentredItem } from '@/blocks/scene-shared/new-item';
import { useDispatch, useSelect } from '@wordpress/data';
import './inserter.scss';

interface Props {
	clientId?: string;
	isEdit: boolean;
	/** Row 0 has nothing above it inside the clipped stage, so the bar flips inward there. */
	row: number;
}

/**
 * The element types a box will take.
 *
 * Read from the box's own `allowedBlocks` rather than listed here, so the bar is a view of the
 * rule instead of a second copy of it. When a scene-video or scene-chart block is registered and
 * added to that list, its button appears with no change to this file.
 */
function useAllowedChildren( clientId?: string ) {
	return useSelect(
		( select: any ) => {
			const store = select( 'core/block-editor' );
			const names: string[] = clientId
				? store?.getAllowedBlocks?.( clientId )?.map( ( b: any ) => b.name ) ?? []
				: [];

			// `getAllowedBlocks` is unavailable in some editor versions; the block type's own
			// setting is the same list and is always there.
			const fallback = ( getBlockType( 'blicks/scene-box' ) as any )?.allowedBlocks ?? [];
			const list = names.length ? names : fallback;

			return list
				.map( ( name: string ) => getBlockType( name ) )
				.filter( Boolean )
				.map( ( type: any ) => ( { name: type.name, title: type.title, icon: type.icon } ) );
		},
		[ clientId ]
	);
}

/**
 * The per-box element inserter.
 *
 * A box is a region, not a flow, so WordPress's end-of-list appender points at nothing useful
 * inside one. This is the affordance that replaces it: the types this box accepts, on the box,
 * visible the moment it is selected.
 */
export function SceneBoxInserter( { clientId, isEdit, row }: Props ) {
	const children = useAllowedChildren( clientId );
	const { insertBlock } = useDispatch( 'core/block-editor' ) as any;

	if ( ! isEdit || ! clientId || children.length === 0 ) return null;

	const add = ( name: string ) => insertBlock( createCentredItem( name ), undefined, clientId, true );

	return (
		<span
			className={ `bl-scene-box-inserter${ row === 0 ? ' is-inside' : '' }` }
			// The bar is chrome sitting on the stage, so a press on it must not reach the box's
			// move gesture underneath.
			onPointerDown={ ( event ) => event.stopPropagation() }
		>
			<span className="bl-scene-box-inserter__label">{ __( 'Add element', 'blicks' ) }</span>
			{ children.map( ( child: any ) => (
				<button
					key={ child.name }
					type="button"
					className="bl-scene-box-inserter__btn"
					title={ child.title }
					aria-label={ child.title }
					onClick={ () => add( child.name ) }
				>
					<BlockIcon icon={ child.icon } />
				</button>
			) ) }
		</span>
	);
}
