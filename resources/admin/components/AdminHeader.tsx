import { __, sprintf } from '@wordpress/i18n';
import { bootstrap } from '../bootstrap';
import { icon, StackBMark } from '../icons';
import { urlForView } from '../routing';
import type { AdminView } from '../types';

export function AdminHeader( {
	activeView,
	systemState,
	onViewChange,
	onOpenPalette,
}: {
	activeView: AdminView;
	systemState: { label: string; tone: 'ok' | 'warn' };
	onViewChange: ( view: AdminView ) => void;
	onOpenPalette: () => void;
} ): JSX.Element {
	const { version, docsUrl, editorUrl } = bootstrap();

	const tabs: Array< { id: AdminView; label: string; icon: JSX.Element } > = [
		{ id: 'overview', label: __( 'Overview', 'blicks' ), icon: icon( <><path d="M3 12l9-8 9 8" /><path d="M5 10v10h14V10" /></> ) },
		{ id: 'design', label: __( 'Design System', 'blicks' ), icon: icon( <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></> ) },
		{ id: 'settings', label: __( 'Settings', 'blicks' ), icon: icon( <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1l-.4-2.6H9.5L9 5.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4L5 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.5 2.6h5l.4-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5a7 7 0 0 0 .1-1Z" /></> ) },
	];

	const shortcut = isAppleOs() ? '⌘K' : 'Ctrl K';

	return (
		<>
			<div className="topbar">
				{ /* The real plugin mark (icons.tsx / .wordpress-org/icon-256x256.png), not the
				     mockup's placeholder bars — same slot, same size. */ }
				<div className="brand">
					<StackBMark className="mark" />
					<b>Blicks</b>
					<span>{ __( 'Design System', 'blicks' ) }</span>
				</div>
				<div className="spacer" />

				<button
					className="search"
					type="button"
					onClick={ onOpenPalette }
					aria-label={ sprintf(
						/* translators: %s: keyboard shortcut, e.g. "⌘K". */
						__( 'Search views and tokens (%s)', 'blicks' ),
						shortcut
					) }
				>
					{ icon( <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></> ) }
					<span>{ __( 'Search views and tokens', 'blicks' ) }</span>
					<kbd aria-hidden="true">{ shortcut }</kbd>
				</button>

				{ docsUrl && (
					<a className="btn" href={ docsUrl } target="_blank" rel="noreferrer">
						{ icon( <><path d="M14 3h7v7" /><path d="M21 3l-9 9" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></> ) }
						{ __( 'Docs', 'blicks' ) }
					</a>
				) }

				{ editorUrl && (
					<a className="btn primary" href={ editorUrl }>
						{ icon( <><path d="M12 5v14M5 12h14" /></> ) }
						{ __( 'Create with Blicks', 'blicks' ) }
					</a>
				) }
			</div>

			<div className="tabs" role="tablist" aria-label={ __( 'Blicks sections', 'blicks' ) }>
				{ tabs.map( tab => (
					<a
						key={ tab.id }
						className="tab"
						role="tab"
						href={ urlForView( tab.id ) }
						aria-selected={ activeView === tab.id }
						onClick={ event => {
							// Plain clicks route in-page; modified clicks keep the browser's
							// open-in-new-tab behaviour, which the real href makes possible.
							if ( event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ) return;
							event.preventDefault();
							onViewChange( tab.id );
						} }
					>
						{ tab.icon }
						{ tab.label }
					</a>
				) ) }
				<div className="right">
					{ version && <span className="ver">{ sprintf( /* translators: %s: plugin version. */ __( 'v%s', 'blicks' ), version ) }</span> }
					<span className={ `live${ systemState.tone === 'warn' ? ' is-warn' : '' }` }>
						<span className="dot" />
						{ systemState.label }
					</span>
				</div>
			</div>
		</>
	);
}

function isAppleOs(): boolean {
	return /Mac|iPhone|iPad/.test( window.navigator.platform || window.navigator.userAgent );
}
