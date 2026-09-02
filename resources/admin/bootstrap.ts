import { ADMIN_VIEWS } from './constants';
import type { AdminBootstrap, AdminView } from './types';

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
};

function readInjected(): Record< string, unknown > {
	const injected = ( window as unknown as { blicksAdminSettings?: unknown } ).blicksAdminSettings;
	return typeof injected === 'object' && injected !== null ? injected as Record< string, unknown > : {};
}

function readString( source: Record< string, unknown >, key: string ): string {
	const value = source[ key ];
	return typeof value === 'string' ? value : '';
}

function readPageSlugs( source: Record< string, unknown > ): Partial< Record< AdminView, string > > {
	const raw = source.pageSlugs;
	if ( typeof raw !== 'object' || raw === null ) return {};

	const entries = Object.entries( raw as Record< string, unknown > )
		.filter( ( [ view, slug ] ) => ( ADMIN_VIEWS as readonly string[] ).includes( view ) && typeof slug === 'string' );

	return Object.fromEntries( entries ) as Partial< Record< AdminView, string > >;
}

let cached: AdminBootstrap | null = null;

export function bootstrap(): AdminBootstrap {
	if ( cached ) return cached;

	const source = readInjected();
	const view = readString( source, 'view' );

	cached = {
		...FALLBACK,
		version: readString( source, 'version' ),
		view: ( ADMIN_VIEWS as readonly string[] ).includes( view ) ? view as AdminView : 'overview',
		pageSlugs: readPageSlugs( source ),
		adminUrl: readString( source, 'adminUrl' ),
		docsUrl: readString( source, 'docsUrl' ),
		editorUrl: readString( source, 'editorUrl' ),
	};

	return cached;
}
