import { useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { getValue, setValue } from '@/framework/values';
import { THEME_COLORS } from '@/controls/color/ColorControl';
import {
	IconBtn,
	IconSeg,
	LENGTH_PATTERN,
	NoMatches,
	ResetButton,
	makeMatcher,
	validateOrEmpty,
} from '@/controls/common';
import { lengthOrTokenPattern, lengthOrTokenPatternMulti, resolveTokenValues } from '@/controls/token-utils';
import { ColorRow } from '@/controls/ColorRow';
import { IconValueField, type IconChoice } from '@/controls/IconValueField';
import { FieldGroup, LengthField, ValueField } from '@/controls/ValueField';
import './border.scss';

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
type Corner = 'topLeft' | 'topRight' | 'bottomRight' | 'bottomLeft';

const SIDES: Side[] = [ 'top', 'right', 'bottom', 'left' ];
const CORNERS: Corner[] = [ 'topLeft', 'topRight', 'bottomRight', 'bottomLeft' ];

const SIDE_LABEL: Record< Side, string > = {
	top: __( 'top', 'blicks' ),
	right: __( 'right', 'blicks' ),
	bottom: __( 'bottom', 'blicks' ),
	left: __( 'left', 'blicks' ),
};

const CORNER_META: Array< [ Corner, string, string ] > = [
	[ 'topLeft', 'c-top-left', __( 'top left', 'blicks' ) ],
	[ 'topRight', 'c-top-right', __( 'top right', 'blicks' ) ],
	[ 'bottomLeft', 'c-bottom-left', __( 'bottom left', 'blicks' ) ],
	[ 'bottomRight', 'c-bottom-right', __( 'bottom right', 'blicks' ) ],
];

/** Which side the width/style/colour fields are pointed at, drawn as the edge itself. */
const SIDE_CHOICES: Array< [ Side, JSX.Element ] > = [
	[ 'top', <svg key="t" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="3" width="16" height="4" /><rect x="4" y="10" width="16" height="11" opacity="0.18" /></svg> ],
	[ 'right', <svg key="r" viewBox="0 0 24 24" fill="currentColor"><rect x="17" y="4" width="4" height="16" /><rect x="3" y="4" width="11" height="16" opacity="0.18" /></svg> ],
	[ 'bottom', <svg key="b" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="17" width="16" height="4" /><rect x="4" y="3" width="16" height="11" opacity="0.18" /></svg> ],
	[ 'left', <svg key="l" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="4" height="16" /><rect x="10" y="4" width="11" height="16" opacity="0.18" /></svg> ],
];

/**
 * A stroke sample per style. The line IS the label, so these carry no caption and no text — but
 * they only work drawn wide: a dash pattern squeezed into a 15px square is a smudge. The frame
 * takes `--strokes`, which gives the row a 2:1 glyph.
 *
 * Dotted needs round caps — with the butt caps the other two use, a `0.1` dash renders as nothing.
 */
const strokeIcon = ( dash?: string, round?: boolean ) => (
	<svg viewBox="0 0 24 12" fill="none" stroke="currentColor" strokeWidth={ round ? 3 : 2.6 } strokeLinecap={ round ? 'round' : 'butt' }>
		<line x1={ round ? 2 : 1 } y1="6" x2={ round ? 22 : 23 } y2="6" strokeDasharray={ dash } />
	</svg>
);

// No `none` icon: it is the initial value, so an empty field already says none — and three
// samples get a third of the row each instead of a quarter.
const STYLE_CHOICES: IconChoice[] = [
	{ value: 'solid', title: __( 'Solid', 'blicks' ), icon: strokeIcon() },
	{ value: 'dashed', title: __( 'Dashed', 'blicks' ), icon: strokeIcon( '5 3.5' ) },
	{ value: 'dotted', title: __( 'Dotted', 'blicks' ), icon: strokeIcon( '0.1 5', true ) },
];
const STYLE_OPTIONS = [ 'none', 'solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'inset', 'outset', 'hidden' ]
	.map( ( value ) => ( { value, label: value } ) );

const LINK_ICON = (
	<svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
		<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
		<path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
	</svg>
);

/**
 * Read one side out of a per-side value. Tolerates a bare string, which is how `border.style` and
 * `border.color` were stored before they became per-side — the same back-compat the style engine
 * applies when it expands a string across all four sides.
 */
function sideOf( value: any, key: string ): string {
	if ( typeof value === 'string' ) return value;
	return String( value?.[ key ] ?? '' );
}

const BORDER_PATTERN = /^(0|\d+(\.\d+)?(px|%|em|rem)|thin|medium|thick)$/;
const BORDER_SUGGESTIONS = [ '0', '1px', '2px', 'thin', 'thick' ];
// Width sides resolve token slugs against the dedicated borderWidth scale, radius corners
// against the radius scale (see `valOrToken` in the style engine). Also accepts the old spacing
// scale so values saved before the borderWidth category existed keep validating (the engine's
// `fallbackCategory` resolves them the same way).
const BORDER_WIDTH_PATTERN = lengthOrTokenPatternMulti( [ 'borderWidth', 'spacing' ], BORDER_PATTERN );
const RADIUS_PATTERN = lengthOrTokenPattern( 'radius', LENGTH_PATTERN );
// `auto`/`1fr`/`100vh` from the generic length set are meaningless for a corner radius.
const RADIUS_LITERALS = [ '0', '2px', '4px', '8px', '16px', '50%', '9999px' ];

/**
 * Per-section search keywords, re-exported flat for the Inspector's rail filter so the two can
 * never disagree. See `LAYOUT_KEYWORDS` for the rationale.
 *
 * `outline` is deliberately absent — it is a *decoration* property (`DECO_EXTRA` in the style
 * engine), not a block-level border control, so answering to it here would open a facet that
 * cannot edit it.
 */
const K = {
	sides: [ 'border', 'side', 'sides', 'link', 'uniform', 'top', 'right', 'bottom', 'left' ],
	width: [ 'border', 'width', 'thickness', 'thin', 'thick', 'stroke' ],
	style: [ 'border', 'style', 'solid', 'dashed', 'dotted', 'none', 'line' ],
	color: [ 'border', 'colour', 'color', 'stroke', 'swatch' ],
	radius: [ 'border', 'radius', 'corner', 'corners', 'rounded', 'round', 'pill', 'circle' ],
};

export const BORDER_KEYWORDS: string[] = [ ...new Set( Object.values( K ).flat() ) ];

/**
 * Border — width, style, colour and radius, over a live preview that renders what the engine
 * actually emits.
 *
 * Two devices carry the per-side story, and both are borrowed rather than invented: the **link
 * toggle** in the section head is the one Spacing uses for margin and padding, and the **corner
 * cross** is the box-model cross Spacing and Position draw, with a field at each corner instead of
 * each edge. Learning either one once covers all four facets.
 */
export function BorderControl( { attributes, setAttributes, state, breakpoint, isAllowed, query }: Props ) {
	const can = ( controlId: string ) => ! isAllowed || isAllowed( controlId );
	const m = makeMatcher( query );
	const searching = Boolean( query && query.trim() );

	const width = getValue( attributes, 'border.width', state, breakpoint ) || {};
	const style = getValue( attributes, 'border.style', state, breakpoint ) || '';
	const color = getValue( attributes, 'border.color', state, breakpoint ) || '';
	const radius = getValue( attributes, 'border.radius', state, breakpoint ) || {};

	// One question — "is this border uniform?" — so one toggle, covering width/style/colour.
	// It opens per-side only when the saved value actually differs somewhere.
	const uniform = ( value: any, keys: string[] ) =>
		typeof value === 'string' ||
		! value ||
		keys.every( ( k ) => ( value[ k ] ?? '' ) === ( value[ keys[ 0 ] ] ?? '' ) );

	const [ linked, setLinked ] = useState(
		uniform( width, SIDES ) && uniform( style, SIDES ) && uniform( color, SIDES )
	);
	const [ activeSide, setActiveSide ] = useState< Side >( 'top' );
	/** Which side the fields below read/write. Linked mode edits every side through `top`. */
	const side: Side = linked ? 'top' : activeSide;

	/** Current value as a full per-side object, whatever shape it was stored in. */
	const asSides = ( value: any, keys: string[] ) =>
		keys.reduce( ( acc: any, k ) => {
			acc[ k ] = sideOf( value, k );
			return acc;
		}, {} );

	/** Write one side — or, when linked, all of them. Always stores the object shape. */
	const writeSide = ( attr: string, value: any, keys: string[], key: string, val: string ) => {
		const next = linked
			? keys.reduce( ( acc: any, k ) => { acc[ k ] = val; return acc; }, {} )
			: { ...asSides( value, keys ), [ key ]: val };
		setValue( attributes, setAttributes, attr, state, breakpoint, next );
	};

	const onWidthChange = ( val: string ) => writeSide( 'border.width', width, SIDES, side, val );
	const onStyleChange = ( val: string ) => writeSide( 'border.style', style, SIDES, side, val );
	const onColorChange = ( val: string ) => writeSide( 'border.color', color, SIDES, side, val );

	/** A radius corner is never "linked to a side" — it follows its own toggle below. */
	const onRadiusChange = ( corner: Corner, val: string, all = false ) => {
		const next = all
			? CORNERS.reduce( ( acc: any, k ) => { acc[ k ] = val; return acc; }, {} )
			: { ...asSides( radius, CORNERS ), [ corner ]: val };
		setValue( attributes, setAttributes, 'border.radius', state, breakpoint, next );
	};

	/**
	 * Re-linking spreads the side you were last editing across the rest, so the single field you're
	 * left looking at is the border you actually get — silently keeping four divergent values behind
	 * one input would be worse.
	 */
	const setLinkedMode = ( next: boolean ) => {
		if ( next ) {
			for ( const [ attr, value ] of [
				[ 'border.width', width ],
				[ 'border.style', style ],
				[ 'border.color', color ],
			] as const ) {
				const flat = sideOf( value, activeSide );
				setValue( attributes, setAttributes, attr, state, breakpoint,
					SIDES.reduce( ( acc: any, k ) => { acc[ k ] = flat; return acc; }, {} ) );
			}
		}
		setLinked( next );
	};

	const hasAny = ( value: any ) => ( typeof value === 'string' ? Boolean( value ) : Object.values( value ?? {} ).some( Boolean ) );
	const hasWidthValue = hasAny( width );
	const hasRadiusValue = hasAny( radius );
	const cornersDiffer = ! uniform( radius, CORNERS );

	const sideWidth = sideOf( width, side );
	const sideStyle = sideOf( style, side );
	const sideColor = sideOf( color, side );

	const showWidth = can( 'border.width' ) && m( K.width );
	const showStyle = can( 'border.style' ) && m( K.style );
	const showColor = can( 'border.color' ) && m( K.color );
	const showRadius = can( 'border.radius' ) && m( K.radius );
	const showEdge = showWidth || showStyle || showColor;
	const anyShown = showEdge || showRadius;

	const widthTokens = useMemo( () => resolveTokenValues( 'borderWidth' ), [ JSON.stringify( width ) ] );
	const radiusTokens = useMemo( () => resolveTokenValues( 'radius' ), [ JSON.stringify( radius ) ] );

	/** Token slug → its live value; a literal length passes straight through. */
	const asLength = ( tokens: Record< string, string >, value: string ) =>
		value ? tokens[ value ] || value : '';
	const asColor = ( value: string ) => {
		if ( ! value ) return 'currentcolor';
		return THEME_COLORS.find( ( c ) => c.slug === value )?.color ?? value;
	};

	// Honest preview: it renders exactly what the engine emits, including the empty-value
	// fallbacks (`border-style: none`, `border-color: currentcolor`). A width with no style really
	// does draw nothing, and the preview should say so rather than flatter the setting.
	const previewStyle: Record< string, string > = {};
	for ( const s of SIDES ) {
		const cap = s[ 0 ].toUpperCase() + s.slice( 1 );
		previewStyle[ `border${ cap }Width` ] = asLength( widthTokens, sideOf( width, s ) ) || '0';
		previewStyle[ `border${ cap }Style` ] = sideOf( style, s ) || 'none';
		previewStyle[ `border${ cap }Color` ] = asColor( sideOf( color, s ) );
	}
	for ( const c of CORNERS ) {
		const cap = c[ 0 ].toUpperCase() + c.slice( 1 );
		previewStyle[ `border${ cap }Radius` ] = asLength( radiusTokens, sideOf( radius, c ) ) || '0';
	}

	const cornerCell = ( corner: Corner, cls: string, label: string ) => (
		<div key={ corner } className={ `bl-cross__cell ${ cls }` }>
			<ValueField
				value={ String( radius[ corner ] ?? '' ) }
				ariaLabel={ `${ __( 'Radius', 'blicks' ) } ${ label }` }
				options={ RADIUS_LITERALS.map( ( v ) => ( { value: v, label: v } ) ) }
				placeholder="0"
				listLabel="RADIUS"
				modified={ Boolean( radius[ corner ] ) }
				onChange={ ( next ) => onRadiusChange( corner, next ) }
				onCommit={ ( raw ) => onRadiusChange( corner, validateOrEmpty( raw, RADIUS_PATTERN ) ) }
			/>
		</div>
	);

	return (
		<div className="bl-border-control">
			{ ! anyShown && <NoMatches query={ query ?? '' } /> }

			{ anyShown && (
				<div className="bl-border-preview" aria-hidden="true">
					<span className="bl-border-preview__box" style={ previewStyle as any } />
				</div>
			) }

			{ showEdge && (
			<div className="bl-border-group">
				<div className="bl-spacing-head">
					<span>{ __( 'Edge', 'blicks' ) }</span>
					{ ( hasWidthValue || hasAny( style ) || hasAny( color ) ) && <span className="bl-mod-dot" aria-hidden="true" /> }
					<div className="bl-spacing-actions">
						<ResetButton
							idle={ ! ( hasWidthValue || hasAny( style ) || hasAny( color ) ) }
							onClick={ () => {
								for ( const attr of [ 'border.width', 'border.style', 'border.color' ] ) {
									setValue( attributes, setAttributes, attr, state, breakpoint, '' );
								}
							} }
						/>
						{ /* The same link toggle Spacing uses on margin and padding: on means one border
						     all round, off means the side picker below chooses which edge you are editing. */ }
						<button
							type="button"
							className={ `bl-spacing-link ${ linked ? 'on' : '' }` }
							aria-pressed={ linked }
							aria-label={ __( 'Link all sides', 'blicks' ) }
							title={ __( 'Link all sides', 'blicks' ) }
							onClick={ () => setLinkedMode( ! linked ) }
						>
							{ LINK_ICON }
						</button>
					</div>
				</div>

				<div className="bl-fields">
					{ /* No `is-set` on the picker: the frame accent means "this holds a value" everywhere
					     else, and this row holds none — it only points the three fields below at an edge. */ }
					{ ! linked && (
					<div className="bl-valuefield bl-valuefield--icons">
						<span className="bl-valuefield__cap" title={ __( 'Which edge the fields below edit', 'blicks' ) }>SIDE</span>
						<div className="bl-valuefield__icons">
							<IconSeg>
								{ SIDE_CHOICES.map( ( [ id, icon ] ) => (
									<IconBtn
										key={ id }
										title={ SIDE_LABEL[ id ] }
										active={ activeSide === id }
										// A dot marks the sides that already carry a value, so switching
										// away from one you have set is never a silent loss.
										className={ sideOf( width, id ) || sideOf( style, id ) || sideOf( color, id ) ? 'has-value' : '' }
										onClick={ () => setActiveSide( id ) }
									>
										{ icon }
									</IconBtn>
								) ) }
							</IconSeg>
						</div>
					</div>
					) }

					{ showWidth && (
					<LengthField
						label="WIDTH"
						hint={ __( 'Border width', 'blicks' ) }
						category="borderWidth"
						literals={ BORDER_SUGGESTIONS }
						pattern={ BORDER_WIDTH_PATTERN }
						listLabel="WIDTH LIBRARY"
						value={ sideWidth }
						placeholder="0"
						onChange={ onWidthChange }
						onReset={ () => setValue( attributes, setAttributes, 'border.width', state, breakpoint, '' ) }
					/>
					) }

					{ showStyle && (
					<IconValueField
						className="bl-valuefield--strokes"
						value={ sideStyle }
						choices={ STYLE_CHOICES }
						options={ STYLE_OPTIONS }
						placeholder="none"
						listLabel="STYLES"
						onChange={ onStyleChange }
					/>
					) }

					{ showColor && (
					<ColorRow
						hint={ __( 'Border colour', 'blicks' ) }
						value={ sideColor }
						onChange={ onColorChange }
					/>
					) }
				</div>
			</div>
			) }

			{ showRadius && (
			<div className="bl-border-group">
				<div className="bl-spacing-head">
					<span>{ __( 'Radius', 'blicks' ) }</span>
					{ hasRadiusValue && <span className="bl-mod-dot" aria-hidden="true" /> }
					<div className="bl-spacing-actions">
						<ResetButton
							idle={ ! hasRadiusValue }
							onClick={ () => setValue( attributes, setAttributes, 'border.radius', state, breakpoint, '' ) }
						/>
					</div>
				</div>

				{ /* One radius, with the four corners nested behind the toggle — the same shape Width
				     uses for its min and max. A radius has no "top", so the per-corner view is the
				     corner cross rather than the side cross. */ }
				<div className="bl-fields">
					<FieldGroup
						title={ __( 'Per corner', 'blicks' ) }
						constrained={ cornersDiffer }
						defaultOpen={ cornersDiffer }
						forceOpen={ searching }
						field={ ( toggle ) => (
							<LengthField
								before={ toggle }
								label="ALL"
								hint={ __( 'Radius on every corner', 'blicks' ) }
								category="radius"
								literals={ RADIUS_LITERALS }
								pattern={ RADIUS_PATTERN }
								listLabel="RADIUS LIBRARY"
								value={ sideOf( radius, 'topLeft' ) }
								placeholder="0"
								onChange={ ( next ) => onRadiusChange( 'topLeft', next, true ) }
								onReset={ () => setValue( attributes, setAttributes, 'border.radius', state, breakpoint, '' ) }
							/>
						) }
					>
						<div className="bl-cross bl-cross--corners">
							{ CORNER_META.map( ( [ corner, cls, label ] ) => cornerCell( corner, cls, label ) ) }
							<span className="bl-cross__core">RADIUS</span>
						</div>
					</FieldGroup>
				</div>
			</div>
			) }
		</div>
	);
}
