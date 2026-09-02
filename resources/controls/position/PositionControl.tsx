import { __ } from '@wordpress/i18n';
import { getValue, setValue } from '@/framework/values';
import {
	LENGTH_SUGGESTIONS,
	NoMatches,
	Z_INDEX_SUGGESTIONS,
	makeMatcher,
	validateOrEmpty,
} from '@/controls/common';
import { lengthOrTokenPattern } from '@/controls/token-utils';
import { tokenComboboxOptions } from '@/controls/TokenCombobox';
import { IconValueField, type IconChoice } from '@/controls/IconValueField';
import { FieldGroup, LengthField, ValueField } from '@/controls/ValueField';
import './position.scss';

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
	isAllowed?: ( controlId: string ) => boolean;
	/** Property-search query from the Inspector. Absent/empty → every section renders. */
	query?: string;
}

type Side = 'top' | 'right' | 'bottom' | 'left';

const SIDE_LABEL: Record< Side, string > = {
	top: __( 'top', 'blicks' ),
	right: __( 'right', 'blicks' ),
	bottom: __( 'bottom', 'blicks' ),
	left: __( 'left', 'blicks' ),
};

// An inset takes a length, `auto`, or a spacing token slug — the engine resolves slugs through
// `valOrToken`, same as margin and padding.
const INSET_PATTERN = lengthOrTokenPattern( 'spacing', /^(auto|-?\d+(\.\d+)?(px|%|em|rem|vh|vw)?)$/ );
const INSET_OPTIONS = tokenComboboxOptions( 'spacing', [ 'auto', '0', ...LENGTH_SUGGESTIONS ] );

// Accepts 'auto', a bare integer, or a `zIndex` token slug (e.g. 'sticky', 'drawer').
const Z_INDEX_PATTERN = lengthOrTokenPattern( 'zIndex', /^(auto|-?\d+)$/ );

const choice = ( value: string, title: string, icon: JSX.Element ): IconChoice => ( { value, title, icon } );

const POSITION_OPTIONS = [ 'static', 'relative', 'absolute', 'fixed', 'sticky' ].map( ( value ) => ( { value, label: value } ) );

/**
 * The four values that take a block out of the flow get an icon; `static` does not, because it is
 * the initial value — an empty field already says static, and spending a fifth of the row saying
 * it again costs the value the width it needs to render `absolute`.
 */
const POSITION_CHOICES: IconChoice[] = [
	choice( 'relative', __( 'Relative', 'blicks' ),
		// solid box offset from a dashed ghost
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="3" y="10" width="9" height="7" rx="1" strokeDasharray="3 2" strokeWidth="1.5" /><rect x="12" y="5" width="9" height="7" rx="1" />
		</svg> ),
	choice( 'absolute', __( 'Absolute', 'blicks' ),
		// box floating over corner anchors
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="6" y="6" width="12" height="12" rx="1" />
			<circle cx="3" cy="3" r="1.5" fill="currentColor" stroke="none" />
			<circle cx="21" cy="3" r="1.5" fill="currentColor" stroke="none" />
			<circle cx="3" cy="21" r="1.5" fill="currentColor" stroke="none" />
			<circle cx="21" cy="21" r="1.5" fill="currentColor" stroke="none" />
		</svg> ),
	choice( 'fixed', __( 'Fixed', 'blicks' ),
		// box pinned inside a viewport outline
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="2" y="3" width="20" height="15" rx="1.5" /><rect x="8" y="7" width="8" height="7" rx="1" />
			<line x1="9" y1="21" x2="15" y2="21" /><line x1="12" y1="18" x2="12" y2="21" />
		</svg> ),
	choice( 'sticky', __( 'Sticky', 'blicks' ),
		// box with a thick band at the top
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="5" y="6" width="14" height="12" rx="1" /><line x1="5" y1="10" x2="19" y2="10" strokeWidth="3" strokeLinecap="round" />
		</svg> ),
];

/**
 * Per-section search keywords, re-exported flat for the Inspector's rail filter so the two can
 * never disagree. See `LAYOUT_KEYWORDS` for the rationale.
 *
 * No `float` — Layout owns that control, and a keyword that opens a facet which then cannot edit
 * it is worse than no match at all.
 */
const K = {
	// Inset is nested inside the type field now, so the two share a gate — searching "top" has to
	// leave the field that reveals it on screen.
	type: [ 'position', 'static', 'relative', 'absolute', 'fixed', 'sticky', 'pin', 'inset', 'offset', 'top', 'right', 'bottom', 'left' ],
	zIndex: [ 'z', 'index', 'z-index', 'stack', 'stacking', 'order', 'layer', 'above', 'below' ],
};

export const POSITION_KEYWORDS: string[] = [ ...new Set( Object.values( K ).flat() ) ];

/**
 * Position — how the block is taken out of (or kept in) the normal flow, where it sits once it is,
 * and what it stacks above.
 *
 * The inset is the same **cross** Spacing draws for margin and padding: four value fields laid out
 * where the side they write actually is. Sharing the figure is the point — an offset from the top
 * and a padding on the top are read the same way, so they should be edited the same way.
 */
export function PositionControl( { attributes, setAttributes, state, breakpoint, isAllowed, query }: Props ) {
	const can = ( controlId: string ) => ! isAllowed || isAllowed( controlId );
	const m = makeMatcher( query );
	const anyMatch = Object.values( K ).some( ( keywords ) => m( keywords ) );

	const positionType = getValue( attributes, 'position.type', state, breakpoint ) || '';
	const inset = getValue( attributes, 'position.inset', state, breakpoint ) || {};
	const zIndex = getValue( attributes, 'position.zIndex', state, breakpoint ) || '';

	const activeType = positionType || 'static';

	const writeInset = ( side: Side, value: string ) =>
		setValue( attributes, setAttributes, 'position.inset', state, breakpoint, { ...inset, [ side ]: value } );

	const cell = ( side: Side ) => (
		<div key={ side } className={ `bl-cross__cell b-${ side }` }>
			<ValueField
				value={ String( inset[ side ] ?? '' ) }
				ariaLabel={ `${ __( 'Inset', 'blicks' ) } ${ SIDE_LABEL[ side ] }` }
				options={ INSET_OPTIONS }
				placeholder="auto"
				listLabel="SPACING LIBRARY"
				modified={ Boolean( inset[ side ] ) }
				onChange={ ( next ) => writeInset( side, next ) }
				onCommit={ ( raw ) => writeInset( side, validateOrEmpty( raw.replace( /\s+/g, '' ), INSET_PATTERN ) ) }
			/>
		</div>
	);

	// Insets only mean anything once the block is positioned; a static block would get four fields
	// that change nothing.
	const isPositioned = activeType !== 'static';
	const hasInset = Object.values( inset ).some( Boolean );

	return (
		<div className="bl-position-control">
			{ ! anyMatch && <NoMatches query={ query ?? '' } /> }

			{ can( 'position.type' ) && m( K.type ) && (
			<div className="bl-position-group">
				<div className="bl-spacing-head">
					{ /* "Type", not "Position" — the facet header directly above already says Position,
					     and a section repeating its parent's name tells you nothing twice. */ }
					<span>{ __( 'Type', 'blicks' ) }</span>
					{ positionType && <span className="bl-mod-dot" aria-hidden="true" /> }
				</div>
				<div className="bl-fields">
					{ /* The inset belongs to the position that gives it meaning, so it nests under it
					     rather than sitting in a section of its own — the same relationship min and max
					     have with the length they bound. */ }
					<FieldGroup
						title={ __( 'Inset', 'blicks' ) }
						constrained={ hasInset }
						defaultOpen={ isPositioned && hasInset }
						forceOpen={ Boolean( query && query.trim() ) }
						field={ ( toggle ) => (
							<IconValueField
								before={ toggle }
								value={ positionType }
								choices={ POSITION_CHOICES }
								options={ POSITION_OPTIONS }
								placeholder="static"
								listLabel="POSITION"
								onChange={ ( next ) => setValue( attributes, setAttributes, 'position.type', state, breakpoint, next ) }
							/>
						) }
					>
						{ isPositioned ? (
							<div className="bl-cross">
								{ cell( 'top' ) }
								{ cell( 'left' ) }
								<span className="bl-cross__core">INSET</span>
								{ cell( 'right' ) }
								{ cell( 'bottom' ) }
							</div>
						) : (
							<p className="bl-empty">
								{ __( 'Insets apply once the block is positioned.', 'blicks' ) }{ ' ' }
								<button
									type="button"
									className="bl-empty__fix"
									onClick={ () => setValue( attributes, setAttributes, 'position.type', state, breakpoint, 'relative' ) }
								>
									{ __( 'Make it relative', 'blicks' ) }
								</button>
							</p>
						) }
					</FieldGroup>
				</div>
			</div>
			) }

			{ /* Z-index is top level, not nested under the inset: a stacking order also applies to
			     flex and grid children, so hiding it behind `position` was wrong. */ }
			{ can( 'position.zIndex' ) && m( K.zIndex ) && (
			<div className="bl-position-group">
				<div className="bl-spacing-head">
					<span>{ __( 'Stacking', 'blicks' ) }</span>
					{ zIndex && <span className="bl-mod-dot" aria-hidden="true" /> }
				</div>
				<div className="bl-fields">
					<LengthField
						label="Z-INDEX"
						hint={ __( 'What this block stacks above', 'blicks' ) }
						category="zIndex"
						literals={ Z_INDEX_SUGGESTIONS }
						pattern={ Z_INDEX_PATTERN }
						listLabel="Z-INDEX"
						value={ zIndex }
						placeholder="auto"
						onChange={ ( next ) => setValue( attributes, setAttributes, 'position.zIndex', state, breakpoint, next ) }
						onReset={ () => setValue( attributes, setAttributes, 'position.zIndex', state, breakpoint, '' ) }
					/>
				</div>
			</div>
			) }
		</div>
	);
}
