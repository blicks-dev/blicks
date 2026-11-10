/**
 * Blicks › Headers: every header template part of the theme, whether it is a Header Studio header
 * yet, the templates that use it, and Edit, which opens it in the Studio in the Site Editor.
 */
import { Button, Notice, Spinner } from '@wordpress/components';
import { createElement, useEffect, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, _n, sprintf } from '@wordpress/i18n';
import { editLink, editorData, type AdminHost } from './studio/host';

export interface Row {
	id: string;
	title: string;
	slug: string;
	custom: boolean;
	studio: boolean;
	usedOn: { id: string; title: string; kind: string }[];
}

interface Listing {
	headers: Row[];
	blockTheme: boolean;
}

export function usedLine( used: Row[ 'usedOn' ] ): string {
	if ( ! used.length ) return __( 'Not used by any template', 'blicks-pro' );
	const names = used.slice( 0, 3 ).map( ( u ) => u.title ).join( ', ' );
	const more = used.length > 3 ? ` +${ used.length - 3 }` : '';
	/* translators: 1: "3 templates", 2: their names */
	return sprintf( __( 'Used on %1$s: %2$s', 'blicks-pro' ), sprintf( /* translators: %d: how many */ _n( '%d template', '%d templates', used.length, 'blicks-pro' ), used.length ), names + more );
}

/** The Site Editor, with "+ New" open in the Studio: the library, where + New › Header is. */
export function newLink(): string {
	const base = editorData().siteEditor;
	return `${ base }${ base.includes( '?' ) ? '&' : '?' }blicks-studio=library`;
}

function HeadersView(): JSX.Element {
	const [ list, setList ] = useState< Listing | null >( null );
	const [ problem, setProblem ] = useState( '' );

	useEffect( () => {
		apiFetch( { path: '/blicks-pro/v1/headers' } )
			.then( ( l: unknown ) => setList( l as Listing ) )
			.catch( ( e: { message?: string } ) => setProblem( e?.message ?? __( 'The headers could not be loaded.', 'blicks-pro' ) ) );
	}, [] );

	return (
		<div className="bl-hs-admin">
			<header className="bl-hs-admin__head" style={ { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 16 } }>
				<div>
					<h1>{ __( 'Headers', 'blicks-pro' ) }</h1>
					<p>{ __( 'Your site’s headers, kept as template parts. Edit one in Header Studio, or start a new one; choose which template uses which in the Site Editor.', 'blicks-pro' ) }</p>
				</div>
				{ list?.blockTheme && (
					<Button variant="primary" href={ newLink() }>
						{ __( 'New header', 'blicks-pro' ) }
					</Button>
				) }
			</header>
			{ problem && (
				<Notice status="error" isDismissible={ false }>
					{ problem }
				</Notice>
			) }
			{ ! list && ! problem && <Spinner /> }
			{ list && ! list.blockTheme && <Notice status="warning" isDismissible={ false }>{ __( 'Header Studio needs a block theme. This site’s theme keeps its header in PHP.', 'blicks-pro' ) }</Notice> }
			{ list?.blockTheme && 0 === list.headers.length && <p>{ __( 'This theme has no header template parts yet.', 'blicks-pro' ) }</p> }
			{ list && list.headers.length > 0 && (
				<table className="widefat striped">
					<thead>
						<tr>
							<th scope="col">{ __( 'Header', 'blicks-pro' ) }</th>
							<th scope="col">{ __( 'Used on', 'blicks-pro' ) }</th>
							<th scope="col">
								<span className="screen-reader-text">{ __( 'Actions', 'blicks-pro' ) }</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{ list.headers.map( ( row ) => (
							<tr key={ row.id }>
								<td>
									<b>{ row.title }</b>
									<br />
									<small>
										{ [ row.studio ? __( 'Header Studio', 'blicks-pro' ) : __( 'Theme blocks', 'blicks-pro' ), row.custom ? __( 'Edited on this site', 'blicks-pro' ) : __( 'From the theme', 'blicks-pro' ) ].join( ' · ' ) }
									</small>
								</td>
								<td>{ usedLine( row.usedOn ) }</td>
								<td>
									<Button variant="secondary" href={ editLink( row.id ) }>
										{ row.studio ? __( 'Edit', 'blicks-pro' ) : __( 'Edit in Header Studio', 'blicks-pro' ) }
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
	host.registerView( { id: 'headers', render: () => createElement( HeadersView ) } );
}
