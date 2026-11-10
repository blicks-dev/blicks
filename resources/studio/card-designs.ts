/**
 * Card designs for a Loop, taken from the patterns the Studio already shelves.
 *
 * A Loop's card is just its inner blocks, so a "card design" is any Box card or panel found inside
 * a pattern: the built-ins (each collection's feature card, offer panel and closing card), the
 * store's items and the patterns saved on this site.
 *
 * **Why this lives in the Studio's bundle.** The editor and the Studio are separate classic
 * scripts; a module both imported would make Rollup split a shared chunk, which neither can load.
 * So, as with `window.blicks.designPanel`, they meet at runtime: the Studio entry publishes
 * {@see cardDesignsApi} on `window.blicks.studio.cardDesigns` and the Loop's "Card design" section
 * reads it (`resources/blocks/loop/card-picker.tsx`). Binding the chosen card to item fields is the
 * Loop's job and stays there (`resources/blocks/loop/cards.ts`).
 *
 * Nothing here fetches on its own: the REST client and the parser are handed in.
 */
import { __ } from '@wordpress/i18n';
import type { BlockNode } from './mount';
import type { PatternEntry } from './library';
import { BUILTIN_PATTERNS } from './builtins';
import { COLLECTIONS } from './collections';
import { loadMarketplace, type Fetcher as MarketFetcher } from './marketplace';
import { loadSitePatterns, type Fetcher as SiteFetcher } from './patterns';
import type { CardOption, CardShelf, CardDesigns } from '../blocks/loop/cards';

const CARD_KINDS = [ 'card', 'panel' ];

/** The first Box card or panel with something in it, depth first. */
export function findCard( blocks: BlockNode[] ): BlockNode | null {
	for ( const block of blocks ) {
		const kind = block.attributes?.kind;
		if ( block.name === 'blicks/box' && CARD_KINDS.includes( String( kind ) ) && ( block.innerBlocks ?? [] ).length > 0 ) {
			return block;
		}
		const inner = findCard( block.innerBlocks ?? [] );
		if ( inner ) {
			return inner;
		}
	}
	return null;
}

/** What each composition's card is called once it stands alone in a Loop. */
const BUILTIN_TITLES: Record< string, () => string > = {
	features: () => __( 'Feature card', 'blicks' ),
	offer: () => __( 'Offer panel', 'blicks' ),
	cta: () => __( 'Call-to-action card', 'blicks' ),
};

/** Every built-in that holds a card, collection by collection. */
export function builtinCards( entries: PatternEntry[] = BUILTIN_PATTERNS ): CardOption[] {
	return entries.flatMap( ( entry ): CardOption[] => {
		const card = findCard( entry.blocks ?? [] );
		if ( ! card ) {
			return [];
		}
		const collection = COLLECTIONS.find( ( c ) => c.id === entry.collection );
		const slug = entry.id.split( ':' ).pop() ?? '';
		return [ {
			id: entry.id,
			title: BUILTIN_TITLES[ slug ]?.() ?? entry.title,
			source: 'builtin',
			card,
			...( collection ? {
				collection: { name: collection.name, accent: collection.palette.accent, ground: collection.palette.ground },
				filters: [ { id: `collection:${ collection.id }`, label: collection.name, swatch: [ collection.palette.ground, collection.palette.accent ] as [ string, string ] } ],
			} : {} ),
		} ];
	} );
}

/**
 * Saved patterns that hold a card. They arrive as markup; `parse` is core's, handed in so this
 * file needs no editor. A pattern with no card in it is left out rather than offered and refused.
 */
export function siteCards( entries: PatternEntry[], parse: ( content: string ) => BlockNode[] ): CardOption[] {
	return entries.flatMap( ( entry ): CardOption[] => {
		const card = findCard( entry.blocks ?? parse( entry.content ?? '' ) );
		return card ? [ {
			id: entry.id,
			title: entry.title,
			source: 'site',
			card,
			...( entry.kind ? { filters: [ { id: `category:${ entry.kind }`, label: entry.kind } ] } : {} ),
		} ] : [];
	} );
}

/**
 * The card in a store item. Items in the store's cards group are cards already, usually one Box
 * holding the whole design with no `kind` of its own, so when no Box card or panel is found inside,
 * the item's single root block is the card.
 */
export function storeCard( blocks: BlockNode[] ): BlockNode | null {
	const roots = blocks.filter( ( b ) => b.name.startsWith( 'blicks/' ) );
	return findCard( blocks ) ?? ( roots.length === 1 && ( roots[ 0 ].innerBlocks ?? [] ).length > 0 ? roots[ 0 ] : null );
}

/** The store group whose items are cards. Every other group (buttons, texts, lists…) is left out. */
export const STORE_CARD_GROUP = 'cards';

/**
 * Store items in the cards group. The tree is fetched when the shelf draws the item, so it can be
 * shown as a real card with the Loop's data; a locked Pro item cannot be fetched and shows its
 * live preview page instead.
 */
export function storeCards( entries: PatternEntry[] ): CardOption[] {
	return entries.filter( ( entry ) => entry.groupSlug === STORE_CARD_GROUP ).map( ( entry ) => ( {
		id: entry.id,
		title: entry.title,
		source: 'store' as const,
		card: null,
		...( entry.tier ? { tier: entry.tier } : {} ),
		...( entry.image ? { image: entry.image } : {} ),
		...( entry.frame ? { frame: entry.frame } : {} ),
		filters: [
			entry.tier === 'pro' ? { id: 'tier:pro', label: __( 'Pro', 'blicks' ) } : { id: 'tier:free', label: __( 'Free', 'blicks' ) },
			...( entry.motion && entry.motion !== 'static' ? [ { id: 'motion:moving', label: __( 'Animated', 'blicks' ) } ] : [] ),
		],
		...( entry.locked ? { locked: true, lockedReason: entry.lockedReason ?? '' } : {} ),
		...( entry.open ? { load: async () => storeCard( ( await entry.open!() ).blocks ) } : {} ),
	} ) );
}

/**
 * What the Studio publishes for the Loop. Built-ins are in hand; the store and saved patterns are
 * fetched once per editor session and shared by every Loop.
 */
export function cardDesignsApi( fetch: MarketFetcher & SiteFetcher, parse: ( content: string ) => BlockNode[] ): CardDesigns {
	let remote: Promise< { store: CardShelf; site: CardShelf } > | null = null;

	return {
		builtin: () => ( { options: builtinCards(), error: '' } ),
		remote: () => {
			remote ??= Promise.all( [ loadMarketplace( fetch, parse ), loadSitePatterns( fetch ) ] ).then( ( [ store, site ] ) => ( {
				store: { options: storeCards( store.entries ), error: store.entries.length ? '' : store.error ?? '' },
				site: { options: siteCards( site.entries, parse ), error: site.error ?? '' },
			} ) );
			return remote;
		},
	};
}
