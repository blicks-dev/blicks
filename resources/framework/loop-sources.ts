import type { ComponentType } from 'react';

/**
 * Loop sources other plugins add in the editor, through `window.blicks.loop.registerSource()`.
 *
 * The PHP side (`Blicks\Data\LoopSources`, filter `blicks_loop_sources`) supplies the items; this side
 * lists the source in the Loop's "Comes from", draws its own settings rows, and offers its starter
 * cards in the card shelf. The ids must match: `vendor/name`.
 */

/** A block tree, as the card shelf deals in. */
export interface SourceCard {
	id: string;
	title: string;
	card: { name: string; attributes?: Record< string, unknown >; innerBlocks?: SourceCard[ 'card' ][] };
}

export interface SourceSettingsProps {
	/** The Loop's `sourceArgs`. */
	args: Record< string, unknown >;
	/** Replaces `sourceArgs` (pass the whole object). */
	setArgs: ( next: Record< string, unknown > ) => void;
	/** The Loop's other attributes, read-only. */
	attributes: Record< string, unknown >;
}

export interface LoopSource {
	id: string;
	label: string;
	/** The source's own rows in the Loop's Data section. */
	Settings?: ComponentType< SourceSettingsProps >;
	/** A note under "Comes from". */
	note?: string;
	/** True when the source orders its own items: the Loop's "Order by" row is hidden. */
	ordersItself?: boolean;
	/** False when the Loop's "Only show" rules do not apply. */
	rules?: boolean;
	/** Starter card designs, offered in the card shelf while this is the Loop's source. */
	cards?: SourceCard[];
}

const ID = /^[a-z0-9-]+\/[a-z0-9-]+$/;
const sources = new Map< string, LoopSource >();

/**
 * Add a source. Returns false (and registers nothing) for a malformed id or a duplicate: the first
 * registration of an id wins.
 */
export function registerSource( source: LoopSource ): boolean {
	if ( ! source || 'string' !== typeof source.id || ! ID.test( source.id ) || sources.has( source.id ) ) {
		return false;
	}

	sources.set( source.id, {
		...source,
		label: 'string' === typeof source.label && source.label ? source.label : source.id,
		cards: Array.isArray( source.cards ) ? source.cards.filter( ( c ) => c && 'string' === typeof c.id && c.card?.name ) : [],
	} );

	return true;
}

/** A registered source, or undefined (built-ins are not here). */
export function loopSource( id: unknown ): LoopSource | undefined {
	return 'string' === typeof id ? sources.get( id ) : undefined;
}

/** Every registered source, in registration order. */
export function loopSources(): LoopSource[] {
	return [ ...sources.values() ];
}

/** Whether an id is shaped like another plugin's source (registered or not: its plugin may be off). */
export function isSourceId( id: unknown ): boolean {
	return 'string' === typeof id && ID.test( id );
}

/** For tests. */
export function resetSources(): void {
	sources.clear();
}
