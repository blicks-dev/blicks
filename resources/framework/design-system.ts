/**
 * Design-system data layer for the editor-side Theme Settings panel.
 *
 * Pure types + helpers around the `GET/PATCH blicks/v1/design-system` snapshot:
 * defensive normalization, draft-override diffing, and the draft CSS-variable
 * block injected for live preview.
 *
 * Editor-bundle only. The admin entry (`resources/admin/app.tsx`) keeps its own
 * copy of the snapshot plumbing — importing this module from both entries would
 * make Rollup split it into `build/chunks/`, which classic WP scripts can't load.
 */

import tokenCatalogue from '@/design-system/tokens.json';

/**
 * Every token category the snapshot can carry, derived from the shared catalogue
 * (`resources/design-system/tokens.json` — the same file `src/Style/Tokens.php` reads) so this
 * list cannot drift behind a newly added category.
 *
 * Drift here is not cosmetic: {@link normalizeOverrides} keeps only the categories it knows and
 * the sidebar PATCHes the whole override bag back, so an unknown category would be silently
 * dropped from the payload and wiped from the saved theme on the next save.
 */
export const TOKEN_CATEGORIES = Object.keys( tokenCatalogue ) as ( keyof typeof tokenCatalogue )[];

export type TokenCategory = keyof typeof tokenCatalogue;
export type TokenValues = Record< TokenCategory, Record< string, string > >;
export type TokenOverrides = Partial< Record< TokenCategory, Record< string, string > > >;
export type DesignOverrides = {
	tokens: TokenOverrides;
	breakpoints: Record< string, number >;
	typeRoles: TypeRoleOverrides;
};
export type Breakpoint = { id: string; label: string; max: number | null };

/** Semantic typography roles — composite per-content-type looks layered over the fontSize scale. */
export type TypeRoleValues = Record< string, Record< string, string > >;
export type TypeRoleOverrides = Record< string, Record< string, string > >;
export type TypeRoleSlot = {
	kind: 'native' | 'custom';
	stylesPath?: string[];
	settingsGroup?: string[];
};
export type TypeRoleSnapshot = {
	roles: string[];
	props: string[];
	slots: Record< string, TypeRoleSlot >;
	base: TypeRoleValues;
	values: TypeRoleValues;
};

export type FontFamily = {
	slug: string;
	name: string;
	fontFamily: string;
	source: string;
};

export type DesignSystemSnapshot = {
	source: { theme: string; themeJson: boolean; globalStyles: boolean };
	tokens: Record< TokenCategory, readonly string[] >;
	baseValues: TokenValues;
	values: TokenValues;
	overrides: DesignOverrides;
	breakpoints: Breakpoint[];
	fontLibrary: FontFamily[];
	typeRoles: TypeRoleSnapshot;
};

/** A saved design theme — a named snapshot of the whole override bag (see `DesignThemes` in PHP). */
export type DesignThemeTokens = {
	tokens: TokenOverrides;
	breakpoints: Record< string, number >;
	typeRoles: TypeRoleOverrides;
};
export type DesignTheme = { id: string; name: string; builtin: boolean; edited: boolean; tokens: DesignThemeTokens };
export type ThemesState = { active: string; themes: DesignTheme[] };

export function tokenVar( category: string, slug: string ): string {
	return `--blicks-${ category }-${ slug }`;
}

export function titleCase( value: string ): string {
	return value
		.split( '-' )
		.map( part => part.charAt( 0 ).toUpperCase() + part.slice( 1 ) )
		.join( ' ' );
}

/** Strict-shape the API snapshot; null means "not a usable snapshot". */
export function normalizeSnapshot( value: unknown ): DesignSystemSnapshot | null {
	if ( typeof value !== 'object' || value === null ) {
		return null;
	}

	const data = value as Partial< DesignSystemSnapshot >;

	return {
		source: {
			theme: typeof data.source?.theme === 'string' ? data.source.theme : 'active',
			themeJson: Boolean( data.source?.themeJson ),
			globalStyles: Boolean( data.source?.globalStyles ),
		},
		tokens: mapCategories( category => stringList( data.tokens?.[ category ] ) ),
		baseValues: mapCategories( category => stringRecord( data.baseValues?.[ category ] ) ),
		values: mapCategories( category => stringRecord( data.values?.[ category ] ) ),
		overrides: normalizeOverrides( data.overrides ),
		breakpoints: Array.isArray( data.breakpoints ) ? data.breakpoints.filter( isBreakpoint ) : [],
		fontLibrary: Array.isArray( data.fontLibrary ) ? data.fontLibrary.filter( isFontFamily ) : [],
		typeRoles: normalizeTypeRoles( data.typeRoles ),
	};
}

/**
 * Strict-shape `GET blicks/v1/design-system/themes`. The create/delete/apply responses return the
 * same envelope (or a bare list), so one normalizer covers every call site.
 */
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
				tokens: normalizeOverrides( { tokens: bag.tokens } ).tokens,
				breakpoints: numberRecord( bag.breakpoints ),
				typeRoles: nestedStringRecord( bag.typeRoles ),
			},
		} );
	}

	return { active: typeof data.active === 'string' ? data.active : '', themes };
}

function normalizeTypeRoles( value: unknown ): TypeRoleSnapshot {
	const data = ( typeof value === 'object' && value !== null ? value : {} ) as Partial< TypeRoleSnapshot >;

	return {
		roles: stringList( data.roles ).slice(),
		props: stringList( data.props ).slice(),
		slots: normalizeSlots( data.slots ),
		base: nestedStringRecord( data.base ),
		values: nestedStringRecord( data.values ),
	};
}

function normalizeSlots( value: unknown ): Record< string, TypeRoleSlot > {
	if ( typeof value !== 'object' || value === null ) {
		return {};
	}

	const slots: Record< string, TypeRoleSlot > = {};
	for ( const [ role, raw ] of Object.entries( value ) ) {
		if ( typeof raw !== 'object' || raw === null ) continue;
		const candidate = raw as Partial< TypeRoleSlot >;
		const kind = candidate.kind === 'custom' ? 'custom' : 'native';
		slots[ role ] = {
			kind,
			...( Array.isArray( candidate.stylesPath ) ? { stylesPath: stringList( candidate.stylesPath ).slice() } : {} ),
			...( Array.isArray( candidate.settingsGroup ) ? { settingsGroup: stringList( candidate.settingsGroup ).slice() } : {} ),
		};
	}

	return slots;
}

/** Defensively shape a `{ role: { prop: value } }` map. */
function nestedStringRecord( value: unknown ): TypeRoleValues {
	if ( typeof value !== 'object' || value === null ) {
		return {};
	}

	const out: TypeRoleValues = {};
	for ( const [ role, props ] of Object.entries( value ) ) {
		const entries = stringRecord( props );
		if ( Object.keys( entries ).length > 0 ) {
			out[ role ] = entries;
		}
	}

	return out;
}

function isFontFamily( value: unknown ): value is FontFamily {
	if ( typeof value !== 'object' || value === null ) return false;
	const candidate = value as Partial< FontFamily >;
	return typeof candidate.slug === 'string'
		&& typeof candidate.name === 'string'
		&& typeof candidate.fontFamily === 'string'
		&& typeof candidate.source === 'string';
}

function normalizeOverrides( value: unknown ): DesignOverrides {
	if ( typeof value !== 'object' || value === null ) {
		return { tokens: {}, breakpoints: {}, typeRoles: {} };
	}

	const data = value as Partial< DesignOverrides >;
	const rawTokens = data.tokens && typeof data.tokens === 'object' ? data.tokens : {};
	const tokens: TokenOverrides = {};

	for ( const category of TOKEN_CATEGORIES ) {
		const entries = stringRecord( ( rawTokens as Record< string, unknown > )[ category ] );
		if ( Object.keys( entries ).length > 0 ) {
			tokens[ category ] = entries;
		}
	}

	return { tokens, breakpoints: numberRecord( data.breakpoints ), typeRoles: nestedStringRecord( data.typeRoles ) };
}

function mapCategories< T >( build: ( category: TokenCategory ) => T ): Record< TokenCategory, T > {
	return Object.fromEntries( TOKEN_CATEGORIES.map( category => [ category, build( category ) ] ) ) as Record< TokenCategory, T >;
}

function stringList( value: unknown ): readonly string[] {
	return Array.isArray( value ) ? value.filter( ( item ): item is string => typeof item === 'string' ) : [];
}

function stringRecord( value: unknown ): Record< string, string > {
	if ( typeof value !== 'object' || value === null ) {
		return {};
	}

	return Object.fromEntries(
		Object.entries( value ).filter( ( entry ): entry is [ string, string ] => typeof entry[ 1 ] === 'string' )
	);
}

function numberRecord( value: unknown ): Record< string, number > {
	if ( typeof value !== 'object' || value === null ) {
		return {};
	}

	return Object.fromEntries(
		Object.entries( value ).filter( ( entry ): entry is [ string, number ] => typeof entry[ 1 ] === 'number' )
	);
}

function isBreakpoint( value: unknown ): value is Breakpoint {
	if ( typeof value !== 'object' || value === null ) return false;
	const candidate = value as Partial< Breakpoint >;
	return typeof candidate.id === 'string'
		&& typeof candidate.label === 'string'
		&& ( typeof candidate.max === 'number' || candidate.max === null );
}

/** Count entries that differ between a draft record and its saved counterpart. */
export function countRecordChanges(
	draft: Record< string, string | number >,
	saved: Record< string, string | number >
): number {
	const keys = new Set( [ ...Object.keys( draft ), ...Object.keys( saved ) ] );
	let changes = 0;

	for ( const key of keys ) {
		if ( draft[ key ] !== saved[ key ] ) {
			changes += 1;
		}
	}

	return changes;
}

export function countTokenChanges( draft: TokenOverrides, saved: TokenOverrides ): number {
	let changes = 0;

	for ( const category of TOKEN_CATEGORIES ) {
		changes += countRecordChanges( draft[ category ] ?? {}, saved[ category ] ?? {} );
	}

	return changes;
}

export function countTypeRoleChanges( draft: TypeRoleOverrides, saved: TypeRoleOverrides ): number {
	let changes = 0;
	const roles = new Set( [ ...Object.keys( draft ), ...Object.keys( saved ) ] );

	for ( const role of roles ) {
		changes += countRecordChanges( draft[ role ] ?? {}, saved[ role ] ?? {} );
	}

	return changes;
}

/**
 * CSS for live-previewing draft overrides: every slug touched by the draft *or*
 * by a saved override is pinned — draft value when set, otherwise the theme base
 * value (so resetting a saved override previews the revert too). Returns '' when
 * there is nothing to pin.
 */
export function buildPreviewVars( draft: TokenOverrides, saved: TokenOverrides, baseValues: TokenValues ): string {
	const lines: string[] = [];

	for ( const category of TOKEN_CATEGORIES ) {
		const slugs = new Set( [ ...Object.keys( draft[ category ] ?? {} ), ...Object.keys( saved[ category ] ?? {} ) ] );

		for ( const slug of slugs ) {
			const value = sanitizeCssValue( draft[ category ]?.[ slug ] ?? baseValues[ category ]?.[ slug ] ?? '' );
			if ( value === '' ) continue;
			lines.push( `\t${ tokenVar( sanitizeCssName( category ), sanitizeCssName( slug ) ) }: ${ value };` );
		}
	}

	return lines.length > 0 ? `:root {\n${ lines.join( '\n' ) }\n}` : '';
}

/**
 * camelCase → kebab-case. Mirrors `TypeRoles::kebabProp()` in PHP so the var names the preview
 * pins match the ones `CssVariables` emits byte-for-byte.
 */
export function kebabProp( prop: string ): string {
	return prop.replace( /([a-z0-9])([A-Z])/g, '$1-$2' ).toLowerCase();
}

/**
 * The element a **native** type role occupies, derived from its theme.json `stylesPath`. Native
 * roles are already painted by WP's own element CSS, so pinning `--blicks-type-*` alone would
 * only preview the opt-in `.bl-type--{role}` class — not a plain `<h2>` in the canvas.
 */
function nativeRoleSelector( slot: TypeRoleSlot | undefined ): string | null {
	const path = slot?.kind === 'native' ? slot.stylesPath ?? [] : [];

	// Root typography (the `body` role) — WP emits it at `:root`.
	if ( path.length === 1 && path[ 0 ] === 'typography' ) {
		return ':root body';
	}

	if ( path.length === 3 && path[ 0 ] === 'elements' && path[ 2 ] === 'typography' ) {
		const element = sanitizeCssName( path[ 1 ] );
		if ( element === '' ) return null;
		// WP has no `<caption>` element — it styles the figure caption class instead.
		return element === 'caption' ? ':root figcaption, :root .wp-element-caption' : `:root ${ element }`;
	}

	return null;
}

/**
 * CSS for live-previewing draft **type-role** edits: the `--blicks-type-{role}-{prop}` aliases
 * (what `.bl-type--{role}` and the custom roles read) plus, for native roles, a real declaration
 * block on their element.
 *
 * The element rules are deliberately `:root {element}` — specificity (0,1,1) — so they beat the
 * `:root :where({element})` (0,1,0) that WordPress emits for theme.json element styles. Without
 * that, editing H2 here would preview on nothing but a Blicks block that opted into the role.
 *
 * Same "pin everything touched" rule as {@link buildPreviewVars}: a role prop that has a *saved*
 * override is pinned at its draft value, or at the theme base when the draft cleared it, so
 * resetting an override previews the revert instead of waiting for a reload.
 */
export function buildTypeRolePreview(
	draft: TypeRoleOverrides,
	saved: TypeRoleOverrides,
	base: TypeRoleValues,
	slots: Record< string, TypeRoleSlot >
): string {
	const vars: string[] = [];
	const blocks: string[] = [];
	const roles = new Set( [ ...Object.keys( draft ), ...Object.keys( saved ) ] );

	for ( const role of roles ) {
		const props = new Set( [ ...Object.keys( draft[ role ] ?? {} ), ...Object.keys( saved[ role ] ?? {} ) ] );
		const declarations: string[] = [];

		for ( const prop of props ) {
			const value = sanitizeCssValue( draft[ role ]?.[ prop ] ?? base[ role ]?.[ prop ] ?? '' );
			if ( value === '' ) continue;

			const cssProp = sanitizeCssName( kebabProp( prop ) );
			vars.push( `\t--blicks-type-${ sanitizeCssName( role ) }-${ cssProp }: ${ value };` );
			declarations.push( `\t${ cssProp }: ${ value };` );
		}

		const selector = nativeRoleSelector( slots[ role ] );
		if ( selector !== null && declarations.length > 0 ) {
			blocks.push( `${ selector } {\n${ declarations.join( '\n' ) }\n}` );
		}
	}

	if ( vars.length > 0 ) {
		blocks.unshift( `:root {\n${ vars.join( '\n' ) }\n}` );
	}

	return blocks.join( '\n' );
}

// Mirrors the conservative sanitization in src/DesignSystem/CssVariables.php.
function sanitizeCssName( value: string ): string {
	return value.replace( /[^a-zA-Z0-9_-]/g, '' );
}

function sanitizeCssValue( value: string ): string {
	// eslint-disable-next-line no-control-regex
	return value.trim().replace( /[\x00-\x1F\x7F]/g, '' ).replace( /[;{}<>]/g, '' );
}

/** WP ColorPicker (enableAlpha) emits #rrggbbaa — convert to a usable CSS value. */
export function hex8ToCssValue( value: string ): string {
	if ( ! /^#[0-9A-Fa-f]{8}$/.test( value ) ) {
		return value;
	}

	const alpha = parseInt( value.slice( 7, 9 ), 16 ) / 255;
	if ( alpha >= 0.995 ) {
		return value.slice( 0, 7 );
	}

	const num = parseInt( value.slice( 1, 7 ), 16 );
	const r = ( num >> 16 ) & 255;
	const g = ( num >> 8 ) & 255;
	const b = num & 255;

	return `rgba(${ r }, ${ g }, ${ b }, ${ Math.round( alpha * 100 ) / 100 })`;
}
