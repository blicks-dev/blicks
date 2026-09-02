import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { useState } from '@wordpress/element';
import { normalizeDiagnostics } from '../data';
import type { DiagnosticsResult } from '../types';

/**
 * Backs the Overview's "Run diagnostics" action. Nothing runs on mount — the checks touch the
 * filesystem, so they happen only when the user asks.
 */
export function useDiagnostics(): {
	result: DiagnosticsResult | null;
	isRunning: boolean;
	error: string;
	run: () => Promise< void >;
} {
	const [ result, setResult ] = useState< DiagnosticsResult | null >( null );
	const [ isRunning, setIsRunning ] = useState( false );
	const [ error, setError ] = useState( '' );

	const run = async (): Promise< void > => {
		setIsRunning( true );
		setError( '' );

		try {
			const data = await apiFetch( { path: '/blicks/v1/diagnostics' } );
			const normalized = normalizeDiagnostics( data );
			if ( ! normalized ) {
				setError( __( 'Diagnostics returned an unreadable response.', 'blicks' ) );
				return;
			}
			setResult( normalized );
		} catch ( failure ) {
			const message = failure instanceof Error ? failure.message : '';
			setError( message || __( 'Diagnostics could not run.', 'blicks' ) );
		} finally {
			setIsRunning( false );
		}
	};

	return { result, isRunning, error, run };
}
