import { __, _n, sprintf } from '@wordpress/i18n';
import { TYPE_ROLES, TYPE_ROLE_DEFAULTS, DEFAULT_BREAKPOINTS, TOKENS, TOKEN_CATEGORY_KEYS, fallbackTypeRoles } from './constants';
import { FALLBACK_SNAPSHOT, FALLBACK_ADMIN_SETTINGS, FALLBACK_DASHBOARD_SUMMARY } from './fallbacks';
import type { Tokens, TokenValues, FontFamily, TypeRoleValues, TypeRoleSlot, TypeRoleSnapshot, DesignOverrides, Breakpoint, DesignTheme, ThemesState, TokenSourceTone, DesignSystemSnapshot, AdminSettingsSnapshot, DashboardSummary, ActivityEntry, DiagnosticsCheck, DiagnosticsResult, DiagnosticsStatus, CustomAnimation, AnimationStep, LibraryAnimation } from './types';

export function tokenVar( category: string, slug: string ): string {
	return `--blicks-${ category }-${ slug }`;
}

export function titleCase( value: string ): string {
	return value
		.split( '-' )
		.map( part => part.charAt( 0 ).toUpperCase() + part.slice( 1 ) )
		.join( ' ' );
}
export function normalizeDashboardSummary( value: unknown ): DashboardSummary {
	if ( typeof value !== 'object' || value === null ) {
		return FALLBACK_DASHBOARD_SUMMARY;
	}

	const data = value as Partial< DashboardSummary >;
	const blocks = data.blocks && typeof data.blocks === 'object' ? data.blocks as Partial< DashboardSummary[ 'blocks' ] > : {};
	const usage = data.usage && typeof data.usage === 'object' ? data.usage as Partial< DashboardSummary[ 'usage' ] > : {};

	return {
		blocks: {
			total: numberOrFallback( blocks.total, 0 ),
			interactive: numberOrFallback( blocks.interactive, 0 ),
		},
		usage: {
			posts: numberOrFallback( usage.posts, 0 ),
		},
		activity: normalizeActivity( data.activity ),
	};
}

// An entry without a parseable timestamp is dropped rather than shown undated — the whole
// point of the feed is that every time on it was actually measured.
export function normalizeActivity( value: unknown ): ActivityEntry[] {
	if ( ! Array.isArray( value ) ) return [];

	return value.flatMap( ( entry: unknown ) => {
		if ( typeof entry !== 'object' || entry === null ) return [];
		const row = entry as Partial< ActivityEntry >;
		const time = typeof row.time === 'string' ? row.time : '';
		if ( ! time || Number.isNaN( Date.parse( time ) ) ) return [];

		return [ {
			id: typeof row.id === 'string' ? row.id : time,
			label: typeof row.label === 'string' ? row.label : '',
			detail: typeof row.detail === 'string' ? row.detail : '',
			time,
		} ];
	} );
}

// The server is the authority on what a valid animation is; this only guards the UI against a
// malformed response, so anything unusable is dropped rather than half-rendered.
export function normalizeAnimations( value: unknown ): CustomAnimation[] {
	const list = Array.isArray( value )
		? value
		: typeof value === 'object' && value !== null && Array.isArray( ( value as { animations?: unknown } ).animations )
			? ( value as { animations: unknown[] } ).animations
			: [];

	return list.flatMap( ( entry: unknown ) => {
		if ( typeof entry !== 'object' || entry === null ) return [];
		const row = entry as Partial< CustomAnimation >;
		const slug = typeof row.slug === 'string' ? row.slug : '';
		if ( ! slug ) return [];

		const steps = Array.isArray( row.steps ) ? row.steps.flatMap( ( step: unknown ) => {
			if ( typeof step !== 'object' || step === null ) return [];
			const s = step as Partial< AnimationStep >;
			const offset = Number( s.offset );
			if ( ! Number.isFinite( offset ) || offset < 0 || offset > 100 ) return [];

			const declarations = typeof s.declarations === 'object' && s.declarations !== null
				? Object.fromEntries(
					Object.entries( s.declarations as Record< string, unknown > )
						.filter( ( [ prop, val ] ) => prop !== '' && typeof val === 'string' && val !== '' )
				) as Record< string, string >
				: {};

			return Object.keys( declarations ).length > 0 ? [ { offset, declarations } ] : [];
		} ) : [];

		if ( steps.length === 0 ) return [];

		const defaults = typeof row.defaults === 'object' && row.defaults !== null ? row.defaults : {};

		return [ {
			slug,
			label: typeof row.label === 'string' && row.label !== '' ? row.label : slug,
			defaults,
			steps: steps.sort( ( a, b ) => a.offset - b.offset ),
		} ];
	} );
}

/** The merged predefined ∪ custom list the endpoint returns under `library`. */
export function normalizeLibrary( value: unknown ): LibraryAnimation[] {
	const list = typeof value === 'object' && value !== null && Array.isArray( ( value as { library?: unknown } ).library )
		? ( value as { library: unknown[] } ).library
		: [];

	return list.flatMap( ( entry: unknown ) => {
		if ( typeof entry !== 'object' || entry === null ) return [];
		const row = entry as Partial< LibraryAnimation >;
		const name = typeof row.name === 'string' ? row.name : '';
		if ( ! name ) return [];

		return [ {
			slug: typeof row.slug === 'string' ? row.slug : name,
			name,
			label: typeof row.label === 'string' && row.label ? row.label : name,
			description: typeof row.description === 'string' ? row.description : '',
			builtin: row.builtin === true,
			defaults: typeof row.defaults === 'object' && row.defaults !== null ? row.defaults : {},
			steps: Array.isArray( row.steps ) ? row.steps as AnimationStep[] : [],
		} ];
	} );
}

export function normalizeDiagnostics( value: unknown ): DiagnosticsResult | null {
	if ( typeof value !== 'object' || value === null ) return null;

	const data = value as Partial< DiagnosticsResult >;
	const checks = Array.isArray( data.checks ) ? data.checks.flatMap( ( entry: unknown ) => {
		if ( typeof entry !== 'object' || entry === null ) return [];
		const row = entry as Partial< DiagnosticsCheck >;
		const status: DiagnosticsStatus = row.status === 'fail' || row.status === 'warn' ? row.status : 'pass';

		return [ {
			id: typeof row.id === 'string' ? row.id : '',
			label: typeof row.label === 'string' ? row.label : '',
			detail: typeof row.detail === 'string' ? row.detail : '',
			status,
		} ];
	} ) : [];

	return {
		ranAt: typeof data.ranAt === 'string' ? data.ranAt : new Date().toISOString(),
		checks,
		summary: {
			pass: checks.filter( check => check.status === 'pass' ).length,
			warn: checks.filter( check => check.status === 'warn' ).length,
			fail: checks.filter( check => check.status === 'fail' ).length,
		},
	};
}

/** "3 minutes ago" via WP's own humanizer, so the string matches the rest of wp-admin. */
export function timeAgo( iso: string ): string {
	const then = Date.parse( iso );
	if ( Number.isNaN( then ) ) return '';

	const seconds = Math.max( 0, Math.round( ( Date.now() - then ) / 1000 ) );
	if ( seconds < 60 ) return __( 'just now', 'blicks' );

	const units: Array< [ number, ( n: number ) => string ] > = [
		[ 60, n => sprintf( _n( '%d minute ago', '%d minutes ago', n, 'blicks' ), n ) ],
		[ 3600, n => sprintf( _n( '%d hour ago', '%d hours ago', n, 'blicks' ), n ) ],
		[ 86400, n => sprintf( _n( '%d day ago', '%d days ago', n, 'blicks' ), n ) ],
		[ 2592000, n => sprintf( _n( '%d month ago', '%d months ago', n, 'blicks' ), n ) ],
	];

	let label = units[ 0 ][ 1 ]( 1 );
	for ( const [ divisor, format ] of units ) {
		const amount = Math.floor( seconds / divisor );
		if ( amount < 1 ) break;
		label = format( amount );
	}

	return label;
}

export function metricValue( value: number, status: 'loading' | 'ready' | 'fallback' ): string {
	if ( status === 'loading' ) return '...';
	return String( value );
}

export function designSyncStatus( source: DesignSystemSnapshot[ 'source' ] ): {
	eyebrow: string;
	target: string;
	note: string;
	title: string;
	body: string;
	readValue: string;
	readText: string;
	nextSaveText: string;
	warn: boolean;
} {
	if ( source.globalStyles ) {
		return {
			eyebrow: __( 'Global Styles sync on', 'blicks' ),
			target: __( 'Global Styles', 'blicks' ),
			note: __( 'Native WordPress presets', 'blicks' ),
			title: __( 'Saving into WordPress Global Styles', 'blicks' ),
			body: __( 'Changed tokens graduate into theme.json so core controls and Blicks read the same values.', 'blicks' ),
			readValue: 'theme.json',
			readText: __( 'Projected from native settings', 'blicks' ),
			nextSaveText: __( 'Changed tokens migrate forward', 'blicks' ),
			warn: false,
		};
	}

	if ( source.themeJson ) {
		return {
			eyebrow: __( 'theme.json connected', 'blicks' ),
			target: __( 'Blicks option', 'blicks' ),
			note: __( 'Sync disabled', 'blicks' ),
			title: __( 'Sync is currently disabled', 'blicks' ),
			body: __( 'Blicks still projects the active theme, but new edits stay in the plugin override layer until sync is enabled.', 'blicks' ),
			readValue: 'theme.json',
			readText: __( 'Projected from active theme', 'blicks' ),
			nextSaveText: __( 'Edits stay local to Blicks', 'blicks' ),
			warn: false,
		};
	}

	return {
		eyebrow: __( 'Fallback theme', 'blicks' ),
		target: __( 'Blicks option', 'blicks' ),
		note: __( 'No theme.json support', 'blicks' ),
		title: __( 'Classic theme fallback', 'blicks' ),
		body: __( 'This theme does not expose Global Styles, so Blicks keeps design-system edits in its own option.', 'blicks' ),
		readValue: __( 'Fallback', 'blicks' ),
		readText: __( 'Default Blicks tokens', 'blicks' ),
		nextSaveText: __( 'Classic theme fallback', 'blicks' ),
		warn: true,
	};
}

export function designOverrideCount( overrides: DesignOverrides ): number {
	const tokenCount = Object.values( overrides.tokens ).reduce( ( count, values ) => count + Object.keys( values ?? {} ).length, 0 );
	return tokenCount + Object.keys( overrides.breakpoints ).length;
}

export function tokenSource( {
	hasDraftValue,
	isChanged,
	hasSavedOverride,
	source,
}: {
	hasDraftValue: boolean;
	isChanged: boolean;
	hasSavedOverride: boolean;
	source: DesignSystemSnapshot[ 'source' ];
} ): { label: string; tone: TokenSourceTone } {
	if ( hasDraftValue && isChanged && source.globalStyles ) {
		return { label: __( 'Will sync', 'blicks' ), tone: 'draft' };
	}

	if ( hasDraftValue && isChanged ) {
		return { label: __( 'Draft', 'blicks' ), tone: 'draft' };
	}

	if ( hasSavedOverride ) {
		return { label: __( 'Blicks override', 'blicks' ), tone: 'override' };
	}

	if ( source.globalStyles ) {
		return { label: __( 'Global Styles', 'blicks' ), tone: 'sync' };
	}

	if ( source.themeJson ) {
		return { label: 'theme.json', tone: 'theme' };
	}

	return { label: __( 'Fallback', 'blicks' ), tone: 'fallback' };
}

export function normalizeAdminSettings( value: unknown ): AdminSettingsSnapshot {
	if ( typeof value !== 'object' || value === null ) {
		return FALLBACK_ADMIN_SETTINGS;
	}

	const data = value as Partial< AdminSettingsSnapshot >;

	return {
		defaultInspectorPanel: choiceOrFallback(
			data.defaultInspectorPanel,
			[ 'settings', 'styles', 'advanced' ],
			FALLBACK_ADMIN_SETTINGS.defaultInspectorPanel
		),
		helpVisibility: choiceOrFallback(
			data.helpVisibility,
			[ 'show', 'hide' ],
			FALLBACK_ADMIN_SETTINGS.helpVisibility
		),
		deleteDataOnUninstall: typeof data.deleteDataOnUninstall === 'boolean'
			? data.deleteDataOnUninstall
			: FALLBACK_ADMIN_SETTINGS.deleteDataOnUninstall,
		designSystem: {
			themeJsonSupported: Boolean( data.designSystem?.themeJsonSupported ),
			themeJsonSync: Boolean( data.designSystem?.themeJsonSync ) && Boolean( data.designSystem?.themeJsonSupported ),
		},
	};
}

export function adminSettingsEqual( left: AdminSettingsSnapshot, right: AdminSettingsSnapshot ): boolean {
	return left.defaultInspectorPanel === right.defaultInspectorPanel
		&& left.helpVisibility === right.helpVisibility
		&& left.deleteDataOnUninstall === right.deleteDataOnUninstall
		&& left.designSystem.themeJsonSync === right.designSystem.themeJsonSync
		&& left.designSystem.themeJsonSupported === right.designSystem.themeJsonSupported;
}

export function choiceOrFallback< T extends string >( value: unknown, allowed: readonly T[], fallback: T ): T {
	return typeof value === 'string' && allowed.includes( value as T ) ? value as T : fallback;
}

export function isSettingSource< T extends string >( value: unknown, allowed: readonly T[] ): value is T {
	return typeof value === 'string' && allowed.includes( value as T );
}

export function formatDate( value: string | null ): string {
	if ( ! value ) return __( 'Never', 'blicks' );
	const date = new Date( value );
	return Number.isNaN( date.getTime() ) ? __( 'Never', 'blicks' ) : date.toLocaleString();
}

export function normalizeSnapshot( value: unknown ): DesignSystemSnapshot {
	if ( typeof value !== 'object' || value === null ) {
		return FALLBACK_SNAPSHOT;
	}

	const data = value as Partial< DesignSystemSnapshot >;

	return {
		mode: 'readOnly',
		source: {
			theme: typeof data.source?.theme === 'string' ? data.source.theme : FALLBACK_SNAPSHOT.source.theme,
			themeJson: Boolean( data.source?.themeJson ),
			globalStyles: Boolean( data.source?.globalStyles ),
		},
		tokens: ( () => {
			const out = {} as Tokens;
			for ( const category of TOKEN_CATEGORY_KEYS ) {
				out[ category ] = listOrFallback( data.tokens?.[ category ], FALLBACK_SNAPSHOT.tokens[ category ] );
			}
			return out;
		} )(),
		baseValues: normalizeValues( data.baseValues, FALLBACK_SNAPSHOT.baseValues ),
		values: normalizeValues( data.values, FALLBACK_SNAPSHOT.values ),
		typeRoles: normalizeTypeRoles( data.typeRoles ),
		fontLibrary: Array.isArray( data.fontLibrary ) ? data.fontLibrary.filter( isFontFamily ) : [],
		overrides: normalizeOverrides( data.overrides ),
		breakpoints: Array.isArray( data.breakpoints ) ? data.breakpoints.filter( isBreakpoint ) : FALLBACK_SNAPSHOT.breakpoints,
		counts: {
			colors: numberOrFallback( data.counts?.colors, FALLBACK_SNAPSHOT.counts.colors ),
			typography: numberOrFallback( data.counts?.typography, FALLBACK_SNAPSHOT.counts.typography ),
			spacing: numberOrFallback( data.counts?.spacing, FALLBACK_SNAPSHOT.counts.spacing ),
			radius: numberOrFallback( data.counts?.radius, FALLBACK_SNAPSHOT.counts.radius ),
			shadow: numberOrFallback( data.counts?.shadow, FALLBACK_SNAPSHOT.counts.shadow ),
			breakpoints: numberOrFallback( data.counts?.breakpoints, FALLBACK_SNAPSHOT.counts.breakpoints ),
			typeRoles: numberOrFallback( data.counts?.typeRoles, FALLBACK_SNAPSHOT.counts.typeRoles ),
		},
	};
}

export function isFontFamily( value: unknown ): value is FontFamily {
	if ( typeof value !== 'object' || value === null ) return false;
	const c = value as Partial< FontFamily >;
	return typeof c.slug === 'string' && typeof c.name === 'string' && typeof c.fontFamily === 'string' && typeof c.source === 'string';
}

export function normalizeTypeRoles( value: unknown ): TypeRoleSnapshot {
	const fallback = fallbackTypeRoles();
	if ( typeof value !== 'object' || value === null ) {
		return fallback;
	}

	const data = value as Partial< TypeRoleSnapshot >;
	const roleRecord = ( raw: unknown ): TypeRoleValues => {
		const out: TypeRoleValues = {};
		for ( const role of TYPE_ROLES ) {
			const props = stringRecordOrFallback( ( raw as Record< string, unknown > )?.[ role ], TYPE_ROLE_DEFAULTS[ role ] );
			out[ role ] = { ...TYPE_ROLE_DEFAULTS[ role ], ...props };
		}
		return out;
	};

	return {
		roles: Array.isArray( data.roles ) && data.roles.every( r => typeof r === 'string' ) ? data.roles : fallback.roles,
		props: Array.isArray( data.props ) && data.props.every( p => typeof p === 'string' ) ? data.props : fallback.props,
		slots: typeof data.slots === 'object' && data.slots !== null ? data.slots as Record< string, TypeRoleSlot > : fallback.slots,
		base: roleRecord( data.base ),
		values: roleRecord( data.values ),
	};
}

export function normalizeValues( value: unknown, fallback: TokenValues ): TokenValues {
	const values = value && typeof value === 'object' ? value as Partial< TokenValues > : {};

	const out = {} as TokenValues;
	for ( const category of TOKEN_CATEGORY_KEYS ) {
		out[ category ] = stringRecordOrFallback( values[ category ], fallback[ category ] );
	}
	return out;
}

export function normalizeOverrides( value: unknown ): DesignOverrides {
	if ( typeof value !== 'object' || value === null ) {
		return { tokens: {}, breakpoints: {}, typeRoles: {} };
	}

	const data = value as Partial< DesignOverrides >;
	const tokens = data.tokens && typeof data.tokens === 'object' ? data.tokens : {};
	const rawRoles = data.typeRoles && typeof data.typeRoles === 'object' ? data.typeRoles : {};
	const typeRoles: TypeRoleValues = {};
	for ( const role of TYPE_ROLES ) {
		const props = stringRecordOrFallback( ( rawRoles as Record< string, unknown > )[ role ], {} );
		if ( Object.keys( props ).length > 0 ) {
			typeRoles[ role ] = props;
		}
	}

	const tokensOut = {} as DesignOverrides[ 'tokens' ];
	for ( const category of TOKEN_CATEGORY_KEYS ) {
		tokensOut[ category ] = stringRecordOrFallback( ( tokens as Partial< Record< keyof typeof TOKENS, unknown > > )[ category ], {} );
	}

	return {
		tokens: tokensOut,
		breakpoints: numberRecordOrFallback( data.breakpoints, {} ),
		typeRoles,
	};
}

export function stringRecordOrFallback( value: unknown, fallback: Record< string, string > ): Record< string, string > {
	if ( typeof value !== 'object' || value === null ) {
		return fallback;
	}

	const entries = Object.entries( value ).filter( ( entry ): entry is [ string, string ] => typeof entry[ 1 ] === 'string' );
	return Object.fromEntries( entries );
}

export function numberRecordOrFallback( value: unknown, fallback: Record< string, number > ): Record< string, number > {
	if ( typeof value !== 'object' || value === null ) {
		return fallback;
	}

	const entries = Object.entries( value ).filter( ( entry ): entry is [ string, number ] => typeof entry[ 1 ] === 'number' );
	return Object.fromEntries( entries );
}

export function nestedStringRecord( value: unknown ): Record< string, Record< string, string > > {
	if ( typeof value !== 'object' || value === null ) {
		return {};
	}
	const out: Record< string, Record< string, string > > = {};
	for ( const [ key, inner ] of Object.entries( value ) ) {
		out[ key ] = stringRecordOrFallback( inner, {} );
	}
	return out;
}

export function normalizeThemes( value: unknown ): ThemesState {
	const data = ( value && typeof value === 'object' ? value : {} ) as { active?: unknown; themes?: unknown };
	const list = Array.isArray( data.themes ) ? data.themes : Array.isArray( value ) ? value : [];

	const themes: DesignTheme[] = [];
	for ( const raw of list ) {
		if ( ! raw || typeof raw !== 'object' ) continue;
		const item = raw as { id?: unknown; name?: unknown; builtin?: unknown; edited?: unknown; tokens?: unknown };
		if ( typeof item.id !== 'string' || typeof item.name !== 'string' ) continue;
		const bag = ( item.tokens && typeof item.tokens === 'object' ? item.tokens : {} ) as Record< string, unknown >;
		themes.push( {
			id: item.id,
			name: item.name,
			builtin: Boolean( item.builtin ),
			edited: Boolean( item.edited ),
			tokens: {
				tokens: nestedStringRecord( bag.tokens ),
				breakpoints: numberRecordOrFallback( bag.breakpoints, {} ),
				typeRoles: nestedStringRecord( bag.typeRoles ),
			},
		} );
	}

	return { active: typeof data.active === 'string' ? data.active : 'indigo', themes };
}

export function hasColorChanges( draft: Record< string, string >, saved: Record< string, string > ): boolean {
	const keys = new Set( [ ...Object.keys( draft ), ...Object.keys( saved ) ] );
	for ( const key of keys ) {
		if ( ( draft[ key ] ?? '' ) !== ( saved[ key ] ?? '' ) ) {
			return true;
		}
	}

	return false;
}

export function cloneTokens( tokens: Record< string, Record< string, string > > ): Record< string, Record< string, string > > {
	const next: Record< string, Record< string, string > > = {};
	for ( const [ category, values ] of Object.entries( tokens ) ) {
		next[ category ] = { ...values };
	}

	return next;
}

export function hasTokenChanges( draft: Record< string, Record< string, string > >, saved: Record< string, Record< string, string > > ): boolean {
	const categories = new Set( [ ...Object.keys( draft ), ...Object.keys( saved ) ] );
	for ( const category of categories ) {
		if ( hasColorChanges( draft[ category ] ?? {}, saved[ category ] ?? {} ) ) {
			return true;
		}
	}

	return false;
}

export function hasBreakpointChanges( draft: Record< string, number >, saved: Record< string, number > ): boolean {
	const keys = new Set( [ ...Object.keys( draft ), ...Object.keys( saved ) ] );
	for ( const key of keys ) {
		if ( draft[ key ] !== saved[ key ] ) {
			return true;
		}
	}

	return false;
}

export function defaultBreakpointMax( breakpointId: string ): number | null {
	return DEFAULT_BREAKPOINTS.find( breakpoint => breakpoint.id === breakpointId )?.max ?? null;
}

export function listOrFallback( value: unknown, fallback: readonly string[] ): readonly string[] {
	return Array.isArray( value ) && value.every( item => typeof item === 'string' ) ? value : fallback;
}

export function numberOrFallback( value: unknown, fallback: number ): number {
	return typeof value === 'number' ? value : fallback;
}

export function isBreakpoint( value: unknown ): value is Breakpoint {
	if ( typeof value !== 'object' || value === null ) return false;
	const candidate = value as Partial< Breakpoint >;
	return typeof candidate.id === 'string'
		&& typeof candidate.label === 'string'
		&& ( typeof candidate.max === 'number' || candidate.max === null );
}

export function colorTokenUsage( token: string ): string {
	const uses: Record< string, string > = {
		primary: __( 'Primary CTAs, links, and selected states.', 'blicks' ),
		background: __( 'Page background and large blank regions.', 'blicks' ),
		foreground: __( 'Primary text and dark interface regions.', 'blicks' ),
		border: __( 'Hairlines, grid dividers, and table edges.', 'blicks' ),
		card: __( 'Cards, token cells, and framed panels.', 'blicks' ),
		accent: __( 'Secondary emphasis and supporting UI.', 'blicks' ),
	};

	return uses[ token ] ?? __( 'Theme preset alias used by blocks, controls, and generated layouts.', 'blicks' );
}

export function isLightColor( value: string ): boolean {
	const match = value.trim().match( /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i );
	if ( ! match ) return false;
	const r = Number.parseInt( match[ 1 ], 16 );
	const g = Number.parseInt( match[ 2 ], 16 );
	const b = Number.parseInt( match[ 3 ], 16 );
	return ( r * 299 + g * 587 + b * 114 ) / 1000 > 180;
}

export function isDarkColor( value: string ): boolean {
	const hex = value.trim().replace( '#', '' );
	if ( hex.length !== 3 && hex.length !== 6 ) return false;
	const full = hex.length === 3 ? hex.replace( /./g, '$&$&' ) : hex;
	const n = parseInt( full, 16 );
	if ( Number.isNaN( n ) ) return false;
	const r = ( n >> 16 ) & 255, g = ( n >> 8 ) & 255, b = n & 255;
	return ( 0.299 * r + 0.587 * g + 0.114 * b ) < 150;
}

// ── Field validation ───────────────────────────────────────────────────────
// Each design-system input validates its value on blur. Empty or invalid values
// revert the field to its base (theme) value; valid values are committed.

export function balancedParens( v: string ): boolean {
	let depth = 0;
	for ( const ch of v ) {
		if ( ch === '(' ) depth++;
		else if ( ch === ')' ) { depth--; if ( depth < 0 ) return false; }
	}
	return depth === 0;
}

export const isFnExpr = ( v: string ): boolean => /^(var|calc|clamp|min|max|env)\(/i.test( v ) && balancedParens( v );

// The CSS named colours. Kept as a list rather than probed from the DOM so this stays
// testable in node — and `red` being refused as a colour is worse than the bytes.
const NAMED_COLORS = new Set( ( 'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue '
	+ 'blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue '
	+ 'darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid '
	+ 'darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink '
	+ 'deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold '
	+ 'goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush '
	+ 'lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey '
	+ 'lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime '
	+ 'limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen '
	+ 'mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin '
	+ 'navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise '
	+ 'palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue '
	+ 'saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow '
	+ 'springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen' ).split( ' ' ) );

export const isColorValue = ( v: string ): boolean =>
	/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test( v ) ||
	/^(rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([^()]*\)$/i.test( v ) ||
	/^(transparent|currentcolor|inherit)$/i.test( v ) ||
	NAMED_COLORS.has( v.trim().toLowerCase() ) ||
	isFnExpr( v );

export const isLengthValue = ( v: string ): boolean =>
	v === '0' ||
	/^-?\d*\.?\d+(px|rem|em|%|vw|vh|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh|ch|ex|pt|pc|cm|mm|in|q)$/i.test( v ) ||
	isFnExpr( v );

export const isUnitlessNumber = ( v: string ): boolean => /^-?\d*\.?\d+$/.test( v );

export const isLineHeightValue = ( v: string ): boolean =>
	v.toLowerCase() === 'normal' || isUnitlessNumber( v ) || isLengthValue( v );

export const isTrackingValue = ( v: string ): boolean =>
	v.toLowerCase() === 'normal' || isLengthValue( v ) || isUnitlessNumber( v );

export const isOpacityValue = ( v: string ): boolean => {
	if ( /^\d{1,3}%$/.test( v ) ) return Number.parseInt( v, 10 ) <= 100;
	if ( isUnitlessNumber( v ) ) { const n = Number.parseFloat( v ); return n >= 0 && n <= 1; }
	return isFnExpr( v );
};

export const isIntegerValue = ( v: string ): boolean => /^-?\d+$/.test( v ) || isFnExpr( v );

export const isAspectValue = ( v: string ): boolean =>
	v.toLowerCase() === 'auto' || /^\d*\.?\d+(\s*\/\s*\d*\.?\d+)?$/.test( v ) || isFnExpr( v );

// Free-form CSS (shadow, gradient, transition, …): only reject empty / unbalanced.
export const isFreeformValue = ( v: string ): boolean => v !== '' && balancedParens( v );

export const TOKEN_VALIDATORS: Record< string, ( v: string ) => boolean > = {
	color: isColorValue,
	spacing: isLengthValue,
	radius: isLengthValue,
	borderWidth: isLengthValue,
	width: isLengthValue,
	zIndex: isIntegerValue,
	opacity: isOpacityValue,
	leading: isLineHeightValue,
	aspect: isAspectValue,
	shadow: isFreeformValue,
	gradient: isFreeformValue,
	transition: isFreeformValue,
	transform: isFreeformValue,
	filter: isFreeformValue,
	ring: isFreeformValue,
	borderStyle: isFreeformValue,
};

export const validateTokenValue = ( category: string, v: string ): boolean =>
	( TOKEN_VALIDATORS[ category ] ?? isFreeformValue )( v );

export const TYPE_ROLE_VALIDATORS: Record< string, ( v: string ) => boolean > = {
	fontSize: isLengthValue,
	lineHeight: isLineHeightValue,
	letterSpacing: isTrackingValue,
};

export const validateTypeRoleValue = ( prop: string, v: string ): boolean =>
	( TYPE_ROLE_VALIDATORS[ prop ] ?? isFreeformValue )( v );

// Variable-value sugar: edit `--token` instead of the full `var(--token)`. The
// value is treated as a comma-separated list, so only whole list items that are
// a bare token or a simple `var(--token)` are transformed — compound values like
// `1px solid var(--border)` pass through untouched.
export const stripVars = ( v: string ): string =>
	v.split( ',' ).map( part => {
		const t = part.trim();
		const m = t.match( /^var\(\s*(--[a-z0-9-]+)\s*\)$/i );
		return m ? m[ 1 ] : t;
	} ).join( ', ' );

export const wrapVars = ( v: string ): string =>
	v.split( ',' ).map( part => {
		const t = part.trim();
		return /^--[a-z0-9-]+$/.test( t ) ? `var(${ t })` : t;
	} ).join( ', ' );

export const colorToEdit = ( v: string ): string => {
	const s = stripVars( v );
	return s.startsWith( '#' ) ? s.toUpperCase() : s;
};

// Split a `<number><unit>` value (e.g. `1.5rem`) into its parts so the unit can be
// shown as a separate chip while the field is idle. Returns null for anything that
// isn't a plain numeric length (var(), calc(), unitless, multi-value, …).
export const UNIT_SPLIT_RE = /^(-?(?:\d*\.\d+|\d+))(px|rem|em|%|vw|vh|vmin|vmax|svw|svh|lvw|lvh|dvw|dvh|ch|ex|pt|pc|cm|mm|in|q)$/i;
export const splitNumUnit = ( v: string ): { num: string; unit: string } | null => {
	const m = v.trim().match( UNIT_SPLIT_RE );
	return m ? { num: m[ 1 ], unit: m[ 2 ] } : null;
};

/**
 * Text input with a local edit buffer. While focused it shows what the user
 * types — even when empty or partway through a value — so clearing a field no
 * longer snaps back to the base value mid-typing. Valid values commit live (for
 * the preview); on blur an empty or invalid value reverts to the base/default.
 */

/* ── contrast ─────────────────────────────────────────────────────────────────
   A colour pair is judged by the ratio between the two, which is the one thing
   the Site Editor's palette UI cannot tell you. These take the *rendered* values
   (`getComputedStyle` returns `rgb()` / `rgba()` / `color(srgb …)`), because a
   token may hold a `var()`, a `color-mix()`, or a preset reference. */

export type Rgba = { r: number; g: number; b: number; a: number };

/** Parse the forms a browser hands back from a computed style. Null for anything else. */
export const parseRgb = ( value: string ): Rgba | null => {
	const v = value.trim().toLowerCase();

	const fn = v.match( /^rgba?\(([^)]+)\)$/ );
	if ( fn ) {
		const parts = fn[ 1 ].split( /[,/\s]+/ ).filter( p => p !== '' );
		if ( parts.length < 3 ) return null;
		const [ r, g, b ] = parts.slice( 0, 3 ).map( p => ( p.endsWith( '%' ) ? ( parseFloat( p ) / 100 ) * 255 : parseFloat( p ) ) );
		const rawAlpha = parts[ 3 ];
		const a = rawAlpha === undefined ? 1 : ( rawAlpha.endsWith( '%' ) ? parseFloat( rawAlpha ) / 100 : parseFloat( rawAlpha ) );
		if ( [ r, g, b, a ].some( n => Number.isNaN( n ) ) ) return null;
		return { r, g, b, a };
	}

	// `color(srgb 0 0.5 1 / .5)` — Safari and colour-space-aware values.
	const srgb = v.match( /^color\(\s*srgb\s+([^)]+)\)$/ );
	if ( srgb ) {
		const parts = srgb[ 1 ].split( /[/\s]+/ ).filter( p => p !== '' );
		if ( parts.length < 3 ) return null;
		const [ r, g, b ] = parts.slice( 0, 3 ).map( p => parseFloat( p ) * 255 );
		const a = parts[ 3 ] === undefined ? 1 : parseFloat( parts[ 3 ] );
		if ( [ r, g, b, a ].some( n => Number.isNaN( n ) ) ) return null;
		return { r, g, b, a };
	}

	if ( v === 'transparent' ) return { r: 0, g: 0, b: 0, a: 0 };
	return null;
};

/** Composite a colour over an opaque backdrop (source-over), so alpha is honoured. */
export const compositeOver = ( top: Rgba, base: Rgba ): Rgba => ( {
	r: top.r * top.a + base.r * ( 1 - top.a ),
	g: top.g * top.a + base.g * ( 1 - top.a ),
	b: top.b * top.a + base.b * ( 1 - top.a ),
	a: 1,
} );

/** WCAG 2.x relative luminance. */
export const luminance = ( { r, g, b }: Rgba ): number => {
	const channel = ( c: number ): number => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ( ( s + 0.055 ) / 1.055 ) ** 2.4;
	};
	return 0.2126 * channel( r ) + 0.7152 * channel( g ) + 0.0722 * channel( b );
};

/** WCAG 2.x contrast ratio, 1–21. Both colours must already be opaque. */
export const contrastRatio = ( fg: Rgba, bg: Rgba ): number => {
	const a = luminance( fg );
	const b = luminance( bg );
	return ( Math.max( a, b ) + 0.05 ) / ( Math.min( a, b ) + 0.05 );
};

/**
 * The strongest WCAG level a ratio clears for body-size text. `AA Large` is the
 * 3:1 step that only applies at 18.66px bold / 24px regular and up, so it is
 * reported by name rather than being allowed to read as a pass.
 */
export const contrastGrade = ( ratio: number ): 'AAA' | 'AA' | 'AA Large' | 'Fail' => {
	if ( ratio >= 7 ) return 'AAA';
	if ( ratio >= 4.5 ) return 'AA';
	if ( ratio >= 3 ) return 'AA Large';
	return 'Fail';
};

/**
 * Split a CSS argument list on top-level commas — `clamp(1rem, 2vw, 3rem)`'s three
 * terms, without cutting inside a nested `calc(a, b)` or `min(…)`. Returns the trimmed
 * terms; a list with unbalanced parens comes back as a single term rather than nonsense.
 */
export const splitTopLevel = ( list: string ): string[] => {
	const out: string[] = [];
	let depth = 0;
	let current = '';

	for ( const char of list ) {
		if ( char === '(' ) depth++;
		else if ( char === ')' ) depth--;

		if ( char === ',' && depth === 0 ) {
			out.push( current.trim() );
			current = '';
			continue;
		}
		current += char;
	}
	out.push( current.trim() );

	return depth === 0 ? out : [ list.trim() ];
};

/** The three terms of a `clamp(min, preferred, max)`, or null for anything else. */
export const parseClamp = ( value: string ): { min: string; max: string } | null => {
	const match = value.trim().match( /^clamp\((.*)\)$/is );
	if ( ! match ) return null;
	const terms = splitTopLevel( match[ 1 ] );
	return terms.length === 3 ? { min: terms[ 0 ], max: terms[ 2 ] } : null;
};

/* ── box-shadow parts ─────────────────────────────────────────────────────────
   A shadow is up to six decisions (inset, x, y, blur, spread, colour) hidden in
   one string, which is why the token rows offered a text field and nothing else.
   These split it into parts and put it back together again. */

export type ShadowParts = { inset: boolean; x: string; y: string; blur: string; spread: string; color: string };

/** Split on whitespace *outside* parens — `rgb(0 0 0 / 0.08)` is one token, not four. */
export const topLevelTokens = ( value: string ): string[] => {
	const out: string[] = [];
	let depth = 0;
	let current = '';

	for ( const char of value.trim() ) {
		if ( char === '(' ) depth++;
		else if ( char === ')' ) depth--;

		if ( /\s/.test( char ) && depth === 0 ) {
			if ( current !== '' ) out.push( current );
			current = '';
			continue;
		}
		current += char;
	}
	if ( current !== '' ) out.push( current );

	return out;
};

const LENGTH_RE = /^[+-]?(\d*\.\d+|\d+)(px|rem|em|%|vw|vh|ch|pt)?$/i;
const isShadowLength = ( token: string ): boolean =>
	LENGTH_RE.test( token ) || /^(calc|min|max|clamp)\(/i.test( token );

/**
 * One shadow layer as its parts. Null for anything this cannot take apart and put
 * back together unchanged — several comma-separated layers, or a token order it
 * does not recognise — so the caller can fall back to editing the text rather than
 * quietly rewriting someone's value.
 */
export const parseShadow = ( value: string ): ShadowParts | null => {
	const trimmed = value.trim();
	if ( trimmed === '' || trimmed.toLowerCase() === 'none' ) return null;
	if ( splitTopLevel( trimmed ).length > 1 ) return null;  // multi-layer

	const tokens = topLevelTokens( trimmed );
	const inset = tokens.some( t => t.toLowerCase() === 'inset' );
	const rest = tokens.filter( t => t.toLowerCase() !== 'inset' );

	const lengths = rest.filter( isShadowLength );
	const colors = rest.filter( t => ! isShadowLength( t ) );
	// Two to four lengths and at most one colour is the whole of the grammar we edit.
	if ( lengths.length < 2 || lengths.length > 4 || colors.length > 1 ) return null;
	if ( lengths.length + colors.length !== rest.length ) return null;

	return {
		inset,
		x: lengths[ 0 ],
		y: lengths[ 1 ],
		blur: lengths[ 2 ] ?? '',
		spread: lengths[ 3 ] ?? '',
		color: colors[ 0 ] ?? '',
	};
};

/** Parts back to a value. A spread with no blur needs the blur slot filled to keep its place. */
export const formatShadow = ( parts: ShadowParts ): string => {
	const blur = parts.blur.trim() === '' && parts.spread.trim() !== '' ? '0' : parts.blur.trim();
	return [
		parts.inset ? 'inset' : '',
		parts.x.trim() || '0',
		parts.y.trim() || '0',
		blur,
		parts.spread.trim(),
		parts.color.trim(),
	].filter( part => part !== '' ).join( ' ' );
};

/* ── gradients ────────────────────────────────────────────────────────────────
   A gradient is a kind (linear / radial / conic), an optional geometry (angle,
   side-or-corner, shape, position) and a list of colour stops. Editing that as
   one string means retyping the whole thing to move a stop. */

export type GradientKind = 'linear' | 'radial' | 'conic';
/**
 * One entry in the stop list. `pos2` is the second position of a double-position stop
 * (`orange 10% 30%`), which paints a hard band rather than a ramp. A stop with no colour
 * at all is a colour hint (`red, 20%, blue`) — the point where the midpoint of the blend
 * is moved to. Both are ordinary CSS and both are editable here.
 */
export type GradientStop = { color: string; pos: string; pos2?: string };
export type GradientParts = { kind: GradientKind; repeating: boolean; geometry: string; stops: GradientStop[] };

/** The geometry each kind starts life with when you switch to it. */
export const GRADIENT_GEOMETRY: Record< GradientKind, string > = {
	linear: '180deg',
	radial: 'circle at 50% 50%',
	conic: 'from 0deg at 50% 50%',
};

// Whatever leads the argument list and is not a colour stop: `135deg`, `to bottom right`,
// `circle closest-side at 20% 30%`, `from 90deg at center`.
const GEOMETRY_RE = /^(to\s|from\s|at\s|circle\b|ellipse\b|[+-]?[\d.]+(deg|rad|grad|turn)\b|closest-|farthest-)/i;
// A unitless number is not a length, so it is not a stop position — except zero, which is.
const STOP_POS_RE = /^([+-]?0(\.0+)?|[+-]?[\d.]+(px|rem|em|%|vw|vh|deg|rad|grad|turn)|calc\(.*\))$/i;

/** Is this a legal colour-stop position? Exported so the editor can refuse what it cannot store. */
export const isGradientPosition = ( value: string ): boolean => STOP_POS_RE.test( value.trim() );

/**
 * A gradient as its parts, or null for anything these fields cannot rebuild exactly —
 * a value that is not a single gradient function, or a stop list we cannot read. The
 * caller then leaves the author's text alone.
 */
export const parseGradient = ( value: string ): GradientParts | null => {
	const match = value.trim().match( /^(repeating-)?(linear|radial|conic)-gradient\((.*)\)$/is );
	if ( ! match ) return null;

	const args = splitTopLevel( match[ 3 ] ).filter( a => a !== '' );
	if ( args.length === 0 ) return null;

	const geometry = GEOMETRY_RE.test( args[ 0 ] ) ? args[ 0 ] : '';
	const stopArgs = geometry === '' ? args : args.slice( 1 );

	const stops: GradientStop[] = [];
	for ( const arg of stopArgs ) {
		const tokens = topLevelTokens( arg );
		const positions = tokens.slice( 1 );

		// A lone position is a colour hint, not a stop: `red, 20%, blue`.
		if ( tokens.length === 1 && STOP_POS_RE.test( tokens[ 0 ] ) ) {
			stops.push( { color: '', pos: tokens[ 0 ] } );
			continue;
		}
		// `<color>`, `<color> <pos>`, `<color> <pos> <pos>` — the last paints a hard band.
		if ( tokens.length > 3 || ! positions.every( p => STOP_POS_RE.test( p ) ) ) return null;
		stops.push( { color: tokens[ 0 ], pos: positions[ 0 ] ?? '', pos2: positions[ 1 ] ?? '' } );
	}

	// Hints are not stops: two actual colours is still the minimum.
	if ( stops.filter( stop => stop.color !== '' ).length < 2 ) return null;

	return { kind: match[ 2 ].toLowerCase() as GradientKind, repeating: match[ 1 ] !== undefined, geometry, stops };
};

/** Parts back to a value. */
export const formatGradient = ( parts: GradientParts ): string => {
	const args = [
		parts.geometry.trim(),
		...parts.stops.map( stop => [ stop.color.trim(), stop.pos.trim(), ( stop.pos2 ?? '' ).trim() ].filter( part => part !== '' ).join( ' ' ) ),
	].filter( arg => arg !== '' );

	return `${ parts.repeating ? 'repeating-' : '' }${ parts.kind }-gradient(${ args.join( ', ' ) })`;
};

/* ── transition parts ─────────────────────────────────────────────────────────
   `all 200ms ease` is four decisions — what animates, how long, on what curve,
   after what wait — and the order of the two time values is what tells duration
   from delay. Editing that as one string is where the delay silently becomes the
   duration, so the row takes it apart. */

export type TransitionParts = { property: string; duration: string; timing: string; delay: string };

const TIME_RE = /^-?(\d*\.)?\d+(ms|s)$/i;
export const isTimeValue = ( v: string ): boolean => TIME_RE.test( v.trim() );

// The keyword curves plus the three functional ones. `linear()` is the newer easing
// function, not the `linear` keyword — both are valid and both are accepted here.
const TIMING_KEYWORDS = new Set( [
	'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end',
] );
export const isTimingValue = ( v: string ): boolean => {
	const value = v.trim().toLowerCase();
	if ( TIMING_KEYWORDS.has( value ) ) return true;
	return /^(cubic-bezier|steps|linear)\(/.test( value ) && balancedParens( value );
};

/**
 * Take a single transition apart. A comma-separated list is several transitions and
 * has no single set of parts, so it stays text — as does anything with a token these
 * fields would not put back where they found it.
 */
export const parseTransition = ( value: string ): TransitionParts | null => {
	const trimmed = value.trim();
	if ( trimmed === '' || trimmed.toLowerCase() === 'none' ) return null;
	if ( splitTopLevel( trimmed ).length > 1 ) return null;

	const tokens = topLevelTokens( trimmed );
	if ( tokens.length === 0 || tokens.length > 4 ) return null;

	const times: string[] = [];
	const timings: string[] = [];
	const names: string[] = [];
	for ( const token of tokens ) {
		if ( isTimeValue( token ) ) times.push( token );
		else if ( isTimingValue( token ) ) timings.push( token );
		else names.push( token );
	}
	// Order is the grammar: first time is the duration, second the delay. More than one
	// of anything else means this is not a shape these four fields can rebuild.
	if ( times.length > 2 || timings.length > 1 || names.length > 1 ) return null;
	if ( names.length === 1 && ! /^(-{2}[\w-]+|[a-z-]+)$/i.test( names[ 0 ] ) ) return null;

	return {
		property: names[ 0 ] ?? '',
		duration: times[ 0 ] ?? '',
		timing: timings[ 0 ] ?? '',
		delay: times[ 1 ] ?? '',
	};
};

/**
 * Put one back together. A delay with no duration cannot be written — the first time
 * value in the string is always read as the duration — so it emits an explicit `0s`
 * rather than a string that means something else than what the fields say.
 */
export const formatTransition = ( parts: TransitionParts ): string => {
	const delay = parts.delay.trim();
	const duration = parts.duration.trim() || ( delay === '' ? '' : '0s' );
	return [ parts.property.trim(), duration, parts.timing.trim(), delay ]
		.filter( part => part !== '' )
		.join( ' ' );
};

/* ── transform readout ────────────────────────────────────────────────────────
   `translateY(-2px)` on a plain square looks like nothing at all, so the row draws
   the box where it would have been and reports the move in words. The browser hands
   back a matrix, not the authored functions, so the words come from the matrix — what
   the element actually does, not what the string claims. */

/** Describe a computed `transform` matrix in plain terms: `up 2px · scale 1.05`. */
export const describeTransform = ( computed: string ): string => {
	const value = computed.trim();
	if ( value === '' || value === 'none' ) return '';

	const match = /^matrix(3d)?\(([^)]*)\)$/i.exec( value );
	if ( ! match ) return value;
	const n = match[ 2 ].split( ',' ).map( part => Number( part.trim() ) );
	if ( n.some( part => ! Number.isFinite( part ) ) ) return value;

	// matrix3d is 4×4 in column order; the 2D parts sit at 0,1,4,5,12,13.
	const [ a, b, c, d, e, f ] = match[ 1 ]
		? [ n[ 0 ], n[ 1 ], n[ 4 ], n[ 5 ], n[ 12 ], n[ 13 ] ]
		: n;
	if ( [ a, b, c, d, e, f ].some( part => part === undefined ) ) return value;

	const round = ( x: number ): number => Math.round( x * 1000 ) / 1000;
	const scaleX = round( Math.hypot( a, b ) );
	const scaleY = round( Math.hypot( c, d ) );
	const rotate = round( ( Math.atan2( b, a ) * 180 ) / Math.PI );

	const out: string[] = [];
	if ( e ) out.push( `${ e < 0 ? 'left' : 'right' } ${ Math.abs( round( e ) ) }px` );
	if ( f ) out.push( `${ f < 0 ? 'up' : 'down' } ${ Math.abs( round( f ) ) }px` );
	if ( scaleX !== 1 || scaleY !== 1 ) {
		out.push( scaleX === scaleY ? `scale ${ scaleX }` : `scale ${ scaleX }×${ scaleY }` );
	}
	if ( rotate ) out.push( `rotate ${ rotate }°` );

	return out.join( ' · ' );
};

/* ── focus rings ──────────────────────────────────────────────────────────────
   A ring is a box-shadow, but not a shadow-shaped one: x, y and blur are zero in
   every ring worth having, and the two decisions that matter — how thick, and how
   far off the control it sits — are the spread of one layer and the difference
   between the spreads of two. That is why editing one as `0 0 0 3px rgba(…)` reads
   as arithmetic rather than as design. */

export type RingParts = {
	thickness: string;
	offset: string;       // the gap between the control and the ring: an inner layer
	offsetColor: string;  // what shows in that gap — usually the page background
	blur: string;         // 0 for a ring, non-zero for a glow
	color: string;
};

const LEN_RE = /^([+-]?[\d.]+)([a-z%]*)$/i;
const lenParts = ( value: string ): { n: number; unit: string } | null => {
	const match = LEN_RE.exec( value.trim() );
	if ( ! match ) return null;
	const n = Number( match[ 1 ] );
	return Number.isFinite( n ) ? { n, unit: match[ 2 ] || ( n === 0 ? '' : 'px' ) } : null;
};

/** `5px` − `2px`. Null unless both are plain lengths in one unit — no guessing across units. */
const lenDiff = ( a: string, b: string ): string | null => {
	const left = lenParts( a );
	const right = lenParts( b );
	if ( ! left || ! right ) return null;
	if ( left.unit !== right.unit && left.n !== 0 && right.n !== 0 ) return null;
	const unit = left.unit || right.unit;
	const value = Math.round( ( left.n - right.n ) * 1000 ) / 1000;
	return value === 0 ? '0' : `${ value }${ unit }`;
};

const lenSum = ( a: string, b: string ): string | null => {
	const left = lenParts( a );
	const right = lenParts( b );
	if ( ! left || ! right ) return null;
	if ( left.unit !== right.unit && left.n !== 0 && right.n !== 0 ) return null;
	const unit = left.unit || right.unit;
	const value = Math.round( ( left.n + right.n ) * 1000 ) / 1000;
	return value === 0 ? '0' : `${ value }${ unit }`;
};

export const isZeroLength = ( value: string ): boolean => {
	const parsed = lenParts( value );
	return value.trim() === '' || ( parsed !== null && parsed.n === 0 );
};

/**
 * A ring as thickness, offset and colour. Both shapes a ring comes in are read:
 * one layer (`0 0 0 3px blue`) and the offset pair (`0 0 0 2px #fff, 0 0 0 5px blue`),
 * where the inner layer paints the gap and the outer spread is the *total* — so the
 * ring you see is the difference, which is the sum nobody wants to do by hand.
 * Anything else (an inset ring, a shifted one, three layers) stays text.
 */
export const parseRing = ( value: string ): RingParts | null => {
	const layers = splitTopLevel( value.trim() );
	if ( layers.length === 0 || layers.length > 2 ) return null;

	const parsed = layers.map( parseShadow );
	if ( parsed.some( layer => layer === null ) ) return null;
	const shadows = parsed as ShadowParts[];
	// A ring surrounds its control: no offset in x or y, and never inset.
	if ( shadows.some( layer => layer.inset || ! isZeroLength( layer.x ) || ! isZeroLength( layer.y ) ) ) return null;

	if ( shadows.length === 1 ) {
		const [ only ] = shadows;
		return {
			thickness: only.spread || '0',
			offset: '0',
			offsetColor: '',
			blur: isZeroLength( only.blur ) ? '' : only.blur,
			color: only.color,
		};
	}

	const [ inner, outer ] = shadows;
	// The gap layer is a flat band; a blurred one is two glows, not a ring with a gap.
	if ( ! isZeroLength( inner.blur ) ) return null;
	const thickness = lenDiff( outer.spread, inner.spread );
	if ( thickness === null || ( lenParts( thickness )?.n ?? 0 ) <= 0 ) return null;

	return {
		thickness,
		offset: inner.spread || '0',
		offsetColor: inner.color,
		blur: isZeroLength( outer.blur ) ? '' : outer.blur,
		color: outer.color,
	};
};

/** Parts back to a value: one layer with no offset, the gap pair with one. */
export const formatRing = ( parts: RingParts ): string => {
	const thickness = parts.thickness.trim() || '0';
	const blur = parts.blur.trim() && ! isZeroLength( parts.blur ) ? parts.blur.trim() : '0';
	const outerColor = parts.color.trim();

	if ( isZeroLength( parts.offset ) ) {
		return [ '0 0', blur, thickness, outerColor ].filter( part => part !== '' ).join( ' ' );
	}

	const offset = parts.offset.trim();
	const total = lenSum( offset, thickness );
	const gap = [ '0 0 0', offset, parts.offsetColor.trim() ].filter( part => part !== '' ).join( ' ' );
	const ring = [ '0 0', blur, total ?? thickness, outerColor ].filter( part => part !== '' ).join( ' ' );
	return `${ gap }, ${ ring }`;
};

/** What a rendered ring measures, in the browser's own pixels: `2px gap · 3px`. */
export const describeRing = ( computed: string ): string => {
	const parts = parseRing( computed );
	if ( ! parts ) return '';
	return [
		isZeroLength( parts.offset ) ? '' : `${ parts.offset } gap`,
		parts.thickness,
		parts.blur ? `${ parts.blur } soft` : '',
	].filter( part => part !== '' ).join( ' · ' );
};

/* ── border shorthands ────────────────────────────────────────────────────────
   `borderStyle.solid` is not a style keyword, whatever the category is called:
   it is stored as `1px solid #111827`, a whole border. Three decisions in one
   string, and the one the token is named after is the middle word. */

export const BORDER_STYLES = [
	'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset', 'hidden', 'none',
] as const;

export type BorderParts = { width: string; style: string; color: string };

/** A border shorthand as width · style · colour. Null for anything with a token spare. */
export const parseBorder = ( value: string ): BorderParts | null => {
	const trimmed = value.trim();
	if ( trimmed === '' ) return null;
	if ( splitTopLevel( trimmed ).length > 1 ) return null;

	const tokens = topLevelTokens( trimmed );
	if ( tokens.length === 0 || tokens.length > 3 ) return null;

	const styles = tokens.filter( token => ( BORDER_STYLES as readonly string[] ).includes( token.toLowerCase() ) );
	const rest = tokens.filter( token => ! ( BORDER_STYLES as readonly string[] ).includes( token.toLowerCase() ) );

	// A `var()` could be either a width or a colour, and putting one back in the wrong slot
	// would rewrite someone's border. Our own token names say which; anything else is left
	// to the text field rather than guessed at.
	const widths: string[] = [];
	const colors: string[] = [];
	for ( const token of rest ) {
		if ( /^var\(/i.test( token ) ) {
			if ( /--[\w-]*width/i.test( token ) ) widths.push( token );
			else if ( /--[\w-]*colou?r/i.test( token ) ) colors.push( token );
			else return null;
			continue;
		}
		( isShadowLength( token ) ? widths : colors ).push( token );
	}
	if ( styles.length > 1 || widths.length > 1 || colors.length > 1 ) return null;

	return { width: widths[ 0 ] ?? '', style: styles[ 0 ] ?? '', color: colors[ 0 ] ?? '' };
};

/** Parts back to a shorthand, in the order CSS reads them. */
export const formatBorder = ( parts: BorderParts ): string =>
	[ parts.width.trim(), parts.style.trim(), parts.color.trim() ].filter( part => part !== '' ).join( ' ' );

/**
 * The number an `aspect-ratio` comes out as. `16 / 9`, `16/9` and `1.7778` are the same
 * shape written three ways, and only the number says which is wider than which. Null for
 * anything with no single ratio — a `var()`, a `min()`, an `auto` fallback.
 */
export const aspectRatioOf = ( value: string ): number | null => {
	const match = /^([\d.]+)(?:\s*\/\s*([\d.]+))?$/.exec( value.trim() );
	if ( ! match ) return null;
	const width = Number( match[ 1 ] );
	const height = match[ 2 ] === undefined ? 1 : Number( match[ 2 ] );
	if ( ! Number.isFinite( width ) || ! Number.isFinite( height ) || height === 0 ) return null;
	return width / height;
};

/**
 * How many entries actually differ between a draft and what is saved. The screen was counting
 * the size of the whole draft — which is seeded from the saved overrides — so a single edit on
 * top of four saved overrides reported "5 tokens changed · unsaved", four of which were saved.
 * Keys on either side count: clearing an override is a change too.
 */
export const countRecordChanges = (
	draft: Record< string, string | number | undefined >,
	saved: Record< string, string | number | undefined >
): number => {
	const keys = new Set( [ ...Object.keys( draft ), ...Object.keys( saved ) ] );
	let changed = 0;
	for ( const key of keys ) {
		if ( draft[ key ] !== saved[ key ] ) changed++;
	}
	return changed;
};

/**
 * How many design-system values this install has moved off the theme's own. Drives the
 * Overview setup step, so it reads PERSISTED overrides — a draft the user has not saved is
 * not progress. Counting against `{}` reuses the same comparison the editor uses for its
 * change badges, so the two can never disagree about what counts as a change.
 */
export const countOverrides = ( overrides: DesignOverrides ): number =>
	countNestedChanges( overrides.tokens as Record< string, Record< string, string > >, {} ) +
	countNestedChanges( overrides.typeRoles, {} ) +
	countRecordChanges( overrides.breakpoints, {} );

/** The same, one level deeper: categories of tokens, or roles of type properties. */
export const countNestedChanges = (
	draft: Record< string, Record< string, string > | undefined >,
	saved: Record< string, Record< string, string > | undefined >
): number => {
	const categories = new Set( [ ...Object.keys( draft ), ...Object.keys( saved ) ] );
	let changed = 0;
	for ( const category of categories ) {
		changed += countRecordChanges( draft[ category ] ?? {}, saved[ category ] ?? {} );
	}
	return changed;
};
