import { __ } from '@wordpress/i18n';
import { getValue, setValue } from '@/framework/values';
import {
	LENGTH_PATTERN,
	LENGTH_SUGGESTIONS,
	NoMatches,
	makeMatcher,
	setOrClear,
} from '@/controls/common';
import { lengthOrTokenPattern } from '@/controls/token-utils';
import { IconField, type IconChoice } from '@/controls/IconValueField';
import { FieldGroup, LengthField, ValueField } from '@/controls/ValueField';
import './columns.scss';

// columnWidth resolves token slugs against the width scale, columnGap against the spacing scale
// (see `valOrToken`/`cssValueForCategory` in the style engine).
const WIDTH_PATTERN = lengthOrTokenPattern( 'width', LENGTH_PATTERN );
const GAP_PATTERN = lengthOrTokenPattern( 'spacing', LENGTH_PATTERN );

const COUNT_OPTIONS = [ 'auto', '2', '3', '4', '5' ].map( ( value ) => ( { value, label: value } ) );

/**
 * `break-inside` takes `auto` or `avoid` here — the `avoid-page` / `avoid-column` spellings are
 * paged-media concerns that do nothing in a browser column box. Two fixed values, so icons and no
 * field.
 */
const BREAK_CHOICES: IconChoice[] = [
	{
		value: 'auto',
		title: __( 'Allow — items may split across a column boundary', 'blicks' ),
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
				<rect x="3" y="4" width="18" height="7" rx="1" /><rect x="3" y="13" width="18" height="7" rx="1" />
				<line x1="1" y1="12" x2="23" y2="12" strokeDasharray="2 2" strokeWidth="1.5" />
			</svg>
		),
	},
	{
		value: 'avoid',
		title: __( 'Avoid — keep each item whole in one column', 'blicks' ),
		icon: (
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
				<rect x="3" y="5" width="18" height="14" rx="1" />
			</svg>
		),
	},
];

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
	isAllowed?: ( controlId: string ) => boolean;
	/** Property-search query from the Inspector. Absent/empty → every section renders. */
	query?: string;
}

/**
 * Per-section search keywords, re-exported flat for the Inspector's rail filter so the two can
 * never disagree. See `LAYOUT_KEYWORDS` for the rationale.
 */
const K = {
	tracks: [ 'multi', 'column', 'columns', 'count', 'newspaper', 'flow', 'width', 'gap', 'gutter' ],
	breaks: [ 'break', 'inside', 'avoid', 'split', 'orphan', 'widow' ],
};

export const COLUMNS_KEYWORDS: string[] = [ ...new Set( Object.values( K ).flat() ) ];

/**
 * **Multi-column** — CSS multicol, which flows a block's *own content* into newspaper columns.
 *
 * Not to be confused with the Grid facet: this lays out nothing: the content reflows across the
 * columns by itself, and there is no per-child control anywhere in it. It earns its place on a
 * block of running text or a wrapper holding many small items.
 *
 * Multicol applies to **block containers only** — the properties are inert on a flex or grid
 * container, so a block whose display is either gets the empty state rather than four fields that
 * emit CSS the browser will ignore.
 */
export function ColumnsControl( { attributes, setAttributes, state, breakpoint, isAllowed, query }: Props ) {
	const can = ( controlId: string ) => ! isAllowed || isAllowed( controlId );
	const m = makeMatcher( query );
	const searching = Boolean( query && query.trim() );
	const anyMatch = Object.values( K ).some( ( keywords ) => m( keywords ) );

	const columnCount = getValue( attributes, 'columns.columnCount', state, breakpoint ) || '';
	const columnWidth = getValue( attributes, 'columns.columnWidth', state, breakpoint ) || '';
	const columnGap   = getValue( attributes, 'columns.columnGap',   state, breakpoint ) || '';
	const breakInside = getValue( attributes, 'columns.breakInside', state, breakpoint ) || '';

	const setVal = ( controlId: string ) => ( value: string ) =>
		setOrClear( attributes, setAttributes, controlId, state, breakpoint, value );

	const cleanCount = ( raw: string ) => {
		const trimmed = raw.trim().toLowerCase();
		if ( trimmed === '' || trimmed === 'auto' ) return trimmed;
		const n = Number.parseInt( trimmed, 10 );
		return Number.isFinite( n ) && n > 0 ? String( Math.min( n, 24 ) ) : '';
	};

	// A block whose manifest excludes `layout.display` IS its display mode, and the only blocks
	// carrying this facet are block containers — so with no display control, multicol applies.
	const display = getValue( attributes, 'layout.display', state, breakpoint ) || '';
	const hasDisplay = can( 'layout.display' );
	const isInert = hasDisplay && /^(inline-)?(flex|grid)$/.test( display );

	if ( isInert ) {
		return (
			<div className="bl-columns bl-layout">
				<p className="bl-empty">
					{ /* translators: %s: the current display value, e.g. flex */
					  __( 'Columns do not apply to a %s container — its children lay themselves out.', 'blicks' ).replace( '%s', display ) }{ ' ' }
					<button
						type="button"
						className="bl-empty__fix"
						onClick={ () => setValue( attributes, setAttributes, 'layout.display', state, breakpoint, 'block' ) }
					>
						{ __( 'Switch to Block', 'blicks' ) }
					</button>
				</p>
			</div>
		);
	}

	return (
		<div className="bl-columns bl-layout">
			{ ! anyMatch && <NoMatches query={ query ?? '' } /> }

			{ ( can( 'columns.columnCount' ) || can( 'columns.columnWidth' ) || can( 'columns.columnGap' ) ) && m( K.tracks ) && (
			<div className="bl-columns-group">
				<div className="bl-spacing-head">
					<span>{ __( 'Columns', 'blicks' ) }</span>
					{ ( columnCount || columnWidth || columnGap ) && <span className="bl-mod-dot" aria-hidden="true" /> }
				</div>
				<div className="bl-fields">
					{ can( 'columns.columnCount' ) && (
					<FieldGroup
						title={ __( 'Minimum column width', 'blicks' ) }
						constrained={ Boolean( columnWidth ) }
						defaultOpen={ Boolean( columnWidth ) }
						forceOpen={ searching }
						field={ ( toggle ) => (
							<ValueField
								affix={ <>{ toggle }<span className="bl-valuefield__cap" title={ __( 'How many columns the content flows into', 'blicks' ) }>COUNT</span></> }
								listLabel="COLUMNS"
								value={ columnCount }
								options={ COUNT_OPTIONS }
								placeholder="auto"
								modified={ Boolean( columnCount ) }
								onChange={ setVal( 'columns.columnCount' ) }
								onCommit={ ( raw ) => setVal( 'columns.columnCount' )( cleanCount( raw ) ) }
								onReset={ () => setVal( 'columns.columnCount' )( '' ) }
							/>
						) }
					>
						{ /* Width nests under count because the two are the same question asked from
						     opposite ends: fix the number and let the columns size themselves, or fix a
						     minimum width and let the number fall out of it. Read as siblings they look
						     like rival settings. */ }
						{ can( 'columns.columnWidth' ) && (
						<LengthField
							label="MIN W"
							hint={ __( 'Minimum column width — the count then follows from the space available', 'blicks' ) }
							category="width"
							literals={ LENGTH_SUGGESTIONS }
							pattern={ WIDTH_PATTERN }
							value={ columnWidth }
							placeholder="auto"
							onChange={ setVal( 'columns.columnWidth' ) }
							onReset={ () => setVal( 'columns.columnWidth' )( '' ) }
						/>
						) }
					</FieldGroup>
					) }
					{ can( 'columns.columnGap' ) && (
					<LengthField
						label="GAP"
						hint={ __( 'Gutter between the columns', 'blicks' ) }
						category="spacing"
						literals={ [ 'normal', ...LENGTH_SUGGESTIONS ] }
						pattern={ GAP_PATTERN }
						listLabel="SPACING LIBRARY"
						value={ columnGap }
						placeholder="normal"
						onChange={ setVal( 'columns.columnGap' ) }
						onReset={ () => setVal( 'columns.columnGap' )( '' ) }
					/>
					) }
				</div>
			</div>
			) }

			{ can( 'columns.breakInside' ) && m( K.breaks ) && (
			<div className="bl-columns-group">
				<div className="bl-spacing-head">
					<span>{ __( 'Breaks', 'blicks' ) }</span>
					{ breakInside && <span className="bl-mod-dot" aria-hidden="true" /> }
				</div>
				<div className="bl-fields">
					<IconField
						label="BREAK"
						hint={ __( 'Break inside — whether an item may split across a column boundary', 'blicks' ) }
						value={ breakInside }
						choices={ BREAK_CHOICES }
						onChange={ setVal( 'columns.breakInside' ) }
						onReset={ () => setVal( 'columns.breakInside' )( '' ) }
					/>
				</div>
			</div>
			) }
		</div>
	);
}
