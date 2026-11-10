/**
 * Blicks › Dialogs: every saved dialog, with its kind, what opens it, its triggers and rules in one
 * line, the last 30 days, an on/off switch and Edit, which opens it in the Studio.
 */
import { Button, Notice, Spinner, ToggleControl } from '@wordpress/components';
import { createElement, useEffect, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, _n, sprintf } from '@wordpress/i18n';
import { editorData, MODE, POST_TYPE, type AdminHost } from './host';
import { summary } from './summary';
import { rate } from './results';
import type { Rules, Triggers } from './settings';

export interface Row {
	id: number;
	title: string;
	on: boolean;
	domId: string;
	kind: string;
	modal: boolean;
	triggers: Triggers;
	rules: Rules;
	openers: { buttons: number; pages: number };
	shown: number;
	converted: number;
}

interface Listing {
	dialogs: Row[];
	editUrl: string;
	newUrl: string;
}

/** The editor's address for a dialog, with the Studio open on it (`?blicks-studio=ref:…`). */
export function editLink( base: string, id: number ): string {
	const ref = JSON.stringify( { kind: 'post', type: POST_TYPE, id } );
	return `${ base }${ id }&blicks-studio=${ encodeURIComponent( `ref:${ MODE }:${ ref }` ) }`;
}

export function openersLine( o: Row[ 'openers' ] ): string {
	if ( 0 === o.buttons ) return __( 'Not opened by any Button or link', 'blicks-pro' );
	/* translators: 1: "4 buttons or links", 2: "3 pages" */
	return sprintf(
		__( 'Opened by %1$s on %2$s', 'blicks-pro' ),
		sprintf( /* translators: %d: how many */ _n( '%d button or link', '%d buttons or links', o.buttons, 'blicks-pro' ), o.buttons ),
		sprintf( /* translators: %d: how many */ _n( '%d page', '%d pages', o.pages, 'blicks-pro' ), o.pages )
	);
}

const KINDS: Record< string, string > = {
	modal: __( 'Modal', 'blicks-pro' ),
	drawer: __( 'Drawer', 'blicks-pro' ),
	sheet: __( 'Bottom sheet', 'blicks-pro' ),
	full: __( 'Full screen', 'blicks-pro' ),
};

function DialogsView(): JSX.Element {
	const [ list, setList ] = useState< Listing | null >( null );
	const [ problem, setProblem ] = useState( '' );

	const load = (): void => {
		apiFetch( { path: '/blicks-pro/v1/dialogs' } )
			.then( ( l: unknown ) => setList( l as Listing ) )
			.catch( ( e: { message?: string } ) => setProblem( e?.message ?? __( 'The dialogs could not be loaded.', 'blicks-pro' ) ) );
	};

	useEffect( load, [] );

	const toggle = async ( row: Row, on: boolean ): Promise< void > => {
		setList( ( l ) => ( l ? { ...l, dialogs: l.dialogs.map( ( d ) => ( d.id === row.id ? { ...d, on } : d ) ) } : l ) );
		try {
			await apiFetch( { path: `/wp/v2/${ editorData().restBase }/${ row.id }`, method: 'POST', data: { status: on ? 'publish' : 'draft' } } );
		} catch ( e ) {
			setProblem( ( e as { message?: string } )?.message ?? __( 'That could not be saved.', 'blicks-pro' ) );
			load();
		}
	};

	return (
		<div className="bl-ds-admin">
			<header className="bl-ds-admin__head">
				<div>
					<h1>{ __( 'Dialogs', 'blicks-pro' ) }</h1>
					<p>{ __( 'Saved dialogs, opened by Buttons and links anywhere on the site, or by themselves. Start one from the Studio’s + New › Dialog.', 'blicks-pro' ) }</p>
				</div>
				{ list && (
					<Button variant="primary" href={ list.newUrl }>
						{ __( 'New dialog', 'blicks-pro' ) }
					</Button>
				) }
			</header>
			{ problem && <Notice status="error" isDismissible={ false }>{ problem }</Notice> }
			{ ! list && ! problem && <Spinner /> }
			{ list && 0 === list.dialogs.length && <p>{ __( 'No saved dialogs yet.', 'blicks-pro' ) }</p> }
			{ list && list.dialogs.length > 0 && (
				<table className="bl-ds-admin__table widefat striped">
					<thead>
						<tr>
							<th scope="col">{ __( 'Dialog', 'blicks-pro' ) }</th>
							<th scope="col">{ __( 'Opens', 'blicks-pro' ) }</th>
							<th scope="col">{ __( 'Last 30 days', 'blicks-pro' ) }</th>
							<th scope="col">{ __( 'On', 'blicks-pro' ) }</th>
							<th scope="col"><span className="screen-reader-text">{ __( 'Actions', 'blicks-pro' ) }</span></th>
						</tr>
					</thead>
					<tbody>
						{ list.dialogs.map( ( row ) => (
							<tr key={ row.id }>
								<td>
									<b>{ row.title || row.domId }</b>
									<br />
									<small>
										{ KINDS[ row.kind ] ?? KINDS.modal } · <code>#{ row.domId }</code>
									</small>
								</td>
								<td>
									{ openersLine( row.openers ) }
									<br />
									<small>{ summary( row.triggers, row.rules ) }</small>
								</td>
								<td>
									{ sprintf( /* translators: 1: views, 2: conversions, 3: rate */ __( '%1$d views · %2$d conversions · %3$s', 'blicks-pro' ), row.shown, row.converted, rate( row.shown, row.converted ) ) }
								</td>
								<td>
									<ToggleControl
										__nextHasNoMarginBottom
										label={ <span className="screen-reader-text">{ sprintf( /* translators: %s: a dialog's title */ __( 'Show %s on the site', 'blicks-pro' ), row.title ) }</span> }
										checked={ row.on }
										onChange={ ( on: boolean ) => void toggle( row, on ) }
									/>
								</td>
								<td>
									<Button variant="secondary" href={ editLink( list.editUrl, row.id ) }>
										{ __( 'Edit', 'blicks-pro' ) }
									</Button>
								</td>
							</tr>
						) ) }
					</tbody>
				</table>
			) }
		</div>
	);
}

export function registerAdmin( host: AdminHost ): void {
	host.registerView( { id: 'dialogs', render: () => createElement( DialogsView ) } );
}
