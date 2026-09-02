import { __, _n, sprintf } from '@wordpress/i18n';
import { bootstrap } from '../bootstrap';
import { SettingRow, Select, Toggle } from './primitives';
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

export function SettingsPanel( {
	settings,
	isDirty,
	isSaving,
	dirtyCount,
	onChange,
	onReset,
	onSave,
}: {
	settings: AdminSettingsSnapshot;
	isDirty: boolean;
	isSaving: boolean;
	dirtyCount: number;
	onChange: ( settings: AdminSettingsSnapshot ) => void;
	onReset: () => void;
	onSave: () => Promise< void >;
} ): JSX.Element {
	return (
		<>
			<div className="ph">
				<div>
					<div className="eyebrow accent">{ __( 'Settings', 'blicks' ) }</div>
					<h1>{ __( 'Keep Blicks comfortable for authors.', 'blicks' ) }</h1>
					<div className="sub">{ __( 'Tune the editor experience while preserving clean output and theme-native behavior.', 'blicks' ) }</div>
				</div>
				<button className="lnk" type="button" disabled={ isSaving || ! isDirty } onClick={ onReset }>
					{ __( 'Reset to defaults', 'blicks' ) }
				</button>
			</div>

			<div className="cols">
				<div className="panel">
					<div className="p-head">
						<div>
							<h2>{ __( 'Editor experience', 'blicks' ) }</h2>
							<div className="sub">{ __( 'Controls for authors working in Gutenberg.', 'blicks' ) }</div>
						</div>
					</div>
					<div className="setlist">
						<SettingRow title={ __( 'Default inspector panel', 'blicks' ) } text={ __( 'Opens when a Blicks block is selected.', 'blicks' ) }>
							<Select
								label={ __( 'Default inspector panel', 'blicks' ) }
								value={ settings.defaultInspectorPanel }
								disabled={ isSaving }
								options={ [
									{ value: 'styles', label: __( 'Styles', 'blicks' ) },
									{ value: 'settings', label: __( 'Settings', 'blicks' ) },
									{ value: 'advanced', label: __( 'Advanced', 'blicks' ) },
								] }
								onChange={ value => onChange( { ...settings, defaultInspectorPanel: value as AdminSettingsSnapshot[ 'defaultInspectorPanel' ] } ) }
							/>
						</SettingRow>

						<SettingRow title={ __( 'Per-block help', 'blicks' ) } text={ __( 'Uses block readme metadata inside the inspector.', 'blicks' ) }>
							<Toggle
								checked={ settings.helpVisibility === 'show' }
								label={ __( 'Per-block help', 'blicks' ) }
								disabled={ isSaving }
								onChange={ checked => onChange( { ...settings, helpVisibility: checked ? 'show' : 'hide' } ) }
							/>
						</SettingRow>

						<SettingRow
							title={ __( 'On uninstall', 'blicks' ) }
							text={ __( 'Applies when the plugin is deleted, not deactivated. Deleting removes saved tokens, themes, animations, and settings.', 'blicks' ) }
						>
							<Select
								label={ __( 'On uninstall', 'blicks' ) }
								value={ settings.deleteDataOnUninstall ? 'delete' : 'keep' }
								disabled={ isSaving }
								options={ [
									{ value: 'keep', label: __( 'Keep my data', 'blicks' ) },
									{ value: 'delete', label: __( 'Remove everything', 'blicks' ) },
								] }
								onChange={ value => onChange( { ...settings, deleteDataOnUninstall: value === 'delete' } ) }
							/>
						</SettingRow>
					</div>
				</div>

				<div className="panel">
					<div className="p-head">
						<div>
							<h2>{ __( 'Output & performance', 'blicks' ) }</h2>
							<div className="sub">{ __( 'Production defaults for front-end CSS and rendering.', 'blicks' ) }</div>
						</div>
						<span className="badge">{ __( 'Recommended', 'blicks' ) }</span>
					</div>
					<div className="setlist">
						<SettingRow
							title={ __( 'Global Styles sync', 'blicks' ) }
							text={ settings.designSystem.themeJsonSupported
								? __( 'Writes newly saved design tokens to theme.json Global Styles.', 'blicks' )
								: __( 'Your active theme does not support theme.json Global Styles.', 'blicks' ) }
						>
							<Toggle
								checked={ settings.designSystem.themeJsonSync }
								label={ __( 'Global Styles sync', 'blicks' ) }
								disabled={ isSaving || ! settings.designSystem.themeJsonSupported }
								onChange={ checked => onChange( {
									...settings,
									designSystem: { ...settings.designSystem, themeJsonSync: checked },
								} ) }
							/>
						</SettingRow>

						{ /* The rows below report how the style engine is built, not preferences —
						     Blicks has no alternative strategy to switch to. They stay read-only
						     rather than pretending to be controls. */ }
						<SettingRow title={ __( 'CSS strategy', 'blicks' ) } text={ __( 'Class-first with instance variables.', 'blicks' ) }>
							<span className="badge">{ __( 'Class-first', 'blicks' ) }</span>
						</SettingRow>
						<SettingRow title={ __( 'Runtime CSS', 'blicks' ) } text={ __( 'Load shared block styles on the front end.', 'blicks' ) }>
							<span className="badge">{ __( 'On', 'blicks' ) }</span>
						</SettingRow>
						<SettingRow title={ __( 'Scoped custom CSS', 'blicks' ) } text={ __( 'Per-block advanced rules.', 'blicks' ) }>
							<span className="badge">{ __( 'Sanitized', 'blicks' ) }</span>
						</SettingRow>
						<SettingRow title={ __( 'Reduced motion', 'blicks' ) } text={ __( 'Respect visitor prefers-reduced-motion.', 'blicks' ) }>
							<span className="badge">{ __( 'On', 'blicks' ) }</span>
						</SettingRow>
					</div>
				</div>
			</div>

			<div className="dev">
				<div className="p-head">
					<div>
						<h2>{ __( 'Developer references', 'blicks' ) }</h2>
						<div className="sub">{ __( 'Implementation, schema, and block authoring.', 'blicks' ) }</div>
					</div>
				</div>
				<div className="dev-grid">
					<a className="dev-tile" href={ docsLink( 'docs/README.md' ) } target="_blank" rel="noreferrer">
						<span className="dt-ic" aria-hidden="true">&lt;/&gt;</span>
						<span className="dt-t">
							<b>{ __( 'Block reference', 'blicks' ) }</b>
							<small>{ __( 'Attributes and supported controls.', 'blicks' ) }</small>
							<span className="tag">{ __( 'Docs', 'blicks' ) }</span>
						</span>
					</a>
					<a className="dev-tile" href={ docsLink( 'docs/architecture/design-system-fse.md' ) } target="_blank" rel="noreferrer">
						<span className="dt-ic" aria-hidden="true">◐</span>
						<span className="dt-t">
							<b>{ __( 'Design system', 'blicks' ) }</b>
							<small>{ __( 'Tokens, type roles, and the theme.json bridge.', 'blicks' ) }</small>
							<span className="tag">{ __( 'Tokens', 'blicks' ) }</span>
						</span>
					</a>
					<a className="dev-tile" href={ docsLink( 'docs/architecture/style-generation.md' ) } target="_blank" rel="noreferrer">
						<span className="dt-ic" aria-hidden="true">{ '{ }' }</span>
						<span className="dt-t">
							<b>{ __( 'Style engine', 'blicks' ) }</b>
							<small>{ __( 'Class tiers and scoped CSS rules.', 'blicks' ) }</small>
							<span className="tag">{ __( 'CSS', 'blicks' ) }</span>
						</span>
					</a>
				</div>
			</div>

			<div className={ `savebar${ isDirty ? ' on' : '' }` }>
				<div className="in">
					<div className="msg">
						<span className="d" />
						<span>
							{ sprintf(
								/* translators: %d: number of changed settings. */
								_n( '%d setting changed', '%d settings changed', dirtyCount, 'blicks' ),
								dirtyCount
							) }
							{ ` · ${ __( 'unsaved', 'blicks' ) }` }
						</span>
					</div>
					<div className="sp" />
					<button className="btn" type="button" disabled={ isSaving } onClick={ onReset }>{ __( 'Discard', 'blicks' ) }</button>
					<button className="btn primary" type="button" disabled={ isSaving } onClick={ () => void onSave() }>
						{ isSaving ? __( 'Saving…', 'blicks' ) : __( 'Save settings', 'blicks' ) }
					</button>
				</div>
			</div>
		</>
	);
}
