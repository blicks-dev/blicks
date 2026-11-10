import { ToolbarGroup } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { ToolbarIcon, ToolbarLink, newTabAttributes } from '@/blocks/shared/toolbar';
import type { PanelProps } from '@/framework/inspector-v2/InspectorV2';
import { StylePanel } from '@/framework/inspector-v2/StylePanel';
import { Field, Note, Row, Sec, Switch } from '@/framework/inspector-v2/kit';
import { IconPicker } from '@/controls/IconPicker';

const LINK_ICON = 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1';

/** The Menu link's Settings tab: where it goes, its icon and its badge. Label and description are typed on the canvas. */
export function MenuLinkSettings( { attributes, setAttributes }: PanelProps ) {
	const newTab = attributes.linkTarget === '_blank';

	const icon = String( attributes.icon || '' );

	return (
		<>
			<Sec title={ __( 'Content', 'blicks' ) } icon="edit_note">
				<Row label={ __( 'Icon', 'blicks' ) } stack set={ !! icon }>
					<IconPicker value={ icon } allowNone onChange={ ( next: string ) => setAttributes( { icon: next } ) } />
				</Row>
				<Row label={ __( 'Badge', 'blicks' ) } set={ !! attributes.badge }>
					<Field value={ attributes.badge || '' } placeholder={ __( 'e.g. New', 'blicks' ) } label={ __( 'Badge', 'blicks' ) } onChange={ ( badge ) => setAttributes( { badge } ) } />
				</Row>
				<Note>{ __( 'Type the label and the line under it on the canvas. Leave the line empty for a plain link.', 'blicks' ) }</Note>
			</Sec>
			<Sec title={ __( 'Link', 'blicks' ) } icon="link">
				<Row
					label={ __( 'Address', 'blicks' ) }
					stack
					set={ !! attributes.url }
				>
					<Field icon={ LINK_ICON } value={ attributes.url || '' } placeholder={ __( 'Paste a link', 'blicks' ) } label={ __( 'Link', 'blicks' ) } onChange={ ( v ) => setAttributes( { url: v.trim() } ) } />
				</Row>
				<Switch
					label={ __( 'Open in a new tab', 'blicks' ) }
					checked={ newTab }
					onChange={ ( on ) => setAttributes( { linkTarget: on ? '_blank' : '', rel: on ? 'noopener' : '' } ) }
				/>
			</Sec>
		</>
	);
}

/** A menu link is a link, so its States offer When clicked and Keyboard focus too. */
export function MenuLinkStyle( { attributes, setAttributes }: PanelProps ) {
	return <StylePanel attributes={ attributes } setAttributes={ setAttributes } kind="box" linked />;
}

/** The Menu link's toolbar: Link and Icon, written as its Settings tab writes them. */
export function MenuLinkToolbar( { attributes, setAttributes }: PanelProps ) {
	return (
		<ToolbarGroup>
			<ToolbarLink
				url={ String( attributes.url || '' ) }
				newTab={ attributes.linkTarget === '_blank' }
				onUrl={ ( v ) => setAttributes( { url: v.trim() } ) }
				onNewTab={ ( on ) => setAttributes( newTabAttributes( on, 'noopener' ) ) }
			/>
			<ToolbarIcon value={ String( attributes.icon || '' ) } allowNone onChange={ ( icon ) => setAttributes( { icon } ) } />
		</ToolbarGroup>
	);
}
