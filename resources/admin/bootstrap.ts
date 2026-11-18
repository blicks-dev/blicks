import { BUILTIN_VIEWS } from './constants';
import type { AdminBootstrap, AdminView, ExternalView, MenuEntry, MenuGroup, SupportLink } from './types';

// `window.blicksAdminSettings` is injected by AssetServiceProvider. Everything the admin UI
// needs from PHP — the real plugin version, the real docs URL, the page slug of each view —
// comes through here, so no user-visible string in the SPA is a hardcoded guess.
const FALLBACK: AdminBootstrap = {
	version: '',
	view: 'overview',
	pageSlugs: {},
	adminUrl: '',
	docsUrl: '',
	editorUrl: '',
	supportLinks: [],
	externalViews: [],
	menu: [],
};

const MENU_GROUPS: readonly MenuGroup[] = [ 'build', 'system' ];

function readInjected(): Record< string, unknown > {
	const injected = ( window as unknown as { blicksAdminSettings?: unknown } ).blicksAdminSettings;
	return typeof injected === 'object' && injected !== null ? injected as Record< string, unknown > : {};
}

function readString( source: Record< string, unknown >, key: string ): string {
	const value = source[ key ];
	return typeof value === 'string' ? value : '';
}

/**
 * `view => slug`, for every page PHP says this user can open.
 *
 * No longer filtered against the built-in list: that filter is exactly what would drop a
 * companion plugin's page. PHP has already capability-checked these, so the only validation left
 * is that both halves are non-empty strings.
 */
function readPageSlugs( source: Record< string, unknown > ): Record< string, string > {
	const raw = source.pageSlugs;
	if ( typeof raw !== 'object' || raw === null ) return {};

	const entries = Object.entries( raw as Record< string, unknown > )
		.filter( ( [ view, slug ] ) => view !== '' && typeof slug === 'string' && slug !== '' );

	return Object.fromEntries( entries ) as Record< string, string >;
}

/** Pages registered by other plugins. Anything malformed is dropped, never rendered. */
function readExternalViews( source: Record< string, unknown > ): ExternalView[] {
	const raw = source.externalViews;
	if ( ! Array.isArray( raw ) ) return [];

	return raw.filter( ( entry ): entry is ExternalView => {
		if ( typeof entry !== 'object' || entry === null ) return false;

		const { id, label, slug } = entry as Partial< ExternalView >;

		return typeof id === 'string' && id !== ''
			&& typeof label === 'string' && label !== ''
			&& typeof slug === 'string' && slug !== ''
			// A companion cannot claim a built-in id and take over a Blicks panel.
			&& ! ( BUILTIN_VIEWS as readonly string[] ).includes( id );
	} );
}

/**
 * The admin menu, in PHP's order. An entry with an unknown group is kept in `build` — the same
 * fallback PHP applies — and one missing its id, label or slug is dropped.
 */
function readMenu( source: Record< string, unknown > ): MenuEntry[] {
	const raw = source.menu;
	if ( ! Array.isArray( raw ) ) return [];

	return raw.flatMap( ( entry ): MenuEntry[] => {
		if ( typeof entry !== 'object' || entry === null ) return [];

		const { id, label, slug, group } = entry as Partial< Record< keyof MenuEntry, unknown > >;

		if ( typeof id !== 'string' || id === '' || typeof label !== 'string' || label === '' || typeof slug !== 'string' || slug === '' ) {
			return [];
		}

		return [ {
			id,
			label,
			slug,
			group: ( MENU_GROUPS as readonly unknown[] ).includes( group ) ? group as MenuGroup : 'build',
		} ];
	} );
}

/**
 * Docs and issue links. Dropped rather than rendered if either half is missing — a CTA with an
 * empty href looks like a broken button, which is worse than one link fewer.
 */
function readSupportLinks( source: Record< string, unknown > ): SupportLink[] {
	const raw = source.supportLinks;
	if ( ! Array.isArray( raw ) ) return [];

	return raw.filter( ( entry ): entry is SupportLink => {
		if ( typeof entry !== 'object' || entry === null ) return false;

		const { label, url } = entry as Partial< SupportLink >;

		return typeof label === 'string' && label !== ''
			&& typeof url === 'string' && url !== '';
	} );
}

let cached: AdminBootstrap | null = null;

export function bootstrap(): AdminBootstrap {
	if ( cached ) return cached;

	const source = readInjected();
	const view = readString( source, 'view' );

	const externalViews = readExternalViews( source );
	const known = [
		...BUILTIN_VIEWS as readonly string[],
		...externalViews.map( entry => entry.id ),
	];

	cached = {
		...FALLBACK,
		version: readString( source, 'version' ),
		view: known.includes( view ) ? view as AdminView : 'overview',
		pageSlugs: readPageSlugs( source ),
		adminUrl: readString( source, 'adminUrl' ),
		docsUrl: readString( source, 'docsUrl' ),
		editorUrl: readString( source, 'editorUrl' ),
		supportLinks: readSupportLinks( source ),
		externalViews,
		menu: readMenu( source ),
	};

	return cached;
}
