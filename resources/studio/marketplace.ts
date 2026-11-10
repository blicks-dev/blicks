/**
 * The Marketplace shelf: the first source registered through `registerSource`.
 *
 * Everything goes through this site's own `/blicks/v1/marketplace/*` routes, never to the
 * marketplace directly. Those routes cache, survive an outage with the last good list, and — the
 * reason they exist — let Blicks Pro add its licence on the server, so the key never reaches this
 * code. All the shelf learns is `licensed`: whether Pro items open here.
 */
import { __, sprintf } from '@wordpress/i18n';
import type { BlockNode } from './mount';
import type { PatternEntry } from './library';
import type { Keyframes } from './motion/keyframes';
import type { SourceLoad, StudioSource } from './registry';

export type Fetcher = < T >( options: { path: string } ) => Promise< T >;
export type Parser = ( content: string ) => BlockNode[];

/** One item as the marketplace lists it — only the fields the shelf reads. */
export interface MarketItem {
	slug: string;
	title: string;
	type?: { slug: string; name: string } | null;
	group?: { slug: string; name: string } | null;
	tier?: string;
	excerpt?: string;
	motion?: string;
	has_content?: boolean;
	preview?: { image?: string | null; url?: string | null; frame?: string | null };
}

interface ItemsBody {
	items?: MarketItem[];
	stale?: string | null;
	licensed?: boolean;
}

interface ContentBody {
	content?: string;
	keyframes?: Keyframes[];
}

const PATH = '/blicks/v1/marketplace';

/** Whether the shelf may ask the marketplace anything, and where its switch is. */
export interface MarketplaceGate {
	enabled: boolean;
	/** Blicks → Settings, for someone who can turn the shelf on; empty for everyone else. */
	settingsUrl: string;
}

/** The gate as the server printed it (`blicksStudioSettings.marketplace`). Off when absent. */
export function marketplaceGate(): MarketplaceGate {
	const raw = ( globalThis as unknown as { blicksStudioSettings?: { marketplace?: Partial< MarketplaceGate > } } ).blicksStudioSettings?.marketplace;

	return {
		enabled: raw?.enabled === true,
		settingsUrl: typeof raw?.settingsUrl === 'string' ? raw.settingsUrl : '',
	};
}

/**
 * The shelf while it is off: no request, no preview frame, only what it would do and where to turn
 * it on. Nothing is fetched until an administrator does.
 */
export function marketplaceOff( gate: MarketplaceGate ): SourceLoad {
	return {
		entries: [],
		error: gate.settingsUrl
			? __( 'The Marketplace is off. Turning it on lets this site fetch designs and previews from showcase.blicks.dev.', 'blicks' )
			: __( 'The Marketplace is off. An administrator can turn it on in Blicks → Settings.', 'blicks' ),
		...( gate.settingsUrl ? { action: { label: __( 'Open Settings', 'blicks' ), href: gate.settingsUrl } } : {} ),
	};
}

/** A WordPress REST failure's own sentence, else a fallback. */
function messageOf( failure: unknown, fallback: string ): string {
	const message = ( failure as { message?: unknown } | null )?.message;
	return typeof message === 'string' && message !== '' ? message : fallback;
}

/** One listed item as a shelf entry. Pro items are locked, not hidden, where Pro is not licensed. */
export function toEntry( item: MarketItem, licensed: boolean, open: PatternEntry[ 'open' ] ): PatternEntry {
	const pro = item.tier === 'pro';
	const locked = pro && ! licensed;

	return {
		id: `marketplace:${ item.slug }`,
		title: item.title,
		source: 'dev',
		kind: item.group?.name ?? item.type?.name ?? '',
		...( item.group?.slug ? { groupSlug: item.group.slug } : {} ),
		blocks: null,
		tier: pro ? 'pro' : 'free',
		...( item.preview?.image ? { image: item.preview.image } : {} ),
		...( item.preview?.frame || item.preview?.url ? { frame: ( item.preview.frame || item.preview.url ) as string } : {} ),
		...( item.excerpt ? { excerpt: item.excerpt } : {} ),
		...( item.motion ? { motion: item.motion } : {} ),
		...( locked ? { locked: true, lockedReason: __( 'Part of Blicks Pro', 'blicks' ) } : { open } ),
	};
}

/** The shelf, from the proxy's list. A stale copy says how old it is rather than pretending. */
export async function loadMarketplace( fetch: Fetcher, parse: Parser ): Promise< SourceLoad > {
	try {
		const body = await fetch< ItemsBody >( { path: `${ PATH }/items?per_page=100` } );
		const licensed = body.licensed === true;
		const entries = ( body.items ?? [] )
			.filter( ( item ) => item && typeof item.slug === 'string' && item.has_content !== false )
			.map( ( item ) => toEntry( item, licensed, () => openMarketplace( item.slug, fetch, parse ) ) );

		return {
			entries,
			stale: body.stale ?? null,
			...( body.stale
				? {
					error: sprintf(
						/* translators: %s: when the shown list was fetched, as a date and time */
						__( 'Can’t reach the marketplace. Showing what was fetched on %s.', 'blicks' ),
						new Date( body.stale ).toLocaleString()
					),
				}
				: {} ),
		};
	} catch ( failure ) {
		return { entries: [], error: messageOf( failure, __( 'Can’t reach the marketplace right now.', 'blicks' ) ) };
	}
}

/** One item's tree and keyframes. Throws with the marketplace's own reason (licence, not built). */
export async function openMarketplace( slug: string, fetch: Fetcher, parse: Parser ): Promise< { blocks: BlockNode[]; keyframes: Keyframes[] } > {
	let body: ContentBody;

	try {
		body = await fetch< ContentBody >( { path: `${ PATH }/items/${ encodeURIComponent( slug ) }/content` } );
	} catch ( failure ) {
		throw new Error( messageOf( failure, __( 'Can’t reach the marketplace right now.', 'blicks' ) ) );
	}

	const blocks = parse( body.content ?? '' );

	if ( blocks.length === 0 ) {
		throw new Error( __( 'This item has no blocks yet.', 'blicks' ) );
	}

	return { blocks, keyframes: Array.isArray( body.keyframes ) ? body.keyframes : [] };
}

export function marketplaceSource( fetch: Fetcher, parse: Parser, gate: () => MarketplaceGate = marketplaceGate ): StudioSource {
	return {
		id: 'marketplace',
		label: __( 'Marketplace', 'blicks' ),
		load: () => {
			const now = gate();
			return now.enabled ? loadMarketplace( fetch, parse ) : Promise.resolve( marketplaceOff( now ) );
		},
	};
}
