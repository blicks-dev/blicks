import type { ComponentType, ReactNode } from 'react';
import { InspectorControls } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import { InspectorContent } from '@/framework/inspector/Inspector';
import { DesignPanel } from './DesignPanel';
import { ClearStyles, MorePanel } from './More';
import { tabsOf, type InspectorPanels, type PanelProps } from './InspectorV2';

/**
 * A Blicks block's inspector inside the Studio: the design panel.
 *
 * A v2 block brings its own panels — the same Settings, Style and Motion the post editor draws —
 * and they open first, as the panel's Quick tab, so the choices people know by name are where they
 * start, and the engine's every setting is one tab away. A block still on the rail inspector
 * brings that whole, behind the gear, as it is today.
 */
export function StudioInspector( { attributes, setAttributes, clientId, name, panels, manifest, Controls, Advanced }: {
	attributes: any;
	setAttributes: ( a: any ) => void;
	clientId: string;
	name: string;
	panels?: InspectorPanels;
	manifest: any;
	Controls?: ComponentType< { attributes: any; setAttributes: ( a: any ) => void } >;
	Advanced?: ComponentType< { attributes: any; setAttributes: ( a: any ) => void } >;
} ) {
	const props: PanelProps = { attributes, setAttributes, clientId };
	const quick = panels ? <QuickPanels panels={ panels } { ...props } /> : undefined;
	const settings = panels ? undefined : (
		<InspectorContent attributes={ attributes } setAttributes={ setAttributes } manifest={ manifest } clientId={ clientId } Controls={ Controls } Advanced={ Advanced } />
	);
	return (
		<InspectorControls>
			<DesignPanel attributes={ attributes } setAttributes={ setAttributes } clientId={ clientId } name={ name } quick={ quick } settings={ settings } look={ panels?.look } />
		</InspectorControls>
	);
}

/**
 * The post editor's three tabs, one under the other, then More. Stacked rather than tabbed again:
 * tabs inside a tab would be a second row of the same control, and every section here is short.
 */
export function QuickPanels( { panels, ...props }: PanelProps & { panels: InspectorPanels } ) {
	const groups: Array< [ string, string, ReactNode ] > = [];
	const shown = tabsOf( panels, props.attributes );
	if ( panels.Settings && shown.includes( 'settings' ) ) groups.push( [ 'settings', __( 'Settings', 'blicks' ), <panels.Settings { ...props } /> ] );
	if ( panels.Style && shown.includes( 'style' ) ) {
		groups.push( [
			'style',
			__( 'Style', 'blicks' ),
			<>
				<panels.Style { ...props } />
				<ClearStyles attributes={ props.attributes } setAttributes={ props.setAttributes } />
			</>,
		] );
	}
	if ( panels.Motion && shown.includes( 'motion' ) ) groups.push( [ 'motion', __( 'Motion', 'blicks' ), <panels.Motion { ...props } /> ] );
	groups.push( [ 'more', __( 'More', 'blicks' ), <MorePanel { ...props } /> ] );

	return (
		<div className="bl-ins2 bui-dp-quick">
			{ groups.map( ( [ key, title, body ] ) => (
				<div key={ key } className="pane-b" data-quick={ key }>
					<h2 className="bui-dp-qgroup">{ title }</h2>
					{ body }
				</div>
			) ) }
		</div>
	);
}
