import { useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { getValue, setValue } from '@/framework/values';
import { LENGTH_SUGGESTIONS, MoreSettings, NoMatches, makeMatcher } from '@/controls/common';
import { resolveTokenValues, tokenOptions } from '@/controls/token-utils';
import { TokenLibrary } from '@/controls/TokenLibrary';
import { tokenComboboxOptions } from '@/controls/TokenCombobox';
import { ColorRow } from '@/controls/ColorRow';
import { IconField, IconValueField, type IconChoice } from '@/controls/IconValueField';
import { LengthField, OptionField, SliderField, ValueField } from '@/controls/ValueField';
import { SHAPE_PRESETS, shapeToCss, shapeToSvgPoints } from './shape-presets';
import './effects.scss';

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
	isAllowed?: ( controlId: string ) => boolean;
	/** Property-search query from the Inspector. Absent/empty → every section renders. */
	query?: string;
}

interface BoxShadow {
	inset: boolean;
	x: string;
	y: string;
	blur: string;
	spread: string;
	color: string;
}

interface TextShadow {
	x: string;
	y: string;
	blur: string;
	color: string;
}

const SHADOW_UNIT_PATTERN = /^-?\d+(\.\d+)?(px|em|rem|%)$/;

const choice = ( value: string, title: string, icon: JSX.Element ): IconChoice => ( { value, title, icon } );
const opts = ( values: readonly string[] ) => values.map( ( value ) => ( { value, label: value } ) );

/**
 * The four cursors you can actually draw. The rest — `wait`, `progress`, `crosshair`, `grab` —
 * are in the dropdown, where a name beats a 15px glyph nobody can tell from the one above it.
 */
const CURSOR_CHOICES: IconChoice[] = [
	choice( 'pointer', __( 'Pointer', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
			<path d="M6 3l12 8-5 1.4 2.6 5.3-2.4 1.2-2.6-5.3L6 17z" />
		</svg> ),
	choice( 'move', __( 'Move', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />
		</svg> ),
	choice( 'text', __( 'Text', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
			<path d="M12 4v16M9 4h6M9 20h6" />
		</svg> ),
	choice( 'not-allowed', __( 'Not allowed', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<circle cx="12" cy="12" r="9" /><line x1="6" y1="18" x2="18" y2="6" />
		</svg> ),
];
const CURSOR_OPTIONS = opts( [
	'auto', 'default', 'pointer', 'move', 'text', 'not-allowed', 'grab', 'grabbing',
	'crosshair', 'wait', 'progress', 'zoom-in', 'zoom-out', 'none',
] );

const BLEND_VALUES = [
	'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
	'color-dodge', 'color-burn', 'hard-light', 'soft-light',
	'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
] as const;

const SHADOW_KIND_CHOICES: IconChoice[] = [
	choice( 'outset', __( 'Outset — the shadow falls outside the box', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="4" y="4" width="13" height="13" rx="1" />
			<path d="M9 20h11V9" strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round" />
		</svg> ),
	choice( 'inset', __( 'Inset — the shadow falls inside the box', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="4" y="4" width="16" height="16" rx="1" />
			<path d="M7 16V7h9" strokeOpacity="0.45" strokeWidth="3" strokeLinecap="round" />
		</svg> ),
];

const TRANSFORM_STYLE_CHOICES: IconChoice[] = [
	choice( 'flat', __( 'Flat — children are flattened into this plane', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="5" y="5" width="14" height="14" rx="1" />
		</svg> ),
	choice( 'preserve-3d', __( 'Preserve 3D — children keep their own depth', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="3" y="7" width="12" height="12" rx="1" /><path d="M8 4h11v11" strokeOpacity="0.5" />
		</svg> ),
];

const MASK_CHOICES: IconChoice[] = [
	choice( 'edge-fade', __( 'Fade one edge', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="3" y="6" width="18" height="12" rx="1" />
			<path d="M14 6v12M17 6v12" strokeOpacity="0.45" />
		</svg> ),
	choice( 'edge-fade-both', __( 'Fade both edges', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="3" y="6" width="18" height="12" rx="1" />
			<path d="M7 6v12M17 6v12" strokeOpacity="0.45" />
		</svg> ),
	choice( 'radial', __( 'Fade to a circle', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<rect x="3" y="6" width="18" height="12" rx="1" /><circle cx="12" cy="12" r="4" strokeOpacity="0.5" />
		</svg> ),
];

const SIDE_CHOICES: IconChoice[] = [
	choice( 'left', __( 'Left', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="5" width="5" height="14" /></svg> ),
	choice( 'right', __( 'Right', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="currentColor"><rect x="16" y="5" width="5" height="14" /></svg> ),
	choice( 'top', __( 'Top', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="3" width="14" height="5" /></svg> ),
	choice( 'bottom', __( 'Bottom', 'blicks' ),
		<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="16" width="14" height="5" /></svg> ),
];

const CLIP_SHAPES = [ 'diagonal', 'diagonal-reverse', 'notch', 'chevron', 'fold', 'circle', 'ellipse', 'inset', 'custom' ] as const;

const TRANSITION_SUGGESTIONS = [
	'all 200ms ease', 'none', 'all 300ms cubic-bezier(0.4,0,0.2,1)',
	'opacity 200ms ease', 'transform 200ms ease',
];
const TRANSFORM_SUGGESTIONS = [
	'none', 'translateX(10px)', 'translateY(10px)', 'scale(1.05)', 'rotate(45deg)', 'skewX(10deg)',
];
const FILTER_SUGGESTIONS = [
	'none', 'blur(4px)', 'brightness(1.2)', 'contrast(1.1)', 'grayscale(100%)', 'opacity(0.5)', 'saturate(2)',
];
const ORIGIN_SUGGESTIONS = [
	'center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right',
];

// The keywords above are suggestions, not the value space: `transform-origin` also takes one or
// two lengths (`50% 50%`, `10px 2rem`, `left 20px`), so the field keeps those out of the guard.
const ORIGIN_PATTERN = /^(?:(center|top|bottom|left|right|-?\d*\.?\d+(px|%|em|rem|vw|vh)?)(\s+|$)){1,3}$/i;

function formatBoxShadow( s: BoxShadow | null ): string {
	if ( ! s || ( ! s.x && ! s.y ) ) return '';
	const inset = s.inset ? 'inset ' : '';
	return `${ inset }${ s.x || '0px' } ${ s.y || '0px' } ${ s.blur || '0px' } ${ s.spread || '0px' } ${ s.color || 'rgba(0,0,0,0.1)' }`;
}

function formatTextShadow( s: TextShadow | null ): string {
	if ( ! s || ( ! s.x && ! s.y ) ) return '';
	return `${ s.x || '0px' } ${ s.y || '0px' } ${ s.blur || '0px' } ${ s.color || 'rgba(0,0,0,0.1)' }`;
}

function validateUnit( raw: string ): string {
	const cleaned = raw.trim();
	if ( cleaned === '' || cleaned === '0' ) return cleaned;
	return SHADOW_UNIT_PATTERN.test( cleaned ) ? cleaned : '';
}

/**
 * Per-section search keywords, re-exported flat for the Inspector's rail filter so the two can
 * never disagree. See `LAYOUT_KEYWORDS` for the rationale.
 */
const K = {
	surface: [ 'opacity', 'transparent', 'fade', 'blend', 'mode', 'multiply', 'screen', 'overlay', 'cursor', 'pointer' ],
	shadow: [ 'shadow', 'box', 'text', 'elevation', 'drop', 'inset', 'outset', 'blur', 'spread' ],
	motion: [ 'transition', 'transform', 'translate', 'scale', 'rotate', 'skew', 'origin', 'perspective', '3d', 'preserve' ],
	filter: [ 'filter', 'blur', 'brightness', 'contrast', 'saturate', 'grayscale', 'backdrop', 'glass' ],
	shape: [ 'clip', 'path', 'shape', 'polygon', 'mask', 'fade', 'edge', 'radial', 'diagonal', 'notch', 'chevron' ],
};

export const EFFECTS_KEYWORDS: string[] = [ ...new Set( Object.values( K ).flat() ) ];

/**
 * Effects — everything that changes how the block *renders* rather than where it sits.
 *
 * It used to be eight two-up popover triggers: nothing was visible until you opened it, and
 * finding which of eight panels held a value meant opening all eight. The sections are flat
 * disclosures now, each carrying a count, so a glance down the facet says what is set.
 *
 * Opacity is the one control here that is a *quantity* rather than a choice, so it gets the
 * slider; the shadow token row and the clip-path shape grid stay pickers, because both are
 * libraries where the preview IS the label.
 */
export function EffectsControl( { attributes, setAttributes, state, breakpoint, isAllowed, query }: Props ) {
	const can = ( controlId: string ) => ! isAllowed || isAllowed( controlId );
	const m = makeMatcher( query );
	const searching = Boolean( query && query.trim() );
	const anyMatch = Object.values( K ).some( ( keywords ) => m( keywords ) );

	const opacity = getValue( attributes, 'effects.opacity', state, breakpoint ) || '';
	const cursor = getValue( attributes, 'effects.cursor', state, breakpoint ) || '';
	const blendMode = getValue( attributes, 'effects.blendMode', state, breakpoint ) || '';
	// Box shadow holds either a shadow-token slug (string) or a composite object.
	const boxShadowValue = getValue( attributes, 'effects.boxShadow', state, breakpoint ) || null;
	const boxShadowToken = typeof boxShadowValue === 'string' ? boxShadowValue : '';
	const boxShadow = ( boxShadowValue && typeof boxShadowValue === 'object' ? boxShadowValue : null ) as BoxShadow | null;
	const textShadow = ( getValue( attributes, 'effects.textShadow', state, breakpoint ) || null ) as TextShadow | null;
	const transition = getValue( attributes, 'effects.transition', state, breakpoint ) || '';
	// effects.transform may be a freeform string OR a structured object (translateX/rotateY/…) from
	// the AI/finalizer or a 3D builder. The field is string-only, so coerce: an object renders as a
	// summary (never as a React child — that throws) and typing replaces it with a string.
	const transformRaw = getValue( attributes, 'effects.transform', state, breakpoint );
	const transformObj = transformRaw && typeof transformRaw === 'object' ? ( transformRaw as Record< string, string > ) : null;
	const transform = typeof transformRaw === 'string' ? transformRaw : '';
	const transformSummary = transform || ( transformObj
		? Object.entries( transformObj ).filter( ( [ , v ] ) => v ).map( ( [ k, v ] ) => `${ k }(${ v })` ).join( ' ' )
		: '' );
	const filter = getValue( attributes, 'effects.filter', state, breakpoint ) || '';
	const clipPath = ( getValue( attributes, 'effects.clipPath', state, breakpoint ) || null ) as any;
	const backdrop = ( getValue( attributes, 'effects.backdropFilter', state, breakpoint ) || null ) as any;
	const mask     = ( getValue( attributes, 'effects.mask', state, breakpoint ) || null ) as any;
	const transformOrigin = getValue( attributes, 'effects.transformOrigin', state, breakpoint ) || '';
	const transformStyle  = getValue( attributes, 'effects.transformStyle',  state, breakpoint ) || '';
	const perspective     = getValue( attributes, 'effects.perspective',     state, breakpoint ) || '';

	const clipShape  = String( clipPath?.shape  ?? '' );
	const clipAmount = String( clipPath?.amount ?? '' );
	const bdfBlur       = String( backdrop?.blur       ?? '' );
	const bdfBrightness = String( backdrop?.brightness ?? '' );
	const bdfSaturate   = String( backdrop?.saturate   ?? '' );
	const maskKind = String( mask?.kind ?? '' );
	const maskSide = String( mask?.side ?? 'right' );
	const maskSize = String( mask?.size ?? '' );

	const shadowTokens = useMemo( () => tokenOptions( 'shadow' ), [] );
	// Concrete shadow values for the previews. Resolved once — the catalogue is static per load.
	const resolvedShadows = useMemo< Record< string, string > >( () => resolveTokenValues( 'shadow' ), [] );

	// `opacity` may hold a literal ratio ("0.5") or an `opacity` token slug ("muted") — the slider
	// only drives the literal form; a token freezes the track and shows its own slug in the readout.
	const isOpacityToken = opacity !== '' && ! /^-?\d*\.?\d+$/.test( opacity );
	const opacityPercent = ! isOpacityToken && opacity ? Math.round( parseFloat( opacity ) * 100 ) : 100;

	const set = ( id: string, val: any ) =>
		setValue( attributes, setAttributes, id, state, breakpoint, val );
	const setVal = ( id: string ) => ( val: string ) => set( id, val || undefined );

	const updateBoxShadow = ( key: keyof BoxShadow, val: string | boolean ) => {
		const next: BoxShadow = {
			inset: boxShadow?.inset ?? false,
			x: boxShadow?.x ?? '0px',
			y: boxShadow?.y ?? '0px',
			blur: boxShadow?.blur ?? '0px',
			spread: boxShadow?.spread ?? '0px',
			color: boxShadow?.color ?? 'rgba(0,0,0,0.1)',
			[ key ]: val,
		};
		set( 'effects.boxShadow', next );
	};

	const updateTextShadow = ( key: keyof TextShadow, val: string ) => {
		const next: TextShadow = {
			x: textShadow?.x ?? '0px',
			y: textShadow?.y ?? '0px',
			blur: textShadow?.blur ?? '0px',
			color: textShadow?.color ?? 'rgba(0,0,0,0.1)',
			[ key ]: val,
		};
		set( 'effects.textShadow', next );
	};

	/** One shadow offset/size field — four of these make the composite editor. */
	const shadowField = (
		label: string,
		hint: string,
		value: string,
		placeholder: string,
		write: ( v: string ) => void
	) => (
		<ValueField
			affix={ <span className="bl-valuefield__cap" title={ hint }>{ label }</span> }
			listLabel="LENGTHS"
			value={ value }
			options={ opts( [ '0px', '2px', '4px', '8px', '16px' ] ) }
			placeholder={ placeholder }
			modified={ Boolean( value ) }
			onChange={ write }
			onCommit={ ( raw ) => write( validateUnit( raw ) ) }
		/>
	);

	const shadowCount = [ boxShadowToken || formatBoxShadow( boxShadow ), formatTextShadow( textShadow ) ].filter( Boolean ).length;
	const motionCount = [ transition, transformSummary, transformOrigin, transformStyle, perspective ].filter( Boolean ).length;
	const filterCount = [ filter, bdfBlur, bdfBrightness, bdfSaturate ].filter( Boolean ).length;
	const shapeCount = [ clipShape, maskKind ].filter( Boolean ).length;

	return (
		<div className="bl-effects-control">
			{ ! anyMatch && <NoMatches query={ query ?? '' } /> }

			{ m( K.surface ) && (
			<div className="bl-fx-group">
				<div className="bl-spacing-head">
					<span>{ __( 'Surface', 'blicks' ) }</span>
					{ ( opacity || blendMode || cursor ) && <span className="bl-mod-dot" aria-hidden="true" /> }
				</div>
				<div className="bl-fields">
					{ can( 'effects.opacity' ) && (
					<SliderField
						label="OPACITY"
						hint={ __( 'Opacity', 'blicks' ) }
						min={ 0 }
						max={ 100 }
						value={ opacityPercent }
						display={ isOpacityToken ? opacity : `${ opacityPercent }%` }
						modified={ Boolean( opacity ) }
						frozen={ isOpacityToken }
						actions={
							<TokenLibrary
								category="opacity"
								value={ opacity }
								title={ __( 'Opacity token library', 'blicks' ) }
								onSelect={ ( slug ) => set( 'effects.opacity', slug ) }
							/>
						}
						onChange={ ( pct ) => set( 'effects.opacity', pct === 100 ? '' : String( pct / 100 ) ) }
						onReset={ () => set( 'effects.opacity', '' ) }
					/>
					) }
					{ can( 'effects.blendMode' ) && (
					<OptionField
						label="BLEND"
						hint={ __( 'Blend mode — how the block composites with what is behind it', 'blicks' ) }
						values={ BLEND_VALUES }
						value={ blendMode }
						placeholder="normal"
						onChange={ setVal( 'effects.blendMode' ) }
						onReset={ () => set( 'effects.blendMode', '' ) }
					/>
					) }
					{ can( 'effects.cursor' ) && (
					<IconValueField
						label="CURSOR"
						hint={ __( 'Cursor shown over the block', 'blicks' ) }
						value={ cursor }
						choices={ CURSOR_CHOICES }
						options={ CURSOR_OPTIONS }
						placeholder="auto"
						listLabel="CURSORS"
						onChange={ setVal( 'effects.cursor' ) }
					/>
					) }
				</div>
			</div>
			) }

			{ ( can( 'effects.boxShadow' ) || can( 'effects.textShadow' ) ) && m( K.shadow ) && (
			<div className="bl-fx-group">
				<MoreSettings label="Shadow" badge={ shadowCount } defaultOpen={ shadowCount > 0 } forceOpen={ searching }>
					{ can( 'effects.boxShadow' ) && (
					<>
						{ /* The scale first: a shadow from the design system is one click and stays in
						     step with the rest of the site. The hand-built one below is the escape
						     hatch, not the default path. */ }
						<div className="bl-shadow-tokens">
							{ shadowTokens.map( ( option ) => (
								<button
									type="button"
									key={ option.slug }
									className={ `bl-shadow-tokens__item${ boxShadowToken === option.slug ? ' is-selected' : '' }` }
									title={ resolvedShadows[ option.slug ] || option.css }
									aria-pressed={ boxShadowToken === option.slug }
									onClick={ () =>
										set( 'effects.boxShadow', boxShadowToken === option.slug ? '' : option.slug )
									}
								>
									<span
										className="bl-shadow-tokens__preview"
										style={ { boxShadow: resolvedShadows[ option.slug ] || option.css } }
									/>
									<span className="bl-shadow-tokens__label">{ option.slug }</span>
								</button>
							) ) }
						</div>

						<div className="bl-fields">
							<IconField
								label="KIND"
								hint={ __( 'Which side of the edge the shadow falls on', 'blicks' ) }
								value={ boxShadow?.inset ? 'inset' : ( boxShadow ? 'outset' : '' ) }
								choices={ SHADOW_KIND_CHOICES }
								onChange={ ( next ) => updateBoxShadow( 'inset', next === 'inset' ) }
								onReset={ () => set( 'effects.boxShadow', '' ) }
							/>
						</div>
						<div className="bl-fields bl-fields--2">
							{ shadowField( 'X', __( 'Horizontal offset', 'blicks' ), boxShadow?.x ?? '', '0px', ( v ) => updateBoxShadow( 'x', v ) ) }
							{ shadowField( 'Y', __( 'Vertical offset', 'blicks' ), boxShadow?.y ?? '', '4px', ( v ) => updateBoxShadow( 'y', v ) ) }
						</div>
						<div className="bl-fields bl-fields--2">
							{ shadowField( 'BLUR', __( 'Blur radius', 'blicks' ), boxShadow?.blur ?? '', '6px', ( v ) => updateBoxShadow( 'blur', v ) ) }
							{ shadowField( 'SPRD', __( 'Spread radius', 'blicks' ), boxShadow?.spread ?? '', '0px', ( v ) => updateBoxShadow( 'spread', v ) ) }
						</div>
						<div className="bl-fields">
							<ColorRow
								hint={ __( 'Box shadow colour', 'blicks' ) }
								value={ boxShadow?.color ?? '' }
								onChange={ ( v ) => updateBoxShadow( 'color', v ) }
							/>
						</div>
					</>
					) }

					{ can( 'effects.textShadow' ) && (
					<MoreSettings
						label="Text shadow"
						badge={ formatTextShadow( textShadow ) ? 1 : 0 }
						defaultOpen={ Boolean( formatTextShadow( textShadow ) ) }
						forceOpen={ searching }
					>
						<div className="bl-fields bl-fields--2">
							{ shadowField( 'X', __( 'Horizontal offset', 'blicks' ), textShadow?.x ?? '', '0px', ( v ) => updateTextShadow( 'x', v ) ) }
							{ shadowField( 'Y', __( 'Vertical offset', 'blicks' ), textShadow?.y ?? '', '2px', ( v ) => updateTextShadow( 'y', v ) ) }
						</div>
						<div className="bl-fields">
							{ shadowField( 'BLUR', __( 'Blur radius', 'blicks' ), textShadow?.blur ?? '', '4px', ( v ) => updateTextShadow( 'blur', v ) ) }
							<ColorRow
								hint={ __( 'Text shadow colour', 'blicks' ) }
								value={ textShadow?.color ?? '' }
								onChange={ ( v ) => updateTextShadow( 'color', v ) }
							/>
						</div>
					</MoreSettings>
					) }
				</MoreSettings>
			</div>
			) }

			{ ( can( 'effects.transition' ) || can( 'effects.transform' ) ) && m( K.motion ) && (
			<div className="bl-fx-group">
				<MoreSettings label="Transition & transform" badge={ motionCount } defaultOpen={ motionCount > 0 } forceOpen={ searching }>
					<div className="bl-fields">
						{ can( 'effects.transition' ) && (
						<ValueField
							affix={ <span className="bl-valuefield__cap" title={ __( 'Transition — what animates on a state change', 'blicks' ) }>TRANS</span> }
							listLabel="TRANSITIONS"
							value={ transition }
							options={ tokenComboboxOptions( 'transition', TRANSITION_SUGGESTIONS ) }
							placeholder="all 200ms ease"
							modified={ Boolean( transition ) }
							onChange={ setVal( 'effects.transition' ) }
							onReset={ () => set( 'effects.transition', '' ) }
						/>
						) }
						{ can( 'effects.transform' ) && (
						<ValueField
							affix={ <span className="bl-valuefield__cap" title={ __( 'Transform', 'blicks' ) }>TFM</span> }
							listLabel="TRANSFORMS"
							value={ transformSummary }
							options={ tokenComboboxOptions( 'transform', TRANSFORM_SUGGESTIONS ) }
							placeholder="translateX(10px)"
							modified={ Boolean( transformSummary ) }
							onChange={ setVal( 'effects.transform' ) }
							onReset={ () => set( 'effects.transform', '' ) }
						/>
						) }
					</div>

					{ ( can( 'effects.transformOrigin' ) || can( 'effects.transformStyle' ) || can( 'effects.perspective' ) ) && (
					<MoreSettings
						label="Origin & 3D"
						badge={ [ transformOrigin, transformStyle, perspective ].filter( Boolean ).length }
						defaultOpen={ Boolean( transformOrigin || transformStyle || perspective ) }
						forceOpen={ searching }
					>
						<div className="bl-fields">
							{ can( 'effects.transformOrigin' ) && (
							<OptionField
								label="ORIGIN"
								hint={ __( 'Transform origin — the point the block transforms around', 'blicks' ) }
								values={ ORIGIN_SUGGESTIONS }
								pattern={ ORIGIN_PATTERN }
								value={ transformOrigin }
								placeholder="50% 50%"
								onChange={ setVal( 'effects.transformOrigin' ) }
								onReset={ () => set( 'effects.transformOrigin', '' ) }
							/>
							) }
							{ can( 'effects.perspective' ) && (
							<LengthField
								label="PERSP"
								hint={ __( 'Perspective — how deep the 3D scene is', 'blicks' ) }
								category="width"
								literals={ [ '400px', '800px', '1200px', ...LENGTH_SUGGESTIONS ] }
								pattern={ /^(none|\d+(\.\d+)?(px|rem|em))$/ }
								value={ perspective }
								placeholder="800px"
								onChange={ setVal( 'effects.perspective' ) }
								onReset={ () => set( 'effects.perspective', '' ) }
							/>
							) }
							{ can( 'effects.transformStyle' ) && (
							<IconField
								label="3D"
								hint={ __( 'Transform style — whether children keep their own depth', 'blicks' ) }
								value={ transformStyle }
								choices={ TRANSFORM_STYLE_CHOICES }
								onChange={ setVal( 'effects.transformStyle' ) }
								onReset={ () => set( 'effects.transformStyle', '' ) }
							/>
							) }
						</div>
					</MoreSettings>
					) }
				</MoreSettings>
			</div>
			) }

			{ ( can( 'effects.filter' ) || can( 'effects.backdropFilter' ) ) && m( K.filter ) && (
			<div className="bl-fx-group">
				<MoreSettings label="Filters" badge={ filterCount } defaultOpen={ filterCount > 0 } forceOpen={ searching }>
					{ can( 'effects.filter' ) && (
					<div className="bl-fields">
						<ValueField
							affix={ <span className="bl-valuefield__cap" title={ __( 'Filter applied to the block itself', 'blicks' ) }>FILTER</span> }
							listLabel="FILTERS"
							value={ filter }
							options={ tokenComboboxOptions( 'filter', FILTER_SUGGESTIONS ) }
							placeholder="blur(4px)"
							modified={ Boolean( filter ) }
							onChange={ setVal( 'effects.filter' ) }
							onReset={ () => set( 'effects.filter', '' ) }
						/>
					</div>
					) }

					{ can( 'effects.backdropFilter' ) && (
					<MoreSettings
						label="Backdrop"
						badge={ [ bdfBlur, bdfBrightness, bdfSaturate ].filter( Boolean ).length }
						defaultOpen={ Boolean( bdfBlur || bdfBrightness || bdfSaturate ) }
						forceOpen={ searching }
					>
						{ /* Three parts of one filter, not three properties — they are written into a
						     single object, so they belong in one stack under one heading. */ }
						<div className="bl-fields">
							{ ( [
								[ 'blur', 'BLUR', __( 'Backdrop blur', 'blicks' ), '12px', bdfBlur, [ '4px', '8px', '12px', '20px' ] ],
								[ 'brightness', 'BRIGHT', __( 'Backdrop brightness', 'blicks' ), '110%', bdfBrightness, [ '80%', '100%', '110%', '130%' ] ],
								[ 'saturate', 'SAT', __( 'Backdrop saturation', 'blicks' ), '150%', bdfSaturate, [ '100%', '150%', '180%' ] ],
							] as Array< [ string, string, string, string, string, string[] ] > ).map(
								( [ key, cap, hint, ph, val, presets ] ) => (
									<ValueField
										key={ key }
										affix={ <span className="bl-valuefield__cap" title={ hint }>{ cap }</span> }
										listLabel="VALUES"
										value={ val }
										options={ opts( presets ) }
										placeholder={ ph }
										modified={ Boolean( val ) }
										onChange={ ( next ) =>
											set( 'effects.backdropFilter', { ...( backdrop || {} ), [ key ]: next || undefined } )
										}
									/>
								)
							) }
						</div>
					</MoreSettings>
					) }
				</MoreSettings>
			</div>
			) }

			{ ( can( 'effects.clipPath' ) || can( 'effects.mask' ) ) && m( K.shape ) && (
			<div className="bl-fx-group">
				<MoreSettings label="Shape & mask" badge={ shapeCount } defaultOpen={ shapeCount > 0 } forceOpen={ searching }>
					{ can( 'effects.clipPath' ) && (
					<>
						{ /* The silhouette IS the label — a name like `chevron` tells you far less than
						     the outline does, so the presets stay a picture grid. */ }
						<div className="fx-shape-grid">
							{ SHAPE_PRESETS.map( ( shape ) => (
								<button
									key={ shape.id }
									type="button"
									className="fx-shape-btn"
									title={ shape.label }
									aria-label={ shape.label }
									onClick={ () => set( 'effects.clipPath', { shape: 'custom', custom: shapeToCss( shape.points ) } ) }
								>
									<svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
										<polygon points={ shapeToSvgPoints( shape.points ) } fill="currentColor" />
									</svg>
								</button>
							) ) }
						</div>
						<div className="bl-fields">
							<OptionField
								label="CLIP"
								hint={ __( 'Clip path — the shape the block is cut to', 'blicks' ) }
								values={ CLIP_SHAPES }
								value={ clipShape }
								placeholder="none"
								onChange={ ( next ) =>
									next
										? set( 'effects.clipPath', { shape: next, amount: clipAmount || '20%' } )
										: set( 'effects.clipPath', '' )
								}
								onReset={ () => set( 'effects.clipPath', '' ) }
							/>
							{ clipShape && clipShape !== 'custom' && (
							<ValueField
								affix={ <span className="bl-valuefield__cap" title={ __( 'How far the shape cuts in', 'blicks' ) }>AMOUNT</span> }
								value={ clipAmount }
								options={ opts( [ '10%', '20%', '30%', '50%' ] ) }
								placeholder="20%"
								modified={ Boolean( clipAmount ) }
								onChange={ ( next ) => set( 'effects.clipPath', { shape: clipShape, amount: next } ) }
							/>
							) }
							{ clipShape === 'custom' && (
							<ValueField
								affix={ <span className="bl-valuefield__cap" title={ __( 'Raw clip-path value', 'blicks' ) }>PATH</span> }
								value={ String( clipPath?.custom ?? '' ) }
								options={ [] }
								placeholder="polygon(0 0, 100% 0, …)"
								modified={ Boolean( clipPath?.custom ) }
								onChange={ ( next ) => set( 'effects.clipPath', { shape: 'custom', custom: next } ) }
							/>
							) }
						</div>
					</>
					) }

					{ can( 'effects.mask' ) && (
					<div className="bl-fields">
						<IconField
							label="MASK"
							hint={ __( 'Mask — fade the block out towards an edge or a circle', 'blicks' ) }
							value={ maskKind }
							choices={ MASK_CHOICES }
							onChange={ ( next ) =>
								next
									? set( 'effects.mask', { kind: next, size: maskSize || '20%', side: maskSide } )
									: set( 'effects.mask', '' )
							}
							onReset={ () => set( 'effects.mask', '' ) }
						/>
						{ maskKind === 'edge-fade' && (
						<IconField
							label="SIDE"
							hint={ __( 'Which edge fades', 'blicks' ) }
							value={ maskSide }
							choices={ SIDE_CHOICES }
							onChange={ ( next ) => set( 'effects.mask', { ...( mask || {} ), side: next || 'right', kind: 'edge-fade' } ) }
							onReset={ () => set( 'effects.mask', { ...( mask || {} ), side: 'right', kind: 'edge-fade' } ) }
						/>
						) }
						{ maskKind && (
						<ValueField
							affix={ <span className="bl-valuefield__cap" title={ __( 'How far the fade reaches', 'blicks' ) }>SIZE</span> }
							value={ maskSize }
							options={ opts( [ '10%', '20%', '30%', '50%' ] ) }
							placeholder="20%"
							modified={ Boolean( maskSize ) }
							onChange={ ( next ) => set( 'effects.mask', { ...( mask || {} ), size: next, kind: maskKind } ) }
						/>
						) }
					</div>
					) }
				</MoreSettings>
			</div>
			) }
		</div>
	);
}
