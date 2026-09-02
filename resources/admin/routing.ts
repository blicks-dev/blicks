import { bootstrap } from './bootstrap';
import { ADMIN_VIEWS } from './constants';
import type { AdminView } from './types';

// Each view is its own WP submenu page (`admin.php?page=blicks-design`), so the **page slug**
// owns the view and the hash owns the design view's *section* (`#design/color`). Hash-only
// URLs still work — links minted before the submenus existed, and the editor's deep links —
// so `#design` alone resolves to the design view.
export { ADMIN_VIEWS };

export function parseHash(): { view: AdminView; section: string } {
	const [ rawView, section ] = window.location.hash.replace( /^#/, '' ).split( '/' );
	const view = ( ADMIN_VIEWS as readonly string[] ).includes( rawView ) ? rawView as AdminView : 'overview';
	return { view, section: section ?? '' };
}

/** The view the current URL points at: the hash wins when it names one, else the page slug. */
export function viewFromUrl(): AdminView {
	const rawHash = window.location.hash.replace( /^#/, '' ).split( '/' )[ 0 ];
	if ( ( ADMIN_VIEWS as readonly string[] ).includes( rawHash ) ) {
		return rawHash as AdminView;
	}

	const page = new URLSearchParams( window.location.search ).get( 'page' ) ?? '';
	const match = Object.entries( bootstrap().pageSlugs ).find( ( [ , slug ] ) => slug === page );

	return match ? match[ 0 ] as AdminView : bootstrap().view;
}

/**
 * The in-page URL for a view: its own submenu page, plus the hash so a link copied out of the
 * address bar restores the same place even on an install where the slug is unknown.
 */
export function urlForView( view: AdminView, section = '' ): string {
	const { adminUrl, pageSlugs } = bootstrap();
	const hash = section ? `#${ view }/${ section }` : `#${ view }`;
	const slug = pageSlugs[ view ];

	if ( ! adminUrl || ! slug ) return hash;

	return `${ adminUrl }?page=${ encodeURIComponent( slug ) }${ hash }`;
}
