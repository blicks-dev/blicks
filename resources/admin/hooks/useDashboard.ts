import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from '@wordpress/element';
import { normalizeDashboardSummary } from '../data';
import { FALLBACK_DASHBOARD_SUMMARY } from '../fallbacks';
import type { DashboardSummary } from '../types';

// Read-only dashboard metrics for the Overview tab.
export function useDashboard(): {
	dashboardSummary: DashboardSummary;
	dashboardStatus: 'loading' | 'ready' | 'fallback';
} {
	const [ dashboardSummary, setDashboardSummary ] = useState< DashboardSummary >( FALLBACK_DASHBOARD_SUMMARY );
	const [ dashboardStatus, setDashboardStatus ] = useState< 'loading' | 'ready' | 'fallback' >( 'loading' );

	useEffect( () => {
		let alive = true;

		apiFetch( { path: '/blicks/v1/dashboard' } )
			.then( ( data: unknown ) => {
				if ( ! alive ) return;
				setDashboardSummary( normalizeDashboardSummary( data ) );
				setDashboardStatus( 'ready' );
			} )
			.catch( () => {
				if ( ! alive ) return;
				setDashboardStatus( 'fallback' );
			} );

		return () => {
			alive = false;
		};
	}, [] );

	return { dashboardSummary, dashboardStatus };
}
