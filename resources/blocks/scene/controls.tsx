import { __ } from '@wordpress/i18n';
import { FieldRow, SegmentedSetting, SettingsCard, type Option } from '@/blocks/shared/settings-ui';

/**
 * Design presets. A scene is authored at ONE size and scaled everywhere else, so the choice here
 * is really "what shape is this band" rather than "how big is it" — the numbers only set the
 * coordinate space the items are placed in.
 */
const PRESETS: Option[] = [
	{ label: __( 'Wide', 'blicks' ), value: '1440x800', hint: '16:9' },
	{ label: __( 'Banner', 'blicks' ), value: '1440x520', hint: __( 'short', 'blicks' ) },
	{ label: __( 'Square', 'blicks' ), value: '1080x1080', hint: '1:1' },
	{ label: __( 'Custom', 'blicks' ), value: 'custom' },
];

/**
 * Grid presets. The grid is the coordinate space boxes snap to, so these are the common densities
 * rather than a free-for-all — 16 is PaneFlow's default and what the runtime falls back to.
 */
const GRID_PRESETS: Option[] = [
	{ label: '8', value: '8x8' },
	{ label: '12', value: '12x12' },
	{ label: '16', value: '16x16', hint: __( 'default', 'blicks' ) },
	{ label: '24', value: '24x24' },
	{ label: __( 'Custom', 'blicks' ), value: 'custom' },
];

const GRID_LINES_OPTIONS: Option[] = [
	{ label: __( 'Show', 'blicks' ), value: 'show', hint: __( 'default', 'blicks' ) },
	{ label: __( 'Hide', 'blicks' ), value: 'hide' },
];

const UPSCALE_OPTIONS: Option[] = [
	{ label: __( 'Cap at design width', 'blicks' ), value: 'cap', hint: __( 'default', 'blicks' ) },
	{ label: __( 'Fill', 'blicks' ), value: 'fill' },
];

/**
 * A design dimension is a plain positive integer — it is the denominator of the stage's scale
 * factor, so a zero or a unit string would take the whole composition out with it.
 */
export function cleanDesignSize( value: unknown, fallback: number ): number {
	const n = Math.round( Number( value ) );
	return Number.isFinite( n ) && n >= 200 && n <= 10000 ? n : fallback;
}

/** Gutter and outer margin, in design pixels. Bounded so a grid cannot be gutter with no cells. */
export function cleanGridSpace( value: unknown, fallback = 0 ): number {
	const n = Math.round( Number( value ) );
	return Number.isFinite( n ) && n >= 0 && n <= 400 ? n : fallback;
}

/**
 * A custom track list, e.g. `2fr 1fr 1fr`.
 *
 * Passed through to `grid-template-columns`, so it is validated rather than trusted: only track
 * sizes are allowed through, which keeps a stray `;` or a `url()` out of the style attribute. An
 * empty string means "equal tracks" and is the default.
 */
const TRACK = /^\s*(?:\d+(?:\.\d+)?(?:fr|px|%|em|rem)|auto|min-content|max-content)\s*$/;

export function cleanTracks( value: unknown, fallback = '' ): string {
	const raw = String( value ?? '' ).trim();
	if ( ! raw ) return '';
	const parts = raw.split( /\s+/ );
	if ( parts.length > 64 || ! parts.every( ( part ) => TRACK.test( part ) ) ) return fallback;
	return parts.join( ' ' );
}

/** How many tracks a list describes, so the count fields stay honest about what is drawn. */
export function trackCount( tracks: string ): number {
	return tracks ? tracks.trim().split( /\s+/ ).length : 0;
}

/**
 * The grid a scene actually draws.
 *
 * A custom track list DEFINES the count — four tracks is a four-column grid, whatever the number
 * field says. Everything that draws or measures the grid has to agree on this or they disagree
 * about where a cell is: the surface kept rendering twelve columns against a four-track template
 * and the browser invented eight implicit tracks to put them in.
 */
export function gridOf( attributes: any ): { cols: number; rows: number } {
	return {
		cols: trackCount( cleanTracks( attributes?.colTracks ) ) || cleanGrid( attributes?.cols ),
		rows: trackCount( cleanTracks( attributes?.rowTracks ) ) || cleanGrid( attributes?.rows ),
	};
}

/** The grid is the denominator of every box's position, so it must be a sane whole number. */
export function cleanGrid( value: unknown, fallback = 16 ): number {
	const n = Math.round( Number( value ) );
	return Number.isFinite( n ) && n >= 2 && n <= 64 ? n : fallback;
}

/** Milliseconds between one box's entrance and the next. Clamped to something watchable. */
/** The entrance window, in MILLISECONDS. Authored in seconds; stored in ms like every other time. */
export const ENTRANCE_DEFAULT = 2000;

export function cleanEntrance( value: unknown, fallback = ENTRANCE_DEFAULT ): number {
	const n = Math.round( Number( value ) );
	return Number.isFinite( n ) && n >= 0 && n <= 10000 ? n : fallback;
}

function presetValue( width: number, height: number ): string {
	const key = `${ width }x${ height }`;
	return PRESETS.some( ( preset ) => preset.value === key ) ? key : 'custom';
}

export function SceneControls( {
	attributes,
	setAttributes,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
} ) {
	const width = cleanDesignSize( attributes.designWidth, 1440 );
	const height = cleanDesignSize( attributes.designHeight, 800 );
	const preset = presetValue( width, height );

	const colTracks = cleanTracks( attributes.colTracks );
	const rowTracks = cleanTracks( attributes.rowTracks );
	// A track list defines the count, so the number fields show what is drawn rather than a stale
	// figure the list has overridden.
	const { cols, rows } = gridOf( attributes );
	const gridPreset = GRID_PRESETS.some( ( p ) => p.value === `${ cols }x${ rows }` )
		? `${ cols }x${ rows }`
		: 'custom';

	const applyGridPreset = ( value: string ) => {
		if ( value === 'custom' ) return;
		const [ c, r ] = value.split( 'x' ).map( Number );
		setAttributes( { cols: cleanGrid( c ), rows: cleanGrid( r ) } );
	};

	const applyPreset = ( value: string ) => {
		if ( value === 'custom' ) return;
		const [ w, h ] = value.split( 'x' ).map( Number );
		setAttributes( { designWidth: w, designHeight: h } );
	};

	return (
		<>
			<SettingsCard
				title={ __( 'Stage', 'blicks' ) }
				help={ __( 'Items are placed in these coordinates. The whole stage scales to fit, so the composition holds at every screen width.', 'blicks' ) }
			>
				<SegmentedSetting
					label={ __( 'Shape', 'blicks' ) }
					value={ preset }
					options={ PRESETS }
					onChange={ applyPreset }
				/>
				<FieldRow label={ __( 'Design width', 'blicks' ) }>
					<input
						type="number"
						min={ 200 }
						max={ 10000 }
						step={ 10 }
						value={ width }
						onChange={ ( event ) =>
							setAttributes( { designWidth: cleanDesignSize( event.currentTarget.value, width ) } )
						}
					/>
				</FieldRow>
				<FieldRow label={ __( 'Design height', 'blicks' ) }>
					<input
						type="number"
						min={ 200 }
						max={ 10000 }
						step={ 10 }
						value={ height }
						onChange={ ( event ) =>
							setAttributes( { designHeight: cleanDesignSize( event.currentTarget.value, height ) } )
						}
					/>
				</FieldRow>
			</SettingsCard>

			<SettingsCard
				title={ __( 'Grid', 'blicks' ) }
				help={ __( 'The cells a box snaps to. Boxes store whole cells rather than pixels, so changing the grid re-lays-out every box at once instead of stranding them at old coordinates.', 'blicks' ) }
			>
				<SegmentedSetting
					label={ __( 'Size', 'blicks' ) }
					value={ gridPreset }
					options={ GRID_PRESETS }
					onChange={ applyGridPreset }
				/>
				<FieldRow label={ __( 'Columns', 'blicks' ) }>
					<input
						type="number"
						min={ 2 }
						max={ 64 }
						step={ 1 }
						value={ cols }
						onChange={ ( event ) =>
							setAttributes( { cols: cleanGrid( event.currentTarget.value, cols ) } )
						}
					/>
				</FieldRow>
				<FieldRow label={ __( 'Rows', 'blicks' ) }>
					<input
						type="number"
						min={ 2 }
						max={ 64 }
						step={ 1 }
						value={ rows }
						onChange={ ( event ) =>
							setAttributes( { rows: cleanGrid( event.currentTarget.value, rows ) } )
						}
					/>
				</FieldRow>
				<FieldRow label={ __( 'Gutter', 'blicks' ) }>
					<input
						type="number"
						min={ 0 }
						max={ 400 }
						step={ 1 }
						value={ cleanGridSpace( attributes.gutter ) }
						onChange={ ( event ) =>
							setAttributes( {
								gutter: cleanGridSpace( event.currentTarget.value, cleanGridSpace( attributes.gutter ) ),
							} )
						}
					/>
				</FieldRow>
				<FieldRow label={ __( 'Margin', 'blicks' ) }>
					<input
						type="number"
						min={ 0 }
						max={ 400 }
						step={ 1 }
						value={ cleanGridSpace( attributes.gridMargin ) }
						onChange={ ( event ) =>
							setAttributes( {
								gridMargin: cleanGridSpace( event.currentTarget.value, cleanGridSpace( attributes.gridMargin ) ),
							} )
						}
					/>
				</FieldRow>

				{ /* Behind a disclosure on purpose. An even grid is what most compositions want and
				     what every count above describes; a track list is the escape hatch for the one
				     that needs a wide first column. Native `details`, so it is keyboard- and
				     screen-reader-correct without a new component. */ }
				<details className="bl-scene-tracks">
					<summary>{ __( 'Uneven tracks', 'blicks' ) }</summary>
					<p className="bl-scene-tracks__note">
						{ __(
							'A list of track sizes, largest control first — for example 2fr 1fr 1fr. Leave empty for equal tracks. Setting a list replaces the count above.',
							'blicks'
						) }
					</p>
					<FieldRow label={ __( 'Columns', 'blicks' ) }>
						<input
							type="text"
							spellCheck={ false }
							placeholder={ __( 'equal', 'blicks' ) }
							defaultValue={ colTracks }
							onBlur={ ( event ) =>
								setAttributes( { colTracks: cleanTracks( event.currentTarget.value, colTracks ) } )
							}
						/>
					</FieldRow>
					<FieldRow label={ __( 'Rows', 'blicks' ) }>
						<input
							type="text"
							spellCheck={ false }
							placeholder={ __( 'equal', 'blicks' ) }
							defaultValue={ rowTracks }
							onBlur={ ( event ) =>
								setAttributes( { rowTracks: cleanTracks( event.currentTarget.value, rowTracks ) } )
							}
						/>
					</FieldRow>
				</details>

				<SegmentedSetting
					label={ __( 'Grid lines', 'blicks' ) }
					help={ __( 'Only ever drawn in the editor. Hiding them is a way to see the composition clean without changing where anything snaps.', 'blicks' ) }
					value={ attributes.showGrid === false ? 'hide' : 'show' }
					options={ GRID_LINES_OPTIONS }
					onChange={ ( value ) => setAttributes( { showGrid: value !== 'hide' } ) }
				/>
			</SettingsCard>

			<SettingsCard
				title={ __( 'Entrance', 'blicks' ) }
				help={ __( 'The window the entrance sequence is spread across. Each box and item is delayed in proportion to how far along the stage\u2019s diagonal it sits — an element in the far corner starts at the full window, one nearer the top left starts sooner, so a composition that does not reach the corner finishes early. Give an element its own animation delay to take it out of the sequence.', 'blicks' ) }
			>
				<FieldRow label={ __( 'Total (s)', 'blicks' ) }>
					<input
						type="number"
						min={ 0 }
						max={ 10 }
						step={ 0.1 }
						value={ cleanEntrance( attributes.entrance ) / 1000 }
						onChange={ ( event ) =>
							setAttributes( {
								entrance: cleanEntrance(
									Number( event.currentTarget.value ) * 1000,
									cleanEntrance( attributes.entrance )
								),
							} )
						}
					/>
				</FieldRow>
			</SettingsCard>

			<SettingsCard title={ __( 'Scaling', 'blicks' ) }>
				<SegmentedSetting
					label={ __( 'Beyond design width', 'blicks' ) }
					help={ __( 'Fill keeps growing the stage on wide monitors. Cap stops it at its design size and centres it.', 'blicks' ) }
					value={ attributes.upscale === false ? 'cap' : 'fill' }
					options={ UPSCALE_OPTIONS }
					onChange={ ( value ) => setAttributes( { upscale: value !== 'cap' } ) }
				/>
			</SettingsCard>
		</>
	);
}
