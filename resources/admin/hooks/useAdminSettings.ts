import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { adminSettingsEqual, normalizeAdminSettings } from '../data';
import { FALLBACK_ADMIN_SETTINGS } from '../fallbacks';
import type { AdminSettingsSnapshot } from '../types';

// Owns the Settings tab: the saved snapshot, the editable draft, and the save/reset flow.
export function useAdminSettings() {
	const [ adminSettings, setAdminSettings ] = useState< AdminSettingsSnapshot >( FALLBACK_ADMIN_SETTINGS );
	const [ adminSettingsDraft, setAdminSettingsDraft ] = useState< AdminSettingsSnapshot >( FALLBACK_ADMIN_SETTINGS );
	const [ settingsNotice, setSettingsNotice ] = useState( '' );
	const [ isSettingsSaving, setIsSettingsSaving ] = useState( false );
	const settingsDirty = ! adminSettingsEqual( adminSettingsDraft, adminSettings );

	// How many individual settings differ from the saved snapshot — drives the save bar's
	// "N settings changed" line. Derived for display only; `settingsDirty` still owns the
	// save/reset gating.
	const settingsDirtyCount = [
		adminSettingsDraft.defaultInspectorPanel !== adminSettings.defaultInspectorPanel,
		adminSettingsDraft.helpVisibility !== adminSettings.helpVisibility,
		adminSettingsDraft.deleteDataOnUninstall !== adminSettings.deleteDataOnUninstall,
		adminSettingsDraft.designSystem.themeJsonSync !== adminSettings.designSystem.themeJsonSync,
	].filter( Boolean ).length;

	useEffect( () => {
		let alive = true;

		apiFetch( { path: '/blicks/v1/settings' } )
			.then( ( data: unknown ) => {
				if ( ! alive ) return;
				const next = normalizeAdminSettings( data );
				setAdminSettings( next );
				setAdminSettingsDraft( next );
			} )
			.catch( () => {
				if ( ! alive ) return;
				setSettingsNotice( __( 'Could not load settings. Showing defaults.', 'blicks' ) );
			} );

		return () => {
			alive = false;
		};
	}, [] );

	async function saveAdminSettings(): Promise< void > {
		if ( ! settingsDirty || isSettingsSaving ) return;

		setIsSettingsSaving( true );
		setSettingsNotice( '' );

		try {
			const data = await apiFetch( {
				path: '/blicks/v1/settings',
				method: 'PATCH',
				data: adminSettingsDraft,
			} );
			const next = normalizeAdminSettings( data );
			setAdminSettings( next );
			setAdminSettingsDraft( next );
			setSettingsNotice( __( 'Settings saved.', 'blicks' ) );
		} catch ( error ) {
			setSettingsNotice( error instanceof Error ? error.message : __( 'Could not save settings.', 'blicks' ) );
		} finally {
			setIsSettingsSaving( false );
		}
	}

	function resetSettingsDraft(): void {
		setAdminSettingsDraft( adminSettings );
		setSettingsNotice( __( 'Settings reset in draft.', 'blicks' ) );
	}

	return {
		adminSettings,
		adminSettingsDraft,
		setAdminSettingsDraft,
		settingsNotice,
		isSettingsSaving,
		settingsDirty,
		settingsDirtyCount,
		saveAdminSettings,
		resetSettingsDraft,
	};
}
