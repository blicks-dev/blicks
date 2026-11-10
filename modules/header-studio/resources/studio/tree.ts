/**
 * Layers, in the header's own words: Top bar, Main row, its Start / Centre / End, the menu's items
 * with "Mega" beside the ones that open a panel. Selection still maps to client ids.
 */
import { getBlockType } from '@wordpress/blocks';
import { __, _n, sprintf } from '@wordpress/i18n';
import type { Block, TreeNode } from './host';

const SLOTS: Record< string, string > = {
	start: __( 'Start', 'blicks-pro' ),
	centre: __( 'Center', 'blicks-pro' ),
	end: __( 'End', 'blicks-pro' ),
};

const text = ( html: unknown ): string => String( html ?? '' ).replace( /<[^>]*>/g, '' ).trim();

/** A row's name: what the author called it, else Top bar above a main row, else Main row / Row n. */
export function rowLabel( row: Block, index: number, count: number ): string {
	const named = text( ( row.attributes?.metadata as { name?: unknown } | undefined )?.name );
	if ( named ) return named;
	if ( count > 1 && index === 0 ) return __( 'Top bar', 'blicks-pro' );
	if ( count === 1 || index === 1 ) return __( 'Main row', 'blicks-pro' );
	/* translators: %d: the row's number */
	return sprintf( __( 'Row %d', 'blicks-pro' ), index + 1 );
}

function element( block: Block ): TreeNode | null {
	if ( ! block.clientId ) return null;

	if ( block.name === 'blicks/nav' ) {
		const items = block.innerBlocks ?? [];
		return {
			clientId: block.clientId,
			label: __( 'Menu', 'blicks-pro' ),
			note: String( items.length ),
			children: items.flatMap( ( item ) => {
				if ( ! item.clientId ) return [];
				const panel = ( item.innerBlocks ?? [] ).find( ( b ) => b.name === 'blicks/mega-panel' );
				const label = text( item.attributes?.label ) || __( 'Menu item', 'blicks-pro' );
				return [
					{
						clientId: item.clientId,
						label,
						...( panel?.clientId ? { note: __( 'Mega', 'blicks-pro' ), children: [ { clientId: panel.clientId, label: __( 'Mega menu', 'blicks-pro' ) } ] } : {} ),
					},
				];
			} ),
		};
	}

	const title = ( getBlockType( block.name ) as { title?: string } | undefined )?.title ?? block.name;
	const own = text( block.attributes?.text ?? block.attributes?.content ?? block.attributes?.label );
	return { clientId: block.clientId, label: own || title, ...( own ? { note: title } : {} ) };
}

export function headerTree( blocks: Block[] ): TreeNode[] {
	const [ root ] = blocks;
	if ( ! root?.clientId || root.name !== 'blicks/header' ) return [];

	const rows = ( root.innerBlocks ?? [] ).filter( ( b ) => b.name === 'blicks/header-row' );

	return [
		{
			clientId: root.clientId,
			label: __( 'Header', 'blicks-pro' ),
			/* translators: %d: how many rows */
			note: sprintf( _n( '%d row', '%d rows', rows.length, 'blicks-pro' ), rows.length ),
			children: rows.flatMap( ( row, i ) =>
				row.clientId
					? [
							{
								clientId: row.clientId,
								label: rowLabel( row, i, rows.length ),
								children: ( row.innerBlocks ?? [] ).flatMap( ( areaBlock ) =>
									areaBlock.clientId
										? [
												{
													clientId: areaBlock.clientId,
													label: SLOTS[ String( areaBlock.attributes?.slot ?? 'start' ) ] ?? SLOTS.start,
													children: ( areaBlock.innerBlocks ?? [] ).map( element ).filter( ( n ): n is TreeNode => !! n ),
												},
										  ]
										: []
								),
							},
					  ]
					: []
			),
		},
	];
}

/** A tree is the header mode's when it is one Header block. */
export const isHeader = ( blocks: Block[] ): boolean => blocks.length === 1 && blocks[ 0 ]?.name === 'blicks/header';
