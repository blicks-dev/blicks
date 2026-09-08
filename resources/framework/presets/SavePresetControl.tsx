/**
 * Inspector control (Settings tab) for user-saved design presets. Lists this block's saved presets
 * with delete, and saves the current block's design as a new preset. On success it registers/removes
 * the matching block variation live (see `register.ts`), so a saved preset shows up in the inserter
 * and block-switcher immediately — no reload.
 *
 * A preset stores only design attributes: an explicit `presetAttributes` allowlist when the block
 * supplies one, otherwise everything except the instance/system fields in {@link INSTANCE_FIELDS}.
 */
import { useState } from '@wordpress/element';
import { Button, TextControl, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { SettingsCard } from '@/blocks/shared/settings-ui';
import {
	createPreset,
	deletePreset,
	type UserPreset,
} from './preset-rest';
import {
	registerPresetVariation,
	unregisterPresetVariation,
	presetMarker,
} from './register';
import './presets.scss';

/** Never stored in a preset: per-instance content + factory system attributes. */
const INSTANCE_FIELDS = new Set( [
	'uniqueId',
	'text',
	'url',
	'rel',
	'linkTarget',
	'visibility',
	'htmlAttributes',
	'customCSS',
	'blicksBlank',
	'blicksPreset',
] );

function pickDesign(
	attributes: Record< string, unknown >,
	allowlist?: string[]
): Record< string, unknown > {
	const out: Record< string, unknown > = {};
	if ( allowlist && allowlist.length ) {
		for ( const key of allowlist ) {
			if ( key in attributes && attributes[ key ] !== undefined ) {
				out[ key ] = attributes[ key ];
			}
		}
		return out;
	}
	for ( const [ key, value ] of Object.entries( attributes ) ) {
		if ( ! INSTANCE_FIELDS.has( key ) && value !== undefined ) {
			out[ key ] = value;
		}
	}
	return out;
}

export function SavePresetControl( {
	blockName,
	attributes,
	presetAttributes,
}: {
	blockName: string;
	clientId: string;
	attributes: Record< string, unknown >;
	presetAttributes?: string[];
} ) {
	const [ presets, setPresets ] = useState< UserPreset[] >(
		() => ( window.blicksEditorSettings?.presets?.[ blockName ] as UserPreset[] ) ?? []
	);
	const [ name, setName ] = useState( '' );
	const [ busy, setBusy ] = useState( false );
	const [ error, setError ] = useState( '' );

	const design = pickDesign( attributes, presetAttributes );
	const hasDesign = Object.keys( design ).length > 0;
	const appliedMarker = String( attributes.blicksPreset ?? '' );

	const refresh = ( byBlock?: Record< string, UserPreset[] > ) => {
		setPresets( byBlock?.[ blockName ] ?? [] );
	};

	const onSave = async () => {
		const title = name.trim();
		if ( ! title || ! hasDesign || busy ) {
			return;
		}
		setBusy( true );
		setError( '' );
		try {
			const result = await createPreset( blockName, title, design );
			if ( result.preset ) {
				registerPresetVariation( blockName, result.preset );
			}
			refresh( result.presets );
			setName( '' );
		} catch ( e: any ) {
			setError( e?.message || __( 'Could not save the preset.', 'blicks' ) );
		} finally {
			setBusy( false );
		}
	};

	const onDelete = async ( preset: UserPreset ) => {
		if ( busy ) {
			return;
		}
		setBusy( true );
		setError( '' );
		try {
			const result = await deletePreset( preset.id );
			unregisterPresetVariation( blockName, preset.key );
			refresh( result.presets );
		} catch ( e: any ) {
			setError( e?.message || __( 'Could not delete the preset.', 'blicks' ) );
		} finally {
			setBusy( false );
		}
	};

	return (
		<SettingsCard
			title={ __( 'Presets', 'blicks' ) }
			help={ __( 'Save this block’s current styles as a reusable preset. Saved presets appear in the inserter and the block-switcher.', 'blicks' ) }
		>
			{ presets.length > 0 && (
				<ul className="bl-preset-list">
					{ presets.map( ( preset ) => {
						const applied = appliedMarker === presetMarker( blockName, preset.key );
						return (
							<li key={ preset.id } className="bl-preset-list__item">
								<span className="bl-preset-list__title">
									{ preset.title }
									{ applied && (
										<span className="bl-preset-list__applied">
											{ __( 'Applied', 'blicks' ) }
										</span>
									) }
								</span>
								<Button
									variant="tertiary"
									isDestructive
									size="small"
									disabled={ busy }
									onClick={ () => onDelete( preset ) }
								>
									{ __( 'Delete', 'blicks' ) }
								</Button>
							</li>
						);
					} ) }
				</ul>
			) }

			<div className="bl-preset-save">
				<TextControl
					label={ __( 'New preset name', 'blicks' ) }
					value={ name }
					placeholder={ __( 'e.g. Promo CTA', 'blicks' ) }
					disabled={ busy }
					onChange={ setName }
					onKeyDown={ ( event: React.KeyboardEvent ) => {
						if ( event.key === 'Enter' ) {
							event.preventDefault();
							onSave();
						}
					} }
					__next40pxDefaultSize
					__nextHasNoMarginBottom
				/>
				<Button
					variant="secondary"
					disabled={ ! name.trim() || ! hasDesign || busy }
					onClick={ onSave }
				>
					{ busy ? <Spinner /> : __( 'Save as preset', 'blicks' ) }
				</Button>
			</div>

			{ ! hasDesign && (
				<p className="bl-preset-note">
					{ __( 'Style this block first — there’s nothing to save yet.', 'blicks' ) }
				</p>
			) }
			{ error && <p className="bl-preset-note bl-preset-note--error">{ error }</p> }
		</SettingsCard>
	);
}
