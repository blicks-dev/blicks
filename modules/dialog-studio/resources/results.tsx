/**
 * The Results tab: a saved dialog's last 30 days, shown and converted, from
 * `blicks-pro/v1/dialogs/<id>/stats`.
 */
import { useEffect, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __, sprintf } from '@wordpress/i18n';
import { dialogRef } from './host';

export interface Stats {
	days: { day: string; shown: number; converted: number }[];
	shown: number;
	converted: number;
}

/** "12.5%", or "–" with nothing shown. */
export function rate( shown: number, converted: number ): string {
	return shown > 0 ? `${ Math.round( ( converted / shown ) * 1000 ) / 10 }%` : '–';
}

export function ResultsPanel( { entity }: { entity: unknown } ): JSX.Element {
	const r = dialogRef( entity );
	const id = r?.id ?? 0;
	const [ stats, setStats ] = useState< Stats | null >( null );
	const [ problem, setProblem ] = useState( '' );

	useEffect( () => {
		if ( ! id ) return;
		let live = true;
		apiFetch( { path: `/blicks-pro/v1/dialogs/${ id }/stats?days=30` } )
			.then( ( s: unknown ) => live && setStats( s as Stats ) )
			.catch( ( e: { message?: string } ) => live && setProblem( e?.message ?? __( 'The counts could not be read.', 'blicks-pro' ) ) );
		return () => {
			live = false;
		};
	}, [ id ] );

	if ( ! r ) {
		return (
			<div className="bl-ds-panel">
				<p className="bl-ds-panel__note">{ __( 'Only a saved dialog is counted.', 'blicks-pro' ) }</p>
			</div>
		);
	}

	const max = Math.max( 1, ...( stats?.days ?? [] ).map( ( d ) => d.shown ) );

	return (
		<div className="bl-ds-panel">
			<section className="bl-ds-panel__sec">
				<h3>{ __( 'Last 30 days', 'blicks-pro' ) }</h3>
				{ problem && <p role="alert">{ problem }</p> }
				<div className="bl-ds-stats">
					<div>
						<b>{ stats ? stats.shown : '—' }</b>
						{ __( 'Views', 'blicks-pro' ) }
					</div>
					<div>
						<b>{ stats ? stats.converted : '—' }</b>
						{ __( 'Conversions', 'blicks-pro' ) }
					</div>
					<div>
						<b>{ stats ? rate( stats.shown, stats.converted ) : '—' }</b>
						{ __( 'Rate', 'blicks-pro' ) }
					</div>
				</div>
				{ stats && stats.shown > 0 && (
					<ol className="bl-ds-bars" aria-label={ __( 'Views per day', 'blicks-pro' ) }>
						{ stats.days.map( ( d ) => (
							<li key={ d.day } style={ { height: `${ Math.round( ( d.shown / max ) * 100 ) }%` } } title={ sprintf( /* translators: 1: a day, 2: views, 3: conversions */ __( '%1$s: %2$d views, %3$d conversions', 'blicks-pro' ), d.day, d.shown, d.converted ) } />
						) ) }
					</ol>
				) }
				<p className="bl-ds-panel__note">
					{ __( 'Daily totals per dialog, nothing about who saw it. A conversion is a form sent from the dialog or a link in it followed. Anyone can send these counts, so treat them as a guide, not an audit.', 'blicks-pro' ) }
				</p>
			</section>
		</div>
	);
}
