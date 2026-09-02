import { __ } from '@wordpress/i18n';
import { FieldRow, OptionCards, SegmentedSetting, SettingsCard, useBlockHelp } from '@/blocks/shared/settings-ui';

// No `section` here on purpose: full-width bands are the Section block's job
// (compose Section > Grid); Grid stays a collection container.
const TAG_OPTIONS = [
	{ label: 'Div', value: 'div', hint: __( 'Generic', 'blicks' ) },
	{ label: 'UL', value: 'ul', hint: __( 'List', 'blicks' ) },
	{ label: 'OL', value: 'ol', hint: __( 'Ordered', 'blicks' ) },
];

const MODE_OPTIONS = [
	{ label: __( 'Fixed', 'blicks' ), value: 'fixed' },
	{ label: __( 'Auto-fit', 'blicks' ), value: 'auto' },
];

const PRESET_OPTIONS = [
	{ label: __( 'Cards', 'blicks' ), value: 'cards', hint: __( 'Auto · 16rem', 'blicks' ) },
	{ label: __( 'Gallery', 'blicks' ), value: 'gallery', hint: __( 'Auto · 12rem', 'blicks' ) },
	{ label: __( 'Feature', 'blicks' ), value: 'feature', hint: __( '2 columns', 'blicks' ) },
];

// Same token scale as Stack's gap control, plus XL for airy collections.
// `none` (seamless tiles) maps to var(--blicks-spacing-none) = 0.
const GAP_OPTIONS = [
	{ label: __( 'None', 'blicks' ), value: 'none' },
	{ label: __( 'XS', 'blicks' ), value: 'xs' },
	{ label: __( 'SM', 'blicks' ), value: 'sm' },
	{ label: __( 'MD', 'blicks' ), value: 'md' },
	{ label: __( 'LG', 'blicks' ), value: 'lg' },
	{ label: __( 'XL', 'blicks' ), value: 'xl' },
];

const DENSE_OPTIONS = [
	{ label: __( 'Normal', 'blicks' ), value: 'normal' },
	{ label: __( 'Dense', 'blicks' ), value: 'dense' },
];

const PRESETS: Record< string, { columns: number; minColumnWidth: string; autoFit: boolean; gap: string } > = {
	cards: { columns: 3, minColumnWidth: '16rem', autoFit: true, gap: 'md' },
	gallery: { columns: 4, minColumnWidth: '12rem', autoFit: true, gap: 'sm' },
	feature: { columns: 2, minColumnWidth: '20rem', autoFit: false, gap: 'lg' },
};

function clampColumns( columns: unknown ): number {
	const value = Number( columns );
	if ( Number.isNaN( value ) ) return 3;
	// Up to 12 tracks so a grid can act as a 12-column layout system (bento, asymmetric
	// spans via gridChild.columnSpan), not just an equal-column row.
	return Math.min( 12, Math.max( 1, Math.round( value ) ) );
}

function cleanLength( value: unknown ): string {
	const raw = String( value ?? '' ).trim().replace( /\s+/g, '' );
	if ( /^-?\d*\.?\d+(px|%|em|rem|vw|vh|ch)$/.test( raw ) ) return raw;
	if ( /^-?\d*\.?\d+$/.test( raw ) ) return `${ raw }rem`;
	return raw || '16rem';
}

function cleanGap( value: unknown ): string {
	const gap = String( value || 'md' );
	return GAP_OPTIONS.some( ( option ) => option.value === gap ) ? gap : 'md';
}

export function gridGapValue( gap: unknown ): string {
	return gapValue( cleanGap( gap ) );
}

export function gridColumnsValue( columns: unknown, autoFit: unknown ): string {
	return gridTemplate( clampColumns( columns ?? 3 ), Boolean( autoFit ) );
}

function gapValue( gap: string ): string {
	return `var(--blicks-spacing-${ gap })`;
}

function gridTemplate( columns: number, autoFit: boolean ): string {
	if ( autoFit ) {
		return 'repeat(auto-fit, minmax(var(--bl-grid-min, 16rem), 1fr))';
	}
	return `repeat(${ clampColumns( columns ) }, minmax(0, 1fr))`;
}

function writeBaseValue( tree: any, controlId: string, value: string ) {
	return {
		...tree,
		[ controlId ]: {
			...( tree?.[ controlId ] ?? {} ),
			default: {
				...( tree?.[ controlId ]?.default ?? {} ),
				base: value,
			},
		},
	};
}

function setGridLayout(
	attributes: any,
	setAttributes: ( a: any ) => void,
	next: Partial< { columns: number; autoFit: boolean; minColumnWidth: string; gap: string; dense: boolean } >
) {
	const columns = clampColumns( next.columns ?? attributes.columns ?? 3 );
	const autoFit = Boolean( next.autoFit ?? attributes.autoFit );
	const minColumnWidth = cleanLength( next.minColumnWidth ?? attributes.minColumnWidth ?? '16rem' );
	const gap = cleanGap( next.gap ?? attributes.gap );
	const dense = Boolean( next.dense ?? attributes.dense );
	let blicks = { ...( attributes.blicks ?? {} ) };
	blicks = writeBaseValue( blicks, 'layout.gridColumns', gridTemplate( columns, autoFit ) );
	blicks = writeBaseValue( blicks, 'layout.gapRow', gapValue( gap ) );
	blicks = writeBaseValue( blicks, 'layout.gapColumn', gapValue( gap ) );

	setAttributes( { ...next, columns, autoFit, minColumnWidth, gap, dense, blicks } );
}

export function GridControls( {
	attributes,
	setAttributes,
}: {
	attributes: any;
	setAttributes: ( a: any ) => void;
} ) {
	const autoFit = Boolean( attributes.autoFit );
	const mode = autoFit ? 'auto' : 'fixed';
	const dense = attributes.dense ? 'dense' : 'normal';
	const selectedPreset = Object.entries( PRESETS ).find( ( [ , preset ] ) =>
		clampColumns( attributes.columns ?? 3 ) === preset.columns
		&& cleanLength( attributes.minColumnWidth ?? '16rem' ) === preset.minColumnWidth
		&& autoFit === preset.autoFit
		&& cleanGap( attributes.gap ) === preset.gap
	)?.[ 0 ] ?? '';
	const help = useBlockHelp( 'grid' );
	const controlHelp = help?.controls ?? {};

	return (
		<>
			<SettingsCard title={ __( 'Collection', 'blicks' ) } help={ help?.description }>
				<OptionCards
					label={ __( 'Preset', 'blicks' ) }
					value={ selectedPreset }
					options={ PRESET_OPTIONS }
					columns={ 3 }
					onChange={ ( preset ) => setGridLayout( attributes, setAttributes, PRESETS[ preset ] ) }
				/>
				<SegmentedSetting
					label={ __( 'Columns', 'blicks' ) }
					help={ controlHelp.autoFit }
					value={ mode }
					options={ MODE_OPTIONS }
					onChange={ ( nextMode ) => setGridLayout( attributes, setAttributes, { autoFit: nextMode === 'auto' } ) }
				/>
				<FieldRow
					label={ autoFit ? __( 'Min card width', 'blicks' ) : __( 'Column count', 'blicks' ) }
					help={ autoFit ? controlHelp.minColumnWidth : controlHelp.columns }
				>
					{ autoFit ? (
						<input
							value={ attributes.minColumnWidth || '16rem' }
							onChange={ ( event ) => setAttributes( { minColumnWidth: event.currentTarget.value } ) }
							onBlur={ () => setGridLayout( attributes, setAttributes, { minColumnWidth: attributes.minColumnWidth || '16rem' } ) }
						/>
					) : (
						<input
							type="number"
							min={ 1 }
							max={ 12 }
							value={ clampColumns( attributes.columns ?? 3 ) }
							onChange={ ( event ) => setGridLayout( attributes, setAttributes, { columns: Number( event.currentTarget.value ) } ) }
						/>
					) }
				</FieldRow>
				<SegmentedSetting
					label={ __( 'Gap', 'blicks' ) }
					help={ controlHelp.gap }
					value={ cleanGap( attributes.gap ) }
					options={ GAP_OPTIONS }
					onChange={ ( gap ) => setGridLayout( attributes, setAttributes, { gap } ) }
				/>
				<SegmentedSetting
					label={ __( 'Packing', 'blicks' ) }
					help={ controlHelp.dense }
					value={ dense }
					options={ DENSE_OPTIONS }
					onChange={ ( value ) => setGridLayout( attributes, setAttributes, { dense: value === 'dense' } ) }
				/>
			</SettingsCard>
			<SettingsCard title={ __( 'Element', 'blicks' ) }>
				<OptionCards
					label={ __( 'HTML tag', 'blicks' ) }
					help={ controlHelp.tag }
					value={ attributes.tag || 'div' }
					options={ TAG_OPTIONS }
					columns={ 3 }
					onChange={ ( tag ) => setAttributes( { tag } ) }
				/>
			</SettingsCard>
		</>
	);
}

export function gridMinWidth( attributes: any ): string {
	return cleanLength( attributes.minColumnWidth || '16rem' );
}
