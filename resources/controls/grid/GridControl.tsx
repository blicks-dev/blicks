import { __ } from '@wordpress/i18n';
import { getValue, setValue } from '@/framework/values';
import {
	LENGTH_PATTERN,
	LENGTH_SUGGESTIONS,
	MoreSettings,
	NoMatches,
	makeMatcher,
	setOrClear,
} from '@/controls/common';
import { lengthOrTokenPattern } from '@/controls/token-utils';
import { IconField, IconValueField, type IconChoice } from '@/controls/IconValueField';
import { LengthField, ValueField } from '@/controls/ValueField';
import './grid.scss';

const GAP_PATTERN = lengthOrTokenPattern( 'spacing', LENGTH_PATTERN );
const TRACK_PATTERN = /^(auto|none|subgrid|repeat\(.+\)|minmax\(.+\)|0|-?\d+(\.\d+)?(px|%|em|rem|fr))$/;

const MAX_TRACKS = 12;

const choice = ( value: string, title: string, icon: JSX.Element ): IconChoice => ( { value, title, icon } );
const opts = ( values: string[] ) => values.map( ( value ) => ( { value, label: value } ) );

/** Which sizing model the current `grid-template-columns` value represents. */
type Sizing = 'equal' | 'auto' | 'custom';

const EQUAL_RE = /^repeat\(\s*(\d+)\s*,\s*1fr\s*\)$/;
const AUTOFIT_RE = /^repeat\(\s*auto-fit\s*,\s*minmax\(\s*([^,]+?)\s*,\s*(.+?)\s*\)\s*\)$/;

function readSizing( template: string ): Sizing {
	if ( ! template || EQUAL_RE.test( template ) ) return 'equal';
	if ( AUTOFIT_RE.test( template ) ) return 'auto';
	return 'custom';
}

/** Track count for the equal model — also drives the preview. */
function readCount( template: string ): number {
	const m = EQUAL_RE.exec( template );
	if ( m ) return Math.min( MAX_TRACKS, Math.max( 1, Number.parseInt( m[ 1 ], 10 ) ) );
	if ( ! template ) return 1;
	// A custom template's track count is a decent preview approximation.
	return Math.min( MAX_TRACKS, Math.max( 1, template.trim().split( /\s+(?![^(]*\))/ ).length ) );
}

/** The two bounds inside `repeat(auto-fit, minmax(min, max))`, editable as fields of their own. */
function readAutoFit( template: string ): { min: string; max: string } {
	const m = AUTOFIT_RE.exec( template );
	return m ? { min: m[ 1 ], max: m[ 2 ] } : { min: '200px', max: '1fr' };
}

const SIZING_CHOICES: IconChoice[] = [
	choice( 'equal', __( 'Equal — tracks share the width evenly', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="3" y="6" width="5" height="12" /><rect x="9.5" y="6" width="5" height="12" /><rect x="16" y="6" width="5" height="12" />
		</svg> ),
	choice( 'auto', __( 'Auto fit — tracks wrap to fit the container', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="3" y="4" width="8" height="6" /><rect x="13" y="4" width="8" height="6" /><rect x="3" y="14" width="8" height="6" />
		</svg> ),
	choice( 'custom', __( 'Custom — write the template by hand', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="m8 7-5 5 5 5M16 7l5 5-5 5" />
		</svg> ),
];

/**
 * The template library from the prototype: the handful of track layouts that cover most pages,
 * named for what they build rather than for the CSS they emit.
 */
const TEMPLATE_OPTIONS = [
	{ value: '1fr 1fr', label: 'Halves', hint: '1fr 1fr' },
	{ value: '1fr 1fr 1fr', label: 'Thirds', hint: '1fr 1fr 1fr' },
	{ value: '280px 1fr', label: 'Sidebar', hint: '280px 1fr' },
	{ value: '1fr 2fr 1fr', label: 'Centered', hint: '1fr 2fr 1fr' },
	{ value: 'repeat(auto-fit, minmax(200px, 1fr))', label: 'Fluid', hint: 'auto-fit' },
	{ value: 'subgrid', label: 'Subgrid', hint: 'inherit tracks' },
];

// `justify-items` is the inline axis, `align-items` the block axis — the icons differ by which way
// the bars sit, and each row carries its name in the frame so the pair is never a guess.
//
// No `stretch` icon: it is the initial value, so an untouched field already means stretch. Spending
// a quarter of the icon row on it would take the width the value needs to render `space-between`.
const JUSTIFY_ITEMS_CHOICES: IconChoice[] = [
	choice( 'start', 'Start',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="3" y="5" width="4" height="14" /><rect x="9" y="5" width="4" height="14" />
		</svg> ),
	choice( 'center', 'Center',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" />
		</svg> ),
	choice( 'end', 'End',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="11" y="5" width="4" height="14" /><rect x="17" y="5" width="4" height="14" />
		</svg> ),
];
const JUSTIFY_ITEMS_OPTIONS = opts( [ 'stretch', 'start', 'center', 'end', 'normal', 'left', 'right', 'baseline' ] );

const ALIGN_ITEMS_CHOICES: IconChoice[] = [
	choice( 'start', 'Start',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="5" y="3" width="14" height="4" /><rect x="5" y="9" width="14" height="4" />
		</svg> ),
	choice( 'center', 'Center',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="5" y="6" width="14" height="4" /><rect x="5" y="14" width="14" height="4" />
		</svg> ),
	choice( 'end', 'End',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="5" y="11" width="14" height="4" /><rect x="5" y="17" width="14" height="4" />
		</svg> ),
];
const ALIGN_ITEMS_OPTIONS = opts( [ 'stretch', 'start', 'center', 'end', 'baseline', 'normal', 'self-start', 'self-end' ] );

const FLOW_CHOICES: IconChoice[] = [
	choice( 'row', 'Row',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="5" y1="12" x2="19" y2="12" /><polyline points="14 7 19 12 14 17" />
		</svg> ),
	choice( 'column', 'Column',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="12" y1="5" x2="12" y2="19" /><polyline points="7 14 12 19 17 14" />
		</svg> ),
	choice( 'dense', 'Dense',
		<svg viewBox="0 0 24 24" fill="currentColor">
			<rect x="3" y="3" width="8" height="8" /><rect x="13" y="3" width="8" height="8" /><rect x="3" y="13" width="18" height="8" />
		</svg> ),
];
const FLOW_OPTIONS = opts( [ 'row', 'column', 'dense', 'row dense', 'column dense' ] );

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
	isAllowed?: ( controlId: string ) => boolean;
	/** Property-search query from the Inspector. Absent/empty → every section renders. */
	query?: string;
	/**
	 * Rendered inside Layout's Display nest rather than as a facet of its own. The caller has
	 * already checked that display *is* grid and already answers the search, so the empty state
	 * and the "no matches" line — both of which would now be a second voice in someone else's
	 * panel — are left to it.
	 */
	nested?: boolean;
}

/**
 * Per-section search keywords, re-exported flat for the Inspector's rail filter so the two can
 * never disagree. See `LAYOUT_KEYWORDS` for the rationale.
 */
const K = {
	tracks: [ 'grid', 'track', 'tracks', 'template', 'columns', 'rows', 'fr', 'minmax', 'repeat', 'auto', 'fit', 'equal', 'subgrid', 'sizing' ],
	gap: [ 'gap', 'gutter', 'space', 'between', 'row', 'column' ],
	placement: [ 'justify', 'align', 'items', 'placement', 'stretch', 'center', 'start', 'end', 'baseline' ],
	more: [ 'more', 'auto', 'flow', 'dense', 'areas', 'template', 'row', 'height', 'implicit' ],
};

export const GRID_KEYWORDS: string[] = [ ...new Set( Object.values( K ).flat() ) ];

/**
 * The **Grid** facet — grid *tracks*, split out of Layout so the container's own sizing model gets
 * a first-class surface (Layout keeps display/flex/size/overflow). Not to be confused with the
 * Multi-column facet, which is CSS multi-column (`column-count`), a different feature entirely.
 *
 * Reads and writes the same `layout.*` controlIds Layout used, so blocks styled before the split
 * keep rendering unchanged — this is a re-home, not a new attribute shape.
 *
 * Sizing is three icons rather than three words, and what it reveals follows the model: `auto-fit`
 * gets **min and max fields** instead of asking anyone to type `repeat(auto-fit, minmax(…))` by
 * hand, and Custom gets the template with the named layouts (Sidebar, Centered, Fluid) in its
 * dropdown. Equal shows nothing extra — the steppers above already say it.
 */
export function GridControl( { attributes, setAttributes, state, breakpoint, isAllowed, query, nested }: Props ) {
	const can = ( id: string ) => ( isAllowed ? isAllowed( id ) : true );
	const m = makeMatcher( query );
	const searching = Boolean( query && query.trim() );
	const anyMatch = Object.values( K ).some( ( keywords ) => m( keywords ) );

	const display = getValue( attributes, 'layout.display', state, breakpoint ) || '';
	const cols = getValue( attributes, 'layout.gridColumns', state, breakpoint ) || '';
	const rows = getValue( attributes, 'layout.gridRows', state, breakpoint ) || '';
	const autoRows = getValue( attributes, 'layout.gridAutoRows', state, breakpoint ) || '';
	const autoFlow = getValue( attributes, 'layout.gridAutoFlow', state, breakpoint ) || '';
	const areas = getValue( attributes, 'layout.gridAreas', state, breakpoint ) || '';
	const gapRow = getValue( attributes, 'layout.gapRow', state, breakpoint ) || '';
	const gapColumn = getValue( attributes, 'layout.gapColumn', state, breakpoint ) || '';
	const justifyItems = getValue( attributes, 'layout.justifyItems', state, breakpoint ) || '';
	const alignItems = getValue( attributes, 'layout.alignItems', state, breakpoint ) || '';

	const setVal = ( controlId: string ) => ( value: string ) =>
		setOrClear( attributes, setAttributes, controlId, state, breakpoint, value );
	const setClick = ( controlId: string, value: string ) => () =>
		setValue( attributes, setAttributes, controlId, state, breakpoint, value );

	const sizing = readSizing( cols );
	const colCount = readCount( cols );
	const rowCount = readCount( rows );
	const autoFit = readAutoFit( cols );

	const setColCount = ( n: number ) => {
		const next = Math.min( MAX_TRACKS, Math.max( 1, n ) );
		setVal( 'layout.gridColumns' )( next === 1 ? '' : `repeat(${ next }, 1fr)` );
	};
	const setRowCount = ( n: number ) => {
		const next = Math.min( MAX_TRACKS, Math.max( 1, n ) );
		setVal( 'layout.gridRows' )( next === 1 ? '' : `repeat(${ next }, 1fr)` );
	};

	const setAutoFit = ( min: string, max: string ) =>
		setVal( 'layout.gridColumns' )( `repeat(auto-fit, minmax(${ min || '200px' }, ${ max || '1fr' }))` );

	const applySizing = ( next: string ) => {
		// Clicking the lit icon clears it (`IconField`'s only route back to "not set"), which for a
		// template means no template at all — one implicit column, the browser's own default.
		if ( ! next ) return setVal( 'layout.gridColumns' )( '' );
		if ( next === 'equal' ) return setColCount( colCount );
		if ( next === 'auto' ) return setAutoFit( autoFit.min, autoFit.max );
		// Custom: seed the field from whatever is showing so the user edits rather than retypes —
		// but *expanded*, since `repeat(n, 1fr)` and `repeat(auto-fit, …)` both read back as another
		// model, which would bounce the click straight off the mode it was trying to enter.
		if ( sizing === 'custom' && cols ) return;
		setVal( 'layout.gridColumns' )( Array.from( { length: colCount }, () => '1fr' ).join( ' ' ) );
	};

	// Blocks whose manifest excludes `layout.display` ARE their display mode (Grid = grid), so the
	// empty state only applies where display is actually editable.
	const hasDisplay = can( 'layout.display' );
	const isGrid = display === 'grid' || display === 'inline-grid';

	if ( ! nested && hasDisplay && ! isGrid ) {
		return (
			<div className="bl-grid-control bl-layout">
				<p className="bl-empty">
					{ __( 'Grid tracks apply when display is Grid.', 'blicks' ) }{ ' ' }
					<button
						type="button"
						className="bl-empty__fix"
						onClick={ setClick( 'layout.display', 'grid' ) }
					>
						{ __( 'Switch to Grid', 'blicks' ) }
					</button>
				</p>
			</div>
		);
	}

	// Always draw at least two rows: a single row of one cell reads as an empty bar rather than
	// as a grid, which is exactly when the preview most needs to explain itself.
	const previewRows = Math.max( 2, Math.min( rowCount, 4 ) );
	const previewCells = Array.from( { length: colCount * previewRows } );

	const stepper = ( label: string, count: number, set: ( n: number ) => void, noun: string ) => (
		<div className="bl-tracks__row">
			<span className="bl-tracks__label">{ label }</span>
			<div className="bl-step">
				<button type="button" title={ `${ __( 'Remove', 'blicks' ) } ${ noun }` } onClick={ () => set( count - 1 ) }>−</button>
				<span className="bl-step__n">{ count }</span>
				<button type="button" title={ `${ __( 'Add', 'blicks' ) } ${ noun }` } onClick={ () => set( count + 1 ) }>+</button>
			</div>
		</div>
	);

	const moreCount = [ autoRows, autoFlow, areas ].filter( Boolean ).length;

	return (
		<div className={ nested ? 'bl-grid-control' : 'bl-grid-control bl-layout' }>
			{ ! nested && ! anyMatch && <NoMatches query={ query ?? '' } /> }

			{ ( can( 'layout.gridColumns' ) || can( 'layout.gridRows' ) ) && m( K.tracks ) && (
			<MoreSettings label="Tracks" defaultOpen forceOpen={ searching }>
				{ stepper( __( 'Columns', 'blicks' ), colCount, setColCount, __( 'column', 'blicks' ) ) }
				{ stepper( __( 'Rows', 'blicks' ), rowCount, setRowCount, __( 'row', 'blicks' ) ) }

				<div
					className="bl-grid-control__preview"
					aria-hidden="true"
					style={ { gridTemplateColumns: `repeat(${ colCount }, minmax(0, 1fr))` } }
				>
					{ previewCells.map( ( _, i ) => (
						<span key={ i } className={ i % 2 ? 'alt' : '' } />
					) ) }
				</div>

				<div className="bl-fields">
					<IconField
						label="SIZE"
						hint={ __( 'How the columns are sized', 'blicks' ) }
						value={ sizing }
						choices={ SIZING_CHOICES }
						onChange={ applySizing }
						onReset={ () => setVal( 'layout.gridColumns' )( '' ) }
					/>

					{ /* Each model reveals only what it needs: auto-fit is two bounds, custom is the
					     template itself, and equal is already fully said by the steppers. */ }
					{ sizing === 'auto' && (
						<>
							<LengthField
								label="MIN"
								hint={ __( 'Minimum track width', 'blicks' ) }
								category="width"
								literals={ LENGTH_SUGGESTIONS }
								pattern={ TRACK_PATTERN }
								value={ autoFit.min }
								placeholder="200px"
								onChange={ ( next ) => setAutoFit( next, autoFit.max ) }
								onReset={ () => setAutoFit( '200px', autoFit.max ) }
							/>
							<LengthField
								label="MAX"
								hint={ __( 'Maximum track width', 'blicks' ) }
								category="width"
								literals={ [ '1fr', ...LENGTH_SUGGESTIONS ] }
								pattern={ TRACK_PATTERN }
								value={ autoFit.max }
								placeholder="1fr"
								onChange={ ( next ) => setAutoFit( autoFit.min, next ) }
								onReset={ () => setAutoFit( autoFit.min, '1fr' ) }
							/>
						</>
					) }

					{ sizing === 'custom' && (
						<ValueField
							affix={ <span className="bl-valuefield__cap" title={ __( 'Column template', 'blicks' ) }>TPL</span> }
							listLabel="TRACKS"
							value={ cols }
							options={ TEMPLATE_OPTIONS }
							placeholder="1fr 2fr 1fr"
							modified={ Boolean( cols ) }
							onChange={ setVal( 'layout.gridColumns' ) }
							onReset={ () => setVal( 'layout.gridColumns' )( '' ) }
						/>
					) }
				</div>
			</MoreSettings>
			) }

			{ ( can( 'layout.gapRow' ) || can( 'layout.gapColumn' ) ) && m( K.gap ) && (
			<MoreSettings label="Gap" defaultOpen forceOpen={ searching }>
				<div className="bl-fields bl-fields--2">
					<LengthField
						label="ROW"
						hint={ __( 'Row gap — space between rows', 'blicks' ) }
						category="spacing"
						literals={ LENGTH_SUGGESTIONS }
						pattern={ GAP_PATTERN }
						listLabel="SPACING LIBRARY"
						value={ gapRow }
						placeholder="0"
						onChange={ setVal( 'layout.gapRow' ) }
					/>
					<LengthField
						label="COL"
						hint={ __( 'Column gap — space between columns', 'blicks' ) }
						category="spacing"
						literals={ LENGTH_SUGGESTIONS }
						pattern={ GAP_PATTERN }
						listLabel="SPACING LIBRARY"
						value={ gapColumn }
						placeholder="0"
						onChange={ setVal( 'layout.gapColumn' ) }
					/>
				</div>
			</MoreSettings>
			) }

			{ ( can( 'layout.justifyItems' ) || can( 'layout.alignItems' ) ) && m( K.placement ) && (
			<MoreSettings label="Placement" defaultOpen forceOpen={ searching }>
				<div className="bl-fields">
					{ can( 'layout.justifyItems' ) && (
					<IconValueField
						label="JUSTIFY"
						hint={ __( 'Justify items — placement across the inline axis', 'blicks' ) }
						value={ justifyItems }
						choices={ JUSTIFY_ITEMS_CHOICES }
						options={ JUSTIFY_ITEMS_OPTIONS }
						placeholder="stretch"
						listLabel="JUSTIFY ITEMS"
						onChange={ setVal( 'layout.justifyItems' ) }
					/>
					) }
					{ can( 'layout.alignItems' ) && (
					<IconValueField
						label="ALIGN"
						hint={ __( 'Align items — placement across the block axis', 'blicks' ) }
						value={ alignItems }
						choices={ ALIGN_ITEMS_CHOICES }
						options={ ALIGN_ITEMS_OPTIONS }
						placeholder="stretch"
						listLabel="ALIGN ITEMS"
						onChange={ setVal( 'layout.alignItems' ) }
					/>
					) }
				</div>
			</MoreSettings>
			) }

			{ ( can( 'layout.gridAutoRows' ) || can( 'layout.gridAutoFlow' ) || can( 'layout.gridAreas' ) ) && m( K.more ) && (
			<MoreSettings
				label="Implicit tracks & areas"
				badge={ moreCount }
				defaultOpen={ moreCount > 0 }
				forceOpen={ searching }
			>
				{ ( can( 'layout.gridAutoRows' ) || can( 'layout.gridAutoFlow' ) ) && (
				<div className="bl-fields">
					{ can( 'layout.gridAutoRows' ) && (
					<LengthField
						label="ROW H"
						hint={ __( 'Height of rows the grid creates itself', 'blicks' ) }
						category="width"
						literals={ [ 'auto', 'min-content', 'max-content', ...LENGTH_SUGGESTIONS ] }
						pattern={ TRACK_PATTERN }
						value={ autoRows }
						placeholder="auto"
						onChange={ setVal( 'layout.gridAutoRows' ) }
						onReset={ () => setVal( 'layout.gridAutoRows' )( '' ) }
					/>
					) }
					{ can( 'layout.gridAutoFlow' ) && (
					<IconValueField
						label="FLOW"
						hint={ __( 'Auto flow — the direction items fill the grid', 'blicks' ) }
						value={ autoFlow }
						choices={ FLOW_CHOICES }
						options={ FLOW_OPTIONS }
						placeholder="row"
						listLabel="AUTO FLOW"
						onChange={ setVal( 'layout.gridAutoFlow' ) }
					/>
					) }
				</div>
				) }

				{ can( 'layout.gridAreas' ) && (
				<div className="bl-grid-control__areas">
					<span className="bl-tracks__label">{ __( 'Areas', 'blicks' ) }</span>
					{ /* Free-form and multi-line — the one value in this facet no field shape fits. */ }
					<textarea
						className="bl-textarea"
						value={ areas }
						placeholder={ '"header header"\n"nav main"' }
						rows={ 3 }
						onChange={ ( e ) => setVal( 'layout.gridAreas' )( e.target.value ) }
					/>
				</div>
				) }
			</MoreSettings>
			) }
		</div>
	);
}
