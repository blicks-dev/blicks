/**
 * The dialog mode: a saved dialog opened in the Studio (`studio.openRef( 'dialog', ref )`), its
 * canvas, its five tabs, and "+ New › Dialog".
 *
 * The mode is reached only through a ref: `matches` accepts nothing, so a Dialog block opened from
 * a post stays in the free Studio's own mode, and its door stays Insert.
 */
import { createElement } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { dialogRef, editorData, MODE, type StudioHost } from './host';
import { DialogCanvas, dialogTree } from './canvas';
import { ContentPanel, RulesPanel, StylePanel, TriggersPanel } from './panels';
import { loadDraft, saveDraft } from './drafts';
import { NewDialogPicker } from './new-dialog';
import { ResultsPanel } from './results';

export function registerStudio( host: StudioHost ): void {
	const base = editorData().restBase;

	host.registerMode( {
		id: MODE,
		label: __( 'Dialog', 'blicks-pro' ),
		priority: 5,
		matches: () => false,
		widths: true,
		Canvas: DialogCanvas,
		tree: dialogTree,
		persist: {
			label: __( 'Save dialog', 'blicks-pro' ),
			async load( ref ) {
				const loaded = await host.entity.load( ref );
				const r = dialogRef( ref );

				if ( r ) {
					// The settings beside the blocks. A failure here leaves the panels saying so, rather
					// than refusing to open the dialog's content.
					await loadDraft( apiFetch as never, base, r.id ).catch( () => undefined );
				}

				return loaded;
			},
			async save( blocks, ref ) {
				const r = dialogRef( ref );

				if ( r ) {
					await saveDraft( apiFetch as never, base, r.id );
				}

				return host.entity.save( blocks, ref );
			},
		},
	} );

	const tab = ( id: string, label: string, render: ( props: Parameters< Parameters< StudioHost[ 'registerPanel' ] >[ 0 ][ 'render' ] >[ 0 ] ) => JSX.Element | null ): void => {
		host.registerPanel( { id, label, modes: [ MODE ], render } );
	};

	tab( 'dialog-content', __( 'Content', 'blicks-pro' ), ( p ) => createElement( ContentPanel, p ) );
	tab( 'dialog-style', __( 'Style', 'blicks-pro' ), ( p ) => createElement( StylePanel, p ) );
	tab( 'dialog-triggers', __( 'Triggers', 'blicks-pro' ), ( p ) => createElement( TriggersPanel, { entity: p.ref } ) );
	tab( 'dialog-rules', __( 'Rules', 'blicks-pro' ), ( p ) => createElement( RulesPanel, { entity: p.ref } ) );
	tab( 'dialog-results', __( 'Results', 'blicks-pro' ), ( p ) => createElement( ResultsPanel, { entity: p.ref } ) );

	if ( editorData().canManage ) {
		host.registerNewItem( {
			id: 'dialog',
			label: __( 'Dialog', 'blicks-pro' ),
			description: __( 'A saved dialog: opened by Buttons and links anywhere on the site, or by itself.', 'blicks-pro' ),
			icon: 'M5 5h14v14H5zM8 9h8M8 13h5',
			Picker: NewDialogPicker,
		} );
	}
}
