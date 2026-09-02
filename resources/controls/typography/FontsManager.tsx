/**
 * Self-hosted fonts manager. Wraps the native WordPress Font Library REST API
 * (`/wp/v2/font-families`, `/wp/v2/font-collections`) so installs land in
 * `uploads/fonts/` + theme.json's `typography.fontFamilies` — same path the
 * Site Editor uses. After every install/uninstall we refresh the Blicks
 * design-system snapshot so the typography selector + AI catalogue pick up
 * the new families without a reload.
 *
 * Mounted from the typography control's modal so the block inspector stays focused:
 * the component is self-contained and emits a `FONT_LIBRARY_CHANGED` event other
 * surfaces listen on.
 */
import apiFetch from '@wordpress/api-fetch';
import { dispatch, resolveSelect, select } from '@wordpress/data';
import { useEffect, useMemo, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import type { FontFamily } from '@/framework/design-system';
import { setFontLibrary, type FontFamilyEntry } from './font-library';
import {
	deleteFontFamily,
	getFontCollection,
	installFontFamilyWithFaces,
	listFontCollections,
	listFontFamilies,
	type FontCollection,
	type FontCollectionFamily,
	type FontFaceSettings,
	type FontFamilySettings,
	type InstalledFontFace,
	type InstalledFontFamily,
} from './font-rest';
import './fonts-manager.scss';

const SNAPSHOT_PATH = '/blicks/v1/design-system';
const DEFAULT_INSTALL_WEIGHT = '400';
const PREVIEW_TEXT = 'Everyone has the right to freedom of thought, conscience and religion';

type Tab = 'installed' | 'browse';
type SortMode = 'trending' | 'name';

/** Coerce snapshot.fontLibrary into a list usable by the font-library cache. */
async function refreshSnapshot(): Promise< void > {
	const snapshot = await apiFetch( { path: SNAPSHOT_PATH } ) as { fontLibrary?: FontFamily[] };
	const families = Array.isArray( snapshot?.fontLibrary ) ? snapshot.fontLibrary : [];
	const list: FontFamilyEntry[] = families
		.filter( ( entry: unknown ): entry is FontFamily => {
			if ( typeof entry !== 'object' || entry === null ) return false;
			const candidate = entry as Partial< FontFamily >;
			return typeof candidate.slug === 'string' && typeof candidate.fontFamily === 'string';
		} )
		.map( ( entry: FontFamily ) => ( {
			slug: entry.slug,
			name: typeof entry.name === 'string' ? entry.name : entry.slug,
			fontFamily: entry.fontFamily,
			source: typeof entry.source === 'string' ? entry.source : 'theme',
		} ) );
	setFontLibrary( list );
}

type ActiveFontFamily = FontFamilySettings & {
	fontFace?: FontFaceSettings[];
	source?: string;
};

type GlobalStylesRecord = {
	id?: number | string;
	settings?: {
		typography?: {
			fontFamilies?: {
				default?: ActiveFontFamily[];
				theme?: ActiveFontFamily[];
				custom?: ActiveFontFamily[];
			};
		};
	};
	styles?: Record< string, unknown >;
};

async function getCurrentGlobalStylesRecord(): Promise< GlobalStylesRecord | null > {
	const core = select( 'core' ) as {
		__experimentalGetCurrentGlobalStylesId?: () => number | string | undefined;
	};
	const id = core.__experimentalGetCurrentGlobalStylesId?.();
	if ( id === undefined || id === null || id === '' ) return null;

	const resolver = resolveSelect( 'core' ) as {
		getEntityRecord?: ( kind: string, name: string, key: number | string ) => Promise< GlobalStylesRecord | undefined >;
	};
	const record = await resolver.getEntityRecord?.( 'root', 'globalStyles', id );
	return record && typeof record === 'object' ? record : { id };
}

async function saveActiveFontFamilies(
	mergeCustom: ( current: ActiveFontFamily[] ) => ActiveFontFamily[],
): Promise< void > {
	const record = await getCurrentGlobalStylesRecord();
	if ( ! record?.id ) {
		throw new Error( __( 'Could not find the current Global Styles record.', 'blicks' ) );
	}

	const currentFamilies = record.settings?.typography?.fontFamilies ?? {};
	const nextFamilies = {
		...currentFamilies,
		custom: mergeCustom( Array.isArray( currentFamilies.custom ) ? currentFamilies.custom : [] ),
	};
	const nextRecord: GlobalStylesRecord = {
		...record,
		settings: {
			...( record.settings ?? {} ),
			typography: {
				...( record.settings?.typography ?? {} ),
				fontFamilies: nextFamilies,
			},
		},
	};

	const coreDispatch = dispatch( 'core' ) as {
		saveEntityRecord?: ( kind: string, name: string, record: GlobalStylesRecord ) => Promise< unknown >;
	};
	await coreDispatch.saveEntityRecord?.( 'root', 'globalStyles', nextRecord );
}

async function activateFontFamily( family: InstalledFontFamily, faces: InstalledFontFace[] ): Promise< void > {
	const settings = family.font_family_settings;
	const active: ActiveFontFamily = {
		name: settings.name,
		slug: settings.slug,
		fontFamily: settings.fontFamily,
		...( settings.preview ? { preview: settings.preview } : {} ),
		...( faces.length > 0 ? { fontFace: faces.map( ( face ) => face.font_face_settings ) } : {} ),
	};

	await saveActiveFontFamilies( ( current ) => [
		...current.filter( ( item ) => item.slug !== settings.slug ),
		active,
	] );
}

async function deactivateFontFamily( slug: string ): Promise< void > {
	await saveActiveFontFamilies( ( current ) => current.filter( ( item ) => item.slug !== slug ) );
}

function originForFamily( record: InstalledFontFamily ): 'theme' | 'user' {
	// theme.json origin lives on the post meta as `wp_theme_json_origin`; the controller
	// surfaces theme-baked families with a null parent + a slug present in the read-only
	// theme.json. We approximate from theme_json_version — created via the REST POST = user.
	const slug = record.font_family_settings?.slug ?? '';
	// User-installed families always have an id > 0 — the same fact the Site Editor uses
	// to gate the uninstall button. Theme-baked entries surface in the snapshot but not
	// the REST list, so anything we get here is user-installed.
	return record.id > 0 && slug !== '' ? 'user' : 'theme';
}

export interface FontsManagerProps {
	/** Compact mode trims headings + chrome for any future embedded surface. */
	compact?: boolean;
	/** Modal mode uses a wide preview-browser layout. */
	variant?: 'panel' | 'modal';
	/** Called when the user chooses a family for the current typography control. */
	onSelectFamily?: ( value: string ) => void;
}

export function FontsManager( { compact = false, variant = 'panel', onSelectFamily }: FontsManagerProps ): JSX.Element {
	const [ tab, setTab ] = useState< Tab >( 'browse' );
	const [ installed, setInstalled ] = useState< InstalledFontFamily[] >( [] );
	const [ collections, setCollections ] = useState< FontCollection[] >( [] );
	const [ activeCollection, setActiveCollection ] = useState< FontCollection | null >( null );
	const [ browseQuery, setBrowseQuery ] = useState( '' );
	const [ sortMode, setSortMode ] = useState< SortMode >( 'trending' );
	const [ loading, setLoading ] = useState( false );
	const [ pending, setPending ] = useState< string | null >( null );
	const [ notice, setNotice ] = useState< { kind: 'success' | 'error'; message: string } | null >( null );

	useEffect( () => {
		let alive = true;
		setLoading( true );
		( async () => {
			try {
				const [ families, cols ] = await Promise.all( [ listFontFamilies(), listFontCollections() ] );
				if ( ! alive ) return;
				setInstalled( families );
				setCollections( cols );
				if ( cols.length > 0 ) {
					const google = cols.find( ( c ) => c.slug === 'google-fonts' ) ?? cols[ 0 ];
					const full = await getFontCollection( google.slug );
					if ( alive ) setActiveCollection( full );
				}
			} catch ( err ) {
				if ( alive ) setNotice( { kind: 'error', message: errorMessage( err, 'Could not load fonts.' ) } );
			} finally {
				if ( alive ) setLoading( false );
			}
		} )();
		return () => {
			alive = false;
		};
	}, [] );

	const installedSlugs = useMemo( () => new Set( installed.map( ( f ) => f.font_family_settings?.slug ).filter( Boolean ) ), [ installed ] );

	const familyValue = ( slug: string ): string => `var(--wp--preset--font-family--${ slug })`;

	const browseResults = useMemo( () => {
		if ( ! activeCollection ) return [];
		const needle = browseQuery.trim().toLowerCase();
		const families = activeCollection.font_families ?? [];
		const filtered = needle ? families.filter( ( family ) => {
			const settings = family.font_family_settings;
			const haystack = [
				settings?.name,
				settings?.slug,
				settings?.fontFamily,
				...( family.categories ?? [] ),
			]
				.filter( Boolean )
				.join( ' ' )
				.toLowerCase();
			return haystack.includes( needle );
		} ) : families;
		const sorted = sortMode === 'name'
			? [ ...filtered ].sort( ( a, b ) => ( a.font_family_settings?.name ?? '' ).localeCompare( b.font_family_settings?.name ?? '' ) )
			: filtered;
		return sorted.slice( 0, variant === 'modal' ? 120 : 60 );
	}, [ activeCollection, browseQuery, sortMode, variant ] );

	async function handleUninstall( family: InstalledFontFamily ): Promise< void > {
		const label = family.font_family_settings?.name ?? family.font_family_settings?.slug ?? `#${ family.id }`;
		const ok = typeof window !== 'undefined' ? window.confirm( sprintf(
			__( 'Uninstall "%s"? Pages still using it will fall back to the system font.', 'blicks' ),
			label,
		) ) : true;
		if ( ! ok ) return;

		const slug = family.font_family_settings?.slug ?? `id-${ family.id }`;
		setPending( `uninstall:${ slug }` );
		setNotice( null );
		try {
			await deleteFontFamily( family.id );
			await deactivateFontFamily( slug );
			setInstalled( ( prev ) => prev.filter( ( f ) => f.id !== family.id ) );
			await refreshSnapshot();
			setNotice( { kind: 'success', message: sprintf( __( 'Removed "%s".', 'blicks' ), label ) } );
		} catch ( err ) {
			setNotice( { kind: 'error', message: errorMessage( err, __( 'Could not uninstall font.', 'blicks' ) ) } );
		} finally {
			setPending( null );
		}
	}

	async function handleInstall( family: FontCollectionFamily ): Promise< void > {
		const settings = family.font_family_settings;
		if ( ! settings ) return;
		const label = settings.name ?? settings.slug;
		setPending( `install:${ settings.slug }` );
		setNotice( null );

		// Default install = Regular 400 (normal style). Users add more weights later via Site Editor;
		// keeping the default small avoids dumping every weight into uploads/fonts/.
		const collectionFaces = ( family.font_family_settings as FontCollectionFamily[ 'font_family_settings' ] & { fontFace?: FontFaceSettings[] } )?.fontFace ?? [];
		const preferredFace = pickDefaultFace( collectionFaces );
		const facesToInstall: FontFaceSettings[] = preferredFace ? [ preferredFace ] : [];

		try {
			const { family: created, faces: installedFaces } = await installFontFamilyWithFaces( {
				name: settings.name,
				slug: settings.slug,
				fontFamily: settings.fontFamily,
				preview: settings.preview,
			}, facesToInstall );
			await activateFontFamily( created, installedFaces );
			setInstalled( ( prev ) => [ ...prev.filter( ( f ) => f.id !== created.id ), created ] );
			await refreshSnapshot();
			onSelectFamily?.( familyValue( created.font_family_settings.slug ) );
			setNotice( { kind: 'success', message: sprintf( __( 'Installed "%s".', 'blicks' ), label ) } );
		} catch ( err ) {
			setNotice( { kind: 'error', message: errorMessage( err, __( 'Could not install font.', 'blicks' ) ) } );
		} finally {
			setPending( null );
		}
	}

	const containerClass = `bl-fonts-manager${ compact ? ' is-compact' : '' }${ variant === 'modal' ? ' is-modal' : '' }`;

	return (
		<div className={ containerClass }>
			{ ! compact && (
				<header className="bl-fonts-manager__header">
					<div className="bl-fonts-manager__brand">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
							<path d="M4 19V5h6a4 4 0 0 1 0 8H4" />
							<path d="M14 5h3.5a3.5 3.5 0 0 1 0 7H14" />
							<path d="M14 12h4a3.5 3.5 0 0 1 0 7h-4z" />
						</svg>
						<h2>{ __( 'Google Fonts', 'blicks' ) }</h2>
					</div>
					<p>{ __( 'Browse self-hosted fonts. Installs use WordPress’ native Font Library, so files land in uploads/fonts/.', 'blicks' ) }</p>
				</header>
			) }

			<div className="bl-fonts-manager__toolbar">
				<div className="bl-fonts-manager__tabs" role="tablist">
					<button
						type="button"
						role="tab"
						aria-selected={ tab === 'browse' }
						className={ `bl-fonts-manager__tab${ tab === 'browse' ? ' is-active' : '' }` }
						onClick={ () => setTab( 'browse' ) }
					>
						{ __( 'Browse', 'blicks' ) }
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={ tab === 'installed' }
						className={ `bl-fonts-manager__tab${ tab === 'installed' ? ' is-active' : '' }` }
						onClick={ () => setTab( 'installed' ) }
					>
						{ __( 'Installed', 'blicks' ) } <span className="count">{ installed.length }</span>
					</button>
				</div>

				{ tab === 'browse' && (
					<div className="bl-fonts-manager__searchbar">
						<label className="bl-fonts-manager__searchwrap">
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
								<circle cx="11" cy="11" r="7" />
								<path d="m20 20-3.5-3.5" />
							</svg>
							<input
								type="search"
								className="bl-fonts-manager__search"
								placeholder={ __( 'Search fonts', 'blicks' ) }
								value={ browseQuery }
								onChange={ ( event ) => setBrowseQuery( event.currentTarget.value ) }
							/>
						</label>
						<label className="bl-fonts-manager__sort">
							<span>{ __( 'Sort by', 'blicks' ) }</span>
							<select value={ sortMode } onChange={ ( event ) => setSortMode( event.currentTarget.value as SortMode ) }>
								<option value="trending">{ __( 'Trending', 'blicks' ) }</option>
								<option value="name">{ __( 'Name', 'blicks' ) }</option>
							</select>
						</label>
					</div>
				) }
			</div>

			{ notice && (
				<div className={ `bl-fonts-manager__notice is-${ notice.kind }` } role="status">
					{ notice.message }
				</div>
			) }

			{ loading && installed.length === 0 && (
				<div className="bl-fonts-manager__loading">{ __( 'Loading…', 'blicks' ) }</div>
			) }

			{ tab === 'installed' && (
				<ul className="bl-fonts-manager__list" role="list">
					{ installed.map( ( family ) => {
						const settings = family.font_family_settings;
						const origin = originForFamily( family );
						const slug = settings?.slug ?? `id-${ family.id }`;
						return (
							<li key={ family.id } className="bl-fonts-manager__row">
								<div className="bl-fonts-manager__row-main">
									<span className="bl-fonts-manager__row-name" style={ { fontFamily: settings?.fontFamily ?? undefined } }>
										{ settings?.name ?? slug }
									</span>
									<span className="bl-fonts-manager__row-meta">
										{ slug } · { sprintf(
											/* translators: %d: face count */
											__( '%d face(s)', 'blicks' ),
											family.font_faces.length,
										) }
									</span>
									<span className="bl-fonts-manager__row-preview" style={ { fontFamily: settings?.fontFamily ?? undefined } }>
										{ PREVIEW_TEXT }
									</span>
								</div>
								<div className="bl-fonts-manager__row-actions">
									<span className={ `bl-fonts-manager__badge is-${ origin }` }>
										{ origin === 'user' ? __( 'Installed', 'blicks' ) : __( 'Theme', 'blicks' ) }
									</span>
									{ onSelectFamily && (
										<button
											type="button"
											className="bl-fonts-manager__btn is-primary"
											onClick={ () => onSelectFamily( familyValue( slug ) ) }
										>
											{ __( 'Use', 'blicks' ) }
										</button>
									) }
									{ origin === 'user' && (
										<button
											type="button"
											className="bl-fonts-manager__btn is-danger"
											onClick={ () => handleUninstall( family ) }
											disabled={ pending !== null }
										>
											{ pending === `uninstall:${ slug }` ? __( 'Removing…', 'blicks' ) : __( 'Uninstall', 'blicks' ) }
										</button>
									) }
								</div>
							</li>
						);
					} ) }
					{ ! loading && installed.length === 0 && (
						<li className="bl-fonts-manager__empty">{ __( 'No fonts installed yet. Browse Google Fonts to add some.', 'blicks' ) }</li>
					) }
				</ul>
			) }

			{ tab === 'browse' && (
				<div className="bl-fonts-manager__browse">
					{ collections.length === 0 && ! loading && (
						<div className="bl-fonts-manager__empty">{ __( 'No font collections available on this site.', 'blicks' ) }</div>
					) }
					<ul className="bl-fonts-manager__grid" role="list">
						{ browseResults.map( ( family ) => {
							const settings = family.font_family_settings;
							if ( ! settings ) return null;
							const isInstalled = installedSlugs.has( settings.slug );
							const faceCount = ( settings.fontFace ?? [] ).length;
							return (
								<li key={ settings.slug } className="bl-fonts-manager__card">
									<div className="bl-fonts-manager__card-head">
										<div className="bl-fonts-manager__card-meta">
											<strong>{ settings.name }</strong>
											<span>{ faceCount > 1 ? sprintf( __( '%d styles', 'blicks' ), faceCount ) : __( '1 style', 'blicks' ) }</span>
											{ family.categories?.[ 0 ] && <span>{ family.categories[ 0 ] }</span> }
										</div>
										<button
											type="button"
											className="bl-fonts-manager__btn"
											onClick={ () => {
												if ( isInstalled ) {
													onSelectFamily?.( familyValue( settings.slug ) );
												} else {
													handleInstall( family );
												}
											} }
											disabled={ pending !== null || ( isInstalled && ! onSelectFamily ) }
										>
											{ isInstalled
												? ( onSelectFamily ? __( 'Use', 'blicks' ) : __( 'Installed', 'blicks' ) )
												: pending === `install:${ settings.slug }` ? __( 'Installing…', 'blicks' ) : __( 'Install & use', 'blicks' ) }
										</button>
									</div>
									<div className="bl-fonts-manager__card-preview" style={ { fontFamily: settings.fontFamily ?? undefined } }>
										{ PREVIEW_TEXT }
									</div>
								</li>
							);
						} ) }
					</ul>
					{ activeCollection && browseResults.length === 0 && browseQuery && (
						<div className="bl-fonts-manager__empty">{ __( 'No fonts match your search.', 'blicks' ) }</div>
					) }
				</div>
			) }
		</div>
	);
}

/** Prefer Regular 400 normal; fall back to the first available face. */
function pickDefaultFace( faces: FontFaceSettings[] ): FontFaceSettings | null {
	if ( ! Array.isArray( faces ) || faces.length === 0 ) return null;
	return (
		faces.find( ( f ) => String( f.fontWeight ) === DEFAULT_INSTALL_WEIGHT && f.fontStyle === 'normal' )
		?? faces.find( ( f ) => f.fontStyle === 'normal' )
		?? faces[ 0 ]
	);
}

function errorMessage( err: unknown, fallback: string ): string {
	if ( err instanceof Error ) return err.message || fallback;
	if ( typeof err === 'object' && err !== null && 'message' in ( err as Record< string, unknown > ) ) {
		const msg = ( err as Record< string, unknown > ).message;
		if ( typeof msg === 'string' && msg !== '' ) return msg;
	}
	return fallback;
}
