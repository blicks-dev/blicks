import { useSelect } from '@wordpress/data';
import { applyFilters } from '@wordpress/hooks';
import { dialogId } from './model';

/** A dialog a Button can open: its id, the name it shows in a picker, and whether it is modal. */
export interface DialogTarget {
	id: string;
	title: string;
	modal: boolean;
	/** Where it lives: `page` for a Dialog block in this post; a companion adds its own (`saved`). */
	source: string;
}

function walk( blocks: any[], visit: ( block: any ) => void ): void {
	for ( const block of blocks ?? [] ) {
		visit( block );
		walk( block.innerBlocks, visit );
	}
}

/**
 * The Dialog blocks in the post being edited, and any the `blicks.dialog.targets` filter adds —
 * a companion plugin lists dialogs saved elsewhere there, so a Button can open them too.
 */
export function useDialogTargets(): DialogTarget[] {
	const blocks = useSelect( ( select: any ) => select( 'core/block-editor' ).getBlocks(), [] );
	const page: DialogTarget[] = [];
	walk( blocks, ( block ) => {
		if ( block.name === 'blicks/dialog' ) {
			page.push( {
				id: dialogId( block.attributes ),
				title: String( block.attributes.title || block.attributes.anchor || '' ),
				modal: block.attributes.modal !== false,
				source: 'page',
			} );
		}
	} );
	return applyFilters( 'blicks.dialog.targets', page ) as DialogTarget[];
}

/** How many Buttons in the post open the dialog with this id. */
export function useOpenerCount( id: string ): number {
	return useSelect( ( select: any ) => {
		let count = 0;
		walk( select( 'core/block-editor' ).getBlocks(), ( block ) => {
			if ( block.name === 'blicks/button' && block.attributes.action === 'dialog' && `dialog-${ block.attributes.dialog }` === id ) count++;
		} );
		return count;
	}, [ id ] );
}

/**
 * The anchors already taken by other Dialog blocks in the post, space-separated: a string, so the
 * selector returns an equal value while nothing changes.
 */
export function useTakenAnchors( clientId: string ): string {
	return useSelect( ( select: any ) => {
		const taken: string[] = [];
		walk( select( 'core/block-editor' ).getBlocks(), ( block ) => {
			if ( block.name === 'blicks/dialog' && block.clientId !== clientId && block.attributes.anchor ) taken.push( block.attributes.anchor );
		} );
		return taken.join( ' ' );
	}, [ clientId ] );
}
