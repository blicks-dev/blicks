/**
 * "+ New › Dialog": pick a starter, and a saved dialog is created from it (switched off) and opened
 * in the dialog mode. A new dialog is a post from the first moment, so Save writes to it like any
 * other, and its Triggers and Rules panels have something to keep.
 */
import { Button } from '@wordpress/components';
import { createBlocksFromInnerBlocksTemplate, serialize } from '@wordpress/blocks';
import { useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { editorData, MODE, POST_TYPE, studio } from './host';
import { dialogAttributes, freeAnchor, starters, type Starter } from './starters';
import { rememberTarget } from './targets';

export async function createDialog( starter: Starter ): Promise< number > {
	const anchor = freeAnchor( starter.id, editorData().targets );
	const [ dialog ] = createBlocksFromInnerBlocksTemplate( [ [ 'blicks/dialog', dialogAttributes( starter, anchor ), starter.inner as never ] ] );
	const record = ( await apiFetch( {
		path: `/wp/v2/${ editorData().restBase }`,
		method: 'POST',
		data: {
			title: starter.title,
			status: 'draft',
			content: serialize( [ dialog ] ),
			meta: { blicks_dialog_triggers: starter.triggers, blicks_dialog_rules: starter.rules },
		},
	} ) ) as { id: number };

	rememberTarget( { id: `dialog-${ anchor }`, title: starter.title, modal: false !== starter.dialog.modal, source: 'saved', post: record.id, status: 'draft' } );

	return record.id;
}

export function NewDialogPicker( { onCancel }: { onStart: unknown; onCancel: () => void } ): JSX.Element {
	const [ busy, setBusy ] = useState( '' );
	const [ problem, setProblem ] = useState( '' );

	const start = async ( starter: Starter ): Promise< void > => {
		setBusy( starter.id );
		setProblem( '' );

		try {
			const id = await createDialog( starter );
			onCancel();
			await studio()?.openRef( MODE, { kind: 'post', type: POST_TYPE, id } );
		} catch ( failure ) {
			setProblem( ( failure as { message?: string } )?.message ?? __( 'The dialog could not be created.', 'blicks-pro' ) );
			setBusy( '' );
		}
	};

	return (
		<div className="bl-ds-new">
			<p>{ __( 'Start from one of these. It is saved switched off, so nothing shows on the site until you turn it on.', 'blicks-pro' ) }</p>
			<ul>
				{ starters().map( ( s ) => (
					<li key={ s.id }>
						<button type="button" className="bl-ds-new__item" disabled={ '' !== busy } onClick={ () => void start( s ) }>
							<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
								<path d={ s.icon } />
							</svg>
							<span>
								<b>{ s.label }</b>
								<small>{ busy === s.id ? __( 'Creating…', 'blicks-pro' ) : s.description }</small>
							</span>
						</button>
					</li>
				) ) }
			</ul>
			{ '' !== problem && <p role="alert" className="bl-ds-new__problem">{ problem }</p> }
			<Button variant="tertiary" onClick={ onCancel }>
				{ __( 'Cancel', 'blicks-pro' ) }
			</Button>
		</div>
	);
}
