import { useDispatch, useSelect } from '@wordpress/data';

/** The step's place among its siblings, and a way to make it the current one. */
export function useStepPlace( clientId?: string ) {
	const { parent, index } = useSelect( ( select: any ) => {
		const store = select( 'core/block-editor' );
		const p = clientId ? store.getBlockRootClientId( clientId ) : null;
		return { parent: p, index: p ? store.getBlockOrder( p ).indexOf( clientId ) : -1 };
	}, [ clientId ] );
	const { updateBlockAttributes } = useDispatch( 'core/block-editor' ) as any;
	return { parent, index, makeCurrent: () => parent && updateBlockAttributes( parent, { current: index + 1 } ) };
}

