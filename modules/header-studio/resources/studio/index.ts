/**
 * The header mode: a Header opened in the Studio, its canvas with wide, tablet and phone forms, its
 * Layers tree, the Header and Selected tabs, "+ New › Header", and the Site Editor's "Edit in
 * Header Studio". A header template part is opened by ref and saved back to it; a Header block in a
 * post opens here too, through `matches`, and goes back into the post.
 */
import { createElement } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { editorData, MODE, type StudioHost } from './host';
import { HeaderCanvas } from './canvas';
import { headerTree, isHeader } from './tree';
import { HeaderPanel, SelectedPanel } from './panels';
import { NewHeaderPicker } from './new-header';
import { persist } from './storage';
import { registerSiteEditorEntry } from './site-editor';
import { addStyles } from './styles';

export function registerStudio( host: StudioHost ): void {
	addStyles();

	host.registerMode( {
		id: MODE,
		label: __( 'Header', 'blicks-pro' ),
		priority: 5,
		matches: isHeader,
		widths: true,
		Canvas: HeaderCanvas,
		tree: headerTree,
		// A header has no keyframes to play: the free Studio's Motion tab means nothing here.
		hidePanels: [ 'motion' ],
		persist: persist( host ),
	} );

	host.registerPanel( { id: 'header-header', label: __( 'Header', 'blicks-pro' ), modes: [ MODE ], render: ( p ) => createElement( HeaderPanel, p ) } );
	host.registerPanel( { id: 'header-selected', label: __( 'Item', 'blicks-pro' ), modes: [ MODE ], render: ( p ) => createElement( SelectedPanel, p ) } );

	if ( editorData().canManage ) {
		host.registerNewItem( {
			id: 'header',
			label: __( 'Header', 'blicks-pro' ),
			description: __( 'A site header with mega menus and a phone drawer, kept as a template part.', 'blicks-pro' ),
			icon: 'M3 4h18v5H3zM3 12h18M3 16h12',
			Picker: NewHeaderPicker,
		} );
	}

	registerSiteEditorEntry();
}
