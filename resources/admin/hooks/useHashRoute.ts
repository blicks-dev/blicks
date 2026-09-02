import { useCallback, useEffect, useState } from '@wordpress/element';
import { bootstrap } from '../bootstrap';
import { parseHash, urlForView, viewFromUrl } from '../routing';
import type { AdminView } from '../types';

/**
 * Owns the active tab. Each view has its own WP submenu page, so switching tabs pushes that
 * page's URL (no reload — the SPA is already mounted) and re-points the `#adminmenu`
 * highlight, keeping the WP sidebar honest about where the user is. Back/forward and any
 * external hash change route back through the URL.
 */
export function useHashRoute(): { activeView: AdminView; changeView: ( view: AdminView ) => void } {
	const [ activeView, setActiveView ] = useState< AdminView >( () => viewFromUrl() );

	// Stable identity: it feeds the command palette's memoised index, which would otherwise
	// rebuild the whole token list on every render.
	const changeView = useCallback( ( view: AdminView ): void => {
		setActiveView( view );
		const section = view === 'design' ? parseHash().section : '';
		window.history.pushState( null, '', urlForView( view, section ) );
		syncAdminMenu( view );
	}, [] );

	useEffect( () => {
		const onNavigate = (): void => {
			const view = viewFromUrl();
			setActiveView( view );
			syncAdminMenu( view );
		};

		window.addEventListener( 'hashchange', onNavigate );
		window.addEventListener( 'popstate', onNavigate );

		// The submenu WP rendered as `current` is whichever page was requested; if the URL
		// carries a hash for a different view, correct the highlight on mount.
		syncAdminMenu( viewFromUrl() );

		return () => {
			window.removeEventListener( 'hashchange', onNavigate );
			window.removeEventListener( 'popstate', onNavigate );
		};
	}, [] );

	return { activeView, changeView };
}

// Moves WP's own `current` markers onto the submenu item for `view`. Best-effort and purely
// cosmetic — a markup change in wp-admin degrades to a stale highlight, never a crash.
function syncAdminMenu( view: AdminView ): void {
	const slug = bootstrap().pageSlugs[ view ];
	if ( ! slug ) return;

	const submenu = document.querySelector< HTMLElement >( '#adminmenu #toplevel_page_blicks .wp-submenu' );
	if ( ! submenu ) return;

	submenu.querySelectorAll< HTMLElement >( 'li' ).forEach( item => {
		const link = item.querySelector< HTMLAnchorElement >( 'a' );
		const isCurrent = !! link && new URLSearchParams( link.search ).get( 'page' ) === slug;

		item.classList.toggle( 'current', isCurrent );
		link?.classList.toggle( 'current', isCurrent );
		if ( link ) {
			if ( isCurrent ) link.setAttribute( 'aria-current', 'page' );
			else link.removeAttribute( 'aria-current' );
		}
	} );
}
