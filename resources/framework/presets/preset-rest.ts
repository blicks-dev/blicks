/**
 * Typed wrappers around the plugin's user-preset REST routes (`blicks/v1/presets`), backed by the
 * `wp_blicks_presets` table. Every mutating response carries the full grouped library so the caller
 * can reconcile the block variations it has registered in the editor.
 */
import apiFetch from '@wordpress/api-fetch';

/** One saved design preset — a named bundle of a block's design attributes. */
export interface UserPreset {
	id: number;
	key: string;
	title: string;
	attributes: Record< string, unknown >;
	author: number;
}

/** Presets grouped by block name (e.g. `{ 'blicks/button': [ … ] }`). */
export type PresetsByBlock = Record< string, UserPreset[] >;

interface MutationResponse {
	preset?: UserPreset;
	blockName?: string;
	key?: string;
	presets: PresetsByBlock;
}

export async function listPresets(): Promise< PresetsByBlock > {
	const result = ( await apiFetch( { path: '/blicks/v1/presets' } ) ) as { presets?: PresetsByBlock };
	return result?.presets ?? {};
}

export async function createPreset(
	blockName: string,
	title: string,
	attributes: Record< string, unknown >
): Promise< MutationResponse > {
	return ( await apiFetch( {
		path: '/blicks/v1/presets',
		method: 'POST',
		data: { blockName, title, attributes },
	} ) ) as MutationResponse;
}

export async function updatePreset(
	id: number,
	title: string,
	attributes: Record< string, unknown >
): Promise< MutationResponse > {
	return ( await apiFetch( {
		path: `/blicks/v1/presets/${ id }`,
		method: 'PATCH',
		data: { title, attributes },
	} ) ) as MutationResponse;
}

export async function deletePreset( id: number ): Promise< MutationResponse > {
	return ( await apiFetch( {
		path: `/blicks/v1/presets/${ id }`,
		method: 'DELETE',
	} ) ) as MutationResponse;
}
