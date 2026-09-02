/**
 * Blicks Theme Settings — editor-side global design-system editor.
 *
 * A pinned PluginSidebar backed by the same contract as the wp-admin Design System page
 * (`GET/PATCH blicks/v1/design-system` + `…/design-system/themes`), which remains the full
 * management surface. Drafts are local until Save; while dirty, the draft is live-previewed by
 * pinning `--blicks-*` vars (and, for native type roles, real element rules) in the editor
 * document + canvas iframe.
 *
 * The REST routes are `manage_options`-gated, so the sidebar only registers its UI after a
 * successful GET — non-admins never see the icon.
 *
 * Parity rule: the PATCH body is a **full replace** server-side (`Overrides::sanitize()` reads
 * every key off the payload and drops what is absent). Anything editable here therefore has to be
 * sent on every save — tokens *for every catalogue category*, breakpoints, and type roles — or the
 * omitted bag is wiped from the active theme.
 */
import apiFetch from '@wordpress/api-fetch';
import { ColorPicker, Popover } from '@wordpress/components';
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { registerPlugin } from '@wordpress/plugins';
import { PluginSidebar, PluginSidebarMoreMenuItem } from '@wordpress/editor';
import {
	TOKEN_CATEGORIES,
	buildPreviewVars,
	buildTypeRolePreview,
	countRecordChanges,
	countTokenChanges,
	countTypeRoleChanges,
	hex8ToCssValue,
	normalizeSnapshot,
	normalizeThemes,
	titleCase,
	tokenVar,
	type Breakpoint,
	type DesignSystemSnapshot,
	type ThemesState,
	type TokenCategory,
	type TokenOverrides,
	type TypeRoleOverrides,
} from '@/framework/design-system';
import './theme-settings.scss';

const SIDEBAR_NAME = 'blicks-theme-settings';
const API_PATH = '/blicks/v1/design-system';
const THEMES_PATH = '/blicks/v1/design-system/themes';
const PREVIEW_STYLE_ID = 'blicks-theme-draft-preview';

// Catalogue defaults for the editable breakpoints (snapshot maxes are effective,
// i.e. they already include saved overrides — same fallback the admin app uses).
const DEFAULT_BREAKPOINT_MAX: Record< string, number > = { tablet: 782, mobile: 600 };

const FONT_WEIGHTS = [ '100', '200', '300', '400', '500', '600', '700', '800', '900' ] as const;
const TEXT_TRANSFORMS = [ 'none', 'uppercase', 'lowercase', 'capitalize' ] as const;

/**
 * The panes, and which token categories each one owns. Every category in the shared catalogue
 * must appear exactly once — the union is what gets PATCHed back, and a category with no pane
 * would be invisible here yet still round-trip through the draft.
 */
type Pane = { id: string; label: string; categories: TokenCategory[]; note?: string };

const PANES: Pane[] = [
	{ id: 'themes', label: __( 'Themes', 'blicks' ), categories: [] },
	{
		id: 'color',
		label: __( 'Color', 'blicks' ),
		categories: [ 'color', 'gradient' ],
		note: __( 'Click a swatch to edit. Projected to --blicks-color-* and --blicks-gradient-*.', 'blicks' ),
	},
	{
		id: 'type',
		label: __( 'Typography', 'blicks' ),
		categories: [ 'fontFamily', 'fontSize', 'leading' ],
		note: __( 'Roles are complete looks; the scales below are the primitives they build on.', 'blicks' ),
	},
	{ id: 'spacing', label: __( 'Spacing', 'blicks' ), categories: [ 'spacing' ], note: __( 'Projected to --blicks-spacing-*.', 'blicks' ) },
	{
		id: 'border',
		label: __( 'Border', 'blicks' ),
		categories: [ 'radius', 'borderWidth', 'borderStyle', 'ring' ],
		note: __( 'Corner radii, border widths and styles, plus the focus-ring presets.', 'blicks' ),
	},
	{
		id: 'effects',
		label: __( 'Effects', 'blicks' ),
		categories: [ 'shadow', 'transition', 'transform', 'filter', 'opacity', 'zIndex' ],
		note: __( 'Shadows, motion and the opacity/stacking scales — what the Effects libraries read.', 'blicks' ),
	},
	{
		id: 'layout',
		label: __( 'Layout', 'blicks' ),
		categories: [ 'width', 'aspect', 'content' ],
		note: __( 'Content widths and aspect ratios. “Content size” is the theme.json layout width.', 'blicks' ),
	},
	{ id: 'button', label: __( 'Button', 'blicks' ), categories: [ 'button' ], note: __( 'Shared button metrics — every Button variant reads these.', 'blicks' ) },
	{ id: 'bp', label: __( 'Breakpoints', 'blicks' ), categories: [], note: __( 'Used by responsive controls and runtime CSS.', 'blicks' ) },
];

// Categories the panes above cover, so an unmapped one can be surfaced rather than silently lost.
const MAPPED_CATEGORIES = new Set< string >( PANES.flatMap( pane => pane.categories ) );

/** Subheading per category, for the panes that stack several. */
const CATEGORY_LABELS: Partial< Record< TokenCategory, string > > = {
	gradient: __( 'Gradients', 'blicks' ),
	fontFamily: __( 'Font families', 'blicks' ),
	fontSize: __( 'Font sizes', 'blicks' ),
	leading: __( 'Line height', 'blicks' ),
	radius: __( 'Radius', 'blicks' ),
	borderWidth: __( 'Border width', 'blicks' ),
	borderStyle: __( 'Border style', 'blicks' ),
	ring: __( 'Focus ring', 'blicks' ),
	shadow: __( 'Shadow', 'blicks' ),
	transition: __( 'Transition', 'blicks' ),
	transform: __( 'Transform', 'blicks' ),
	filter: __( 'Filter', 'blicks' ),
	width: __( 'Widths', 'blicks' ),
	aspect: __( 'Aspect ratios', 'blicks' ),
	content: __( 'Content size', 'blicks' ),
	opacity: __( 'Opacity', 'blicks' ),
	zIndex: __( 'Z-index', 'blicks' ),
};

const TYPE_ROLE_LABELS: Record< string, string > = {
	display: __( 'Display', 'blicks' ),
	h1: __( 'Heading 1', 'blicks' ),
	h2: __( 'Heading 2', 'blicks' ),
	h3: __( 'Heading 3', 'blicks' ),
	h4: __( 'Heading 4', 'blicks' ),
	h5: __( 'Heading 5', 'blicks' ),
	h6: __( 'Heading 6', 'blicks' ),
	body: __( 'Body', 'blicks' ),
	lead: __( 'Lead', 'blicks' ),
	small: __( 'Small', 'blicks' ),
	caption: __( 'Caption', 'blicks' ),
	code: __( 'Code', 'blicks' ),
	mono: __( 'Eyebrow / mono', 'blicks' ),
};

const TYPE_ROLE_PROP_LABELS: Record< string, string > = {
	fontSize: __( 'Size', 'blicks' ),
	fontWeight: __( 'Weight', 'blicks' ),
	lineHeight: __( 'Leading', 'blicks' ),
	letterSpacing: __( 'Tracking', 'blicks' ),
	fontFamily: __( 'Family', 'blicks' ),
	textTransform: __( 'Transform', 'blicks' ),
};

const SIDEBAR_ICON = (
	<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
		<circle cx="13.5" cy="6.5" r="2.5" />
		<circle cx="19" cy="13" r="2" />
		<circle cx="6" cy="12" r="3" />
		<path d="M14 19.5a7.5 7.5 0 0 0 5.5-12.6" />
		<path d="M4.6 16.4A7.5 7.5 0 0 0 16 20.3" />
	</svg>
);

const RESET_ICON = (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
		<path d="M3 12a9 9 0 1 0 3-6.7" />
		<path d="M3 4v6h6" />
	</svg>
);

const CHEVRON_ICON = (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
		<path d="m6 9 6 6 6-6" />
	</svg>
);

/** Every document the editor renders into: the admin page plus the (iframed) canvas. */
function previewDocuments(): Document[] {
	const documents: Document[] = [ document ];

	document.querySelectorAll< HTMLIFrameElement >( 'iframe[name="editor-canvas"]' ).forEach( frame => {
		if ( frame.contentDocument ) {
			documents.push( frame.contentDocument );
		}
	} );

	return documents;
}

/** Pin draft CSS in every document the editor renders into. */
function applyPreview( css: string ): void {
	for ( const doc of previewDocuments() ) {
		let style = doc.getElementById( PREVIEW_STYLE_ID );

		if ( css === '' ) {
			style?.remove();
			continue;
		}

		if ( ! style ) {
			style = doc.createElement( 'style' );
			style.id = PREVIEW_STYLE_ID;
			doc.head?.appendChild( style );
		}

		style.textContent = css;
	}
}

function cloneTokenOverrides( tokens: TokenOverrides ): TokenOverrides {
	const next: TokenOverrides = {};
	for ( const [ category, values ] of Object.entries( tokens ) ) {
		next[ category as TokenCategory ] = { ...values };
	}
	return next;
}

function cloneTypeRoles( roles: TypeRoleOverrides ): TypeRoleOverrides {
	const next: TypeRoleOverrides = {};
	for ( const [ role, props ] of Object.entries( roles ) ) {
		next[ role ] = { ...props };
	}
	return next;
}

function ThemeSettings(): JSX.Element | null {
	const [ snapshot, setSnapshot ] = useState< DesignSystemSnapshot | null >( null );
	const [ themes, setThemes ] = useState< ThemesState >( { active: '', themes: [] } );

	useEffect( () => {
		let alive = true;

		apiFetch( { path: API_PATH } )
			.then( ( data: unknown ) => {
				if ( ! alive ) return;
				setSnapshot( normalizeSnapshot( data ) );

				// Only worth asking once the snapshot proves we're an admin.
				return apiFetch( { path: THEMES_PATH } ).then( ( list: unknown ) => {
					if ( alive ) setThemes( normalizeThemes( list ) );
				} );
			} )
			.catch( () => {
				// 401/403 (not an admin) or transport failure — keep the sidebar unregistered.
			} );

		return () => {
			alive = false;
		};
	}, [] );

	// Older editors without the unified slot, or no permission/snapshot yet.
	if ( ! PluginSidebar || ! snapshot ) {
		return null;
	}

	return (
		<>
			{ PluginSidebarMoreMenuItem && (
				<PluginSidebarMoreMenuItem target={ SIDEBAR_NAME } icon={ SIDEBAR_ICON }>
					{ __( 'Theme Settings', 'blicks' ) }
				</PluginSidebarMoreMenuItem>
			) }
			<PluginSidebar
				name={ SIDEBAR_NAME }
				title={ __( 'Theme Settings', 'blicks' ) }
				icon={ SIDEBAR_ICON }
				className="bl-theme-settings"
			>
				<ThemeSettingsPanel snapshot={ snapshot } onSnapshot={ setSnapshot } themes={ themes } onThemes={ setThemes } />
			</PluginSidebar>
		</>
	);
}

function ThemeSettingsPanel( {
	snapshot,
	onSnapshot,
	themes,
	onThemes,
}: {
	snapshot: DesignSystemSnapshot;
	onSnapshot: ( snapshot: DesignSystemSnapshot ) => void;
	themes: ThemesState;
	onThemes: ( themes: ThemesState ) => void;
} ): JSX.Element {
	const [ pane, setPane ] = useState< string >( 'color' );
	const [ tokenDraft, setTokenDraft ] = useState< TokenOverrides >( () => cloneTokenOverrides( snapshot.overrides.tokens ) );
	const [ breakpointDraft, setBreakpointDraft ] = useState< Record< string, number > >( () => ( { ...snapshot.overrides.breakpoints } ) );
	const [ typeRoleDraft, setTypeRoleDraft ] = useState< TypeRoleOverrides >( () => cloneTypeRoles( snapshot.overrides.typeRoles ) );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ notice, setNotice ] = useState( '' );

	// Re-sync drafts whenever a fresh snapshot lands (initial load, after save, after theme apply).
	useEffect( () => {
		setTokenDraft( cloneTokenOverrides( snapshot.overrides.tokens ) );
		setBreakpointDraft( { ...snapshot.overrides.breakpoints } );
		setTypeRoleDraft( cloneTypeRoles( snapshot.overrides.typeRoles ) );
	}, [ snapshot ] );

	const tokenChanges = countTokenChanges( tokenDraft, snapshot.overrides.tokens );
	const breakpointChanges = countRecordChanges( breakpointDraft, snapshot.overrides.breakpoints );
	const roleChanges = countTypeRoleChanges( typeRoleDraft, snapshot.overrides.typeRoles );
	const totalChanges = tokenChanges + breakpointChanges + roleChanges;
	const isDirty = totalChanges > 0;

	// Every slug/role-prop overridden at any point this session (draft or saved). The preview pins
	// all of them — draft value when set, base value otherwise — because the PHP-rendered :root
	// vars are frozen at page load: without the pin, a save (or a saved-override reset) would
	// visually revert until a reload.
	const touchedTokensRef = useRef< TokenOverrides >( {} );
	const touchedRolesRef = useRef< TypeRoleOverrides >( {} );

	const previewCss = useMemo( () => {
		const touchedTokens = touchedTokensRef.current;
		for ( const source of [ snapshot.overrides.tokens, tokenDraft ] ) {
			for ( const [ category, values ] of Object.entries( source ) ) {
				touchedTokens[ category as TokenCategory ] = { ...( touchedTokens[ category as TokenCategory ] ?? {} ), ...values };
			}
		}

		const touchedRoles = touchedRolesRef.current;
		for ( const source of [ snapshot.overrides.typeRoles, typeRoleDraft ] ) {
			for ( const [ role, props ] of Object.entries( source ) ) {
				touchedRoles[ role ] = { ...( touchedRoles[ role ] ?? {} ), ...props };
			}
		}

		return [
			buildPreviewVars( tokenDraft, touchedTokens, snapshot.baseValues ),
			buildTypeRolePreview( typeRoleDraft, touchedRoles, snapshot.typeRoles.base, snapshot.typeRoles.slots ),
		].filter( Boolean ).join( '\n' );
	}, [ tokenDraft, typeRoleDraft, snapshot ] );

	useEffect( () => {
		applyPreview( previewCss );
	}, [ previewCss ] );

	// The canvas iframe remounts on its own (device preview, template switch, editor reboot), which
	// throws the pinned <style> away. Re-apply whenever a canvas turns up without one.
	const previewCssRef = useRef( previewCss );
	previewCssRef.current = previewCss;

	useEffect( () => {
		const observer = new MutationObserver( () => {
			if ( previewCssRef.current === '' ) return;

			const missing = previewDocuments().some( doc => ! doc.getElementById( PREVIEW_STYLE_ID ) );
			if ( missing ) {
				applyPreview( previewCssRef.current );
			}
		} );

		observer.observe( document.body, { childList: true, subtree: true } );

		return () => observer.disconnect();
	}, [] );

	// Drop any lingering draft preview when the sidebar unmounts.
	useEffect( () => () => applyPreview( '' ), [] );

	function baseValue( category: TokenCategory, slug: string ): string {
		return snapshot.baseValues[ category ]?.[ slug ] ?? snapshot.values[ category ]?.[ slug ] ?? '';
	}

	function draftValue( category: TokenCategory, slug: string ): string {
		return tokenDraft[ category ]?.[ slug ] ?? baseValue( category, slug );
	}

	function isOverridden( category: TokenCategory, slug: string ): boolean {
		return Object.prototype.hasOwnProperty.call( tokenDraft[ category ] ?? {}, slug );
	}

	function updateToken( category: TokenCategory, slug: string, raw: string ): void {
		setTokenDraft( current => {
			const values = { ...( current[ category ] ?? {} ) };
			const trimmed = raw.trim();

			if ( trimmed === '' || trimmed === baseValue( category, slug ) ) {
				delete values[ slug ];
			} else {
				values[ slug ] = raw;
			}

			const next = { ...current };
			if ( Object.keys( values ).length > 0 ) {
				next[ category ] = values;
			} else {
				delete next[ category ];
			}

			return next;
		} );
		setNotice( '' );
	}

	function resetToken( category: TokenCategory, slug: string ): void {
		updateToken( category, slug, '' );
	}

	function roleBaseValue( role: string, prop: string ): string {
		return snapshot.typeRoles.base[ role ]?.[ prop ] ?? snapshot.typeRoles.values[ role ]?.[ prop ] ?? '';
	}

	function roleDraftValue( role: string, prop: string ): string {
		return typeRoleDraft[ role ]?.[ prop ] ?? roleBaseValue( role, prop );
	}

	function isRoleOverridden( role: string, prop: string ): boolean {
		return Object.prototype.hasOwnProperty.call( typeRoleDraft[ role ] ?? {}, prop );
	}

	function updateRole( role: string, prop: string, raw: string ): void {
		setTypeRoleDraft( current => {
			const props = { ...( current[ role ] ?? {} ) };
			const trimmed = raw.trim();

			if ( trimmed === '' || trimmed === roleBaseValue( role, prop ) ) {
				delete props[ prop ];
			} else {
				props[ prop ] = raw;
			}

			const next = { ...current };
			if ( Object.keys( props ).length > 0 ) {
				next[ role ] = props;
			} else {
				delete next[ role ];
			}

			return next;
		} );
		setNotice( '' );
	}

	function updateBreakpoint( breakpoint: Breakpoint, raw: string ): void {
		if ( breakpoint.max === null ) return;

		setBreakpointDraft( current => {
			const next = { ...current };
			const parsed = Number.parseInt( raw, 10 );
			const base = DEFAULT_BREAKPOINT_MAX[ breakpoint.id ] ?? breakpoint.max;

			if ( raw.trim() === '' || Number.isNaN( parsed ) || parsed === base ) {
				delete next[ breakpoint.id ];
			} else if ( parsed >= 320 && parsed <= 2400 ) {
				next[ breakpoint.id ] = parsed;
			}

			return next;
		} );
		setNotice( '' );
	}

	function discard(): void {
		setTokenDraft( cloneTokenOverrides( snapshot.overrides.tokens ) );
		setBreakpointDraft( { ...snapshot.overrides.breakpoints } );
		setTypeRoleDraft( cloneTypeRoles( snapshot.overrides.typeRoles ) );
		setNotice( __( 'Draft changes discarded.', 'blicks' ) );
	}

	/** Drop a pane's draft edits back to the saved values, without touching the server. */
	function resetPane( target: Pane ): void {
		if ( target.id === 'bp' ) {
			setBreakpointDraft( { ...snapshot.overrides.breakpoints } );
		}

		if ( target.id === 'type' ) {
			setTypeRoleDraft( cloneTypeRoles( snapshot.overrides.typeRoles ) );
		}

		if ( target.categories.length > 0 ) {
			setTokenDraft( current => {
				const next = { ...current };
				for ( const category of target.categories ) {
					const saved = snapshot.overrides.tokens[ category ];
					if ( saved && Object.keys( saved ).length > 0 ) {
						next[ category ] = { ...saved };
					} else {
						delete next[ category ];
					}
				}
				return next;
			} );
		}

		setNotice( sprintf(
			/* translators: %s: pane name, e.g. "Color". */
			__( '%s draft reverted to the saved values.', 'blicks' ),
			target.label
		) );
	}

	function adopt( data: unknown ): boolean {
		const next = normalizeSnapshot( data );
		if ( ! next ) return false;

		onSnapshot( next );
		return true;
	}

	async function refreshThemes(): Promise< void > {
		try {
			onThemes( normalizeThemes( await apiFetch( { path: THEMES_PATH } ) ) );
		} catch {
			// The list is a convenience — a stale one is better than a broken save flow.
		}
	}

	async function save(): Promise< void > {
		if ( ! isDirty || isSaving ) return;

		setIsSaving( true );
		setNotice( '' );

		// Slugs the user typed that the catalogue doesn't know must be registered alongside the
		// values, or they fail sanitisation server-side and silently vanish on save.
		const customSlugs: Record< string, string[] > = {};
		for ( const [ category, values ] of Object.entries( tokenDraft ) ) {
			const known = new Set< string >( snapshot.tokens[ category as TokenCategory ] ?? [] );
			const extra = Object.keys( values ).filter( slug => ! known.has( slug ) );
			if ( extra.length > 0 ) {
				customSlugs[ category ] = extra;
			}
		}

		try {
			const data = await apiFetch( {
				path: API_PATH,
				method: 'PATCH',
				data: {
					tokens: tokenDraft,
					breakpoints: breakpointDraft,
					typeRoles: typeRoleDraft,
					customSlugs,
				},
			} );

			if ( adopt( data ) ) {
				const activeName = themes.themes.find( theme => theme.id === themes.active )?.name;
				setNotice( activeName
					? sprintf(
						/* translators: %s: design theme name. */
						__( 'Saved to %s.', 'blicks' ),
						activeName
					)
					: __( 'Theme tokens saved.', 'blicks' ) );
				// Saving can flip the active theme's "edited" flag — refresh so the marker stays true.
				void refreshThemes();
			} else {
				setNotice( __( 'Could not save theme tokens.', 'blicks' ) );
			}
		} catch ( error ) {
			setNotice( error instanceof Error && error.message ? error.message : __( 'Could not save theme tokens.', 'blicks' ) );
		} finally {
			setIsSaving( false );
		}
	}

	async function runThemeAction( path: string, method: 'POST' | 'DELETE', successMessage: string, data?: object ): Promise< void > {
		if ( isSaving ) return;

		setIsSaving( true );
		setNotice( '' );

		try {
			const result = await apiFetch( { path, method, ...( data ? { data } : {} ) } );

			// `apply` and `reset` answer with a full snapshot (+ the refreshed list); `create` and
			// `delete` answer with the list alone.
			if ( result && typeof result === 'object' && 'themes' in result ) {
				adopt( result );
				onThemes( normalizeThemes( ( result as { themes: unknown } ).themes ) );
			} else {
				onThemes( normalizeThemes( result ) );
			}

			setNotice( successMessage );
		} catch ( error ) {
			setNotice( error instanceof Error && error.message ? error.message : __( 'Could not update themes.', 'blicks' ) );
		} finally {
			setIsSaving( false );
		}
	}

	function paneDirty( target: Pane ): boolean {
		if ( target.id === 'bp' ) return breakpointChanges > 0;

		const tokensDirty = target.categories.some(
			category => countRecordChanges( tokenDraft[ category ] ?? {}, snapshot.overrides.tokens[ category ] ?? {} ) > 0
		);

		return target.id === 'type' ? tokensDirty || roleChanges > 0 : tokensDirty;
	}

	/** Roving-tabindex arrow navigation, so the tablist behaves like one for keyboard users. */
	function moveTabFocus( event: React.KeyboardEvent< HTMLDivElement >, list: Pane[] ): void {
		const step = event.key === 'ArrowRight' || event.key === 'ArrowDown'
			? 1
			: event.key === 'ArrowLeft' || event.key === 'ArrowUp'
				? -1
				: event.key === 'Home'
					? -list.length
					: event.key === 'End'
						? list.length
						: 0;

		if ( step === 0 ) return;

		event.preventDefault();

		const from = list.findIndex( item => item.id === pane );
		const index = Math.min( list.length - 1, Math.max( 0, ( from < 0 ? 0 : from ) + step ) );
		const next = list[ index ];

		setPane( next.id );
		event.currentTarget.querySelector< HTMLButtonElement >( `#bl-ts-tab-${ next.id }` )?.focus();
	}

	// A category the PANES table forgot would still round-trip through the draft but be invisible;
	// park it in its own pane rather than let it go unnoticed.
	const orphanCategories = TOKEN_CATEGORIES.filter( category => ! MAPPED_CATEGORIES.has( category ) );
	const panes: Pane[] = orphanCategories.length > 0
		? [ ...PANES, { id: 'other', label: __( 'Other', 'blicks' ), categories: orphanCategories } ]
		: PANES;

	const activePane = panes.find( item => item.id === pane ) ?? panes[ 0 ];

	const valueRows = ( category: TokenCategory ): JSX.Element[] =>
		snapshot.tokens[ category ].map( slug => (
			<ValueRow
				key={ `${ category }-${ slug }` }
				label={ titleCase( slug ) }
				detail={ tokenVar( category, slug ) }
				value={ draftValue( category, slug ) }
				placeholder={ baseValue( category, slug ) }
				isOverride={ isOverridden( category, slug ) }
				disabled={ isSaving }
				onChange={ value => updateToken( category, slug, value ) }
				onReset={ () => resetToken( category, slug ) }
			/>
		) );

	/** A category rendered with its subheading — colors as swatches, everything else as values. */
	const categoryBlock = ( category: TokenCategory, withHeading: boolean ): JSX.Element => (
		<div key={ category }>
			{ withHeading && <p className="bl-ts-subhead">{ CATEGORY_LABELS[ category ] ?? titleCase( category ) }</p> }
			{ category === 'color'
				? snapshot.tokens.color.map( slug => (
					<ColorRow
						key={ slug }
						slug={ slug }
						value={ draftValue( 'color', slug ) }
						isOverride={ isOverridden( 'color', slug ) }
						disabled={ isSaving }
						onChange={ value => updateToken( 'color', slug, value ) }
						onReset={ () => resetToken( 'color', slug ) }
					/>
				) )
				: valueRows( category ) }
		</div>
	);

	// Short in the strip, full in the tooltip: the row also carries the Design System link and the
	// sidebar is 280px wide, so the long form ellipsised away to "theme.json · sync …".
	const [ sourceLabel, sourceTitle ] = snapshot.source.globalStyles
		? [ __( 'Synced', 'blicks' ), __( 'Synced with theme.json', 'blicks' ) ]
		: snapshot.source.themeJson
			? [ __( 'Sync off', 'blicks' ), __( 'theme.json theme · Global Styles sync off', 'blicks' ) ]
			: [ __( 'Defaults', 'blicks' ), __( 'Using theme defaults', 'blicks' ) ];

	return (
		<div className="bl-ts">
			<div className="bl-ts-source">
				<span className="bl-ts-dot" />
				<span className="bl-ts-source-label" title={ sourceTitle }>{ sourceLabel }</span>
				<a href="admin.php?page=blicks-design" target="_blank" rel="noreferrer">
					{ __( 'Design System ↗', 'blicks' ) }
				</a>
			</div>

			<div
				className="bl-ts-cats"
				role="tablist"
				aria-label={ __( 'Token categories', 'blicks' ) }
				onKeyDown={ event => moveTabFocus( event, panes ) }
			>
				{ panes.map( item => {
					const isActive = pane === item.id;
					const dirty = paneDirty( item );

					return (
						<button
							key={ item.id }
							id={ `bl-ts-tab-${ item.id }` }
							type="button"
							role="tab"
							aria-selected={ isActive }
							aria-controls={ `bl-ts-panel-${ item.id }` }
							tabIndex={ isActive ? 0 : -1 }
							className={ `bl-ts-cat${ isActive ? ' is-active' : '' }` }
							onClick={ () => setPane( item.id ) }
						>
							{ item.label }
							{ dirty && (
								<>
									<span className="bl-ts-cat-badge" aria-hidden="true" />
									<span className="bl-ts-sr">{ __( '(unsaved changes)', 'blicks' ) }</span>
								</>
							) }
						</button>
					);
				} ) }
			</div>

			<div
				className="bl-ts-body"
				id={ `bl-ts-panel-${ activePane.id }` }
				role="tabpanel"
				aria-labelledby={ `bl-ts-tab-${ activePane.id }` }
				tabIndex={ 0 }
			>
				{ activePane.note && <p className="bl-ts-note">{ activePane.note }</p> }

				{ activePane.id === 'themes' && (
					<ThemesPane
						themes={ themes }
						disabled={ isSaving }
						onApply={ theme => void runThemeAction(
							`${ THEMES_PATH }/${ theme.id }/apply`,
							'POST',
							sprintf(
								/* translators: %s: design theme name. */
								__( '%s applied.', 'blicks' ),
								theme.name
							)
						) }
						onResetTheme={ theme => void runThemeAction(
							`${ THEMES_PATH }/${ theme.id }/reset`,
							'POST',
							sprintf(
								/* translators: %s: design theme name. */
								__( '%s reset to its preset values.', 'blicks' ),
								theme.name
							)
						) }
						onDelete={ theme => void runThemeAction(
							`${ THEMES_PATH }/${ theme.id }`,
							'DELETE',
							sprintf(
								/* translators: %s: design theme name. */
								__( '%s deleted.', 'blicks' ),
								theme.name
							)
						) }
						onCreate={ name => void runThemeAction(
							THEMES_PATH,
							'POST',
							__( 'Theme saved from the current token values.', 'blicks' ),
							{
								name,
								tokens: snapshot.overrides.tokens,
								breakpoints: snapshot.overrides.breakpoints,
								typeRoles: snapshot.overrides.typeRoles,
							}
						) }
					/>
				) }

				{ activePane.id === 'type' && (
					<>
						<p className="bl-ts-subhead">{ __( 'Type roles', 'blicks' ) }</p>
						{ snapshot.typeRoles.roles.map( role => (
							<RoleRow
								key={ role }
								role={ role }
								label={ TYPE_ROLE_LABELS[ role ] ?? titleCase( role ) }
								kind={ snapshot.typeRoles.slots[ role ]?.kind ?? 'custom' }
								props={ snapshot.typeRoles.props }
								fontLibrary={ snapshot.fontLibrary }
								disabled={ isSaving }
								isOverridden={ prop => isRoleOverridden( role, prop ) }
								valueOf={ prop => roleDraftValue( role, prop ) }
								baseOf={ prop => roleBaseValue( role, prop ) }
								onChange={ ( prop, value ) => updateRole( role, prop, value ) }
							/>
						) ) }
						{ activePane.categories.map( category => categoryBlock( category, true ) ) }
					</>
				) }

				{ activePane.id === 'bp' && snapshot.breakpoints.map( breakpoint => {
					const isOverride = Object.prototype.hasOwnProperty.call( breakpointDraft, breakpoint.id );
					const value = breakpointDraft[ breakpoint.id ] ?? DEFAULT_BREAKPOINT_MAX[ breakpoint.id ] ?? breakpoint.max;

					return (
						<div className={ `bl-ts-field${ isOverride ? ' is-override' : '' }` } key={ breakpoint.id }>
							<div className="bl-ts-main">
								<strong>{ breakpoint.label }</strong>
								<span>{ breakpoint.max === null ? __( 'base — no media query', 'blicks' ) : 'max-width' }</span>
							</div>
							{ breakpoint.max === null
								? <span className="bl-ts-badge is-quiet">{ __( 'base', 'blicks' ) }</span>
								: isOverride && <span className="bl-ts-sr">{ __( 'Overrides the theme value', 'blicks' ) }</span> }
							{ breakpoint.max !== null && (
								<>
									<span className="bl-ts-input">
										<input
											type="number"
											min={ 320 }
											max={ 2400 }
											step={ 1 }
											value={ value ?? '' }
											disabled={ isSaving }
											aria-label={ sprintf(
												/* translators: %s: breakpoint label. */
												__( '%s breakpoint max width', 'blicks' ),
												breakpoint.label
											) }
											onChange={ event => updateBreakpoint( breakpoint, event.currentTarget.value ) }
										/>
										<span>px</span>
									</span>
									<button
										type="button"
										className="bl-ts-reset"
										title={ __( 'Reset breakpoint', 'blicks' ) }
										disabled={ isSaving || ! isOverride }
										onClick={ () => updateBreakpoint( breakpoint, '' ) }
									>
										{ RESET_ICON }
									</button>
								</>
							) }
						</div>
					);
				} ) }

				{ activePane.id !== 'themes' && activePane.id !== 'type' && activePane.id !== 'bp'
					&& activePane.categories.map( category => categoryBlock( category, activePane.categories.length > 1 ) ) }

				{ activePane.id !== 'themes' && paneDirty( activePane ) && (
					<div className="bl-ts-panefoot">
						<button type="button" className="bl-ts-discard" disabled={ isSaving } onClick={ () => resetPane( activePane ) }>
							{ sprintf(
								/* translators: %s: pane name, e.g. "Color". */
								__( 'Revert %s', 'blicks' ),
								activePane.label
							) }
						</button>
					</div>
				) }
			</div>

			{ notice && <div className="bl-ts-notice" role="status">{ notice }</div> }

			{ /* Clean state collapses to a single status line — the buttons would be inert anyway, and
			     the sidebar is 280px wide: every row of chrome is a row of tokens the user can't see. */ }
			<div className={ `bl-ts-savebar${ isDirty ? ' is-dirty' : '' }` }>
				<div className="bl-ts-savemeta">
					{ isDirty ? (
						<>
							<span className="bl-ts-dot is-warn" />
							{ sprintf(
								/* translators: %d: number of unsaved token changes. */
								_n( '%d unsaved change · preview only', '%d unsaved changes · preview only', totalChanges, 'blicks' ),
								totalChanges
							) }
						</>
					) : (
						<>
							<span className="bl-ts-dot" />
							{ __( 'Saved · applies site-wide', 'blicks' ) }
						</>
					) }
				</div>
				{ isDirty && (
					<div className="bl-ts-actions">
						<button type="button" className="bl-ts-discard" disabled={ isSaving } onClick={ discard }>
							{ __( 'Discard', 'blicks' ) }
						</button>
						<button type="button" className="bl-ts-save" disabled={ isSaving } onClick={ () => void save() }>
							{ isSaving ? __( 'Saving…', 'blicks' ) : __( 'Save tokens', 'blicks' ) }
						</button>
					</div>
				) }
			</div>
		</div>
	);
}

/**
 * Saved design themes: apply one to repaint the whole token set, snapshot the current values into
 * a new one, or reset/delete an existing one. Applying writes through the same save path as a
 * token edit, so the answer is a fresh snapshot and the drafts re-sync from it.
 */
function ThemesPane( {
	themes,
	disabled,
	onApply,
	onResetTheme,
	onDelete,
	onCreate,
}: {
	themes: ThemesState;
	disabled: boolean;
	onApply: ( theme: ThemesState[ 'themes' ][ number ] ) => void;
	onResetTheme: ( theme: ThemesState[ 'themes' ][ number ] ) => void;
	onDelete: ( theme: ThemesState[ 'themes' ][ number ] ) => void;
	onCreate: ( name: string ) => void;
} ): JSX.Element {
	const [ name, setName ] = useState( '' );

	return (
		<>
			<p className="bl-ts-note">
				{ __( 'Named token presets. Applying one replaces the current values site-wide — it saves immediately.', 'blicks' ) }
			</p>

			{ themes.themes.length === 0 && (
				<p className="bl-ts-empty">{ __( 'No saved themes yet. Save the current values below to make one.', 'blicks' ) }</p>
			) }

			{ themes.themes.map( theme => {
				const isActive = theme.id === themes.active;
				const swatches = [ 'primary', 'secondary', 'accent', 'background' ]
					.map( slug => theme.tokens.tokens.color?.[ slug ] )
					.filter( ( value ): value is string => typeof value === 'string' && value !== '' );

				return (
					<div className={ `bl-ts-theme${ isActive ? ' is-active' : '' }` } key={ theme.id }>
						<button
							type="button"
							className="bl-ts-theme-pick"
							disabled={ disabled || isActive }
							onClick={ () => onApply( theme ) }
						>
							<span className="bl-ts-theme-swatches" aria-hidden="true">
								{ swatches.length > 0
									? swatches.map( ( color, index ) => <i key={ index } style={ { background: color } } /> )
									: <i className="is-empty" /> }
							</span>
							<span className="bl-ts-theme-name">
								{ theme.name }
								{ theme.edited && <em title={ __( 'Customized since its preset', 'blicks' ) }>•</em> }
							</span>
							<span className="bl-ts-badge">{ isActive ? __( 'active', 'blicks' ) : theme.builtin ? __( 'built-in', 'blicks' ) : __( 'custom', 'blicks' ) }</span>
						</button>
						{ theme.builtin ? (
							<button
								type="button"
								className="bl-ts-reset"
								title={ __( 'Reset to its preset values', 'blicks' ) }
								disabled={ disabled || ! theme.edited }
								onClick={ () => onResetTheme( theme ) }
							>
								{ RESET_ICON }
							</button>
						) : (
							<button
								type="button"
								className="bl-ts-reset"
								title={ __( 'Delete theme', 'blicks' ) }
								disabled={ disabled }
								onClick={ () => onDelete( theme ) }
							>
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
									<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
								</svg>
							</button>
						) }
					</div>
				);
			} ) }

			<div className="bl-ts-newtheme">
				<label htmlFor="bl-ts-theme-name">{ __( 'Save current values as', 'blicks' ) }</label>
				<div>
					<span className="bl-ts-input is-wide">
						<input
							id="bl-ts-theme-name"
							type="text"
							value={ name }
							placeholder={ __( 'Theme name', 'blicks' ) }
							disabled={ disabled }
							onChange={ event => setName( event.currentTarget.value ) }
						/>
					</span>
					<button
						type="button"
						className="bl-ts-save"
						disabled={ disabled || name.trim() === '' }
						onClick={ () => {
							onCreate( name.trim() );
							setName( '' );
						} }
					>
						{ __( 'Save', 'blicks' ) }
					</button>
				</div>
			</div>
		</>
	);
}

/**
 * One semantic type role — a whole typographic look (size/weight/leading/tracking/family/case)
 * rather than a scalar token. Collapsed it shows a live specimen rendered from the draft values;
 * expanded it edits every prop the snapshot declares.
 */
function RoleRow( {
	role,
	label,
	kind,
	props,
	fontLibrary,
	disabled,
	isOverridden,
	valueOf,
	baseOf,
	onChange,
}: {
	role: string;
	label: string;
	kind: 'native' | 'custom';
	props: string[];
	fontLibrary: DesignSystemSnapshot[ 'fontLibrary' ];
	disabled: boolean;
	isOverridden: ( prop: string ) => boolean;
	valueOf: ( prop: string ) => string;
	baseOf: ( prop: string ) => string;
	onChange: ( prop: string, value: string ) => void;
} ): JSX.Element {
	const [ isOpen, setIsOpen ] = useState( false );
	const isOverride = props.some( isOverridden );

	const specimen: React.CSSProperties = {
		fontFamily: valueOf( 'fontFamily' ) || undefined,
		fontWeight: valueOf( 'fontWeight' ) || undefined,
		letterSpacing: valueOf( 'letterSpacing' ) || undefined,
		textTransform: ( valueOf( 'textTransform' ) || undefined ) as React.CSSProperties[ 'textTransform' ],
	};

	return (
		<div className={ `bl-ts-role${ isOpen ? ' is-open' : '' }${ isOverride ? ' is-override' : '' }` }>
			<button
				type="button"
				className="bl-ts-role-head"
				aria-expanded={ isOpen }
				onClick={ () => setIsOpen( open => ! open ) }
			>
				<span className="bl-ts-role-chevron" aria-hidden="true">{ CHEVRON_ICON }</span>
				<span className="bl-ts-role-main">
					<strong>{ label }</strong>
					{ /* The specimen deliberately skips font-size — a Display role at 3.5rem would
					     blow out a 280px sidebar. Size is shown as a value on the row instead. */ }
					<span className="bl-ts-role-specimen" style={ specimen }>Ag</span>
				</span>
				<span className="bl-ts-role-size" title={ valueOf( 'fontSize' ) }>{ shortValue( valueOf( 'fontSize' ) ) }</span>
				{ isOverride
					? <span className="bl-ts-sr">{ __( 'Overrides the theme value', 'blicks' ) }</span>
					: kind === 'native' && <span className="bl-ts-badge is-quiet">{ __( 'element', 'blicks' ) }</span> }
			</button>

			{ isOpen && (
				<div className="bl-ts-role-body">
					{ props.map( prop => {
						const label = TYPE_ROLE_PROP_LABELS[ prop ] ?? titleCase( prop );
						const value = valueOf( prop );
						const overridden = isOverridden( prop );

						return (
							<div className="bl-ts-role-field" key={ prop }>
								<label htmlFor={ `bl-ts-${ role }-${ prop }` }>{ label }</label>
								{ prop === 'fontFamily' && fontLibrary.length > 0 ? (
									<span className="bl-ts-select">
										<select
											id={ `bl-ts-${ role }-${ prop }` }
											value={ value }
											disabled={ disabled }
											onChange={ event => onChange( prop, event.currentTarget.value ) }
										>
											{ /* The saved value may be a raw stack or a var() the library
											     doesn't list verbatim — keep it selectable. */ }
											{ ! fontLibrary.some( font => familyValue( font.slug ) === value || font.fontFamily === value ) && (
												<option value={ value }>{ value || __( 'Theme default', 'blicks' ) }</option>
											) }
											{ fontLibrary.map( font => (
												<option key={ font.slug } value={ familyValue( font.slug ) }>{ font.name }</option>
											) ) }
										</select>
									</span>
								) : prop === 'fontWeight' ? (
									<span className="bl-ts-select">
										<select
											id={ `bl-ts-${ role }-${ prop }` }
											value={ value }
											disabled={ disabled }
											onChange={ event => onChange( prop, event.currentTarget.value ) }
										>
											{ ! ( FONT_WEIGHTS as readonly string[] ).includes( value ) && <option value={ value }>{ value }</option> }
											{ FONT_WEIGHTS.map( weight => <option key={ weight } value={ weight }>{ weight }</option> ) }
										</select>
									</span>
								) : prop === 'textTransform' ? (
									<span className="bl-ts-select">
										<select
											id={ `bl-ts-${ role }-${ prop }` }
											value={ value }
											disabled={ disabled }
											onChange={ event => onChange( prop, event.currentTarget.value ) }
										>
											{ ! ( TEXT_TRANSFORMS as readonly string[] ).includes( value ) && <option value={ value }>{ value }</option> }
											{ TEXT_TRANSFORMS.map( transform => <option key={ transform } value={ transform }>{ transform }</option> ) }
										</select>
									</span>
								) : (
									<span className="bl-ts-input is-wide">
										<input
											id={ `bl-ts-${ role }-${ prop }` }
											type="text"
											value={ value }
											placeholder={ baseOf( prop ) }
											disabled={ disabled }
											onChange={ event => onChange( prop, event.currentTarget.value ) }
										/>
									</span>
								) }
								<button
									type="button"
									className="bl-ts-reset"
									title={ __( 'Reset to theme value', 'blicks' ) }
									disabled={ disabled || ! overridden }
									onClick={ () => onChange( prop, '' ) }
								>
									{ RESET_ICON }
								</button>
							</div>
						);
					} ) }
				</div>
			) }
		</div>
	);
}

/** A font-family value the way type roles store it — the theme.json preset var, per TypeRoles::DEFAULTS. */
function familyValue( slug: string ): string {
	return `var(--wp--preset--font-family--${ slug })`;
}

/**
 * A role value shortened for the collapsed row. Roles track the primitive scale by default, so
 * most sizes are `var(--wp--preset--font-size--xx-large)` — 40 characters of boilerplate around
 * the one word that identifies it. Show the slug; the field itself still holds the real value.
 */
function shortValue( value: string ): string {
	return value.replace( /^var\(\s*--wp--preset--[a-z-]+--([a-z0-9-]+)\s*\)$/i, '$1' );
}

function ColorRow( {
	slug,
	value,
	isOverride,
	disabled,
	onChange,
	onReset,
}: {
	slug: string;
	value: string;
	isOverride: boolean;
	disabled: boolean;
	onChange: ( value: string ) => void;
	onReset: () => void;
} ): JSX.Element {
	const [ isOpen, setIsOpen ] = useState( false );
	const swatchRef = useRef< HTMLButtonElement | null >( null );
	const swatch = value || `var(${ tokenVar( 'color', slug ) })`;

	return (
		<div className={ `bl-ts-tok${ isOverride ? ' is-override' : '' }` }>
			<button
				ref={ swatchRef }
				type="button"
				className={ `bl-ts-swatch${ isOpen ? ' is-editing' : '' }` }
				style={ { background: swatch } }
				disabled={ disabled }
				aria-label={ sprintf(
					/* translators: %s: color token name. */
					__( 'Edit %s color', 'blicks' ),
					titleCase( slug )
				) }
				onClick={ () => setIsOpen( open => ! open ) }
			/>
			<div className="bl-ts-main">
				<strong>{ titleCase( slug ) }</strong>
				<span title={ tokenVar( 'color', slug ) }>{ value || tokenVar( 'color', slug ) }</span>
			</div>
			{ isOverride && <span className="bl-ts-sr">{ __( 'Overrides the theme value', 'blicks' ) }</span> }
			<button type="button" className="bl-ts-reset" title={ __( 'Reset to theme value', 'blicks' ) } disabled={ disabled || ! isOverride } onClick={ onReset }>
				{ RESET_ICON }
			</button>
			{ isOpen && (
				<Popover
					anchor={ swatchRef.current }
					placement="left-start"
					offset={ 12 }
					flip
					resize
					noArrow
					focusOnMount={ false }
					onClose={ () => setIsOpen( false ) }
					className="bl-floating-popover"
					variant="unstyled"
				>
					<div className="bl-ts-picker">
						<ColorPicker
							color={ value }
							enableAlpha
							onChange={ ( next: string ) => onChange( hex8ToCssValue( next ) ) }
						/>
					</div>
				</Popover>
			) }
		</div>
	);
}

function ValueRow( {
	label,
	detail,
	value,
	placeholder,
	isOverride,
	disabled,
	onChange,
	onReset,
}: {
	label: string;
	detail: string;
	value: string;
	placeholder: string;
	isOverride: boolean;
	disabled: boolean;
	onChange: ( value: string ) => void;
	onReset: () => void;
} ): JSX.Element {
	return (
		<div className={ `bl-ts-field${ isOverride ? ' is-override' : '' }` }>
			<div className="bl-ts-main">
				<strong>{ label }</strong>
				<span title={ detail }>{ detail }</span>
			</div>
			{ isOverride && <span className="bl-ts-sr">{ __( 'Overrides the theme value', 'blicks' ) }</span> }
			<span className="bl-ts-input is-wide">
				<input
					type="text"
					value={ value }
					placeholder={ placeholder }
					disabled={ disabled }
					title={ value || placeholder }
					aria-label={ sprintf(
						/* translators: %s: token name. */
						__( '%s value', 'blicks' ),
						label
					) }
					onChange={ event => onChange( event.currentTarget.value ) }
				/>
			</span>
			<button type="button" className="bl-ts-reset" title={ __( 'Reset to theme value', 'blicks' ) } disabled={ disabled || ! isOverride } onClick={ onReset }>
				{ RESET_ICON }
			</button>
		</div>
	);
}

registerPlugin( 'blicks', { render: ThemeSettings } );
