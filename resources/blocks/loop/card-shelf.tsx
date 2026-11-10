/**
 * The Loop's card designs, chosen on the canvas through the shared Pattern Shelf.
 *
 * A new Loop opens on the shelf, under its cards: every design is drawn with the Loop's first
 * item, and pointing at one previews it on every card. Picking one replaces the card with a copy
 * whose blocks are bound to fields with matching names ({@see matchFields}); a snackbar offers
 * Undo. Afterwards the shelf comes back from the block toolbar ("Card design") or the sidebar.
 *
 * What is open, and which design is being previewed, is editor state, not block attributes: a
 * small store keyed by the Loop's clientId, like the preview stepper's. The design's name is kept
 * as the card's `metadata.name`, which is also what List View shows.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useDispatch, useSelect } from '@wordpress/data';
import { cloneBlock, createBlock, getBlockType } from '@wordpress/blocks';
import { __, _n, sprintf } from '@wordpress/i18n';
import { PatternShelf, type ShelfOption, type ShelfSource, type ShelfState } from '../shared/pattern-shelf';
import type { BlockNode } from '../../studio/mount';
import { bindBlocks, Preview } from './canvas';
import { cardDesigns, countBindings, matchFields, type CardOption, type CardShelf, type CardSource } from './cards';
import { useLoopItems } from './use-items';

/* ------------------------------------------------------------------ editor state per Loop */

interface ShelfView {
	open: boolean;
	/** The card of the design being pointed at, or null. Bound to fields where it is drawn. */
	hover: BlockNode | null;
	/** Closed with "Start with a plain card" or by picking: the starter card no longer opens it. */
	dismissed: boolean;
}

const views = new Map< string, ShelfView >();
const listeners = new Set< () => void >();
const CLOSED: ShelfView = { open: false, hover: null, dismissed: false };

function setView( clientId: string, patch: Partial< ShelfView > ): void {
	views.set( clientId, { ...( views.get( clientId ) ?? CLOSED ), ...patch } );
	listeners.forEach( ( l ) => l() );
}

export function useShelfView( clientId: string ): ShelfView {
	return useSyncExternalStore(
		( l ) => {
			listeners.add( l );
			return () => listeners.delete( l );
		},
		() => views.get( clientId ) ?? CLOSED
	);
}

export const openCardShelf = ( clientId: string ): void => setView( clientId, { open: true } );
export const closeCardShelf = ( clientId: string ): void => setView( clientId, { open: false, hover: null, dismissed: true } );

/* ------------------------------------------------------------------ the designs */

type Option = ShelfOption & { design: CardOption };

const SOURCES: ShelfSource[] = [
	{ id: 'builtin', label: __( 'Built-in', 'blicks' ), empty: __( 'No built-in designs.', 'blicks' ) },
	{ id: 'store', label: __( 'Store', 'blicks' ), empty: __( 'The store has no designs right now.', 'blicks' ) },
	{ id: 'site', label: __( 'Your patterns', 'blicks' ), empty: __( 'None of your saved patterns has a card in it yet. Save one from the Studio and it shows up here.', 'blicks' ) },
];

/** What a design is called on the card it made (`metadata.name`): "Feature card · Funky". */
export const designLabel = ( design: CardOption ): string => ( design.collection ? `${ design.title } · ${ design.collection.name }` : design.title );

/** Whether the card holds a block of this name, at any depth. */
const holds = ( node: BlockNode, name: string ): boolean => node.name === name || ( node.innerBlocks ?? [] ).some( ( child ) => holds( child, name ) );

/**
 * Filters from what the card holds, so a Loop whose items have pictures can ask for cards with one.
 * A store card has them once it is fetched.
 */
function contentFilters( design: CardOption ): NonNullable< CardOption[ 'filters' ] > {
	const card = cardInHand( design );
	if ( ! card ) return [];
	return [
		...( holds( card, 'blicks/image' ) ? [ { id: 'has:image', label: __( 'With picture', 'blicks' ) } ] : [] ),
		...( holds( card, 'blicks/button' ) ? [ { id: 'has:button', label: __( 'With button', 'blicks' ) } ] : [] ),
	];
}

const toOption = ( design: CardOption ): Option => ( {
	id: design.id,
	title: design.title,
	source: design.source,
	design,
	subtitle: design.collection?.name ?? ( design.source === 'site' ? __( 'Saved pattern', 'blicks' ) : __( 'Store', 'blicks' ) ),
	filters: [ ...( design.filters ?? [] ), ...contentFilters( design ) ],
	...( design.tier ? { tier: design.tier } : {} ),
	...( design.locked ? { locked: true, lockedReason: design.lockedReason } : {} ),
} );

/**
 * Store cards, fetched once each and kept for the editor session: the thumbnail, the preview on
 * every item and the pick all use the same tree. `null` is "fetched, but there is no card in it".
 */
const fetched = new Map< string, BlockNode | null >();
const fetching = new Map< string, Promise< BlockNode | null > >();
/** Bumped as store cards arrive, so the shelf's filters catch up with what has been fetched. */
let fetchedVersion = 0;

function useFetchedVersion(): number {
	return useSyncExternalStore(
		( l ) => {
			listeners.add( l );
			return () => listeners.delete( l );
		},
		() => fetchedVersion
	);
}

function fetchCard( design: CardOption ): Promise< BlockNode | null > {
	if ( design.card ) return Promise.resolve( design.card );
	if ( fetched.has( design.id ) ) return Promise.resolve( fetched.get( design.id )! );
	if ( ! design.load ) return Promise.resolve( null );
	if ( ! fetching.has( design.id ) ) {
		fetching.set( design.id, design.load().then(
			( card ) => {
				fetched.set( design.id, card );
				return card;
			},
			() => {
				fetched.set( design.id, null );
				return null;
			}
		).finally( () => {
			fetching.delete( design.id );
			fetchedVersion += 1;
			listeners.forEach( ( l ) => l() );
		} ) );
	}
	return fetching.get( design.id )!;
}

/** The design's card once it is in hand: at once for a built-in or saved one, after a fetch for a store one. */
function useCard( design: CardOption ): BlockNode | null | 'loading' {
	const ready = design.card ?? ( fetched.has( design.id ) ? fetched.get( design.id )! : undefined );
	const [ card, setCard ] = useState< BlockNode | null | undefined >( ready );
	useEffect( () => {
		if ( card !== undefined ) return;
		let live = true;
		fetchCard( design ).then( ( c ) => live && setCard( c ) );
		return () => {
			live = false;
		};
	}, [ design, card ] );
	return card === undefined ? 'loading' : card;
}

const cardInHand = ( design: CardOption ): BlockNode | null => design.card ?? fetched.get( design.id ) ?? null;

/** The designs, by source. The store and saved patterns are fetched once the tab is opened. */
function useDesigns(): ( source: string ) => ShelfState< Option > | 'unavailable' {
	const designs = cardDesigns();
	const [ remote, setRemote ] = useState< { store: CardShelf; site: CardShelf } | null >( null );
	const [ asked, setAsked ] = useState( false );

	useEffect( () => {
		if ( ! designs || ! asked || remote ) return;
		let live = true;
		designs.remote().then( ( r ) => live && setRemote( r ) );
		return () => {
			live = false;
		};
	}, [ designs, asked, remote ] );

	const builtin = useMemo( () => designs?.builtin(), [ designs ] );
	// Read so the options (and their filters) are rebuilt as store cards arrive.
	useFetchedVersion();

	return ( source ) => {
		if ( ! designs || ! builtin ) return 'unavailable';
		const wrap = ( s: CardShelf ) => ( { options: s.options.map( toOption ), error: s.error } );
		if ( source === 'builtin' ) return wrap( builtin );
		if ( ! asked ) queueMicrotask( () => setAsked( true ) );
		return remote ? wrap( remote[ source as Exclude< CardSource, 'builtin' > ] ) : 'loading';
	};
}

/** A tree as editor blocks, without blocks this site does not have. */
export function toBlocks( node: BlockNode ): any | null {
	if ( ! getBlockType( node.name ) ) return null;
	const children = ( node.innerBlocks ?? [] ).map( toBlocks ).filter( Boolean );
	return createBlock( node.name, ( node.attributes ?? {} ) as never, children );
}

/* ------------------------------------------------------------------ the shelf on the canvas */

/** The starter card a new Loop is inserted with (index.tsx `template`), untouched. */
export function isStarterCard( blocks: any[] ): boolean {
	const [ box ] = blocks;
	if ( blocks.length !== 1 || box?.name !== 'blicks/box' || box.attributes?.metadata ) return false;
	const inner = box.innerBlocks ?? [];
	return inner.length === 2
		&& inner[ 0 ].name === 'blicks/heading' && inner[ 0 ].attributes?.content === __( 'Item title', 'blicks' )
		&& inner[ 1 ].name === 'blicks/text' && inner[ 1 ].attributes?.content === __( 'A line about this item.', 'blicks' )
		&& ! inner.some( ( b: any ) => b.attributes?.metadata );
}

/** The store's live preview page, scaled to the thumbnail, as the Studio's store cards draw it. */
function Frame( { src }: { src: string } ) {
	return <iframe className="bl-shelf__frame" src={ src } title="" tabIndex={ -1 } aria-hidden="true" loading="lazy" sandbox="allow-scripts" width={ 640 } height={ 600 } />;
}

function Thumb( { option, fields, item }: { option: Option; fields: string[]; item: Record< string, unknown > | undefined } ) {
	const design = option.design;
	// A locked store item cannot be fetched, so there is nothing to fill with the Loop's data.
	const card = useCard( design.locked ? { ...design, load: undefined } : design );
	const blocks = useMemo( () => {
		if ( ! card || card === 'loading' ) return null;
		const block = toBlocks( matchFields( card, fields ) );
		return block ? ( item ? bindBlocks( [ block ], item as never, [] ) : [ block ] ) : null;
	}, [ card, fields, item ] );

	if ( blocks ) return <Preview blocks={ blocks } />;
	if ( design.frame && ( card === null || design.locked ) ) return <Frame src={ design.frame } />;
	if ( design.image ) return <img className="bl-shelf__image" src={ design.image } alt="" />;
	return <span className="bl-shelf__placeholder">{ card === 'loading' ? __( 'Loading preview…', 'blicks' ) : option.title }</span>;
}

export function LoopCardShelf( { clientId, attributes, layout }: { clientId: string; attributes: any; layout: 'wide' | 'grid' } ) {
	const designs = useDesigns();
	const { data, loading } = useLoopItems( attributes );
	const fields = useMemo( () => ( data?.fields ?? [] ).map( ( f ) => f.key ), [ data ] );
	const first = data?.items[ 0 ];
	const current = useSelect( ( select: any ) => select( 'core/block-editor' ).getBlocks( clientId ), [ clientId ] );
	const { replaceInnerBlocks } = useDispatch( 'core/block-editor' ) as any;
	const { createSuccessNotice, createErrorNotice } = useDispatch( 'core/notices' ) as any;
	const [ busy, setBusy ] = useState< string | null >( null );
	// Chosen while the Loop's fields were still on their way: used as soon as they arrive.
	const [ pending, setPending ] = useState< Option | null >( null );
	const inUse = current[ 0 ]?.attributes?.metadata?.name ?? null;

	useEffect( () => {
		if ( pending && ! loading ) {
			setPending( null );
			void pick( pending );
		}
		// `pick` reads the latest render's fields; only the arrival of the fields matters here.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ pending, loading ] );

	if ( designs( 'builtin' ) === 'unavailable' ) return null;

	async function pick( option: Option ): Promise< void > {
		setBusy( option.id );
		try {
			const card = await fetchCard( option.design );
			if ( ! card ) {
				createErrorNotice( __( 'That design has no card in it. Pick another.', 'blicks' ), { type: 'snackbar' } );
				return;
			}
			const bound = matchFields( card, fields );
			const block = toBlocks( { ...bound, attributes: { ...bound.attributes, metadata: { ...( bound.attributes?.metadata as object ?? {} ), name: designLabel( option.design ) } } } );
			if ( ! block ) {
				createErrorNotice( __( 'That design uses blocks this site does not have.', 'blicks' ), { type: 'snackbar' } );
				return;
			}
			const previous = current.map( ( b: any ) => cloneBlock( b ) );
			replaceInnerBlocks( clientId, [ block ], false );
			setView( clientId, { open: false, hover: null, dismissed: true } );
			const count = countBindings( bound );
			createSuccessNotice(
				count
					? sprintf( /* translators: %d: blocks showing an item field */ _n( 'Card changed. %d block shows an item field.', 'Card changed. %d blocks show item fields.', count, 'blicks' ), count )
					: __( 'Card changed. Connect its blocks to fields in their Data section.', 'blicks' ),
				{
					type: 'snackbar',
					id: `blicks-loop-card-${ clientId }`,
					actions: [ { label: __( 'Undo', 'blicks' ), onClick: () => replaceInnerBlocks( clientId, previous, false ) } ],
				}
			);
		} catch ( failure ) {
			createErrorNotice( ( failure as { message?: string } )?.message || __( 'That design could not be opened. Try again.', 'blicks' ), { type: 'snackbar' } );
		} finally {
			setBusy( null );
		}
	}

	const wide = layout === 'wide';

	return (
		<PatternShelf< Option >
			title={ wide ? __( 'Choose a card for this Loop', 'blicks' ) : __( 'Change the card', 'blicks' ) }
			blurb={ wide
				? __( 'Each design is shown with your first item. It becomes a copy you can edit, with its blocks connected to fields that have matching names.', 'blicks' )
				: __( 'Point at a design to preview it on every item. Using one replaces the current card.', 'blicks' ) }
			sources={ SOURCES }
			shelf={ ( source ) => {
				const s = designs( source );
				return s === 'unavailable' ? { options: [], error: '' } : s;
			} }
			preview={ ( option ) => <Thumb option={ option } fields={ fields } item={ first } /> }
			onHover={ ( option ) => setView( clientId, { hover: option ? cardInHand( option.design ) : null } ) }
			onPick={ ( option ) => {
				if ( loading ) {
					setPending( option );
					setBusy( option.id );
				} else {
					void pick( option );
				}
			} }
			isCurrent={ ( option ) => inUse === designLabel( option.design ) }
			busy={ busy }
			layout={ layout }
			hint={ loading ? __( 'Reading the Loop’s fields…', 'blicks' ) : undefined }
			action={ wide
				? { label: __( 'Start with a plain card', 'blicks' ), onClick: () => closeCardShelf( clientId ) }
				: { label: __( 'Close', 'blicks' ), onClick: () => closeCardShelf( clientId ) } }
		/>
	);
}
