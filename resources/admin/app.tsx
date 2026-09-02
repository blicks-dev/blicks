import { __ } from '@wordpress/i18n';
import { createRoot, useCallback, useEffect, useState } from '@wordpress/element';
import { AdminHeader } from './components/AdminHeader';
import { CommandPalette } from './components/CommandPalette';
import { OverviewPanel } from './components/OverviewPanel';
import { DesignSystemPanel } from './components/DesignSystemPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { useHashRoute } from './hooks/useHashRoute';
import { useDesignSystem } from './hooks/useDesignSystem';
import { useAdminSettings } from './hooks/useAdminSettings';
import { useDashboard } from './hooks/useDashboard';
import { useDiagnostics } from './hooks/useDiagnostics';
import type { AdminView } from './types';

function App(): JSX.Element {
	const { activeView, changeView } = useHashRoute();
	const ds = useDesignSystem();
	const settings = useAdminSettings();
	const dashboard = useDashboard();
	const diagnostics = useDiagnostics();
	const [ paletteOpen, setPaletteOpen ] = useState( false );

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

	// Jump to a section of the Design System view — switch views first, then let the panel's
	// own hash handling scroll to the anchor once it has mounted.
	const openDesignSection = useCallback( ( section: string ): void => {
		window.location.hash = `design/${ section }`;
		changeView( 'design' );
		window.requestAnimationFrame( () => {
			document.getElementById( `s-${ section }` )?.scrollIntoView( { block: 'start' } );
		} );
	}, [ changeView ] );

	const navigate = useCallback( ( view: AdminView ): void => changeView( view ), [ changeView ] );

	const systemState = activeView === 'design'
		? ds.snapshot.source.themeJson
			? { label: __( 'theme.json in sync', 'blicks' ), tone: 'ok' as const }
			: { label: __( 'theme.json fallback', 'blicks' ), tone: 'warn' as const }
		: ds.apiStatus === 'ready' && dashboard.dashboardStatus === 'ready'
			? { label: __( 'All systems live', 'blicks' ), tone: 'ok' as const }
			: ds.apiStatus === 'loading' || dashboard.dashboardStatus === 'loading'
				? { label: __( 'Checking systems', 'blicks' ), tone: 'ok' as const }
				: { label: __( 'Running on fallback data', 'blicks' ), tone: 'warn' as const };

	// The mockups scope their page CSS per file; here all four views share one document,
	// so the active view's class is what keeps `.panel`/`.toolbar`/`.head` from colliding.
	const viewClass = {
		overview: 'v-overview',
		design: 'v-design',
		settings: 'v-settings',
	}[ activeView ];

	return (
		<div className="blicks-admin">
			<div className={ `wrap ${ viewClass }` }>
				<AdminHeader
					activeView={ activeView }
					systemState={ systemState }
					onViewChange={ changeView }
					onOpenPalette={ () => setPaletteOpen( true ) }
				/>

				<CommandPalette
					open={ paletteOpen }
					snapshot={ ds.snapshot }
					onClose={ () => setPaletteOpen( false ) }
					onNavigate={ navigate }
					onOpenDesignSection={ openDesignSection }
				/>

				{ activeView === 'design' && ds.notice && <div className="notice-card" role="status">{ ds.notice }</div> }

				{ activeView === 'overview' && (
					<OverviewPanel
						snapshot={ ds.snapshot }
						apiStatus={ ds.apiStatus }
						adminSettings={ settings.adminSettings }
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
					<DesignSystemPanel
						snapshot={ ds.snapshot }
						apiStatus={ ds.apiStatus }
						tokenDraft={ ds.tokenDraft }
						breakpointDraft={ ds.breakpointDraft }
						typeRoleDraft={ ds.typeRoleDraft }
						colorTokens={ ds.colorTokens }
						themes={ ds.themes }
						isSaving={ ds.isSaving }
						isDirty={ ds.isDirty }
						onTokenChange={ ds.updateTokenDraft }
						onTokenReset={ ds.resetTokenDraft }
						onBreakpointChange={ ds.updateBreakpointDraft }
						onBreakpointReset={ ds.resetBreakpointDraft }
						onTypeRoleChange={ ds.updateTypeRoleDraft }
						onTypeRoleReset={ ds.resetTypeRoleDraft }
						onReset={ ds.resetDraft }
						onSave={ ds.saveOverrides }
						onApplyTheme={ ds.applyTheme }
						onCreateTheme={ ds.createThemeFromCurrent }
						onDeleteTheme={ ds.deleteTheme }
						onResetTheme={ ds.resetTheme }
						onGroupReset={ ds.resetGroup }
					/>
				) }


				{ activeView === 'settings' && settings.settingsNotice && <div className="notice-card" role="status">{ settings.settingsNotice }</div> }

				{ activeView === 'settings' && (
					<SettingsPanel
						settings={ settings.adminSettingsDraft }
						isDirty={ settings.settingsDirty }
						isSaving={ settings.isSettingsSaving }
						dirtyCount={ settings.settingsDirtyCount }
						onChange={ next => settings.setAdminSettingsDraft( next ) }
						onReset={ settings.resetSettingsDraft }
						onSave={ settings.saveAdminSettings }
					/>
				) }
			</div>
		</div>
	);
}

const root = document.getElementById( 'blicks-admin-root' );

if ( root ) {
	createRoot( root ).render( <App /> );
}
