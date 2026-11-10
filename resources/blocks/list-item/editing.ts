/**
 * How a List is typed into: Enter, Tab, Shift+Tab and Backspace move items about the way they do
 * in every word processor. Each operation reads and writes the block editor through the two small
 * interfaces below, so the tests drive them against a plain in-memory tree.
 *
 *  - indent     Tab: the item joins the end of the previous item's inner list (made if missing).
 *  - outdent    Shift+Tab: the item moves out to follow its parent item; the items below it come
 *               along as its children, so nothing jumps above it.
 *  - stepOut    Enter on an empty item: outdent when nested; at the top, the item leaves the list
 *               as a Text, splitting the list when items follow.
 *  - mergeUp    Backspace at the start: first item of an inner list outdents; otherwise its words
 *               join the item drawn just above it (the deepest last one), and its children follow.
 */

export const LIST = 'blicks/list';
export const ITEM = 'blicks/list-item';

export interface ListStore {
	getBlockName( id: string ): string | null;
	getBlockRootClientId( id: string ): string | null;
	getBlockOrder( id?: string | null ): string[];
	getBlockAttributes( id: string ): Record< string, any > | null;
	getBlock( id: string ): any;
}

export interface ListActions {
	insertBlock( block: any, index: number, rootId?: string | null, updateSelection?: boolean ): void;
	moveBlocksToPosition( ids: string[], fromRoot: string | null, toRoot: string | null, index: number ): void;
	removeBlock( id: string, selectPrevious?: boolean ): void;
	removeBlocks( ids: string[], selectPrevious?: boolean ): void;
	updateBlockAttributes( id: string, attributes: Record< string, any > ): void;
	selectionChange( id: string, attributeKey: string, start: number, end: number ): void;
}

/**
 * Fresh blocks, made by the caller (`createBlock` in the editor, a stub in tests). A list is made
 * already holding the blocks it will contain: the editor refuses to move blocks into a list that
 * has not mounted yet (it has no allowed-blocks settings), and would then fill it from its template.
 */
export interface ListMakers {
	list( attributes: Record< string, any >, innerBlocks?: any[] ): { clientId: string };
	text(): { clientId: string };
}

const parentOf = ( s: ListStore, id: string ) => s.getBlockRootClientId( id );

/** The outermost List an item belongs to. */
export function outerList( s: ListStore, id: string ): string | null {
	let list = parentOf( s, id );
	while ( list ) {
		const item = parentOf( s, list );
		if ( ! item || s.getBlockName( item ) !== ITEM ) return list;
		list = parentOf( s, item );
	}
	return null;
}

/** An item's own inner list, if it has one. */
export const innerListOf = ( s: ListStore, item: string ): string | null =>
	s.getBlockOrder( item ).find( ( id ) => s.getBlockName( id ) === LIST ) ?? null;

/** How many levels deep an item sits: 1 for the outer list. */
export function levelOf( s: ListStore, id: string ): number {
	let level = 1;
	let item = parentOf( s, parentOf( s, id ) ?? '' );
	while ( item && s.getBlockName( item ) === ITEM ) {
		level++;
		item = parentOf( s, parentOf( s, item ) ?? '' );
	}
	return level;
}

const siblingIndex = ( s: ListStore, id: string ) => s.getBlockOrder( parentOf( s, id ) ).indexOf( id );

/** An inner list as the outer one would make it: same kind, and marked nested. */
function innerListAttributes( s: ListStore, id: string ) {
	const outer = outerList( s, id );
	return { kind: ( outer && s.getBlockAttributes( outer )?.kind ) || 'bullets', nested: true };
}

/**
 * Lift `ids` out of where they are, as whole blocks with their client ids, and hand them back for
 * a new list to hold. Keeping the ids keeps the selection and the caret on the moved item.
 */
function lift( s: ListStore, a: ListActions, ids: string[] ): any[] {
	const blocks = ids.map( ( id ) => s.getBlock( id ) );
	a.removeBlocks( ids, false );
	return blocks;
}

/** Move `ids` to the end of `item`'s inner list, making that list around them when it has none. */
function moveIntoInnerList( s: ListStore, a: ListActions, make: ListMakers, ids: string[], item: string ): void {
	const existing = innerListOf( s, item );
	if ( existing ) {
		a.moveBlocksToPosition( ids, parentOf( s, ids[ 0 ] ), existing, s.getBlockOrder( existing ).length );
		return;
	}
	const attributes = innerListAttributes( s, item );
	a.insertBlock( make.list( attributes, lift( s, a, ids ) ), s.getBlockOrder( item ).length, item, false );
}

export const canIndent = ( s: ListStore, id: string ) => siblingIndex( s, id ) > 0;
export const canOutdent = ( s: ListStore, id: string ) => {
	const item = parentOf( s, parentOf( s, id ) ?? '' );
	return !! item && s.getBlockName( item ) === ITEM;
};

export function indent( s: ListStore, a: ListActions, make: ListMakers, id: string ): boolean {
	if ( ! canIndent( s, id ) ) return false;
	const previous = s.getBlockOrder( parentOf( s, id ) )[ siblingIndex( s, id ) - 1 ];
	moveIntoInnerList( s, a, make, [ id ], previous );
	return true;
}

export function outdent( s: ListStore, a: ListActions, make: ListMakers, id: string ): boolean {
	if ( ! canOutdent( s, id ) ) return false;
	const list = parentOf( s, id ) as string;
	const parentItem = parentOf( s, list ) as string;
	const upperList = parentOf( s, parentItem );
	const trailing = s.getBlockOrder( list ).slice( siblingIndex( s, id ) + 1 );
	if ( trailing.length ) moveIntoInnerList( s, a, make, trailing, id );
	a.moveBlocksToPosition( [ id ], list, upperList, siblingIndex( s, parentItem ) + 1 );
	if ( s.getBlockOrder( list ).length === 0 ) a.removeBlock( list, false );
	return true;
}

/** Enter on an empty item. Returns the block to put the caret in, or null when nothing moved. */
export function stepOut( s: ListStore, a: ListActions, make: ListMakers, id: string ): string | null {
	if ( canOutdent( s, id ) ) return outdent( s, a, make, id ) ? id : null;
	const list = parentOf( s, id ) as string;
	const container = parentOf( s, list );
	const listIndex = siblingIndex( s, list );
	const items = s.getBlockOrder( list );
	const trailing = items.slice( items.indexOf( id ) + 1 );
	const text = make.text();
	a.insertBlock( text, listIndex + 1, container, false );
	if ( trailing.length ) {
		const { uniqueId: _drop, ...rest } = s.getBlockAttributes( list ) ?? {};
		a.insertBlock( make.list( rest, lift( s, a, trailing ) ), listIndex + 2, container, false );
	}
	a.removeBlock( id, false );
	if ( s.getBlockOrder( list ).length === 0 ) a.removeBlock( list, false );
	return text.clientId;
}

/** The item drawn just above `id`: the previous sibling, or its deepest last child. */
export function itemAbove( s: ListStore, id: string ): string | null {
	const index = siblingIndex( s, id );
	if ( index <= 0 ) return null;
	let item = s.getBlockOrder( parentOf( s, id ) )[ index - 1 ];
	for ( let inner = innerListOf( s, item ); inner; inner = innerListOf( s, item ) ) {
		const children = s.getBlockOrder( inner );
		if ( ! children.length ) break;
		item = children[ children.length - 1 ];
	}
	return item;
}

/**
 * Backspace at the start of an item. `lengthOf` measures an item's words the way the caret counts
 * them (plain characters, formatting aside). Returns false to leave the key to the editor: the
 * first item of the outer list merges with whatever block comes before the list.
 */
export function mergeUp( s: ListStore, a: ListActions, make: ListMakers, id: string, lengthOf: ( html: string ) => number ): boolean {
	if ( siblingIndex( s, id ) === 0 ) {
		return canOutdent( s, id ) ? outdent( s, a, make, id ) : false;
	}
	const target = itemAbove( s, id ) as string;
	const into = String( s.getBlockAttributes( target )?.content ?? '' );
	const own = String( s.getBlockAttributes( id )?.content ?? '' );
	a.updateBlockAttributes( target, { content: into + own } );
	const children = innerListOf( s, id );
	if ( children && s.getBlockOrder( children ).length ) moveIntoInnerList( s, a, make, s.getBlockOrder( children ), target );
	a.removeBlock( id, false );
	const at = lengthOf( into );
	a.selectionChange( target, 'content', at, at );
	return true;
}

/**
 * Pasted text as list items: one per non-empty line, with any bullet or number the source wrote
 * in front taken off (a list copied from a document or an email brings its own). One line, or
 * none, is not a list paste: the editor pastes it as it always does.
 */
export function pastedLines( text: string ): string[] {
	const lines = text
		.split( /\r\n|\r|\n/ )
		.map( ( line ) => line.replace( /^\s*(?:[-*•–·]|\d{1,3}[.)]|[a-z][.)])\s+/i, '' ).trim() )
		.filter( Boolean );
	return lines.length > 1 ? lines : [];
}
