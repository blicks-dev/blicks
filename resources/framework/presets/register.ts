/**
 * Bridges user-saved presets (the `wp_blicks_presets` table) into the editor as native block
 * **variations**. At editor load {@link registerBootPresets} reads the presets bootstrapped in
 * `window.blicksEditorSettings.presets` and registers one variation per preset; the inspector's
 * "Save as preset" control calls {@link registerPresetVariation}/{@link unregisterPresetVariation}
 * so a just-saved preset appears (or a deleted one disappears) without a reload.
 *
 * Each preset becomes an inserter pick *and* a block-switcher swap. A hidden `blicksPreset` marker
 * attribute (`<blockName>::<key>`) is baked into the variation so the editor can highlight which
 * preset is currently applied (`isActive`).
 */
import { registerBlockVariation, unregisterBlockVariation } from '@wordpress/blocks';
import type { UserPreset } from './preset-rest';

/** Variation name for a preset — namespaced so it never collides with a shipped variation. */
export function presetVariationName( key: string ): string {
	return `blicks-preset-${ key }`;
}

/** The value written to the `blicksPreset` marker attribute when this preset is applied. */
export function presetMarker( blockName: string, key: string ): string {
	return `${ blockName }::${ key }`;
}

function toVariation( blockName: string, preset: UserPreset ) {
	return {
		name: presetVariationName( preset.key ),
		title: preset.title,
		attributes: {
			...preset.attributes,
			blicksPreset: presetMarker( blockName, preset.key ),
		},
		scope: [ 'inserter', 'transform' ],
		// Marker is unique per preset, so shallow-equality on this one attribute cleanly identifies
		// the applied preset without comparing the whole (deep) design bundle.
		isActive: [ 'blicksPreset' ],
	};
}

export function registerPresetVariation( blockName: string, preset: UserPreset ): void {
	// Re-registering under an existing name throws in some WP versions; drop any prior copy first so
	// a rename/update replaces cleanly.
	try {
		unregisterBlockVariation( blockName, presetVariationName( preset.key ) );
	} catch {
		// No existing variation to remove — expected on first registration.
	}
	registerBlockVariation( blockName, toVariation( blockName, preset ) as any );
}

export function unregisterPresetVariation( blockName: string, key: string ): void {
	try {
		unregisterBlockVariation( blockName, presetVariationName( key ) );
	} catch {
		// Already gone — nothing to do.
	}
}

/** Register every preset bootstrapped into the editor. Safe to call when none are present. */
export function registerBootPresets(): void {
	const grouped = window.blicksEditorSettings?.presets;
	if ( ! grouped ) {
		return;
	}

	for ( const [ blockName, presets ] of Object.entries( grouped ) ) {
		if ( ! Array.isArray( presets ) ) {
			continue;
		}
		for ( const preset of presets ) {
			registerPresetVariation( blockName, preset as UserPreset );
		}
	}
}
