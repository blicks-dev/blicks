import { __, _n, sprintf } from '@wordpress/i18n';
import { bootstrap } from '../bootstrap';
import { countOverrides, metricValue, timeAgo } from '../data';
import { icon } from '../icons';
import { TokenPreview } from './primitives';
import type { DesignSystemSnapshot, AdminSettingsSnapshot, DashboardSummary, DiagnosticsResult, AdminView } from '../types';

/** One step of the "Getting started" checklist in the hero's side panel. */
type SetupStep = {
	id: string;
	complete: boolean;
	title: string;
	text: string;
	/** What to do about it, offered only while the step is outstanding. */
	action?: { label: string; href?: string; onClick?: () => void };
};

/**
 * One checklist row. An incomplete step carries the way to complete it, so the list is
 * something to act on rather than a report card. The state is also spelled out for screen
 * readers — the tick is a decorative glyph, so on its own "Theme tokens detected" reads
 * identically whether it is done or outstanding.
 */
function SetupItem( { complete, title, text, action }: SetupStep ): JSX.Element {
	return (
		<div className="si">
			<span className={ `check${ complete ? '' : ' pending' }` } aria-hidden="true">
				<svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6" /></svg>
			</span>
			<span className="t">
				<b>
					{ title }
					<span className="screen-reader-text">
						{ complete ? __( ' — done', 'blicks' ) : __( ' — not done yet', 'blicks' ) }
					</span>
				</b>
				<small>{ text }</small>
			</span>
			{ ! complete && action && (
				action.href
					? <a className="lnk" href={ action.href }>{ action.label }</a>
					: <button className="lnk" type="button" onClick={ action.onClick }>{ action.label }</button>
			) }
		</div>
	);
}

/** One row of the "Quick actions" list — always a real button, never an inert tile. */
function QuickAction( {
	title,
	text,
	meta,
	glyph,
	onClick,
}: {
	title: string;
	text: string;
	meta: string;
	glyph: JSX.Element;
	onClick: () => void;
} ): JSX.Element {
	return (
		<button type="button" onClick={ onClick }>
			<span className="ic">{ glyph }</span>
			<span className="t"><b>{ title }</b><small>{ text }</small></span>
			<span className="meta">{ meta }</span>
		</button>
	);
}

/** One row of the "System health" list, with a status pill. */
function HealthRow( {
	title,
	text,
	value,
	tone = 'pass',
}: {
	title: string;
	text: string;
	value: string;
	tone?: 'pass' | 'warn' | 'fail';
} ): JSX.Element {
	return (
		<div className="hrow">
			<span className="t"><b>{ title }</b><small>{ text }</small></span>
			<span className={ `pill${ tone === 'pass' ? '' : ` is-${ tone }` }` }><span className="dot" />{ value }</span>
		</div>
	);
}

export function OverviewPanel( {
	snapshot,
	apiStatus,
	adminSettings,
	dashboardSummary,
	dashboardStatus,
	diagnostics,
	diagnosticsRunning,
	diagnosticsError,
	onRunDiagnostics,
	onViewChange,
	onOpenDesignSection,
}: {
	snapshot: DesignSystemSnapshot;
	apiStatus: 'loading' | 'ready' | 'fallback';
	adminSettings: AdminSettingsSnapshot;
	dashboardSummary: DashboardSummary;
	dashboardStatus: 'loading' | 'ready' | 'fallback';
	diagnostics: DiagnosticsResult | null;
	diagnosticsRunning: boolean;
	diagnosticsError: string;
	onRunDiagnostics: () => void;
	onViewChange: ( view: AdminView ) => void;
	onOpenDesignSection: ( section: string ) => void;
} ): JSX.Element {
	const { editorUrl } = bootstrap();
	const themeReady = apiStatus === 'ready' && snapshot.counts.colors > 0;
	const tokenCount = snapshot.counts.colors + snapshot.counts.typography;
	const overrideCount = countOverrides( snapshot.overrides );
	const pagesUsingBlicks = dashboardSummary.usage.posts;

	/**
	 * The setup checklist. Every step is answered from something this install actually
	 * recorded — detected tokens, persisted overrides, a real count of content containing a
	 * Blicks block — in the same spirit as the activity feed below, which omits any event it
	 * cannot date rather than inventing one. Nothing here is ticked on the user's behalf.
	 */
	const setupSteps: SetupStep[] = [
		{
			id: 'theme',
			complete: themeReady,
			title: themeReady ? __( 'Theme tokens detected', 'blicks' ) : __( 'Theme tokens loading', 'blicks' ),
			text: themeReady
				? sprintf(
					/* translators: 1: number of color tokens, 2: number of typography tokens. */
					__( '%1$d colors · %2$d type tokens', 'blicks' ),
					snapshot.counts.colors,
					snapshot.counts.typography
				)
				: __( 'Reading the active theme', 'blicks' ),
		},
		{
			id: 'tokens',
			complete: overrideCount > 0,
			title: __( 'Design system made yours', 'blicks' ),
			text: overrideCount > 0
				? sprintf(
					/* translators: %d: number of token values changed from the theme's own. */
					_n( '%d value changed from the theme', '%d values changed from the theme', overrideCount, 'blicks' ),
					overrideCount
				)
				: __( 'Colors, type and spacing still match the theme', 'blicks' ),
			action: { label: __( 'Tokens', 'blicks' ), onClick: () => onViewChange( 'design' ) },
		},
		{
			id: 'usage',
			complete: pagesUsingBlicks > 0,
			title: __( 'Blicks blocks in use', 'blicks' ),
			text: pagesUsingBlicks > 0
				? sprintf(
					/* translators: %d: number of posts or pages containing a Blicks block. */
					_n( '%d page uses Blicks', '%d pages use Blicks', pagesUsingBlicks, 'blicks' ),
					pagesUsingBlicks
				)
				: __( 'Drop a Blicks block into any page', 'blicks' ),
			action: editorUrl ? { label: __( 'Editor', 'blicks' ), href: editorUrl } : undefined,
		},
	];

	const done = setupSteps.filter( ( step ) => step.complete ).length;
	// The footer points at the first step still outstanding, so it always names the next
	// real thing to do rather than a fixed suggestion that may already be finished.
	const nextStep = setupSteps.find( ( step ) => ! step.complete && step.action );

	const statusValue = ( state: 'loading' | 'ready' | 'fallback' ): { value: string; tone: 'pass' | 'warn' } =>
		state === 'ready'
			? { value: __( 'Connected', 'blicks' ), tone: 'pass' }
			: state === 'loading'
				? { value: __( 'Loading', 'blicks' ), tone: 'pass' }
				: { value: __( 'Fallback', 'blicks' ), tone: 'warn' };

	const rest = statusValue( apiStatus );
	const dash = statusValue( dashboardStatus );

	return (
		<>
			{ /* ── HERO ── */ }
			<div className="row hero">
				<div className="panel hero-main">
					<div className="kick eyebrow accent">
						{ done === setupSteps.length ? __( 'Foundation ready', 'blicks' ) : __( 'Setup in progress', 'blicks' ) }
					</div>
					<h1>
						{ done === setupSteps.length
							? __( 'Your site foundation is ready.', 'blicks' )
							: sprintf(
								/* translators: 1: completed setup steps, 2: total setup steps. */
								__( 'Setup %1$d of %2$d complete.', 'blicks' ),
								done,
								setupSteps.length
							) }
					</h1>
					<div className="hero-actions">
						<button className="btn primary" type="button" onClick={ () => onViewChange( 'design' ) }>
							{ __( 'Customize design system', 'blicks' ) }
						</button>
					</div>
				</div>

				<div className="panel hero-side">
					<div className="hs-top">
						<span className="eyebrow">{ __( 'Getting started', 'blicks' ) }</span>
						<span
							className="progress"
							style={ { '--gs-progress': `${ Math.round( ( done / setupSteps.length ) * 100 ) }%` } as React.CSSProperties }
						>
							<span className="bar"><i /></span>
							{ sprintf(
								/* translators: 1: completed setup steps, 2: total setup steps. */
								__( '%1$d / %2$d', 'blicks' ),
								done,
								setupSteps.length
							) }
						</span>
					</div>

					{ setupSteps.map( ( step ) => <SetupItem key={ step.id } { ...step } /> ) }
					<div className="si-next">
						<div>
							<b>
								{ nextStep
									? sprintf(
										/* translators: %s: the title of the next outstanding setup step. */
										__( 'Next — %s', 'blicks' ),
										nextStep.title.toLocaleLowerCase()
									)
									: __( 'You are set up', 'blicks' ) }
							</b>
							<small>{ nextStep ? nextStep.text : __( 'Every step done — build something', 'blicks' ) }</small>
						</div>
						{ nextStep?.action?.href
							? <a className="lnk" href={ nextStep.action.href }>{ nextStep.action.label }</a>
							: nextStep?.action
								? <button className="lnk" type="button" onClick={ nextStep.action.onClick }>{ nextStep.action.label }</button>
								: editorUrl && <a className="lnk" href={ editorUrl }>{ __( 'Editor', 'blicks' ) }</a> }
					</div>
				</div>
			</div>

			{ /* ── STAT STRIP ── */ }
			<div className="panel stats">
				<div className="stat">
					<div className="eyebrow">{ __( 'Registered blocks', 'blicks' ) }</div>
					<div className="v num">
						{ metricValue( dashboardSummary.blocks.total, dashboardStatus ) }
						<span className="u">{ sprintf(
							/* translators: %d: number of blocks using the Interactivity API. */
							_n( '%d interactive', '%d interactive', dashboardSummary.blocks.interactive, 'blicks' ),
							dashboardSummary.blocks.interactive
						) }</span>
					</div>
					<div className="foot">{ __( 'Available in editor', 'blicks' ) }</div>
				</div>
				<div className="stat">
					<div className="eyebrow">{ __( 'Design tokens', 'blicks' ) }</div>
					<div className="v num">
						{ tokenCount }
						<span className="u">{ __( 'theme-native', 'blicks' ) }</span>
					</div>
					<div className={ `foot${ apiStatus === 'fallback' ? ' is-warn' : '' }` }>
						{ snapshot.source.themeJson ? __( 'theme.json · in sync', 'blicks' ) : __( 'Fallback values', 'blicks' ) }
					</div>
				</div>
				<div className="stat">
					<div className="eyebrow">{ __( 'Per-block help', 'blicks' ) }</div>
					<div className="v num">
						{ adminSettings.helpVisibility === 'show' ? __( 'Shown', 'blicks' ) : __( 'Hidden', 'blicks' ) }
					</div>
					<div className="foot">{ __( 'Inspector setting', 'blicks' ) }</div>
				</div>
			</div>

			{ /* ── quick actions | system health ── */ }
			<div className="row two">
				<div className="panel card">
					<div className="head">
						<div>
							<h2>{ __( 'Quick actions', 'blicks' ) }</h2>
							<div className="sub">{ __( 'Common workflows, one click away.', 'blicks' ) }</div>
						</div>
						<button className="lnk" type="button" onClick={ () => onViewChange( 'settings' ) }>{ __( 'All actions', 'blicks' ) }</button>
					</div>
					<div className="qa">
						<QuickAction
							title={ __( 'Edit tokens', 'blicks' ) }
							text={ __( 'Colors, type, spacing, radius.', 'blicks' ) }
							meta={ sprintf(
								/* translators: %d: number of design tokens. */
								_n( '%d token', '%d tokens', tokenCount, 'blicks' ),
								tokenCount
							) }
							glyph={ icon( <><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 0 0 18Z" /></> ) }
							onClick={ () => onOpenDesignSection( 'color' ) }
						/>
						<QuickAction
							title={ __( 'Open the editor', 'blicks' ) }
							text={ __( 'Start a new page with Blicks blocks.', 'blicks' ) }
							meta={ __( 'Editor', 'blicks' ) }
							glyph={ icon( <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></> ) }
							onClick={ () => { if ( editorUrl ) window.location.assign( editorUrl ); } }
						/>
						<QuickAction
							title={ __( 'Adjust settings', 'blicks' ) }
							text={ __( 'Inspector defaults and help.', 'blicks' ) }
							meta={ __( 'Settings', 'blicks' ) }
							glyph={ icon( <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2" /><circle cx="15" cy="17" r="2" /></> ) }
							onClick={ () => onViewChange( 'settings' ) }
						/>
					</div>
				</div>

				<div className="panel card">
					<div className="head">
						<div>
							<h2>{ __( 'System health', 'blicks' ) }</h2>
							<div className="sub">
								{ diagnostics
									? sprintf(
										/* translators: 1: passing check count, 2: total check count. */
										__( '%1$d of %2$d checks passed.', 'blicks' ),
										diagnostics.summary.pass,
										diagnostics.checks.length
									)
									: apiStatus === 'ready' && dashboardStatus === 'ready'
										? __( 'All checks passing.', 'blicks' )
										: __( 'Using fallback data.', 'blicks' ) }
							</div>
						</div>
						<button className="lnk" type="button" disabled={ diagnosticsRunning } onClick={ onRunDiagnostics }>
							{ diagnosticsRunning ? __( 'Running…', 'blicks' ) : __( 'Run diagnostics', 'blicks' ) }
						</button>
					</div>

					<div className="health">
						{ diagnostics
							? diagnostics.checks.map( check => (
								<HealthRow
									key={ check.id }
									title={ check.label }
									text={ check.detail }
									tone={ check.status }
									value={ check.status === 'pass' ? __( 'Pass', 'blicks' ) : check.status === 'warn' ? __( 'Warning', 'blicks' ) : __( 'Fail', 'blicks' ) }
								/>
							) )
							: (
								<>
									<HealthRow title={ __( 'REST API', 'blicks' ) } text={ __( 'Design-system endpoints', 'blicks' ) } value={ rest.value } tone={ rest.tone } />
									<HealthRow title={ __( 'Dashboard API', 'blicks' ) } text={ __( 'Block summary', 'blicks' ) } value={ dash.value } tone={ dash.tone } />
									<HealthRow
										title="theme.json"
										text={ __( 'Source of truth', 'blicks' ) }
										value={ snapshot.source.themeJson ? __( 'In sync', 'blicks' ) : __( 'Fallback', 'blicks' ) }
										tone={ snapshot.source.themeJson ? 'pass' : 'warn' }
									/>
								</>
							) }
					</div>

					{ diagnosticsError && <p className="panel__error" role="alert">{ diagnosticsError }</p> }
					<div className="grow" />
					{ diagnostics && (
						<div className="eyebrow">
							{ sprintf(
								/* translators: %s: relative time, e.g. "4 min ago". */
								__( 'Last check · %s', 'blicks' ),
								timeAgo( diagnostics.ranAt )
							) }
						</div>
					) }
				</div>
			</div>

			{ /* ── current tokens | recent activity ── */ }
			<div className="row two">
				<div className="panel card">
					<div className="head">
						<div>
							<h2>{ __( 'Current tokens', 'blicks' ) }</h2>
							<div className="sub">{ __( 'Type roles & palette in use right now.', 'blicks' ) }</div>
						</div>
						<button className="lnk" type="button" onClick={ () => onOpenDesignSection( 'type' ) }>{ __( 'Edit in design system', 'blicks' ) }</button>
					</div>
					<TokenPreview snapshot={ snapshot } />
					<div className="grow" />
				</div>

				<div className="panel card">
					<div className="head">
						<div>
							<h2>{ __( 'Recent activity', 'blicks' ) }</h2>
							<div className="sub">{ __( 'Latest changes to this workspace.', 'blicks' ) }</div>
						</div>
					</div>
					<div className="act">
						{ dashboardSummary.activity.length === 0
							? (
								<p className="act__empty">
									{ dashboardStatus === 'loading'
										? __( 'Loading activity…', 'blicks' )
										: __( 'Nothing recorded yet. Saving tokens or settings will show up here.', 'blicks' ) }
								</p>
							)
							: dashboardSummary.activity.map( ( entry, index ) => (
								<div className={ `ar${ index === 0 ? '' : ' q' }` } key={ entry.id }>
									<span className="mk" />
									<span className="t">
										<b>{ entry.label }</b>
										<small>{ entry.detail ? `${ entry.detail } · ${ timeAgo( entry.time ) }` : timeAgo( entry.time ) }</small>
									</span>
								</div>
							) ) }
					</div>
					<div className="grow" />
				</div>
			</div>

			{ /* ── full-width tip strip ── */ }
			<div className="panel tip">
				<span className="eyebrow accent">{ __( 'Tip', 'blicks' ) }</span>
				<div className="body">
					<b>{ __( 'Use tokens first.', 'blicks' ) }</b>
					<p>{ __( 'Token values become reusable classes; custom values stay inside instance variables, so Blicks pages stay fast and easy to maintain.', 'blicks' ) }</p>
				</div>
				<button className="lnk" type="button" onClick={ () => onOpenDesignSection( 'out' ) }>{ __( 'See generated output', 'blicks' ) }</button>
			</div>
		</>
	);
}
