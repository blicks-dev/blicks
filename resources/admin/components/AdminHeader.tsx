import { __, sprintf } from '@wordpress/i18n';
import { bootstrap } from '../bootstrap';
import { StackBMark } from '../icons';
import { urlForView } from '../routing';
import type { AdminView } from '../types';

/**
 * One bar for the whole admin: the brand, a tab per page, the actions that belong to the open
 * page, and Jump to. Pages other plugins register (Blicks Pro adds Licence) follow a divider,
 * in the order PHP gave them, so it is always clear which tabs ship with Blicks.
 */
export function AdminHeader( {
	activeView,
	dirty,
	actions,
	onViewChange,
	onOpenPalette,
}: {
	activeView: AdminView;
	dirty: Partial< Record< string, boolean > >;
	actions?: React.ReactNode;
	onViewChange: ( view: AdminView ) => void;
	onOpenPalette: () => void;
} ): JSX.Element {
	const builtin: Array< { id: AdminView; label: string } > = [
		{ id: 'overview', label: __( 'Overview', 'blicks' ) },
		{ id: 'design', label: __( 'Design system', 'blicks' ) },
		{ id: 'settings', label: __( 'Settings', 'blicks' ) },
		{ id: 'mcp', label: __( 'MCP', 'blicks' ) },
	];
	const external = bootstrap().externalViews;
	const shortcut = isAppleOs() ? '⌘K' : 'Ctrl K';

	const tab = ( id: AdminView, label: string, title?: string ): JSX.Element => (
		<a
			key={ id }
			href={ urlForView( id ) }
			title={ title }
			aria-current={ activeView === id ? 'page' : undefined }
			onClick={ event => {
				// Plain clicks route in-page; modified clicks keep open-in-new-tab, which the
				// real href makes possible.
				if ( event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ) return;
				event.preventDefault();
				onViewChange( id );
			} }
		>
			{ label }
			{ dirty[ id ] && (
				<>
					<i className="pdot" aria-hidden="true" />
					<span className="screen-reader-text">{ __( '(unsaved changes)', 'blicks' ) }</span>
				</>
			) }
		</a>
	);

	return (
		<header className="top">
			<a
				className="brand"
				href={ urlForView( 'overview' ) }
				aria-label={ __( 'Blicks overview', 'blicks' ) }
				onClick={ event => {
					if ( event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ) return;
					event.preventDefault();
					onViewChange( 'overview' );
				} }
			>
				{ /* The real plugin mark (icons.tsx), on the brand square — its dark tone keeps the
				     accent bar visible on ultramarine. */ }
				<span className="mark" aria-hidden="true"><StackBMark tone="dark" /></span>
				<span className="t">Blicks</span>
			</a>

			<nav className="pages" aria-label={ __( 'Blicks pages', 'blicks' ) }>
				{ builtin.map( entry => tab( entry.id, entry.label ) ) }
				{ external.length > 0 && <span className="pages-sep" aria-hidden="true" /> }
				{ external.map( entry => tab( entry.id as AdminView, entry.label, __( 'Added by another plugin', 'blicks' ) ) ) }
			</nav>

			<span className="grow" />

			{ actions && <div className="page-actions">{ actions }</div> }

			<button
				type="button"
				className="jump"
				onClick={ onOpenPalette }
				title={ __( 'Jump to any page, section or token', 'blicks' ) }
				aria-label={ sprintf(
					/* translators: %s: keyboard shortcut, e.g. "⌘K". */
					__( 'Jump to anything (%s)', 'blicks' ),
					shortcut
				) }
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5-5-5Zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Z" /></svg>
				<span>{ __( 'Jump to', 'blicks' ) }</span>
				<kbd aria-hidden="true">{ shortcut }</kbd>
			</button>
		</header>
	);
}

function isAppleOs(): boolean {
	return /Mac|iPhone|iPad/.test( window.navigator.platform || window.navigator.userAgent );
}
