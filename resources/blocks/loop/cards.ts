/**
 * Card designs for a Loop: the shapes the picker deals in, and binding a chosen card to the item's
 * fields.
 *
 * The designs themselves — built-ins, store items, saved patterns — come from the Studio's bundle at
 * runtime ({@see cardDesigns}; `resources/studio/card-designs.ts` says why they cannot be imported).
 * Choosing one copies its card into the Loop — a copy, not a link, like every pattern the Studio
 * mounts — and {@see matchFields} connects its blocks to the item's fields by name: the first
 * heading shows `title`, a text `excerpt`/`description`, an image `image`, a button `url`. Whatever
 * it cannot place stays typed text, and each block's Data section can change it.
 */
import type { BlockNode } from '../../studio/mount';

export type CardSource = 'builtin' | 'store' | 'site';

export interface CardOption {
	id: string;
	title: string;
	source: CardSource;
	/** The collection's name and colours, for a built-in: what tells two "Feature card"s apart. */
	collection?: { name: string; accent: string; ground: string };
	/** The card, when it is in hand. A store item is fetched when it is chosen. */
	card: BlockNode | null;
	/** Fetch the pattern and take its card out, for an entry that does not hold one yet. */
	load?: () => Promise< BlockNode | null >;
	locked?: boolean;
	lockedReason?: string;
	/** Free or Pro, for a store item. */
	tier?: 'free' | 'pro';
	/** The store's preview picture, shown until the item is fetched. */
	image?: string;
	/** The store's live preview page, framed when the card itself cannot be fetched (a locked item). */
	frame?: string;
	/** What the shelf's filter chips offer: the collection, Free / Pro, Animated, a category. */
	filters?: Array< { id: string; label: string; swatch?: [ string, string ] } >;
}

export interface CardShelf {
	options: CardOption[];
	/** Why the shelf is empty when a source could not be read. */
	error: string;
}

/** What the Studio publishes on `window.blicks.studio.cardDesigns`. */
export interface CardDesigns {
	builtin: () => CardShelf;
	remote: () => Promise< { store: CardShelf; site: CardShelf } >;
}

/** The Studio's card designs, or null where its bundle is not loaded. */
export function cardDesigns(): CardDesigns | null {
	const studio = ( window as unknown as { blicks?: { studio?: { cardDesigns?: CardDesigns } } } ).blicks?.studio;
	return studio?.cardDesigns ?? null;
}

/** Field names tried in order, per thing a card block can show. The first one the data has wins. */
const NAMES = {
	title: [ 'title', 'name', 'headline', 'heading', 'label' ],
	text: [ 'excerpt', 'description', 'summary', 'blurb', 'subtitle', 'body', 'text', 'content', 'bio', 'role', 'price', 'date' ],
	image: [ 'image', 'featured_image', 'photo', 'picture', 'thumbnail', 'avatar', 'cover', 'img', 'image_url' ],
	url: [ 'url', 'link', 'href', 'permalink' ],
	cta: [ 'cta', 'button', 'action', 'link_text' ],
	badge: [ 'badge', 'tag', 'status', 'category' ],
} as const;

const SOURCE = 'blicks/item';

/**
 * A copy of `card` with its blocks bound to `fields` by name.
 *
 * Each field is used once, so a card with two texts shows `excerpt` and `price` rather than the
 * same line twice; texts are served longest first, so the body gets the description. A block already bound keeps its binding. No uniqueIds are
 * copied: the block factory gives each new block its own, so two Loops made from one design never
 * share a style scope.
 */
export function matchFields( card: BlockNode, fields: string[] ): BlockNode {
	const have = new Set( fields );
	const used = new Set< string >();
	const take = ( names: readonly string[] ): string | null => {
		const found = names.find( ( name ) => have.has( name ) && ! used.has( name ) );
		if ( found ) {
			used.add( found );
		}
		return found ?? null;
	};
	const titleField = NAMES.title.find( ( name ) => have.has( name ) ) ?? null;

	// Texts are given fields longest first, so the body copy shows `description` and a short
	// eyebrow or label above it keeps its own words. Equal lengths keep their order.
	const texts: BlockNode[] = [];
	const collect = ( node: BlockNode ): void => {
		if ( node.name === 'blicks/text' && ! ( node.attributes?.metadata as { bindings?: { content?: unknown } } | undefined )?.bindings?.content ) {
			texts.push( node );
		}
		( node.innerBlocks ?? [] ).forEach( collect );
	};
	collect( card );
	const plain = ( node: BlockNode ): number => String( node.attributes?.content ?? '' ).replace( /<[^>]*>/g, '' ).length;
	const textFields = new Map< BlockNode, string | null >();
	[ ...texts ].sort( ( a, b ) => plain( b ) - plain( a ) ).forEach( ( node ) => textFields.set( node, take( NAMES.text ) ) );

	const visit = ( node: BlockNode ): BlockNode => {
		const { uniqueId: _drop, ...attributes } = ( node.attributes ?? {} ) as Record< string, unknown >;
		const metadata = ( attributes.metadata ?? {} ) as { bindings?: Record< string, unknown > };
		const bindings: Record< string, unknown > = { ...( metadata.bindings ?? {} ) };
		const bind = ( attr: string, key: string | null ) => {
			if ( key && ! bindings[ attr ] ) {
				bindings[ attr ] = { source: SOURCE, args: { key } };
			}
		};

		switch ( node.name ) {
			case 'blicks/heading':
				bind( 'content', bindings.content ? null : take( NAMES.title ) );
				break;
			case 'blicks/text':
				bind( 'content', textFields.get( node ) ?? null );
				break;
			case 'blicks/image':
				bind( 'url', bindings.url ? null : take( NAMES.image ) );
				bind( 'alt', bindings.url ? titleField : null );
				break;
			case 'blicks/button':
				bind( 'text', bindings.text ? null : take( NAMES.cta ) );
				bind( 'url', bindings.url ? null : take( NAMES.url ) );
				break;
			case 'blicks/box':
				if ( attributes.kind === 'badge' ) {
					bind( 'text', bindings.text ? null : take( NAMES.badge ) );
				}
				break;
		}

		const next: Record< string, unknown > = { ...attributes };
		if ( Object.keys( bindings ).length > 0 ) {
			next.metadata = { ...metadata, bindings };
		}
		return { name: node.name, attributes: next, innerBlocks: ( node.innerBlocks ?? [] ).map( visit ) };
	};

	return visit( card );
}

/** How many blocks `matchFields` bound, for the note after a card is chosen. */
export function countBindings( node: BlockNode ): number {
	const own = Object.keys( ( node.attributes?.metadata as { bindings?: object } | undefined )?.bindings ?? {} ).length;
	return ( node.innerBlocks ?? [] ).reduce( ( sum, child ) => sum + countBindings( child ), own );
}
