import { __, _n, sprintf } from '@wordpress/i18n';
import { Fragment, useEffect, useRef, useState } from '@wordpress/element';
import { bootstrap } from '../bootstrap';
import { countOverrides, timeAgo } from '../data';
import { urlForView } from '../routing';
import type { AdminView, DashboardSummary, DesignSystemSnapshot, DiagnosticsResult, ThemesState } from '../types';

const CHECK = <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" /></svg>;
const line = ( d: string ): JSX.Element => <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d={ d } /></svg>;
const HIDE_KEY = 'blicks.overview.setupHidden';

function readHidden(): boolean {
	try {
		return window.localStorage.getItem( HIDE_KEY ) === '1';
	} catch {
		return false;
	}
}

function writeHidden( hidden: boolean ): void {
	try {
		if ( hidden ) window.localStorage.setItem( HIDE_KEY, '1' );
		else window.localStorage.removeItem( HIDE_KEY );
	} catch {
		// Storage can be blocked; the setup card then simply stays visible next time.
	}
}

/**
 * Answers three questions in order: is Blicks set up, what does my design system look like right
 * now, and is anything wrong. Every number comes from something the install recorded — nothing
 * here is ticked on the user's behalf.
 */
export function OverviewPanel( {
	snapshot,
	apiStatus,
	themes,
	unsaved,
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
	themes: ThemesState;
	unsaved: number;
	dashboardSummary: DashboardSummary;
	dashboardStatus: 'loading' | 'ready' | 'fallback';
	diagnostics: DiagnosticsResult | null;
	diagnosticsRunning: boolean;
	diagnosticsError: string;
	onRunDiagnostics: () => void;
	onViewChange: ( view: AdminView ) => void;
	onOpenDesignSection: ( section: string ) => void;
} ): JSX.Element {
	const { editorUrl, supportLinks } = bootstrap();
	const [ setupHidden, setSetupHidden ] = useState( readHidden );

	// The checks only look at files and versions, so they run when the page opens rather than
	// leaving the Health card empty until someone asks.
	const asked = useRef( false );
	useEffect( () => {
		if ( asked.current ) return;
		asked.current = true;
		if ( ! diagnostics && ! diagnosticsRunning ) onRunDiagnostics();
	}, [ diagnostics, diagnosticsRunning, onRunDiagnostics ] );

	const overrides = countOverrides( snapshot.overrides );
	const posts = dashboardSummary.usage.posts;
	const themeReady = apiStatus === 'ready';
	const steps = [
		{
			done: themeReady,
			title: __( 'Theme tokens found', 'blicks' ),
			text: themeReady
				? sprintf(
					/* translators: 1: number of colors, 2: number of text styles. */
					__( '%1$d colors and %2$d text styles read from your theme.', 'blicks' ),
					snapshot.counts.colors,
					snapshot.counts.typeRoles
				)
				: __( 'Reading your theme…', 'blicks' ),
		},
		{
			done: overrides > 0,
			title: __( 'Design system made yours', 'blicks' ),
			text: overrides > 0
				? sprintf( /* translators: %d: number of values changed from the theme. */ _n( '%d value changed from the theme.', '%d values changed from the theme.', overrides, 'blicks' ), overrides )
				: __( 'Colors, type and spacing still match your theme.', 'blicks' ),
			action: { label: __( 'Open Design system', 'blicks' ), href: urlForView( 'design' ), onClick: () => onViewChange( 'design' ) },
		},
		{
			done: posts > 0,
			title: __( 'Use a Blicks block', 'blicks' ),
			text: posts > 0
				? sprintf( /* translators: %d: number of posts or pages that contain a Blicks block. */ _n( '%d page uses Blicks.', '%d pages use Blicks.', posts, 'blicks' ), posts )
				: __( 'Add any Blicks block to a page to see your design system in action.', 'blicks' ),
			action: editorUrl ? { label: __( 'Open the editor', 'blicks' ), href: editorUrl } : undefined,
		},
	];
	const done = steps.filter( step => step.done ).length;
	const next = steps.findIndex( step => ! step.done );
	const allDone = done === steps.length;

	const hide = ( value: boolean ): void => {
		setSetupHidden( value );
		writeHidden( value );
	};

	const setup = allDone || setupHidden
		? (
			<div className="card">
				<div className="setup-done">
					{ CHECK }
					<span>
						{ allDone
							? __( 'Setup complete. Blicks is ready to build with.', 'blicks' )
							: sprintf( /* translators: 1: steps done, 2: total steps. */ __( 'Setup %1$d of %2$d done.', 'blicks' ), done, steps.length ) }
					</span>
					{ ! allDone && <button type="button" className="link-btn" onClick={ () => hide( false ) }>{ __( 'Show setup', 'blicks' ) }</button> }
				</div>
			</div>
		)
		: (
			<section className="card" aria-labelledby="ov-setup">
				<div className="card-h">
					<h2 id="ov-setup">{ __( 'Getting started', 'blicks' ) }</h2>
					<span className="aside">{ sprintf( /* translators: 1: steps done, 2: total steps. */ __( '%1$d of %2$d done', 'blicks' ), done, steps.length ) }</span>
					<button type="button" className="link-btn quiet" onClick={ () => hide( true ) }>{ __( 'Hide', 'blicks' ) }</button>
				</div>
				<ol className="setup">
					{ steps.map( ( step, index ) => (
						<li key={ step.title } className={ `step${ step.done ? ' done' : '' }${ index === next ? ' next' : '' }` }>
							<span className="num" aria-hidden="true">{ step.done ? CHECK : index + 1 }</span>
							<b>
								{ step.title }
								<span className="screen-reader-text">{ step.done ? __( '(done)', 'blicks' ) : __( '(to do)', 'blicks' ) }</span>
							</b>
							<span>{ step.text }</span>
							{ index === next && step.action && (
								<a
									className="pill pill--filled sm"
									href={ step.action.href }
									onClick={ event => {
										if ( ! step.action?.onClick || event.metaKey || event.ctrlKey ) return;
										event.preventDefault();
										step.action.onClick();
									} }
								>
									{ step.action.label }
								</a>
							) }
						</li>
					) ) }
				</ol>
			</section>
		);

	const colors = snapshot.values.color ?? {};
	const h1 = snapshot.typeRoles.values.h1 ?? {};
	const body = snapshot.typeRoles.values.body ?? {};
	const activeTheme = themes.themes.find( theme => theme.id === themes.active );
	const designLink = ( section: string, className: string, children: React.ReactNode, style?: React.CSSProperties, title?: string ): JSX.Element => (
		<a
			className={ className }
			href={ urlForView( 'design', section ) }
			style={ style }
			title={ title }
			onClick={ event => {
				if ( event.metaKey || event.ctrlKey || event.shiftKey ) return;
				event.preventDefault();
				onOpenDesignSection( section );
			} }
		>
			{ children }
		</a>
	);
	const palette: Array< [ string, string, string ] > = [
		[ 'background', 'foreground', __( 'Page', 'blicks' ) ],
		[ 'primary', 'primary-foreground', __( 'Main', 'blicks' ) ],
		[ 'secondary', 'secondary-foreground', __( 'Quiet', 'blicks' ) ],
		[ 'accent', 'accent-foreground', __( 'Highlight', 'blicks' ) ],
		[ 'muted', 'muted-foreground', __( 'Subtle', 'blicks' ) ],
		[ 'destructive', 'background', __( 'Error', 'blicks' ) ],
	];
	const spacing = snapshot.values.spacing ?? {};
	const typeRoleCount = Object.values( snapshot.overrides.typeRoles ).reduce( ( n, props ) => n + Object.keys( props ?? {} ).length, 0 );

	const designCard = (
		<section className="card ds" aria-labelledby="ov-ds">
			<div className="card-h">
				<h2 id="ov-ds">{ __( 'Your design system', 'blicks' ) }</h2>
				<a href={ urlForView( 'design' ) } onClick={ event => { event.preventDefault(); onViewChange( 'design' ); } }>{ __( 'Edit', 'blicks' ) }</a>
			</div>
			{ designLink( 'type', 'ds-type', (
				<>
					<span className="d" style={ { fontWeight: h1.fontWeight as React.CSSProperties[ 'fontWeight' ], letterSpacing: h1.letterSpacing, fontFamily: h1.fontFamily } }>{ __( 'Furniture made to outlast the trend', 'blicks' ) }</span>
					<span className="b" style={ { fontFamily: body.fontFamily } }>{ __( 'Body text reads like this. Headings and paragraphs in every Blicks block use these styles.', 'blicks' ) }</span>
				</>
			), { background: colors.background, color: colors.foreground } ) }
			<div className="ds-pal">
				{ palette.map( ( [ surface, text, label ] ) => (
					<Fragment key={ surface }>
						{ designLink( 'color', 'ds-swatch', (
							<><span className="aa" aria-hidden="true">Aa</span>{ label }</>
						), { background: colors[ surface ], color: colors[ text ] }, `${ label }: ${ colors[ surface ] ?? '' }` ) }
					</Fragment>
				) ) }
			</div>
			<div className="ds-parts">
				{ designLink( 'radius', 'ds-part', (
					<><i aria-hidden="true" style={ { borderRadius: snapshot.values.radius?.md, boxShadow: 'inset 0 0 0 1.5px currentcolor' } } /><div><b>{ __( 'Corners', 'blicks' ) }</b><span>md { snapshot.values.radius?.md }</span></div></>
				) ) }
				{ designLink( 'shadow', 'ds-part', (
					<><i aria-hidden="true" style={ { borderRadius: 4, boxShadow: snapshot.values.shadow?.md } } /><div><b>{ __( 'Shadows', 'blicks' ) }</b><span>{ sprintf( /* translators: %d: number of shadow levels. */ _n( '%d level', '%d levels', snapshot.counts.shadow, 'blicks' ), snapshot.counts.shadow ) }</span></div></>
				) ) }
				{ designLink( 'space', 'ds-part', (
					<><i aria-hidden="true" className="bars">{ [ 'xs', 'sm', 'md', 'lg' ].map( key => <em key={ key } style={ { height: `min(32px, ${ spacing[ key ] || '4px' })` } } /> ) }</i><div><b>{ __( 'Spacing', 'blicks' ) }</b><span>{ sprintf( /* translators: %d: number of spacing steps. */ _n( '%d step', '%d steps', snapshot.counts.spacing, 'blicks' ), snapshot.counts.spacing ) }</span></div></>
				) ) }
			</div>
			<div className="ds-foot">
				{ activeTheme && <span>{ __( 'Palette', 'blicks' ) } <b>{ activeTheme.name }</b></span> }
				<span>{ sprintf( /* translators: %d: number of values changed from the theme. */ _n( '%d value changed from it', '%d values changed from it', overrides + typeRoleCount, 'blicks' ), overrides + typeRoleCount ) }</span>
				{ unsaved > 0 && <span className="unsaved">{ sprintf( /* translators: %d: number of unsaved changes. */ _n( '%d unsaved in Design system', '%d unsaved in Design system', unsaved, 'blicks' ), unsaved ) }</span> }
			</div>
		</section>
	);

	const activity = dashboardSummary.activity;
	const recent = (
		<section className="card" aria-labelledby="ov-act">
			<div className="card-h"><h2 id="ov-act">{ __( 'Recent changes', 'blicks' ) }</h2></div>
			{ activity.length > 0 ? (
				<ul className="acts">
					{ activity.slice( 0, 5 ).map( entry => (
						<li key={ entry.id }>
							<b>{ entry.label }</b>
							<span>{ entry.detail }</span>
							<time dateTime={ entry.time }>{ timeAgo( entry.time ) }</time>
						</li>
					) ) }
				</ul>
			) : (
				<p className="card-empty">{ dashboardStatus === 'loading' ? __( 'Loading…', 'blicks' ) : __( 'Nothing yet. Saves, palette changes and settings show up here.', 'blicks' ) }</p>
			) }
		</section>
	);

	const checks = diagnostics?.checks ?? [];
	const problems = checks.filter( check => check.status !== 'pass' );
	const failed = checks.some( check => check.status === 'fail' );
	const health = (
		<section className="card" aria-labelledby="ov-health" aria-busy={ diagnosticsRunning }>
			<div className="card-h"><h2 id="ov-health">{ __( 'Health', 'blicks' ) }</h2></div>
			{ diagnostics ? (
				<div className={ `health-sum${ problems.length ? ( failed ? ' bad' : ' warn' ) : '' }` }>
					<span className="big" aria-hidden="true">{ problems.length ? <b>!</b> : CHECK }</span>
					<div>
						<b>
							{ problems.length
								? sprintf( /* translators: 1: checks passed, 2: total checks. */ __( '%1$d of %2$d checks passed', 'blicks' ), checks.length - problems.length, checks.length )
								: __( 'All checks passed', 'blicks' ) }
						</b>
						<span>
							{ failed
								? __( 'Something needs fixing. The check below says what.', 'blicks' )
								: problems.length
									? _n( 'One thing to know about. Nothing is broken.', 'Some things to know about. Nothing is broken.', problems.length, 'blicks' )
									: __( 'Blicks is installed correctly.', 'blicks' ) }
						</span>
					</div>
				</div>
			) : (
				<p className="card-empty">{ diagnosticsError || __( 'Checking your install…', 'blicks' ) }</p>
			) }
			{ checks.length > 0 && (
				<div className={ `checks${ diagnosticsRunning ? ' running' : '' }` }>
					{ checks.map( check => (
						<div key={ check.id } className={ `check ${ check.status }` }>
							<i aria-hidden="true" />
							<div>
								<b>{ check.label }<span className="screen-reader-text">{ check.status === 'pass' ? __( '(passed)', 'blicks' ) : check.status === 'warn' ? __( '(worth knowing)', 'blicks' ) : __( '(failed)', 'blicks' ) }</span></b>
								<span>{ check.detail }</span>
							</div>
						</div>
					) ) }
				</div>
			) }
			<div className="checks-foot">
				<button type="button" className="pill sm" disabled={ diagnosticsRunning } onClick={ onRunDiagnostics }>
					{ diagnosticsRunning ? __( 'Checking…', 'blicks' ) : __( 'Check again', 'blicks' ) }
				</button>
				{ diagnostics && <span>{ sprintf( /* translators: %s: relative time, e.g. "2 minutes ago". */ __( 'Last checked %s', 'blicks' ), timeAgo( diagnostics.ranAt ) ) }</span> }
				{ diagnostics && diagnosticsError && <span className="err" role="alert">{ diagnosticsError }</span> }
			</div>
		</section>
	);

	const jump = ( href: string, onClick: () => void, path: string, title: string, sub: string ): JSX.Element => (
		<a href={ href } onClick={ event => { if ( event.metaKey || event.ctrlKey ) return; event.preventDefault(); onClick(); } }>
			{ line( path ) }
			<div><b>{ title }</b><span>{ sub }</span></div>
			<span className="go" aria-hidden="true">→</span>
		</a>
	);
	const jumps = (
		<section className="card" aria-labelledby="ov-jump">
			<div className="card-h"><h2 id="ov-jump">{ __( 'Jump to', 'blicks' ) }</h2></div>
			<nav className="jumps" aria-labelledby="ov-jump">
				{ jump( urlForView( 'design', 'color' ), () => onOpenDesignSection( 'color' ), 'M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z', __( 'Colors', 'blicks' ), __( 'Brand, text and surfaces', 'blicks' ) ) }
				{ jump( urlForView( 'design', 'type' ), () => onOpenDesignSection( 'type' ), 'M5 6h14M12 6v13M8 19h8', __( 'Typography', 'blicks' ), __( 'Fonts and text styles', 'blicks' ) ) }
				{ jump( urlForView( 'settings' ), () => onViewChange( 'settings' ), 'M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4', __( 'Settings', 'blicks' ), __( 'Editor defaults and Global Styles', 'blicks' ) ) }
			</nav>
		</section>
	);

	const help = (
		<section className="card" aria-label={ __( 'Help', 'blicks' ) }>
			<div className="note">
				<b>{ __( 'Good to know', 'blicks' ) }</b>
				<span>{ __( 'Pick token values over custom ones. Tokens become shared classes, so pages stay fast and one edit restyles every block.', 'blicks' ) }</span>
			</div>
			{ supportLinks.length > 0 && (
				<div className="note">
					<b>{ __( 'Something not working?', 'blicks' ) }</b>
					<span>{ __( 'Read the docs, or report a bug or an idea. The issue form asks for what makes a report easy to reproduce.', 'blicks' ) }</span>
					{ supportLinks.map( link => (
						<a key={ link.url } href={ link.url } target="_blank" rel="noreferrer">{ link.label } <span aria-hidden="true">↗</span></a>
					) ) }
				</div>
			) }
		</section>
	);

	return (
		<div className="page ov">
			<div className="page-in ov-in">
				<div className="page-head">
					<div>
						<h1>{ __( 'Overview', 'blicks' ) }</h1>
						<p>
							{ allDone
								? __( 'Everything is set up.', 'blicks' )
								: sprintf( /* translators: 1: steps done, 2: total steps. */ __( 'You’re %1$d of %2$d steps from building with Blicks.', 'blicks' ), done, steps.length ) }
						</p>
					</div>
				</div>
				{ setup }
				<div className="ov-grid">
					<div className="ov-col">{ designCard }{ recent }</div>
					<div className="ov-col">{ health }{ jumps }{ help }</div>
				</div>
			</div>
		</div>
	);
}
