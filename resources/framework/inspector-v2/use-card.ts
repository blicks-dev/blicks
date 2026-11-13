import { store as blockEditorStore, useBlockEditContext } from '@wordpress/block-editor';
import { getBlockType } from '@wordpress/blocks';
import { useDispatch, useRegistry } from '@wordpress/data';
import { canBeCard, cardToMark, markCard, type Ancestor } from './card';

/**
 * Whether this block can answer to its card (its states include the engine's `group`), and how to
 * mark that card. The ancestors are read when the choice is made rather than subscribed to: the
 * panel has no reason to re-render as blocks above it change.
 *
 * The block is the one being edited, unless a panel that is not inside its edit context (Studio's)
 * names it.
 */
export function useCard( block?: { clientId: string; name: string } ): { available: boolean; container: boolean; mark: () => void } {
	const context = useBlockEditContext();
	const { clientId, name } = block ?? context;
	const registry = useRegistry();
	const { updateBlockAttributes } = useDispatch( blockEditorStore ) as unknown as { updateBlockAttributes: ( id: string, a: Record< string, unknown > ) => void };
	const supportsOf = ( blockName: string | undefined ) => ( blockName ? ( getBlockType( blockName )?.supports as any )?.blicks : undefined );
	const states = supportsOf( name )?.states;

	return {
		available: Array.isArray( states ) && states.includes( 'group' ),
		container: canBeCard( supportsOf( name )?.controls ),
		mark: () => {
			if ( ! clientId ) return;
			const store = registry.select( blockEditorStore ) as any;
			const ancestors: Ancestor[] = ( store.getBlockParents( clientId, true ) as string[] ).map( ( id ) => {
				const parent = store.getBlock( id );
				return { clientId: id, controls: supportsOf( parent?.name )?.controls, blicks: parent?.attributes?.blicks };
			} );
			const target = cardToMark( ancestors );
			if ( target ) updateBlockAttributes( target.clientId, { blicks: markCard( target.blicks ) } );
		},
	};
}
