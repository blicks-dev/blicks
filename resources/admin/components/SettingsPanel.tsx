import { __, _n, sprintf } from '@wordpress/i18n';
import { bootstrap } from '../bootstrap';
import { FALLBACK_ADMIN_SETTINGS } from '../fallbacks';
import { DataSources } from './DataSources';
import { FormsSettings } from './FormsSettings';
import { useToast } from './Toast';
import type { AdminSettingsSnapshot } from '../types';

// The developer references point at the hosted docs site. `docsUrl` comes from the plugin's
// BLICKS_DOCS_URI constant, so a fork keeps its own links. `path` is a repo-relative doc path
// (e.g. "docs/architecture/style-generation.md"); map it to the docs site's own routing by
// dropping the leading "docs/" and the ".md" extension.
function docsLink( path: string ): string {
	const { docsUrl } = bootstrap();
	if ( ! docsUrl ) return '';
	const slug = path.replace( /^docs\//, '' ).replace( /\.md$/, '' );
	return `${ docsUrl.replace( /\/$/, '' ) }/${ slug }`;
}

const UNDO = <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.5 8c-2.6 0-5 1-6.9 2.6L2 7v9h9l-3.6-3.6A8 8 0 0 1 20.1 16l2.4-.8A10.5 10.5 0 0 0 12.5 8Z" /></svg>;
const CHECK = <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" /></svg>;

type Key = 'sync' | 'uninstall' | 'marketplace';

/**
 * How Blicks behaves for the people editing pages, and what it writes to the site. A handful of
 * real choices, each next to what it changes; how Blicks builds CSS is stated as fact, not drawn
 * as switches nobody can flip.
 */
export function SettingsPanel( {
	settings,
	saved,
	isSaving,
	ownThemes,
	customAnimations,
	onChange,
}: {
	settings: AdminSettingsSnapshot;
	saved: AdminSettingsSnapshot;
	isSaving: boolean;
	ownThemes: number;
	customAnimations: number;
	onChange: ( settings: AdminSettingsSnapshot ) => void;
} ): JSX.Element {
	const toast = useToast();
	const read = ( from: AdminSettingsSnapshot, key: Key ): string | boolean => ( {
		sync: from.designSystem.themeJsonSync,
		uninstall: from.deleteDataOnUninstall,
		marketplace: from.marketplace,
	} )[ key ];
	const write = ( key: Key, value: string | boolean, from: AdminSettingsSnapshot = settings ): AdminSettingsSnapshot => {
		switch ( key ) {
			case 'sync': return { ...from, designSystem: { ...from.designSystem, themeJsonSync: value as boolean } };
			case 'marketplace': return { ...from, marketplace: value as boolean };
			default: return { ...from, deleteDataOnUninstall: value as boolean };
		}
	};
	const changed = ( key: Key ): boolean => read( settings, key ) !== read( saved, key );

	const defaults: AdminSettingsSnapshot = {
		...FALLBACK_ADMIN_SETTINGS,
		designSystem: { ...FALLBACK_ADMIN_SETTINGS.designSystem, themeJsonSupported: settings.designSystem.themeJsonSupported },
	};
	const atDefaults = ( [ 'sync', 'uninstall', 'marketplace' ] as Key[] ).every( key => read( settings, key ) === read( defaults, key ) );
	const syncSupported = settings.designSystem.themeJsonSupported;

	const row = ( key: Key, title: string, desc: string, control: React.ReactNode, extra?: React.ReactNode ): JSX.Element => (
		<div className={ `sp-row${ changed( key ) ? ' changed' : '' }` }>
			<div className="sp-top">
				<div><b id={ `sp-${ key }` }>{ title }</b><span>{ desc }</span></div>
				{ control }
				{ changed( key ) && (
					<button
						type="button"
						className="icon-btn sm"
						title={ __( 'Back to saved', 'blicks' ) }
						aria-label={ sprintf( /* translators: %s: setting name. */ __( 'Undo %s', 'blicks' ), title ) }
						onClick={ () => onChange( write( key, read( saved, key ) ) ) }
					>{ UNDO }</button>
				) }
			</div>
			{ extra }
		</div>
	);

	const toggle = ( key: Key, label: string, disabled = false ): JSX.Element => (
		<button
			type="button"
			className="sw2"
			role="switch"
			aria-checked={ read( settings, key ) === true }
			aria-labelledby={ `sp-${ key }` }
			disabled={ disabled || isSaving }
			title={ label }
			onClick={ () => onChange( write( key, read( settings, key ) !== true ) ) }
		/>
	);

	return (
		<div className="page sp">
			<div className="page-in sp-in">
				<div className="sp-head">
					<div>
						<h1>{ __( 'Settings', 'blicks' ) }</h1>
						<p>{ __( 'How Blicks behaves for the people editing pages, and what it writes to your site.', 'blicks' ) }</p>
					</div>
					<button
						type="button"
						className="link-btn"
						disabled={ atDefaults || isSaving }
						onClick={ () => {
							const before = settings;
							onChange( defaults );
							toast( __( 'Settings back to defaults. Save to keep them.', 'blicks' ), () => onChange( before ) );
						} }
					>
						{ __( 'Reset to defaults', 'blicks' ) }
					</button>
				</div>

				<section className="sp-sec" aria-labelledby="sp-site">
					<header><h2 id="sp-site">{ __( 'On your site', 'blicks' ) }</h2><p>{ __( 'Where saved design tokens end up.', 'blicks' ) }</p></header>
					<div className="sp-rows">
						{ row( 'sync', __( 'Sync with Global Styles', 'blicks' ),
							syncSupported
								? __( 'Also write design tokens into your theme’s Global Styles, so the Site Editor shows the same colors and sizes.', 'blicks' )
								: __( 'Your active theme has no theme.json, so there are no Global Styles to write to. Blicks keeps the tokens in its own settings.', 'blicks' ),
							toggle( 'sync', __( 'Sync with Global Styles', 'blicks' ), ! syncSupported ),
							<div className="eg">
								<span className="eg-k">{ __( 'When you save', 'blicks' ) }</span>
								<span className="flowline">
									<span>{ __( 'Design system', 'blicks' ) }</span><em aria-hidden="true">→</em>
									<span>Blicks</span><em aria-hidden="true">→</em>
									<span className={ settings.designSystem.themeJsonSync ? '' : 'off' }>{ __( 'theme.json Global Styles', 'blicks' ) }</span><em aria-hidden="true">→</em>
									<span className={ settings.designSystem.themeJsonSync ? '' : 'off' }>{ __( 'Site Editor', 'blicks' ) }</span>
								</span>
							</div>
						) }
					</div>
				</section>

				<section className="sp-sec" aria-labelledby="sp-market">
					<header><h2 id="sp-market">{ __( 'Marketplace', 'blicks' ) }</h2><p>{ __( 'Ready-made designs in the Studio library, served by blicks.dev.', 'blicks' ) }</p></header>
					<div className="sp-rows">
						{ row( 'marketplace', __( 'Show the Marketplace in the Studio', 'blicks' ),
							__( 'Off until you turn it on. When on, opening the Studio library makes this site ask showcase.blicks.dev for its designs, sending your site’s address and any search or filter you pick, and your browser loads the previews from it. Nothing about your visitors or your content is sent.', 'blicks' ),
							toggle( 'marketplace', __( 'Show the Marketplace in the Studio', 'blicks' ) ),
							<p className="eg">
								<a href="https://blicks.dev/privacy/" target="_blank" rel="noreferrer">{ __( 'Privacy policy', 'blicks' ) }</a>
								{ ' · ' }
								<a href="https://blicks.dev/terms/" target="_blank" rel="noreferrer">{ __( 'Terms', 'blicks' ) }</a>
							</p>
						) }
					</div>
				</section>

				<DataSources />

				<FormsSettings />

				<section className="sp-sec" aria-labelledby="sp-data">
					<header><h2 id="sp-data">{ __( 'Your data', 'blicks' ) }</h2><p>{ __( 'Only applies when the plugin is deleted. Deactivating never removes anything.', 'blicks' ) }</p></header>
					<div className="sp-rows">
						{ row( 'uninstall', __( 'When Blicks is deleted', 'blicks' ), __( 'Choose what happens to everything you made in Blicks.', 'blicks' ), null,
							<>
								<div className="choices" role="radiogroup" aria-labelledby="sp-uninstall">
									<button type="button" className="choice" role="radio" aria-checked={ ! settings.deleteDataOnUninstall } disabled={ isSaving } onClick={ () => onChange( write( 'uninstall', false ) ) }>
										<b><i className="rb" aria-hidden="true" />{ __( 'Keep my data', 'blicks' ) }</b>
										<span>{ __( 'Reinstall later and pick up where you left off. Recommended.', 'blicks' ) }</span>
									</button>
									<button type="button" className="choice danger" role="radio" aria-checked={ settings.deleteDataOnUninstall } disabled={ isSaving } onClick={ () => onChange( write( 'uninstall', true ) ) }>
										<b><i className="rb" aria-hidden="true" />{ __( 'Remove everything', 'blicks' ) }</b>
										<span>{ __( 'Leave no Blicks data in the database, form entries included.', 'blicks' ) }</span>
									</button>
								</div>
								{ settings.deleteDataOnUninstall && (
									<div className="losing" role="note">
										<b>{ __( 'Deleting Blicks will then permanently remove:', 'blicks' ) }</b>
										<ul>
											<li>{ __( 'Your design tokens and type styles', 'blicks' ) }</li>
											<li>{ sprintf( /* translators: %d: number of themes the user saved. */ _n( 'Saved themes (%d of your own)', 'Saved themes (%d of your own)', ownThemes, 'blicks' ), ownThemes ) }</li>
											<li>{ sprintf( /* translators: %d: number of custom animations. */ _n( 'Custom animations (%d)', 'Custom animations (%d)', customAnimations, 'blicks' ), customAnimations ) }</li>
											<li>{ __( 'Every form entry: what visitors sent through your forms', 'blicks' ) }</li>
											<li>{ __( 'These settings', 'blicks' ) }</li>
										</ul>
									</div>
								) }
							</>
						) }
					</div>
				</section>

				<section className="sp-sec" aria-labelledby="sp-built">
					<header><h2 id="sp-built">{ __( 'Built in', 'blicks' ) }</h2><p>{ __( 'How Blicks writes CSS. These aren’t switches; they’re how it works.', 'blicks' ) }</p></header>
					<div className="facts">
						<div className="fact">{ CHECK }<div><b>{ __( 'Classes first, small extras per block', 'blicks' ) }</b><span>{ __( 'Shared looks become reusable classes; only one-off values are written on the block itself.', 'blicks' ) } <code>class-first</code></span></div></div>
						<div className="fact">{ CHECK }<div><b>{ __( 'Shared block styles load once', 'blicks' ) }</b><span>{ __( 'One stylesheet on the front end, cached across every page.', 'blicks' ) }</span></div></div>
						<div className="fact">{ CHECK }<div><b>{ __( 'Respects reduced motion', 'blicks' ) }</b><span>{ __( 'Visitors who ask their device for less motion get still pages.', 'blicks' ) }</span></div></div>
					</div>
				</section>

				{ bootstrap().docsUrl && (
					<section className="sp-sec" aria-labelledby="sp-dev">
						<header><h2 id="sp-dev">{ __( 'For developers', 'blicks' ) }</h2><p>{ __( 'Reference for building with Blicks.', 'blicks' ) }</p></header>
						<div className="docs">
							<a className="doc" href={ docsLink( 'docs/README.md' ) } target="_blank" rel="noreferrer"><b>{ __( 'Block reference', 'blicks' ) } <span aria-hidden="true">↗</span></b><span>{ __( 'Attributes and controls for every block.', 'blicks' ) }</span><code>docs/README.md</code></a>
							<a className="doc" href={ docsLink( 'docs/architecture/design-system-fse.md' ) } target="_blank" rel="noreferrer"><b>{ __( 'Design tokens', 'blicks' ) } <span aria-hidden="true">↗</span></b><span>{ __( 'Tokens, text styles and the theme.json bridge.', 'blicks' ) }</span><code>--blicks-*</code></a>
							<a className="doc" href={ docsLink( 'docs/architecture/style-generation.md' ) } target="_blank" rel="noreferrer"><b>{ __( 'Style engine', 'blicks' ) } <span aria-hidden="true">↗</span></b><span>{ __( 'Class tiers and per-block CSS rules.', 'blicks' ) }</span><code>.bl-*</code></a>
						</div>
					</section>
				) }
			</div>
		</div>
	);
}
