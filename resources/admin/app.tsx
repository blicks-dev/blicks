import { _n, sprintf } from '@wordpress/i18n';
import { createRoot, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from '@wordpress/element';
import { AdminHeader } from './components/AdminHeader';
import { CommandPalette } from './components/CommandPalette';
import { OverviewPanel } from './components/OverviewPanel';
import { DesignSystemPanel } from './components/DesignSystemPanel';
import { DesignActions, SettingsActions } from './components/PageActions';
import { SettingsPanel } from './components/SettingsPanel';
import { McpPanel } from './components/McpPanel';
import { EntriesView } from './components/EntriesView';
import { ExternalPanel } from './components/ExternalPanel';
import { ToastProvider, useToast } from './components/Toast';
import { useHashRoute } from './hooks/useHashRoute';
import { useDesignSystem } from './hooks/useDesignSystem';
import { useAdminSettings } from './hooks/useAdminSettings';
import { useAnimations } from './hooks/useAnimations';
import { useDashboard } from './hooks/useDashboard';
import { useDiagnostics } from './hooks/useDiagnostics';
import { BUILTIN_VIEWS } from './constants';
import { designChanges } from './design-model';
import { setDesignSection } from './routing';
import { exposeRegistry, getRegisteredView, getRegisteredViews, subscribeToViews } from './registry';
import type { AdminView } from './types';

function App(): JSX.Element {
	const { activeView, changeView } = useHashRoute();
	const ds = useDesignSystem();
	const settings = useAdminSettings();
	const animations = useAnimations();
	const dashboard = useDashboard();
	const diagnostics = useDiagnostics();
	const toast = useToast();
	const [ paletteOpen, setPaletteOpen ] = useState( false );

	// Companion plugins register their components from their own bundles, which load after this
	// one. Subscribing — rather than reading once — is what makes a late registration appear
	// instead of leaving the user on a permanently empty panel.
	useSyncExternalStore( subscribeToViews, getRegisteredViews );

	// Saves, applies and failures arrive as notices; each one is announced once, as a toast.
	const { notice } = ds;
	const { settingsNotice } = settings;
	useEffect( () => {
		if ( notice.text ) toast( notice.text );
	}, [ notice, toast ] );
	useEffect( () => {
		if ( settingsNotice.text ) toast( settingsNotice.text );
	}, [ settingsNotice, toast ] );

	// ⌘K / Ctrl-K anywhere in the page opens the palette.
	useEffect( () => {
		const onKeyDown = ( event: KeyboardEvent ): void => {
			if ( ! ( event.metaKey || event.ctrlKey ) || event.key.toLowerCase() !== 'k' ) return;
			event.preventDefault();
			setPaletteOpen( current => ! current );
		};

		window.addEventListener( 'keydown', onKeyDown );
		return () => window.removeEventListener( 'keydown', onKeyDown );
	}, [] );

	// Leaving with unsaved work asks first, the way the block editor does.
	const hasUnsaved = ds.isDirty || settings.settingsDirty;
	useEffect( () => {
		if ( ! hasUnsaved ) return;
		const onBeforeUnload = ( event: BeforeUnloadEvent ): void => {
			event.preventDefault();
		};
		window.addEventListener( 'beforeunload', onBeforeUnload );
		return () => window.removeEventListener( 'beforeunload', onBeforeUnload );
	}, [ hasUnsaved ] );

	const openDesignSection = useCallback( ( section: string ): void => {
		changeView( 'design' );
		setDesignSection( section );
	}, [ changeView ] );

	const navigate = useCallback( ( view: AdminView ): void => changeView( view ), [ changeView ] );

	const changes = useMemo(
		() => designChanges( ds.snapshot, { tokens: ds.tokenDraft, breakpoints: ds.breakpointDraft, typeRoles: ds.typeRoleDraft } ),
		[ ds.snapshot, ds.tokenDraft, ds.breakpointDraft, ds.typeRoleDraft ]
	);

	const isBuiltin = ( BUILTIN_VIEWS as readonly string[] ).includes( activeView );

	let actions: React.ReactNode = null;
	if ( activeView === 'design' ) {
		actions = <DesignActions ds={ ds } changes={ changes } />;
	} else if ( activeView === 'settings' ) {
		actions = (
			<SettingsActions
				count={ settings.settingsDirtyCount }
				isSaving={ settings.isSettingsSaving }
				onDiscard={ () => {
					const before = settings.adminSettingsDraft;
					settings.resetSettingsDraft();
					toast(
						sprintf(
							/* translators: %d: number of settings changed. */
							_n( '%d change discarded', '%d changes discarded', settings.settingsDirtyCount, 'blicks' ),
							settings.settingsDirtyCount
						),
						() => settings.setAdminSettingsDraft( before )
					);
				} }
				onSave={ () => void settings.saveAdminSettings() }
			/>
		);
	}

	return (
		<div className="bx-shell">
			<AdminHeader
				activeView={ activeView }
				dirty={ { design: changes.length > 0, settings: settings.settingsDirty } }
				actions={ actions }
				onViewChange={ changeView }
				onOpenPalette={ () => setPaletteOpen( true ) }
			/>

			{ activeView === 'overview' && (
				<OverviewPanel
					snapshot={ ds.snapshot }
					apiStatus={ ds.apiStatus }
					themes={ ds.themes }
					unsaved={ changes.length }
					dashboardSummary={ dashboard.dashboardSummary }
					dashboardStatus={ dashboard.dashboardStatus }
					diagnostics={ diagnostics.result }
					diagnosticsRunning={ diagnostics.isRunning }
					diagnosticsError={ diagnostics.error }
					onRunDiagnostics={ () => void diagnostics.run() }
					onViewChange={ changeView }
					onOpenDesignSection={ openDesignSection }
				/>
			) }

			{ activeView === 'design' && (
				<DesignSystemPanel ds={ ds } changes={ changes } animations={ animations } themeJsonSync={ settings.adminSettings.designSystem.themeJsonSync } onViewChange={ changeView } />
			) }

			{ activeView === 'settings' && (
				<SettingsPanel
					settings={ settings.adminSettingsDraft }
					saved={ settings.adminSettings }
					isSaving={ settings.isSettingsSaving }
					ownThemes={ ds.themes.themes.filter( theme => ! theme.builtin ).length }
					customAnimations={ animations.animations.length }
					onChange={ next => settings.setAdminSettingsDraft( next ) }
				/>
			) }

			{ activeView === 'mcp' && <McpPanel /> }

			{ activeView === 'entries' && <EntriesView /> }

			{ ! isBuiltin && (
				<div className="page ext">
					<div className="page-in">
						<ExternalPanel view={ activeView } registered={ getRegisteredView( activeView ) } navigate={ navigate } />
					</div>
				</div>
			) }

			<CommandPalette
				open={ paletteOpen }
				snapshot={ ds.snapshot }
				onClose={ () => setPaletteOpen( false ) }
				onNavigate={ navigate }
				onOpenDesignSection={ openDesignSection }
			/>
		</div>
	);
}

exposeRegistry();

/**
 * Mount after the document is ready, not at module evaluation.
 *
 * A companion plugin's script declares `blicks-admin` as a dependency, so it runs *after* this
 * file. Mounting here and now would render before any of them had registered, and their pages
 * would be empty on first paint. Waiting for `DOMContentLoaded` lets every enqueued script run
 * first; the registry subscription above covers anything that registers later still.
 */
function mount(): void {
	const root = document.getElementById( 'blicks-admin-root' );

	if ( root ) {
		createRoot( root ).render(
			<div className="blicks-admin">
				<ToastProvider>
					<App />
				</ToastProvider>
			</div>
		);
	}
}

if ( 'loading' === document.readyState ) {
	document.addEventListener( 'DOMContentLoaded', mount, { once: true } );
} else {
	mount();
}
