import { __, sprintf } from '@wordpress/i18n';
import { bootstrap } from '../bootstrap';
import type { AdminView, RegisteredView } from '../types';

/**
 * Renders a page another plugin owns.
 *
 * The two halves of a registered page arrive separately — PHP says the page exists, a companion
 * script supplies the component — so they can be out of step, and this component is what stands
 * between that and a blank screen. A registered page whose script never loaded, or threw while
 * loading, must say so: the nav tab is already visible by then, and silently rendering nothing
 * looks like the Blicks admin itself is broken.
 */
export function ExternalPanel( {
	view,
	registered,
	navigate,
}: {
	view: AdminView;
	registered: RegisteredView | undefined;
	navigate: ( view: AdminView ) => void;
} ): JSX.Element {
	const known = bootstrap().externalViews.find( entry => entry.id === view );

	if ( ! known ) {
		// Routing should never land here — every reachable view comes from `adminViews()` — but
		// a stale bookmark to a deactivated plugin's page would.
		return (
			<div className="panel" role="status">
				<p>{ __( 'That screen is no longer available.', 'blicks' ) }</p>
			</div>
		);
	}

	if ( ! registered ) {
		return (
			<div className="panel" role="status">
				<h2>{ known.label }</h2>
				<p>
					{ sprintf(
						/* translators: %s: admin page name, e.g. "Licence". */
						__(
							'The plugin that provides “%s” did not finish loading this screen. Reload the page, and if it keeps happening check that plugin is up to date.',
							'blicks'
						),
						known.label
					) }
				</p>
			</div>
		);
	}

	return registered.render( { navigate } );
}
