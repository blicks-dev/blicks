import { useState, type ComponentType } from 'react';
import { BlockIcon, InspectorControls } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import { getBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { ClearStyles, MorePanel } from './More';
import { Problems } from './Problems';
import { Sym } from './sym';
import './inspector-v2.scss';

export interface PanelProps {
	attributes: any;
	setAttributes: ( a: any ) => void;
	clientId?: string;
}

/** A block's v2 inspector: its three tabs, and how its header names it. */
export interface InspectorPanels {
	Settings?: ComponentType< PanelProps >;
	Style?: ComponentType< PanelProps >;
	Motion?: ComponentType< PanelProps >;
	/** What the selected block is, e.g. "Card" — shown before "· inside Section". */
	describe?: ( attributes: any ) => string;
	/**
	 * The look its Style panel draws (`StylePanel`'s `kind` and `linked`), so the Studio's design
	 * panel can tell which values a Quick choice wrote. Without it no row says "From Quick".
	 */
	look?: { kind: string; linked?: boolean };
	/**
	 * Which of its tabs a block shows for these attributes, when that depends on them: a Spacer box
	 * has nothing to style or move, so it has Settings only. All of them when absent.
	 */
	tabsFor?: ( attributes: any ) => ReadonlyArray< 'settings' | 'style' | 'motion' >;
}

/** The block's own tabs that have a panel and that it shows for these attributes. */
export function tabsOf( panels: InspectorPanels, attributes: any ): Array< 'settings' | 'style' | 'motion' > {
	const allowed = panels.tabsFor?.( attributes );
	return ( [ 'settings', 'style', 'motion' ] as const ).filter(
		( t ) => panels[ ( t.charAt( 0 ).toUpperCase() + t.slice( 1 ) ) as 'Settings' | 'Style' | 'Motion' ] && ( ! allowed || allowed.includes( t ) )
	);
}

type Tab = 'settings' | 'style' | 'motion' | 'more';

/**
 * The v2 inspector shell: a header naming the block and where it sits, sticky Settings · Style ·
 * Motion tabs on the Blicks UI track (More last, as a glyph), and the active tab's panel. A block opts in with `defineBlock( …, { panels } )`;
 * every other block keeps the rail inspector until it is redone.
 */
export function InspectorV2( { attributes, setAttributes, clientId, name, panels }: PanelProps & { name: string; panels: InspectorPanels } ) {
	const available: Tab[] = tabsOf( panels, attributes );
	// Every block gets More: hiding per screen, screen readers, attributes.
	available.push( 'more' );
	const [ picked, setTab ] = useState< Tab >( available[ 0 ] ?? 'settings' );
	// A tab the block stops showing (a Box turned into a Spacer) falls back to the first.
	const tab: Tab = available.includes( picked ) ? picked : available[ 0 ]!;
	const parentTitle = useSelect(
		( select: any ) => {
			const store = select( 'core/block-editor' );
			const parentId = clientId ? store?.getBlockRootClientId?.( clientId ) : null;
			const parentName = parentId ? store?.getBlockName?.( parentId ) : null;
			return parentName ? ( getBlockType( parentName ) as any )?.title ?? '' : '';
		},
		[ clientId ]
	);

	const title = ( getBlockType( name ) as any )?.title ?? name;
	const described = panels.describe?.( attributes );
	const crumb = [ described, parentTitle ? `${ __( 'inside', 'blicks' ) } ${ parentTitle }` : '' ].filter( Boolean ).join( ' · ' );
	const labels: Record< Tab, string > = { settings: __( 'Settings', 'blicks' ), style: __( 'Style', 'blicks' ), motion: __( 'Motion', 'blicks' ), more: __( 'More', 'blicks' ) };
	const Panel = tab === 'more' ? undefined : { settings: panels.Settings, style: panels.Style, motion: panels.Motion }[ tab ];

	return (
		<InspectorControls>
			<div className="bl-ins2">
				<div className="head">
					<span className="badge" aria-hidden="true">
						<BlockIcon icon={ ( getBlockType( name ) as any )?.icon } />
					</span>
					<div className="who">
						<div className="name">{ title }</div>
						{ crumb && <div className="crumb">{ crumb }</div> }
					</div>
				</div>
				<Problems attributes={ attributes } setAttributes={ setAttributes } controls={ ( getBlockType( name ) as any )?.supports?.blicks?.controls } />
				{ available.length > 1 && (
					<div className="bui-tabs maintabs" role="tablist" aria-label={ __( 'Block panels', 'blicks' ) } style={ { '--tabs': available.length - 1 } as React.CSSProperties }>
						{ available.map( ( t ) => (
							<button key={ t } type="button" role="tab" aria-selected={ tab === t } aria-label={ labels[ t ] } title={ labels[ t ] } onClick={ () => setTab( t ) }>
								{ t === 'more' ? <Sym name="more_horiz" /> : labels[ t ] }
							</button>
						) ) }
					</div>
				) }
				<div className="pane-b" role="tabpanel">
					{ tab === 'more' ? (
						<MorePanel attributes={ attributes } setAttributes={ setAttributes } clientId={ clientId } />
					) : (
						Panel && <Panel attributes={ attributes } setAttributes={ setAttributes } clientId={ clientId } />
					) }
					{ tab === 'style' && <ClearStyles attributes={ attributes } setAttributes={ setAttributes } /> }
				</div>
			</div>
		</InspectorControls>
	);
}
