/**
 * Thin typed wrappers around WordPress's native Font Library REST API. Blicks does no
 * downloading of its own — core handles GDPR/self-hosting, MIME validation, and the
 * theme.json write-back. We just talk to the same endpoints the Site Editor uses.
 *
 * Endpoints:
 *   GET    /wp/v2/font-families
 *   POST   /wp/v2/font-families                              (multipart/form-data)
 *   DELETE /wp/v2/font-families/<id>?force=true
 *   GET    /wp/v2/font-families/<id>/font-faces
 *   POST   /wp/v2/font-families/<id>/font-faces              (multipart/form-data, src may be a URL)
 *   GET    /wp/v2/font-collections
 *   GET    /wp/v2/font-collections/<slug>
 */
import apiFetch from '@wordpress/api-fetch';

const THEME_JSON_VERSION = 2;

export interface FontFamilySettings {
	name: string;
	slug: string;
	fontFamily: string;
	preview?: string;
}

export interface FontFaceSettings {
	fontFamily: string;
	fontWeight: string;
	fontStyle: string;
	/** URL — WP downloads it server-side to `uploads/fonts/` — or a file-reference key. */
	src: string | string[];
	preview?: string;
	fontDisplay?: string;
	fontStretch?: string;
}

export interface InstalledFontFamily {
	id: number;
	theme_json_version: number;
	font_family_settings: FontFamilySettings;
	font_faces: number[];
}

export interface InstalledFontFace {
	id: number;
	parent: number;
	theme_json_version: number;
	font_face_settings: FontFaceSettings;
}

export interface FontCollectionFamily {
	font_family_settings: FontFamilySettings & { fontFace?: FontFaceSettings[] };
	categories?: string[];
}

export interface FontCollection {
	slug: string;
	name: string;
	description?: string;
	font_families: FontCollectionFamily[];
	categories?: string[];
}

function buildFamilyForm( settings: FontFamilySettings ): FormData {
	const form = new FormData();
	form.append( 'theme_json_version', String( THEME_JSON_VERSION ) );
	form.append( 'font_family_settings', JSON.stringify( settings ) );
	return form;
}

function buildFaceForm( settings: FontFaceSettings ): FormData {
	const form = new FormData();
	form.append( 'theme_json_version', String( THEME_JSON_VERSION ) );
	form.append( 'font_face_settings', JSON.stringify( settings ) );
	return form;
}

export async function listFontFamilies(): Promise< InstalledFontFamily[] > {
	const result = await apiFetch( { path: '/wp/v2/font-families?per_page=100' } ) as unknown;
	return Array.isArray( result ) ? result : [];
}

export async function deleteFontFamily( id: number ): Promise< void > {
	await apiFetch( { path: `/wp/v2/font-families/${ id }?force=true`, method: 'DELETE' } );
}

export async function listFontFaces( familyId: number ): Promise< InstalledFontFace[] > {
	const result = await apiFetch( {
		path: `/wp/v2/font-families/${ familyId }/font-faces?per_page=100`,
	} ) as unknown;
	return Array.isArray( result ) ? result : [];
}

/** Create a new family from settings only. WP returns the created record. */
export async function createFontFamily( settings: FontFamilySettings ): Promise< InstalledFontFamily > {
	return apiFetch( {
		path: '/wp/v2/font-families',
		method: 'POST',
		body: buildFamilyForm( settings ),
	} ) as Promise< InstalledFontFamily >;
}

/** Create a single face on an existing family. */
export async function createFontFace( familyId: number, settings: FontFaceSettings ): Promise< InstalledFontFace > {
	return apiFetch( {
		path: `/wp/v2/font-families/${ familyId }/font-faces`,
		method: 'POST',
		body: buildFaceForm( settings ),
	} ) as Promise< InstalledFontFace >;
}

export async function listFontCollections(): Promise< FontCollection[] > {
	const result = await apiFetch( { path: '/wp/v2/font-collections?per_page=100' } ) as unknown;
	return Array.isArray( result ) ? result : [];
}

export async function getFontCollection( slug: string ): Promise< FontCollection > {
	return apiFetch( { path: `/wp/v2/font-collections/${ encodeURIComponent( slug ) }` } ) as Promise< FontCollection >;
}

/**
 * Install a family-with-faces in one shot. Creates the family, then sequentially POSTs each face
 * (WP server-side downloads the URL `src` into `uploads/fonts/` and writes theme.json). Returns
 * the family record + installed faces. Bails on the first error so the caller can show a message.
 */
export async function installFontFamilyWithFaces(
	settings: FontFamilySettings,
	faces: FontFaceSettings[],
): Promise< { family: InstalledFontFamily; faces: InstalledFontFace[] } > {
	const family = await createFontFamily( settings );
	const installed: InstalledFontFace[] = [];
	for ( const face of faces ) {
		installed.push( await createFontFace( family.id, face ) );
	}
	return { family, faces: installed };
}
