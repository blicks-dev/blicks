import { __ } from '@wordpress/i18n';

export interface Facet {
	id: string;
	label: string;
	icon: JSX.Element;
	/** Contextual facet (e.g. grid child) — flagged with a badge in the rail. */
	conditional?: boolean;
	/** Any value set anywhere in this facet's controls — surfaces a "styled" dot. */
	hasValue?: boolean;
}

interface Props {
	facets: Facet[];
	active: string;
	onSelect: ( id: string ) => void;
}

/* The tab ↔ panel pair. Exported so the panel side (Inspector.tsx) cannot drift from the
   tab side: `role="tab"` promises an `aria-controls` target, and the panel has to point
   back with `aria-labelledby`, or the relationship the rail announces does not exist. */
export const facetTabId = ( id: string ) => `bl-facet-tab-${ id }`;
export const facetPanelId = ( id: string ) => `bl-facet-panel-${ id }`;

/**
 * The Style tab's facet rail. Collapsed to a 44px icon strip; expands to show labels on hover and
 * on **keyboard** focus (`:has(:focus-visible)` — plain `:focus-within` would hold it open after a
 * click, long past the pointer leaving).
 *
 * Expanding widens the rail in flow and slides the pane right rather than floating over it; the
 * pane's width is pinned so nothing inside it reflows as the rail opens, and the overhang is
 * clipped. See `_inspector-foundation.scss` for why the rail is not an absolute overlay: taking
 * its height from the pane cut the bottom facets off whenever the open facet was short.
 *
 * Labels stay in the DOM at all times (the collapse is a width/opacity transition, not
 * `display:none`), so assistive tech always reads a real name, never a bare icon.
 *
 * Two elements, not one: the outer column stretches to the pane's full height so the rail's
 * background and divider never stop mid-panel, while the inner list is the sticky part that
 * stays put as a long facet scrolls. `role="tablist"` sits on the inner element so the tabs
 * remain its own children.
 */
export function Rail( { facets, active, onSelect }: Props ) {
	/**
	 * Roving tabindex + arrow keys, which `role="tablist"` obliges us to provide — and
	 * `aria-orientation="vertical"` specifically promises Up/Down. Without it every facet
	 * was a tab stop and none of them answered an arrow, so the rail announced a pattern
	 * it did not implement. Only the selected tab is reachable by Tab; the arrows move
	 * between them and select as they go (an automatic-activation tablist, which is right
	 * here because switching facets is instant and has no side effect).
	 */
	const onKeyDown = ( e: React.KeyboardEvent< HTMLDivElement > ) => {
		const keys = [ 'ArrowDown', 'ArrowUp', 'Home', 'End' ];
		if ( ! keys.includes( e.key ) ) return;
		const i = facets.findIndex( ( f ) => f.id === active );
		if ( i === -1 ) return;
		const next =
			e.key === 'Home'
				? 0
				: e.key === 'End'
				? facets.length - 1
				: ( i + ( e.key === 'ArrowDown' ? 1 : -1 ) + facets.length ) % facets.length;
		e.preventDefault();
		onSelect( facets[ next ].id );
		// The tab has to take focus too, or the arrows move the selection out from under it.
		const el = e.currentTarget.querySelectorAll< HTMLButtonElement >( '[role="tab"]' )[ next ];
		el?.focus();
	};

	return (
		<div className="ins-rail">
			<div
				className="ins-rail__inner"
				role="tablist"
				aria-orientation="vertical"
				aria-label={ __( 'Style facets', 'blicks' ) }
				onKeyDown={ onKeyDown }
			>
				{ facets.map( ( f ) => {
					const on = active === f.id;
					return (
						<button
							key={ f.id }
							type="button"
							role="tab"
							id={ facetTabId( f.id ) }
							aria-selected={ on }
							aria-controls={ facetPanelId( f.id ) }
							tabIndex={ on ? 0 : -1 }
							className={ `ins-rail__btn ${ on ? 'on' : '' }` }
							title={ f.label }
							onClick={ () => onSelect( f.id ) }
						>
							<span className="ins-rail__ico" aria-hidden="true">
								{ f.icon }
								{ f.conditional ? (
									<span className="ins-rail__badge" />
								) : (
									f.hasValue && <span className="ins-rail__dot" />
								) }
							</span>
							<span className="ins-rail__lbl">{ f.label }</span>
							{ /* The badge and the dot live inside an aria-hidden span, so without this
							     the "has a value set" and "only applies in context" states were
							     sighted-only. Read after the label rather than folded into it. */ }
							{ f.conditional ? (
								<span className="screen-reader-text">
									{ __( '(contextual)', 'blicks' ) }
								</span>
							) : (
								f.hasValue && (
									<span className="screen-reader-text">
										{ __( '(styled)', 'blicks' ) }
									</span>
								)
							) }
						</button>
					);
				} ) }
			</div>
		</div>
	);
}
