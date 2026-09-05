import { __ } from '@wordpress/i18n';

export type TabId = 'settings' | 'style' | 'advanced';

const ico = ( path: JSX.Element ): JSX.Element => (
	<svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
		{ path }
	</svg>
);

const TAB_ICONS: Record< TabId, JSX.Element > = {
	settings: ico( <><circle cx="12" cy="12" r="3.4" /><path d="M19.4 13a7.5 7.5 0 0 0 0-2l1.6-1.3-2-3.4-2 .8a7.5 7.5 0 0 0-1.7-1l-.3-2.1h-4l-.3 2.1a7.5 7.5 0 0 0-1.7 1l-2-.8-2 3.4L4.6 11a7.5 7.5 0 0 0 0 2l-1.6 1.3 2 3.4 2-.8a7.5 7.5 0 0 0 1.7 1l.3 2.1h4l.3-2.1a7.5 7.5 0 0 0 1.7-1l2 .8 2-3.4z" /></> ),
	style: ico( <><path d="M15.5 3.5 20.5 8.5 11 18H6v-5z" /><path d="M6.5 12.5 3.5 20.5l8-3" /></> ),
	advanced: ico( <><path d="M3 7.5h8M16.5 7.5H21M3 16.5h4.5M13 16.5H21" /><circle cx="13.7" cy="7.5" r="2.6" /><circle cx="10.3" cy="16.5" r="2.6" /></> ),
};

interface Props {
	tabs: { id: TabId; label: string }[];
	active: TabId;
	onSelect: ( id: TabId ) => void;
}

/**
 * Top-level inspector nav. Sits above the facet rail: the rail is now the **Style tab's**
 * sub-nav, not the inspector's top-level nav. Settings and Advanced render straight into the
 * pane with no rail at all.
 */
export function Tabs( { tabs, active, onSelect }: Props ) {
	return (
		<div
			className="ins-tabs"
			role="tablist"
			aria-label={ __( 'Inspector sections', 'blicks' ) }
		>
			{ tabs.map( ( t ) => (
				<button
					key={ t.id }
					type="button"
					role="tab"
					aria-selected={ active === t.id }
					className={ `ins-tabs__btn ${ active === t.id ? 'on' : '' }` }
					title={ t.label }
					onClick={ () => onSelect( t.id ) }
				>
					{ TAB_ICONS[ t.id ] }
					<span className="ins-tabs__lbl">{ t.label }</span>
				</button>
			) ) }
		</div>
	);
}
