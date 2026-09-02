import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { TOKENS, COLOR_FALLBACKS, PALETTE_TOKENS, COLOR_GROUPS, COLOR_PAIRS, FIXED_TOKENS, TYPE_ROLE_LABELS, TYPE_ROLE_DEFAULTS } from '../constants';
import { parseHash } from '../routing';
import { icon } from '../icons';
import { AnimationSection } from './AnimationSection';
import { Toggle } from './primitives';
import { useAnimations } from '../hooks/useAnimations';
import { titleCase, designSyncStatus, isColorValue, validateTokenValue, validateTypeRoleValue, stripVars, wrapVars, colorToEdit, splitNumUnit, parseRgb, compositeOver, contrastRatio, contrastGrade, parseClamp, parseShadow, formatShadow, parseGradient, formatGradient, isGradientPosition, GRADIENT_GEOMETRY, parseTransition, formatTransition, describeTransform, isTimeValue, isTimingValue, parseRing, formatRing, describeRing, isLengthValue, isZeroLength, parseBorder, formatBorder, BORDER_STYLES, aspectRatioOf, countRecordChanges, countNestedChanges } from '../data';
import type { ShadowParts, GradientParts, GradientKind, TransitionParts, RingParts, BorderParts } from '../data';
import type { Rgba } from '../data';
import type { DesignSystemSnapshot, ThemesState, Breakpoint, TypeRoleValues } from '../types';

export function ValidatedInput( {
	value,
	validate,
	onCommit,
	onRevert,
	toEdit,
	fromEdit,
	unitSplit,
	modified,
	disabled,
	externalReset,
	className,
	...rest
}: {
	value: string;
	// `value` and the args of `validate`/`onCommit` are the stored (canonical) form.
	validate: ( v: string ) => boolean;
	onCommit: ( v: string ) => void;
	onRevert: () => void;
	toEdit?: ( v: string ) => string;    // stored → editable text shown in the field
	fromEdit?: ( v: string ) => string;  // editable text → stored value
	unitSplit?: boolean;                 // idle: show `[number][unit]`; active: full value
	modified?: boolean;
	externalReset?: boolean;             // the caller renders `FieldReset` itself, elsewhere
} & Omit< React.InputHTMLAttributes< HTMLInputElement >, 'value' | 'onChange' | 'onFocus' | 'onBlur' > ): JSX.Element {
	const edit = toEdit ?? ( ( v: string ) => v );
	const store = fromEdit ?? ( ( v: string ) => v );
	const [ local, setLocal ] = useState( '' );
	const [ focused, setFocused ] = useState( false );

	const editValue = edit( value );
	const split = unitSplit && ! focused ? splitNumUnit( editValue ) : null;
	const shown = focused ? local : ( split ? split.num : editValue );
	const invalid = focused && local.trim() !== '' && ! validate( store( local.trim() ) );
	const cls = [ className, invalid ? 'is-invalid' : '', modified ? 'is-modified' : '' ].filter( Boolean ).join( ' ' ) || undefined;

	return (
		<>
			<input
				{ ...rest }
				className={ cls }
				value={ shown }
				disabled={ disabled }
				aria-invalid={ invalid || undefined }
				onFocus={ () => { setLocal( edit( value ) ); setFocused( true ); } }
				onChange={ event => {
					const next = event.currentTarget.value;
					setLocal( next );
					const stored = store( next.trim() );
					if ( validate( stored ) ) onCommit( stored );
				} }
				onBlur={ event => {
					setFocused( false );
					const typed = event.currentTarget.value.trim();
					const stored = store( typed );
					if ( typed === '' || ! validate( stored ) ) onRevert();
					else onCommit( stored );
				} }
			/>
			{ split && <span className="u">{ split.unit }</span> }
			{ modified && ! disabled && ! externalReset && <FieldReset onRevert={ onRevert } /> }
		</>
	);
}

/**
 * The revert-to-theme control. Its own component because a field wrapped in a frame
 * (see `.combo`) has to put it *outside* that frame — inside, it reads as part of the
 * value rather than as an action on it.
 */
export function FieldReset( { onRevert }: { onRevert: () => void } ): JSX.Element {
	return (
		<button
			type="button"
			className="fld-rst"
			title={ __( 'Reset to theme value', 'blicks' ) }
			aria-label={ __( 'Reset to theme value', 'blicks' ) }
			onMouseDown={ event => event.preventDefault() }
			onClick={ onRevert }
		>↺</button>
	);
}

/**
 * A type role's specimen, which measures itself. A role's size is usually stored as a
 * `var(--wp--preset--font-size--…)` reference and its family as a slug, so the stored
 * strings cannot be read as a scale — the only honest figures are the ones the browser
 * resolved. Rendering the type and reporting what it actually became are one job, so
 * they live in one component: the specimen shows the role, the line under it says what
 * the role is, in the units you would set it in.
 */
export function RoleSpecimen( {
	text,
	style,
	family,
	signature,
}: {
	text: string;
	style: React.CSSProperties;
	family?: string;   // the preset's own name; the resolved stack names its fallback, not itself
	signature: string; // the stored values — re-measure whenever an edit lands
} ): JSX.Element {
	const ref = useRef< HTMLSpanElement >( null );
	const [ metrics, setMetrics ] = useState< string[] >( [] );
	const [ stack, setStack ] = useState( '' );
	const [ resolved, setResolved ] = useState( '' );
	const [ missing, setMissing ] = useState( false );

	useLayoutEffect( () => {
		const el = ref.current;
		if ( ! el ) return;
		const computed = getComputedStyle( el );
		const round = ( value: string ): number => Math.round( parseFloat( value ) * 100 ) / 100;
		const size = parseFloat( computed.fontSize );

		const parts = [ `${ round( computed.fontSize ) }px`, computed.fontWeight ];
		// Line height reads as a ratio, the way it is authored, not as resolved pixels.
		parts.push( computed.lineHeight === 'normal'
			? __( 'normal', 'blicks' )
			: String( Math.round( ( parseFloat( computed.lineHeight ) / size ) * 100 ) / 100 ) );
		if ( computed.letterSpacing !== 'normal' && parseFloat( computed.letterSpacing ) !== 0 ) {
			parts.push( `${ round( computed.letterSpacing ) }px` );
		}
		if ( computed.textTransform !== 'none' ) parts.push( computed.textTransform );

		// A role can point at a preset the active theme never defines (`--wp--preset--font-family--mono`
		// on a theme with no mono preset). The declaration then drops and the type quietly renders in
		// whatever it inherited, so naming the preset without saying that would be the lie this line
		// exists to stop. An empty custom property is the definitive test.
		const declared = typeof style.fontFamily === 'string' ? style.fontFamily : '';
		const custom = declared.match( /^var\(\s*(--[\w-]+)\s*\)$/ );

		setMetrics( parts );
		setStack( computed.fontFamily );
		setResolved( computed.fontFamily.split( ',' )[ 0 ].replace( /["']/g, '' ) );
		setMissing( !! custom && getComputedStyle( document.body ).getPropertyValue( custom[ 1 ] ).trim() === '' );
	}, [ signature, family, style.fontFamily ] );

	return (
		<>
			<span className="rrow__s" ref={ ref } style={ style }>{ text }</span>
			{ /* The family reads as its preset name; the stack it resolves to is on hover. */ }
			<span className="rrow__m" title={ stack }>
				{ metrics.join( ' · ' ) }{ ' · ' }
				<span
					className={ missing ? 'is-unset' : undefined }
					title={ missing ? __( 'This font family is not defined by the active theme — the specimen falls back to the inherited font.', 'blicks' ) : undefined }
				>{ family || resolved }</span>
			</span>
		</>
	);
}

/**
 * A colour pair, rendered as the thing it is: text on its own surface, with the WCAG
 * ratio the two actually produce. Global Styles edits colours as a flat list of slugs
 * and can say nothing about a pair, which is the whole reason this lives here.
 *
 * The ratio is measured off the rendered nodes rather than computed from the stored
 * strings: a token may hold `var(…)`, a preset reference or a `color-mix(…)`, and a
 * translucent one is only as legible as what it composites to.
 */
export function PairDemo( { surface, text, sample }: { surface: string; text: string; sample: string } ): JSX.Element {
	const surfaceRef = useRef< HTMLSpanElement >( null );
	const textRef = useRef< HTMLSpanElement >( null );
	const [ read, setRead ] = useState< { ratio: number; grade: string } | null >( null );

	useLayoutEffect( () => {
		const surfaceEl = surfaceRef.current;
		const textEl = textRef.current;
		if ( ! surfaceEl || ! textEl ) return;

		// Whatever is behind a translucent surface is part of its rendered colour.
		const backdrop = ( from: HTMLElement | null ): Rgba => {
			for ( let node = from; node; node = node.parentElement ) {
				const colour = parseRgb( getComputedStyle( node ).backgroundColor );
				if ( colour && colour.a === 1 ) return colour;
			}
			return { r: 255, g: 255, b: 255, a: 1 };
		};

		const surfaceRaw = parseRgb( getComputedStyle( surfaceEl ).backgroundColor );
		const textRaw = parseRgb( getComputedStyle( textEl ).color );
		// An unreadable colour space (oklch, lab…) reports nothing rather than a wrong number.
		if ( ! surfaceRaw || ! textRaw ) { setRead( null ); return; }

		const bg = compositeOver( surfaceRaw, backdrop( surfaceEl.parentElement ) );
		const ratio = contrastRatio( compositeOver( textRaw, bg ), bg );
		setRead( { ratio, grade: contrastGrade( ratio ) } );
	}, [ surface, text ] );

	const grade = read?.grade ?? '';
	return (
		<>
			<span className="cpair__demo" ref={ surfaceRef } style={ { background: surface } }>
				<span className="cpair__t" ref={ textRef } style={ { color: text } }>{ sample }</span>
			</span>
			<span className={ `cpair__r${ grade === 'Fail' ? ' bad' : '' }${ grade === 'AA Large' ? ' warn' : '' }` }>
				{ read
					? sprintf( /* translators: 1: contrast ratio, 2: WCAG grade. */ __( '%1$s:1 · %2$s', 'blicks' ), read.ratio.toFixed( 2 ), read.grade )
					: __( 'not measurable', 'blicks' ) }
			</span>
		</>
	);
}

/** Geometry suggestions offered per gradient kind. Not a closed list — the field takes anything. */
const GRADIENT_GEOMETRY_HINTS: Record< GradientKind, readonly string[] > = {
	linear: [ '0deg', '90deg', '135deg', '180deg', 'to right', 'to bottom', 'to bottom right' ],
	radial: [ 'circle at 50% 50%', 'ellipse at 50% 50%', 'circle closest-side at 50% 50%', 'ellipse farthest-corner at 20% 30%' ],
	conic: [ 'from 0deg at 50% 50%', 'from 90deg at 50% 50%', 'from 0deg at 0% 0%' ],
};

type GradientStopList = GradientParts[ 'stops' ];

/** Angle units are only a legal stop position in a conic gradient. */
const ANGLE_POS_RE = /^[+-]?[\d.]+(deg|rad|grad|turn)$/i;

/**
 * Does the browser actually accept this value for this property? The token fields take
 * free text (see `isFreeformValue`), so this is the difference between "typed" and "works".
 */
type ProbeProperty = 'backgroundImage' | 'transition' | 'transform' | 'filter' | 'boxShadow'
	| 'borderTopWidth' | 'border' | 'opacity' | 'zIndex' | 'aspectRatio' | 'lineHeight';

const cssAccepts = ( property: ProbeProperty, value: string ): boolean => {
	if ( value.trim() === '' ) return true;
	const probe = document.createElement( 'div' );
	probe.style[ property ] = value;
	return probe.style[ property ] !== '';
};

/** The radius preview tile, in px — also the point past which a corner cannot get rounder. */
const RADIUS_TILE = 44;

/** `0.15s` and `150ms` are the same wait; the readouts compare only if they read alike. */
const asMs = ( time: string ): string => {
	const value = Number.parseFloat( time );
	if ( ! Number.isFinite( value ) ) return time;
	return /ms$/i.test( time.trim() ) ? `${ Math.round( value ) }ms` : `${ Math.round( value * 1000 ) }ms`;
};

/**
 * A transition, played. A transition is a rule about change, so a still preview of one is
 * definitionally blank — the old row set `transition` on a box that never changed, which
 * could not show anything at all. This one moves a dot on hover, on click, and on focus,
 * and moves it by changing four things at once (position, size, opacity, colour) so the
 * token's own `transition-property` is what decides which of them animate. The readout is
 * read back off the dot, so an unparseable value reports what the browser settled on.
 */
export function TransitionDemo( { value, label }: { value: string; label: string } ): JSX.Element {
	const [ on, setOn ] = useState( false );
	const [ read, setRead ] = useState( '' );

	useLayoutEffect( () => {
		// Read off a probe outside `.blicks-admin`, not off the dot: the admin's
		// reduced-motion rule flattens every duration in there to 0.01ms, and the dot must
		// honour that — but the readout is describing the token, not this one preview of it.
		const probe = document.createElement( 'div' );
		probe.style.cssText = 'position:fixed;left:-9999px;top:0;';
		probe.style.transition = value;
		document.body.appendChild( probe );
		const style = getComputedStyle( probe );
		const duration = asMs( style.transitionDuration.split( ',' )[ 0 ] ?? '' );
		const delay = style.transitionDelay.split( ',' )[ 0 ]?.trim() ?? '';
		setRead( [
			duration,
			style.transitionTimingFunction.split( ',' )[ 0 ]?.trim() ?? '',
			style.transitionProperty.split( ',' )[ 0 ]?.trim() ?? '',
			Number.parseFloat( delay ) ? sprintf( /* translators: %s: delay, already formatted. */ __( 'after %s', 'blicks' ), asMs( delay ) ) : '',
		].filter( part => part !== '' && part !== '0ms' ).join( ' · ' ) );
		probe.remove();
	}, [ value ] );

	return (
		<div
			className="mdemo"
			onMouseEnter={ () => setOn( true ) }
			onMouseLeave={ () => setOn( false ) }
		>
			<button
				type="button"
				className="mtrack"
				aria-pressed={ on }
				aria-label={ sprintf( /* translators: %s: token name. */ __( 'Play the %s transition', 'blicks' ), label ) }
				onClick={ () => setOn( state => ! state ) }
				onFocus={ () => setOn( true ) }
				onBlur={ () => setOn( false ) }
			>
				<i className={ `mdot${ on ? ' is-on' : '' }` } style={ { transition: value || undefined } } />
			</button>
			<span className="srow__m">{ read }</span>
		</div>
	);
}

/** The ruler every breakpoint band is drawn on, in px. Matches the range they accept. */
const BP_MIN = 320;
const BP_MAX = 2400;

/** The width of this window, kept current — the only viewport the screen can honestly report. */
export function useViewportWidth(): number {
	const [ width, setWidth ] = useState( () => window.innerWidth );

	useEffect( () => {
		const onResize = (): void => setWidth( window.innerWidth );
		window.addEventListener( 'resize', onResize );
		return () => window.removeEventListener( 'resize', onResize );
	}, [] );

	return width;
}

/**
 * The stretch of viewport a breakpoint owns, on a ruler shared by all of them. `782` alone
 * never said whether tablet *starts* or *ends* there, nor where mobile stopped — the numbers
 * are boundaries and a boundary only means something next to its neighbours. The marker is
 * this window, so the band you are inside right now is the one that is lit.
 */
export function BpBand( { lower, upper, viewport }: { lower: number; upper: number | null; viewport: number } ): JSX.Element {
	const pos = ( px: number ): number => Math.max( 0, Math.min( 100, ( ( px - BP_MIN ) / ( BP_MAX - BP_MIN ) ) * 100 ) );
	const start = pos( lower );
	const end = upper === null ? 100 : pos( upper );
	const active = viewport >= lower && ( upper === null || viewport <= upper );

	return (
		<span className="bpr" aria-hidden="true">
			<i
				className={ `bpr__band${ active ? ' is-on' : '' }${ upper === null ? ' is-open' : '' }` }
				style={ { insetInlineStart: `${ start }%`, width: `${ Math.max( 1.5, end - start ) }%` } }
			/>
			{ /* Where this window sits on the same ruler: the one reading nobody has to imagine. */ }
			<i className="bpr__now" style={ { insetInlineStart: `${ pos( viewport ) }%` } } />
		</span>
	);
}

/**
 * Leading, shown across lines — the only place it exists. A line-height of 1.1 and one of
 * 1.7 are the same single line of text; the difference is entirely in the gap to the next
 * line, which a number beside a slider cannot show. The measurement is the computed line box
 * in pixels at the sample's own size, and a value carrying a unit is called out: `24px`
 * leading does not scale with the type it is set on, which is what a ratio is for.
 */
export function LeadingDemo( { value }: { value: string } ): JSX.Element {
	const block = useRef< HTMLParagraphElement >( null );
	const [ read, setRead ] = useState( '' );
	const fixed = /[a-z%]/i.test( value.trim() ) && ! value.trim().startsWith( 'var(' );

	useLayoutEffect( () => {
		const node = block.current;
		if ( ! node ) return;
		const style = getComputedStyle( node );
		const lineBox = Number.parseFloat( style.lineHeight );
		const size = Number.parseFloat( style.fontSize );
		if ( ! Number.isFinite( lineBox ) || ! Number.isFinite( size ) ) { setRead( '' ); return; }
		setRead( sprintf(
			/* translators: 1: line box height in px, 2: the sample's font size in px. */
			__( '%1$spx line on %2$spx', 'blicks' ),
			String( Math.round( lineBox * 10 ) / 10 ),
			String( Math.round( size ) )
		) );
	}, [ value ] );

	return (
		<div className="mdemo">
			<p ref={ block } className="ldv" style={ { lineHeight: value || undefined } }>
				{ __( 'Type is set in lines, and the space between them is the thing being decided here.', 'blicks' ) }
			</p>
			<span className={ `srow__m${ fixed ? ' bad' : '' }` }>
				{ fixed ? __( 'fixed — will not scale', 'blicks' ) : read }
			</span>
		</div>
	);
}

/**
 * A ratio, drawn at one height so the shapes can be compared. The old preview was a box
 * 26px tall — a square came out 26px wide and a 3/4 portrait 19px, which is a difference
 * you cannot see and a shape you cannot judge. The readout is the ratio as a single number,
 * since `16 / 9` and `3 / 4` sort by nothing you can read off the fraction.
 */
export function AspectDemo( { value }: { value: string } ): JSX.Element {
	const ratio = aspectRatioOf( value.trim() );
	const shape = ratio === null ? ''
		: ratio > 1.001 ? __( 'landscape', 'blicks' )
			: ratio < 0.999 ? __( 'portrait', 'blicks' ) : __( 'square', 'blicks' );

	return (
		<div className="mdemo">
			<i className="aspv" style={ { aspectRatio: value || undefined } } />
			<span className="srow__m">
				{ ratio === null ? '' : `${ Math.round( ratio * 100 ) / 100 }:1 · ${ shape }` }
			</span>
		</div>
	);
}

/**
 * An alpha step, over something worth seeing through. Opacity was a slider and a number and
 * nothing else — but 0.4 and 0.55 are indistinguishable as numbers and obvious as ink, and
 * the question being asked of a scrim or a disabled state is always "can you still read it".
 * So the sample is text and colour under the alpha, over a checkerboard: a value that is
 * transparent looks transparent rather than looking like a lighter shade of the page.
 */
export function OpacityDemo( { value }: { value: string } ): JSX.Element {
	const tile = useRef< HTMLElement >( null );
	const [ read, setRead ] = useState( '' );

	useLayoutEffect( () => {
		const node = tile.current;
		if ( ! node ) return;
		setRead( getComputedStyle( node ).opacity );
	}, [ value ] );

	return (
		<span className="opv">
			{ /* The checkerboard has to sit *outside* the faded ink — inside, the element's own
			     opacity fades the checks with it and a translucent value looks merely pale. */ }
			<span className="opv__cell">
				<i ref={ tile } className="opv__ink" style={ { opacity: value || undefined } }>
					{ __( 'Aa', 'blicks' ) }
				</i>
			</span>
			<span className="srow__m">{ read === '' ? '' : `${ Math.round( Number( read ) * 100 ) }%` }</span>
		</span>
	);
}

/**
 * A stacking level, as a position in the stack. A 0–1000 slider treated z-index as a
 * magnitude, which it is not: nothing is "twice as stacked", the numbers are arbitrary
 * (base 1 and sticky 100 sit one apart in the order and 99 apart on the slider), and the
 * only two questions worth answering — what is above what, and does anything collide —
 * were the two the row could not answer. The slabs are the stack; the token's own is lit.
 */
export function ZStack( { rank, total, clash }: { rank: number; total: number; clash: string } ): JSX.Element {
	return (
		<div className="mdemo">
			<span className="zstack" aria-hidden="true">
				{ Array.from( { length: total }, ( _unused, index ) => (
					<i key={ index } className={ `zslab${ index === rank ? ' is-on' : '' }` } />
				) ) }
			</span>
			<span className={ `srow__m${ clash ? ' bad' : '' }` }>
				{ clash
					? sprintf( /* translators: %s: the other token's name. */ __( 'same layer as %s', 'blicks' ), clash )
					: sprintf( /* translators: 1: this layer's position, 2: how many layers there are. */ __( 'layer %1$d of %2$d', 'blicks' ), rank + 1, total ) }
			</span>
		</div>
	);
}

/**
 * A border width, drawn at that width. The old row put a 0–8 slider in `step: 1` next to a
 * number: the three widths in the set are 1px, 2px and 3px, so the whole scale lived in three
 * of eight stops, a `1.5px` hairline could not be expressed at all, and nothing anywhere
 * actually drew a line. Now the line is the row, at true size, over the width of the column.
 */
export function WidthDemo( { value }: { value: string } ): JSX.Element {
	const line = useRef< HTMLElement >( null );
	const [ read, setRead ] = useState( '' );

	useLayoutEffect( () => {
		const node = line.current;
		if ( ! node ) return;
		setRead( getComputedStyle( node ).borderTopWidth );
	}, [ value ] );

	return (
		<div className="mdemo">
			<i ref={ line } className="bwline" style={ { borderTopWidth: value || undefined } } />
			<span className="srow__m">{ read }</span>
		</div>
	);
}

/**
 * A border, on a corner. `borderStyle.solid` is stored as `1px solid #111827` — a whole
 * border, not the keyword the category is named after — and dashes and dots only read at
 * length and around a turn, so the sample is a tile with two sides drawn rather than a chip.
 * The readout is the computed width and style, so a `var()` width reports the pixels it
 * resolves to.
 */
export function BorderDemo( { value }: { value: string } ): JSX.Element {
	const tile = useRef< HTMLElement >( null );
	const [ read, setRead ] = useState( '' );
	const valid = cssAccepts( 'border', value );

	useLayoutEffect( () => {
		const node = tile.current;
		if ( ! node ) return;
		const style = getComputedStyle( node );
		setRead( [ style.borderTopWidth, style.borderTopStyle ].filter( part => part && part !== 'none' ).join( ' · ' ) );
	}, [ value ] );

	return (
		<div className="mdemo">
			<i ref={ tile } className="bdtile" style={ { border: valid ? value || undefined : undefined } } />
			<span className={ `srow__m${ valid ? '' : ' bad' }` }>
				{ valid ? read : __( 'not valid CSS', 'blicks' ) }
			</span>
		</div>
	);
}

/**
 * A focus ring, on something shaped like the thing it will ring. A ring is judged by how
 * it reads around a control and against the page behind it — a bare swatch shows neither,
 * and a ring with a gap shows nothing at all unless something is inside the gap. The tile
 * is a control: card background, a border, the radius scale's own rounding. The readout is
 * the ring the browser resolved, in its pixels, so `0.25rem` is reported as the 4px it is.
 */
export function RingDemo( { value }: { value: string } ): JSX.Element {
	const tile = useRef< HTMLSpanElement >( null );
	const [ read, setRead ] = useState( '' );
	const valid = cssAccepts( 'boxShadow', value );

	useLayoutEffect( () => {
		const node = tile.current;
		if ( ! node ) return;
		setRead( describeRing( getComputedStyle( node ).boxShadow ) );
	}, [ value ] );

	return (
		<div className="mdemo">
			<span ref={ tile } className="ringpv" style={ { boxShadow: valid ? value || undefined : undefined } }>
				{ __( 'Focus', 'blicks' ) }
			</span>
			<span className={ `srow__m${ valid ? '' : ' bad' }` }>
				{ valid ? read : __( 'not valid CSS', 'blicks' ) }
			</span>
		</div>
	);
}

/**
 * A transform, against where it started. `translateY(-2px)` on a lone square is invisible —
 * there is nothing to be two pixels above — so the row draws the untransformed box as a
 * dashed ghost and the transformed one over it. The words come from the computed matrix
 * rather than the authored string, so they say what the element does, not what was typed.
 */
export function TransformDemo( { value }: { value: string } ): JSX.Element {
	const box = useRef< HTMLElement >( null );
	const [ read, setRead ] = useState( '' );

	useLayoutEffect( () => {
		const node = box.current;
		if ( ! node ) return;
		setRead( describeTransform( getComputedStyle( node ).transform ) );
	}, [ value ] );

	return (
		<div className="mdemo">
			<span className="xbox">
				<i className="xbox__ghost" />
				<i ref={ box } className="xbox__live" style={ { transform: value || undefined } } />
			</span>
			<span className={ `srow__m${ cssAccepts( 'transform', value ) ? '' : ' bad' }` }>
				{ cssAccepts( 'transform', value ) ? read : __( 'not valid CSS', 'blicks' ) }
			</span>
		</div>
	);
}

/**
 * A filter, over something worth filtering. `blur(4px)` and `grayscale(1)` both leave a flat
 * coloured box looking exactly like a flat coloured box, so the sample carries colour, an
 * edge and text — and it sits beside the same sample unfiltered, since dimming only reads
 * against what it was dimmed from.
 */
export function FilterDemo( { value }: { value: string } ): JSX.Element {
	const valid = cssAccepts( 'filter', value );
	return (
		<div className="mdemo">
			{ /* Unfiltered, then filtered — the arrow says which is which, so the readout is
			     left for the one thing the samples cannot say: that the value does not parse. */ }
			<span className="fpair" aria-hidden="true">
				<i className="fsample">Aa</i>
				<i className="farrow">→</i>
				<i className="fsample" style={ { filter: valid ? value || undefined : undefined } }>Aa</i>
			</span>
			{ ! valid && <span className="srow__m bad">{ __( 'not valid CSS', 'blicks' ) }</span> }
		</div>
	);
}

/**
 * What a set of length values actually comes out as, in pixels. A spacing scale is
 * judged by the ramp between its steps, and the stored strings cannot be compared:
 * `1.5rem`, `clamp(30px, 5vw, 50px)` and `var(--wp--preset--spacing--40)` are three
 * different notations for a size, and a fluid one has no single size at all. One
 * off-screen probe measures them all — for a `clamp()`, both of its bounds too.
 */
export function useLengths( values: readonly string[] ): Record< string, { min: number; max: number; fluid: boolean } > {
	const key = values.join( '|' );
	const [ measured, setMeasured ] = useState< Record< string, { min: number; max: number; fluid: boolean } > >( {} );

	useLayoutEffect( () => {
		const probe = document.createElement( 'div' );
		probe.style.cssText = 'position:absolute;top:0;left:-9999px;height:0;visibility:hidden;';
		document.body.appendChild( probe );

		const widthOf = ( value: string ): number => {
			probe.style.width = '0px';
			probe.style.width = value;                     // an invalid value leaves the 0px
			return probe.getBoundingClientRect().width;
		};

		const next: Record< string, { min: number; max: number; fluid: boolean } > = {};
		for ( const value of values ) {
			const bounds = parseClamp( value );
			// A fluid token is a range, not a number, so it is reported as one.
			next[ value ] = bounds
				? { min: widthOf( bounds.min ), max: widthOf( bounds.max ), fluid: true }
				: { min: widthOf( value ), max: widthOf( value ), fluid: false };
		}

		probe.remove();
		setMeasured( next );
	}, [ key ] );  // `values` is rebuilt every render; its contents are the dependency

	return measured;
}

/**
 * Which of these colour slugs the active theme actually declares as palette presets.
 * The rest exist only inside Blicks: real for blocks (we emit `--blicks-color-*` from
 * our own values) but invisible in the Site Editor, which is worth saying out loud.
 */
/**
 * One drawing scale for a set of bars, measured from the room they actually have. Bars only
 * mean anything against each other, so every row in a section shares one scale; and the room
 * has to be measured rather than assumed, since the centre column is narrower than the widest
 * value at some widths. Returns 1 whenever the whole scale fits at 1:1.
 */
export function useTrackScale( max: number ): { ref: React.RefObject< HTMLDivElement >; scale: number } {
	const ref = useRef< HTMLDivElement >( null );
	const [ scale, setScale ] = useState( 1 );

	useEffect( () => {
		const rows = ref.current;
		if ( ! rows ) return;
		// The track is re-queried on every measurement, never cached: React replaces these
		// nodes as the section re-renders, and a detached node measures 0 — which silently
		// pinned the scale at 1:1 while the bars were overflowing a 60px track.
		const fit = (): void => {
			const track = rows.querySelector( '.srow__track' );
			if ( ! track ) return;
			// The resolved-pixels label sits at the track's right end. Reserve its width from
			// both the layout and the scale, measured rather than guessed: painting the label
			// over the bar would hide exactly the end the bar is being drawn to show.
			const reserve = Math.max( 0, ...[ ...rows.querySelectorAll( '.srow__m' ) ].map( m => m.getBoundingClientRect().width ) ) + 10;
			rows.style.setProperty( '--m-reserve', `${ reserve }px` );

			const room = track.getBoundingClientRect().width - 8 - reserve;  // less the two walls
			if ( max <= 0 || room <= 0 ) return;
			setScale( Math.min( 1, room / max ) );
		};
		fit();
		const observer = new ResizeObserver( fit );
		observer.observe( rows );
		return () => observer.disconnect();
	}, [ max ] );

	return { ref, scale };
}

export function useThemePalette( slugs: readonly string[] ): Set< string > {
	const [ declared, setDeclared ] = useState< Set< string > >( () => new Set() );

	useEffect( () => {
		const computed = getComputedStyle( document.body );
		const found = slugs.filter( slug => computed.getPropertyValue( `--wp--preset--color--${ slug }` ).trim() !== '' );
		// Same members → keep the old Set, or this effect would re-run on its own output.
		setDeclared( prev => ( prev.size === found.length && found.every( slug => prev.has( slug ) ) ? prev : new Set( found ) ) );
	}, [ slugs ] );

	return declared;
}

/**
 * A collapsible token section. Declared at module scope on purpose: as a function defined
 * inside the panel its type identity changed on every render, so React unmounted and rebuilt
 * all seventeen sections on every keystroke — throwing away DOM state, focus, and any
 * observer bound to a node inside them.
 */
export function Section( {
	ui,
	id,
	n,
	title,
	desc,
	code,
	reset,
	children,
}: {
	ui: {
		q: string;
		hit: ( ...terms: string[] ) => boolean;
		collapsed: Record< string, boolean >;
		setCollapsed: ( update: ( previous: Record< string, boolean > ) => Record< string, boolean > ) => void;
		groupReset: ( category: string ) => JSX.Element;
	};
	id: string;
	n: number;
	title: string;
	desc: string;
	code?: string;
	reset?: string;
	children: React.ReactNode;
} ): JSX.Element | null {
	const rows = ( Array.isArray( children ) ? children.flat( Infinity ) : [ children ] ).filter( Boolean );
	if ( ui.q !== '' && rows.length === 0 && ! ui.hit( title, code ?? '' ) ) return null;
	const isCollapsed = ui.q === '' && ui.collapsed[ id ] === true;
	return (
		<section className={ `sec${ isCollapsed ? ' collapsed' : '' }` } id={ `s-${ id }` }>
			<button
				type="button"
				className="sec-h"
				aria-expanded={ ! isCollapsed }
				onClick={ () => ui.setCollapsed( c => ( { ...c, [ id ]: ! isCollapsed } ) ) }
			>
				<svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
				<h3>{ title }</h3>
				<span className="desc">{ desc }</span>
				{ reset && ui.groupReset( reset ) }
				<span className="n">{ sprintf(
					/* translators: %d: number of tokens in the section. */
					_n( '%d token', '%d tokens', n, 'blicks' ),
					n
				) }</span>
			</button>
			<div className="sec-body">{ children }</div>
		</section>
	);
}

/**
 * The Design System view — the full token catalog on the mockup's three-column editor
 * (mockups/admin-design/design-system.html): category rail, filterable collapsible sections
 * of `.trow` rows, and a live preview + generated-output rail that also owns save/discard.
 */
export function DesignSystemPanel( {
	snapshot,
	tokenDraft,
	breakpointDraft,
	typeRoleDraft,
	colorTokens,
	themes,
	isSaving,
	isDirty,
	onTokenChange,
	onTokenReset,
	onBreakpointChange,
	onBreakpointReset,
	onTypeRoleChange,
	onTypeRoleReset,
	onReset,
	onSave,
	onApplyTheme,
	onCreateTheme,
	onDeleteTheme,
	onResetTheme,
	onGroupReset,
}: {
	snapshot: DesignSystemSnapshot;
	apiStatus: 'loading' | 'ready' | 'fallback';
	tokenDraft: Record< string, Record< string, string > >;
	breakpointDraft: Record< string, number >;
	typeRoleDraft: TypeRoleValues;
	colorTokens: readonly string[];
	themes: ThemesState;
	isSaving: boolean;
	isDirty: boolean;
	onTokenChange: ( category: string, token: string, value: string ) => void;
	onTokenReset: ( category: string, token?: string ) => void;
	onBreakpointChange: ( breakpoint: Breakpoint, value: string ) => void;
	onBreakpointReset: ( breakpointId: string ) => void;
	onTypeRoleChange: ( role: string, prop: string, value: string ) => void;
	onTypeRoleReset: ( role: string, prop?: string ) => void;
	onReset: () => void;
	onSave: () => Promise< void >;
	onApplyTheme: ( id: string ) => void;
	onCreateTheme: ( name: string ) => void;
	onDeleteTheme: ( id: string ) => void;
	onResetTheme: ( id: string ) => void;
	onGroupReset: ( category: string ) => void;
} ): JSX.Element {
	const animations = useAnimations();
	const [ activeSec, setActiveSec ] = useState( () => parseHash().section || 'themes' );
	const [ collapsed, setCollapsed ] = useState< Record< string, boolean > >( {} );
	const [ openRoles, setOpenRoles ] = useState< Record< string, boolean > >( {} );
	const [ filter, setFilter ] = useState( '' );
	const [ customSlugs, setCustomSlugs ] = useState< Record< string, string[] > >( {} );
	const [ composer, setComposer ] = useState< { category: string; name: string; value: string } | null >( null );
	const [ themeComposer, setThemeComposer ] = useState< string | null >( null );
	const [ confirmApply, setConfirmApply ] = useState< string | null >( null );
	const [ confirmDel, setConfirmDel ] = useState< string | null >( null );
	const [ confirmReset, setConfirmReset ] = useState< string | null >( null );
	const baseValues = snapshot.baseValues as Record< string, Record< string, string > >;
	const syncStatus = designSyncStatus( snapshot.source );

	// Which fields carry an unsaved override — drives the per-field "modified"
	// marker, the inline reset affordance, and the per-section rail dot.
	const tokenModified = ( cat: string, tok: string ): boolean => Object.prototype.hasOwnProperty.call( tokenDraft[ cat ] ?? {}, tok );
	const roleModified = ( role: string, prop: string ): boolean => Object.prototype.hasOwnProperty.call( typeRoleDraft[ role ] ?? {}, prop );
	const bpModified = ( id: string ): boolean => Object.prototype.hasOwnProperty.call( breakpointDraft, id );
	const catDirty = ( ...cats: string[] ): boolean => cats.some( c => Object.keys( tokenDraft[ c ] ?? {} ).length > 0 );
	const sectionDirty = ( id: string ): boolean => {
		switch ( id ) {
			case 'bp': return Object.keys( breakpointDraft ).length > 0;
			case 'type': return catDirty( 'fontFamily' ) || Object.values( typeRoleDraft ).some( r => Object.keys( r ?? {} ).length > 0 );
			case 'color': return catDirty( 'color' );
			case 'space': return catDirty( 'spacing' );
			case 'radius': return catDirty( 'radius' );
			case 'shadow': return catDirty( 'shadow' );
			case 'gradient': return catDirty( 'gradient' );
			case 'motion': return catDirty( 'transition', 'transform', 'filter' );
			case 'z': return catDirty( 'zIndex' );
			case 'opacity': return catDirty( 'opacity' );
			case 'border': return catDirty( 'borderWidth', 'borderStyle' );
			case 'ring': return catDirty( 'ring' );
			case 'sizing': return catDirty( 'width', 'aspect' );
			case 'leading': return catDirty( 'leading' );
			default: return false;
		}
	};

	// Section headers stick directly below the sticky toolbar, so the CSS needs the toolbar's
	// live height — it wraps at narrow widths, so a hardcoded offset would leave a gap or
	// tuck the header underneath. Published as `--ds-stick` on `.main`, which `.sec-h` (and
	// the sections' `scroll-margin-top`) read.
	const toolbarRef = useRef< HTMLDivElement >( null );
	useEffect( () => {
		const toolbar = toolbarRef.current;
		const main = toolbar?.parentElement;
		if ( ! toolbar || ! main ) return;
		const publish = (): void => main.style.setProperty( '--ds-stick', `${ toolbar.offsetHeight }px` );
		publish();
		const observer = new ResizeObserver( publish );
		observer.observe( toolbar );
		return () => observer.disconnect();
	}, [] );

	// On load, jump to the section saved in the hash so a reload lands in place.
	useEffect( () => {
		const { section } = parseHash();
		if ( ! section ) return;
		const el = document.getElementById( `s-${ section }` );
		if ( el ) el.scrollIntoView( { block: 'start' } );
	}, [] );

	// Scroll-spy: highlight the rail entry for whichever section is at the top, and
	// mirror it into the hash (replaceState — no history spam) so a reload restores it.
	useEffect( () => {
		const ids = [ 'themes', 'color', 'type', 'space', 'radius', 'shadow', 'gradient', 'motion', 'anim', 'z', 'opacity', 'border', 'ring', 'sizing', 'leading', 'bp', 'out' ];
		const els = ids.map( id => document.getElementById( `s-${ id }` ) ).filter( ( el ): el is HTMLElement => el !== null );
		if ( els.length === 0 ) return;
		const observer = new IntersectionObserver( entries => {
			const top = entries.filter( e => e.isIntersecting ).sort( ( a, b ) => a.boundingClientRect.top - b.boundingClientRect.top )[ 0 ];
			if ( top ) {
				const id = top.target.id.replace( /^s-/, '' );
				setActiveSec( id );
				window.history.replaceState( null, '', `#design/${ id }` );
			}
		}, { rootMargin: '-100px 0px -60% 0px', threshold: 0 } );
		els.forEach( el => observer.observe( el ) );
		return () => observer.disconnect();
	}, [] );

	// ⌘/Ctrl-S saves when there are pending changes.
	useEffect( () => {
		const onKey = ( e: KeyboardEvent ): void => {
			if ( ( e.metaKey || e.ctrlKey ) && ( e.key === 's' || e.key === 'S' ) ) {
				e.preventDefault();
				if ( isDirty && ! isSaving ) void onSave();
			}
		};
		window.addEventListener( 'keydown', onKey );
		return () => window.removeEventListener( 'keydown', onKey );
	}, [ isDirty, isSaving, onSave ] );

	// What differs from what is saved — not the size of the draft, which is seeded from the
	// saved overrides and so counted four saved edits as unsaved the moment a fifth was made.
	const dirtyCount =
		countNestedChanges( tokenDraft, snapshot.overrides.tokens ) +
		countRecordChanges( breakpointDraft, snapshot.overrides.breakpoints ) +
		countNestedChanges( typeRoleDraft, snapshot.overrides.typeRoles );

	const colorVal = ( token: string ): string => {
		const d = tokenDraft.color ?? {};
		if ( Object.prototype.hasOwnProperty.call( d, token ) ) return d[ token ] ?? '';
		return baseValues.color?.[ token ] ?? COLOR_FALLBACKS[ token ] ?? '#000000';
	};
	const tokVal = ( category: string, token: string ): string => {
		const d = tokenDraft[ category ] ?? {};
		if ( Object.prototype.hasOwnProperty.call( d, token ) ) return d[ token ] ?? '';
		return baseValues[ category ]?.[ token ] ?? '';
	};
	const roleVal = ( role: string, prop: string ): string => {
		const d = typeRoleDraft[ role ] ?? {};
		if ( Object.prototype.hasOwnProperty.call( d, prop ) ) return d[ prop ] ?? '';
		return snapshot.typeRoles.values[ role ]?.[ prop ] ?? snapshot.typeRoles.base[ role ]?.[ prop ] ?? TYPE_ROLE_DEFAULTS[ role ]?.[ prop ] ?? '';
	};
	const hexSafe = ( v: string ): string => /^#[0-9a-fA-F]{6}$/.test( v.trim() ) ? v.trim() : '#000000';
	const num = ( v: string ): number => parseFloat( v ) || 0;
	// A range can only represent a plain number+unit; `var(...)`, `clamp()` and friends
	// fall back to a text field rather than being silently rounded into a slider.
	const isPlainNumber = ( v: string ): boolean => /^-?\d*\.?\d+(px|rem|em|%|s|ms|vw|vh|ch)?$/.test( stripVars( v ).trim() );
	const isTokenRef = ( value: string ): boolean => { const v = value.trim(); return v.startsWith( 'var(' ) || v.startsWith( '--' ); };

	const q = filter.trim().toLowerCase();
	const hit = ( ...terms: string[] ): boolean => q === '' || terms.some( t => t.toLowerCase().includes( q ) );

	const familyOptions = ( () => {
		const seen = new Set< string >(); const opts: { slug: string; name: string }[] = [];
		for ( const slug of snapshot.tokens.fontFamily ) { if ( ! seen.has( slug ) ) { seen.add( slug ); opts.push( { slug, name: titleCase( slug ) } ); } }
		for ( const fam of snapshot.fontLibrary ) { if ( ! seen.has( fam.slug ) ) { seen.add( fam.slug ); opts.push( { slug: fam.slug, name: fam.name } ); } }
		return opts;
	} )();
	const familySlug = ( value: string ): string => { const m = value.match( /^var\(--wp--preset--font-family--([a-z0-9-]+)\)$/ ); return m ? m[ 1 ] : value; };

	const goSec = ( id: string ): void => {
		setActiveSec( id );
		setCollapsed( c => ( { ...c, [ id ]: false } ) );
		window.history.replaceState( null, '', `#design/${ id }` );
		const el = document.getElementById( `s-${ id }` );
		if ( ! el ) return;
		const reduce = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
		el.scrollIntoView( { behavior: reduce ? 'auto' : 'smooth', block: 'start' } );
	};

	const slugify = ( raw: string ): string => raw.toLowerCase().replace( /[^a-z0-9]+/g, '-' ).replace( /^-+|-+$/g, '' );

	// Slugs added this session render as real rows right away (the catalog from the
	// snapshot doesn't know about them until the next save+reload).
	const slugsFor = ( category: string, catalog: readonly string[] ): string[] => Array.from( new Set( [ ...catalog, ...( customSlugs[ category ] ?? [] ) ] ) );

	const composerSlug = composer ? slugify( composer.name ) : '';
	const composerTaken = composer ? slugsFor( composer.category, ( snapshot.tokens as Record< string, readonly string[] > )[ composer.category ] ?? [] ).includes( composerSlug ) || ( composer.category === 'color' && colorTokens.includes( composerSlug ) ) : false;
	const composerValid = composer ? composerSlug !== '' && ! composerTaken && composer.value.trim() !== '' && validateTokenValue( composer.category, wrapVars( composer.value.trim() ) ) : false;

	const submitComposer = (): void => {
		if ( ! composer || ! composerValid ) return;
		const { category } = composer;
		setCustomSlugs( current => ( { ...current, [ category ]: [ ...( current[ category ] ?? [] ), composerSlug ] } ) );
		onTokenChange( category, composerSlug, wrapVars( composer.value.trim() ) );
		setComposer( null );
	};

	const NAV = [
		{ id: 'themes', label: __( 'Themes', 'blicks' ), count: themes.themes.length },
		{ id: 'color', label: __( 'Color', 'blicks' ), count: snapshot.tokens.color.length },
		{ id: 'type', label: __( 'Typography', 'blicks' ), count: snapshot.typeRoles.roles.length },
		{ id: 'space', label: __( 'Spacing', 'blicks' ), count: snapshot.tokens.spacing.length },
		{ id: 'radius', label: __( 'Radius', 'blicks' ), count: snapshot.tokens.radius.length },
		{ id: 'shadow', label: __( 'Shadow', 'blicks' ), count: snapshot.tokens.shadow.length },
		{ id: 'gradient', label: __( 'Gradient', 'blicks' ), count: snapshot.tokens.gradient.length },
		{ id: 'motion', label: __( 'Motion', 'blicks' ), count: snapshot.tokens.transition.length + snapshot.tokens.transform.length + snapshot.tokens.filter.length },
		{ id: 'anim', label: __( 'Animation', 'blicks' ), count: animations.library.length },
		{ id: 'z', label: __( 'Z-index', 'blicks' ), count: snapshot.tokens.zIndex.length },
		{ id: 'opacity', label: __( 'Opacity', 'blicks' ), count: snapshot.tokens.opacity.length },
		{ id: 'border', label: __( 'Border', 'blicks' ), count: snapshot.tokens.borderWidth.length + snapshot.tokens.borderStyle.length },
		{ id: 'ring', label: __( 'Focus ring', 'blicks' ), count: snapshot.tokens.ring.length },
		{ id: 'sizing', label: __( 'Sizing', 'blicks' ), count: snapshot.tokens.width.length + snapshot.tokens.aspect.length },
		{ id: 'leading', label: __( 'Line-height', 'blicks' ), count: snapshot.tokens.leading.length },
		{ id: 'bp', label: __( 'Breakpoints', 'blicks' ), count: snapshot.breakpoints.length },
		{ id: 'out', label: 'theme.json', count: 0 },
	];
	const totalTokens = NAV.reduce( ( n, s ) => n + s.count, 0 );

	/* ── row builders — all three-column `.trow` ───────────────────────────── */

	/**
	 * A colour token as a swatch-first tile. Colour is the thing being judged here, so it
	 * leads: as a row the 32px swatch sat a column away from the name it belonged to, and
	 * 26 of them stacked vertically made the section a 1300px scroll of loud hex fields.
	 * The tile keeps both edit paths — click the swatch for the native picker, type in the
	 * value — but the value field only draws its border on hover/focus so the resting state
	 * is colour and names rather than 26 boxes.
	 */
	const colorRow = ( token: string, opts: { strip?: string; always?: boolean; label?: string; flag?: boolean } = {} ): JSX.Element | null => {
		const { strip, always = false, flag = true } = opts;
		const cssVar = `--blicks-color-${ token }`;
		// `always`: inside a pair the two halves stand or fall together — filtering one out
		// would leave a surface with no text colour beside it.
		if ( ! always && ! hit( token, cssVar, titleCase( token ) ) ) return null;
		const val = colorVal( token );
		// Inside a band that already says "Text", every tile repeating "… Foreground" is both
		// noise and the reason the names were too long to fit three across.
		const label = opts.label ?? ( strip && token.endsWith( `-${ strip }` ) ? titleCase( token.slice( 0, -strip.length - 1 ) ) : titleCase( token ) );
		return (
			<div className="ctile" key={ token } title={ cssVar }>
				<span className="ctile__sw" style={ { '--c': val } as React.CSSProperties }>
					<input
						type="color"
						value={ hexSafe( val ) }
						disabled={ isSaving }
						aria-label={ sprintf( /* translators: %s: color token name. */ __( 'Pick %s color', 'blicks' ), titleCase( token ) ) }
						onChange={ e => onTokenChange( 'color', token, e.currentTarget.value ) }
					/>
				</span>
				<span className={ `ctile__nm${ flag && ! themePalette.has( token ) ? ' off' : '' }` } title={ flag && ! themePalette.has( token ) ? NOT_IN_PALETTE : undefined }>{ label }</span>
				<span className="ctile__val">
					<ValidatedInput
						className="hex"
						type="text"
						value={ val }
						disabled={ isSaving }
						title={ val } /* truncated at rest — hover reads the whole `color-mix(…)` */
						aria-label={ sprintf( /* translators: %s: color token name. */ __( '%s value', 'blicks' ), titleCase( token ) ) }
						modified={ tokenModified( 'color', token ) }
						toEdit={ colorToEdit }
						fromEdit={ wrapVars }
						validate={ v => isColorValue( v ) }
						onCommit={ v => onTokenChange( 'color', token, v ) }
						onRevert={ () => onTokenReset( 'color', token ) }
					/>
				</span>
			</div>
		);
	};

	/**
	 * A surface and the text meant to sit on it, as one tile: the pair rendered together,
	 * the ratio they produce, and both swatches under it. This is what the Design System
	 * knows that Global Styles does not — that these two slugs are a pair at all.
	 */
	const pairTile = ( { surface, text, label }: { surface: string; text: string; label: string } ): JSX.Element | null => {
		if ( ! coreColors.includes( surface ) || ! coreColors.includes( text ) ) return null;
		if ( ! hit( surface, text, label, `--blicks-color-${ surface }` ) ) return null;
		// Marked once on the pair rather than twice underneath: it is the same fact about both.
		const ownPair = themePalette.has( surface ) && themePalette.has( text );
		return (
			<div className="cpair" key={ surface }>
				<b className={ `cpair__nm${ ownPair ? '' : ' off' }` } title={ ownPair ? undefined : NOT_IN_PALETTE }>{ label }</b>
				<PairDemo surface={ colorVal( surface ) } text={ colorVal( text ) } sample={ __( 'Aa · The atomic builder', 'blicks' ) } />
				<div className="cpair__f">
					{ colorRow( surface, { always: true, flag: false, label: __( 'Surface', 'blicks' ) } ) }
					{ colorRow( text, { always: true, flag: false, label: __( 'Text', 'blicks' ) } ) }
				</div>
			</div>
		);
	};

	/**
	 * A named band of colour tiles. The group used to be repeated as a label on every row;
	 * it reads once as a subhead instead. Renders nothing when the filter has emptied it,
	 * so a search never leaves a heading standing over no tiles.
	 */
	const colorGroup = ( label: string, tokens: readonly string[], strip?: string ): JSX.Element | null => {
		const tiles = tokens.map( t => colorRow( t, { strip } ) ).filter( Boolean );
		if ( tiles.length === 0 ) return null;
		return (
			<Fragment key={ label }>
				<div className="grp eyebrow">{ label }</div>
				<div className="cgrid">{ tiles }</div>
			</Fragment>
		);
	};

	/**
	 * A step of the spacing scale, drawn at its own size. The scale is the point — whether the
	 * steps ramp evenly, where the jumps are — and a slider per row said nothing about that:
	 * its 96px ceiling was below three of the theme's own steps, so those rows silently became
	 * text fields instead. Now the bar is the value (shared scale across the section), the
	 * resolved pixels sit beside it, and the field holds what is actually stored.
	 */
	const spaceRow = ( token: string ): JSX.Element | null => {
		const cssVar = `--blicks-spacing-${ token }`;
		if ( ! hit( token, cssVar, titleCase( token ) ) ) return null;
		const val = tokVal( 'spacing', token );
		const size = spaceLengths[ val ];
		const round = ( px: number ): number => Math.round( px * 10 ) / 10;
		// Drawn at `spaceScale` — 1:1 whenever the largest step fits, because a real 30px gap
		// says more than 30% of a bar would. One scale for every row: letting each row shrink
		// on its own would leave bars that no longer compare, which is the whole point of them.
		const span = ( px: number ): React.CSSProperties => ( { flex: `0 0 ${ px * spaceScale }px` } );

		return (
			<div className="srow" key={ token }>
				<div className="srow__n"><b>{ titleCase( token ) }</b><code>{ cssVar }</code></div>
				{ /* Spacing is the gap between two things, so it is drawn as one. */ }
				<div className="srow__track">
					<i className="srow__wall" />
					<i className="srow__gap" style={ span( size?.min ?? 0 ) } />
					{ /* A fluid step is a range: hatching covers what it can grow into. */ }
					{ size?.fluid && <i className="srow__ext" style={ span( size.max - size.min ) } /> }
					<i className="srow__wall" />
					{ /* Parked at the track's right edge: the bar leaves that space empty, and a
					     column of its own was taking width the value field needed. */ }
					<span className="srow__m" title={ size?.fluid ? __( 'Fluid — grows with the viewport between these bounds', 'blicks' ) : undefined }>
						{ size === undefined ? '' : ( size.fluid ? `${ round( size.min ) }–${ round( size.max ) }px` : `${ round( size.min ) }px` ) }
					</span>
				</div>
				<div className="ctl">
					<ValidatedInput
						className="txt"
						type="text"
						value={ val }
						disabled={ isSaving }
						title={ val }
						aria-label={ sprintf( /* translators: %s: token name. */ __( '%s value', 'blicks' ), titleCase( token ) ) }
						modified={ tokenModified( 'spacing', token ) }
						toEdit={ stripVars }
						fromEdit={ wrapVars }
						validate={ v => validateTokenValue( 'spacing', v ) }
						onCommit={ v => onTokenChange( 'spacing', token, v ) }
						onRevert={ () => onTokenReset( 'spacing', token ) }
					/>
				</div>
			</div>
		);
	};

	/**
	 * A radius, drawn on a corner at its true size. The slider this replaces was quietly
	 * destructive: its step was 1 against values authored in rem, so `0.25rem`, `0.5rem` and
	 * `0.75rem` all sat at the same two stops and touching one rewrote it to a whole rem —
	 * and `full` (9999px) pinned at the slider's max of 24, so a drag turned a pill into a
	 * 24px corner. Nothing in the row showed what any of it looked like.
	 */
	const radiusRow = ( token: string ): JSX.Element | null => {
		const cssVar = `--blicks-radius-${ token }`;
		if ( ! hit( token, cssVar, titleCase( token ) ) ) return null;
		const val = tokVal( 'radius', token );
		const size = radiusLengths[ val ];
		// `none` and `full` are anchors, not steps — see FIXED_TOKENS.
		const fixed = ( FIXED_TOKENS.radius ?? [] ).includes( token );
		// Past half the tile the corner is as round as it can get; saying `9999px` there would
		// be reporting the sentinel rather than the result.
		const label = size === undefined
			? ''
			: ( size.min >= RADIUS_TILE / 2 ? __( 'pill', 'blicks' ) : `${ Math.round( size.min * 10 ) / 10 }px` );

		return (
			<div className="srow" key={ token }>
				<div className="srow__n"><b>{ titleCase( token ) }</b><code>{ cssVar }</code></div>
				<div className="srow__pv">
					<i className="rad" style={ { borderRadius: val || '0' } } />
					<span className="srow__m" title={ val }>{ label }</span>
				</div>
				<div className="ctl">
					{ fixed ? (
						<span className="fixedv" title={ __( 'Fixed: this token\'s value is its meaning — blocks ask for it by name.', 'blicks' ) }>
							{ stripVars( val ) }
							<i>{ __( 'fixed', 'blicks' ) }</i>
						</span>
					) : (
						<ValidatedInput
							className="txt"
							type="text"
							value={ val }
							disabled={ isSaving }
							title={ val }
							aria-label={ sprintf( /* translators: %s: token name. */ __( '%s value', 'blicks' ), titleCase( token ) ) }
							modified={ tokenModified( 'radius', token ) }
							toEdit={ stripVars }
							fromEdit={ wrapVars }
							validate={ v => validateTokenValue( 'radius', v ) }
							onCommit={ v => onTokenChange( 'radius', token, v ) }
							onRevert={ () => onTokenReset( 'radius', token ) }
						/>
					) }
				</div>
			</div>
		);
	};

	/**
	 * A shadow, previewed and taken apart. One text field was the whole editor for what is
	 * really up to six decisions — inset, x, y, blur, spread, colour — so nudging a blur meant
	 * retyping the string and counting positions. The row previews the shadow and keeps the raw
	 * value editable; the parts open underneath.
	 *
	 * A value that cannot be taken apart and rebuilt unchanged (several layers, an order the
	 * parser does not know) says so and stays text-only, rather than being quietly rewritten.
	 */
	const shadowRow = ( token: string ): JSX.Element | null => {
		const cssVar = `--blicks-shadow-${ token }`;
		if ( ! hit( token, cssVar, titleCase( token ) ) ) return null;
		const val = tokVal( 'shadow', token );
		const fixed = ( FIXED_TOKENS.shadow ?? [] ).includes( token );
		const parts = parseShadow( val );
		const open = openRoles[ `shadow-${ token }` ] === true;

		const commit = ( next: Partial< ShadowParts > ): void => {
			if ( ! parts ) return;
			onTokenChange( 'shadow', token, formatShadow( { ...parts, ...next } ) );
		};
		const partField = ( label: string, key: 'x' | 'y' | 'blur' | 'spread' ): JSX.Element => (
			<label className="cf" key={ key }>
				<span>{ label }</span>
				<div className="ctl">
					<ValidatedInput
						className="txt"
						type="text"
						value={ parts?.[ key ] ?? '' }
						disabled={ isSaving }
						unitSplit
						aria-label={ sprintf( /* translators: 1: token name, 2: shadow part. */ __( '%1$s %2$s', 'blicks' ), titleCase( token ), label ) }
						validate={ v => v === '' || validateTokenValue( 'spacing', v ) }
						onCommit={ v => commit( { [ key ]: v } ) }
						onRevert={ () => onTokenReset( 'shadow', token ) }
					/>
				</div>
			</label>
		);

		return (
			<div className={ `prow${ open ? ' open' : '' }` } key={ token }>
				<div className="srow__n"><b>{ titleCase( token ) }</b><code>{ cssVar }</code></div>
				<div className="srow__pv">
					<i className="shad" style={ { boxShadow: val === 'none' ? undefined : val } } />
					{ /* The tile already shows the colour; the numbers are what it cannot show. */ }
					<span className="srow__m">{ parts
						? [
							sprintf( /* translators: %s: vertical offset. */ __( 'y %s', 'blicks' ), parts.y ),
							parts.blur ? sprintf( /* translators: %s: blur radius. */ __( 'blur %s', 'blicks' ), parts.blur ) : '',
							parts.spread ? sprintf( /* translators: %s: spread radius. */ __( 'spread %s', 'blicks' ), parts.spread ) : '',
						].filter( Boolean ).join( ' · ' )
						: ( val === 'none' ? __( 'no shadow', 'blicks' ) : '' ) }</span>
				</div>
				<div className="ctl">
					{ fixed ? (
						<span className="fixedv" title={ __( 'Fixed: this token\'s value is its meaning — blocks ask for it by name.', 'blicks' ) }>
							{ stripVars( val ) }
							<i>{ __( 'fixed', 'blicks' ) }</i>
						</span>
					) : (
						/* The caret belongs to the value it opens, so the two share one frame — but
						   the reset acts *on* the field and sits outside it, ahead of the frame. */
						<>
							{ /* The slot is always there, filled or not: appearing on edit would
							     otherwise shrink the field out from under whoever is typing. */ }
							<span className="rstslot">
								{ tokenModified( 'shadow', token ) && ! isSaving && (
									<FieldReset onRevert={ () => onTokenReset( 'shadow', token ) } />
								) }
							</span>
							<div className="combo">
							<ValidatedInput
								className="txt"
								type="text"
								value={ val }
								disabled={ isSaving }
								title={ val }
								externalReset
								aria-label={ sprintf( /* translators: %s: token name. */ __( '%s value', 'blicks' ), titleCase( token ) ) }
								modified={ tokenModified( 'shadow', token ) }
								toEdit={ stripVars }
								fromEdit={ wrapVars }
								validate={ v => validateTokenValue( 'shadow', v ) }
								onCommit={ v => onTokenChange( 'shadow', token, v ) }
								onRevert={ () => onTokenReset( 'shadow', token ) }
							/>
							<button
								type="button"
								className="combo__more"
								aria-expanded={ open }
								aria-label={ sprintf( /* translators: %s: token name. */ __( 'Edit %s parts', 'blicks' ), titleCase( token ) ) }
								onClick={ () => setOpenRoles( o => ( { ...o, [ `shadow-${ token }` ]: ! open } ) ) }
							>
								<svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
							</button>
							</div>
						</>
					) }
				</div>

				{ open && (
					<div className="parts parts--shadow">
						{ parts ? (
							<>
								{ /* The four lengths read as one row because that is what they are. */ }
								{ partField( __( 'X', 'blicks' ), 'x' ) }
								{ partField( __( 'Y', 'blicks' ), 'y' ) }
								{ partField( __( 'Blur', 'blicks' ), 'blur' ) }
								{ partField( __( 'Spread', 'blicks' ), 'spread' ) }
								<label className="cf span3">
									<span>{ __( 'Color', 'blicks' ) }</span>
									<div className="ctl shcol">
										{ /* A shadow colour is nearly always translucent, so it is shown over a
										     checkerboard and edited as text — a colour input would drop the alpha. */ }
										<i className="shcol__sw" style={ { '--c': parts.color || 'transparent' } as React.CSSProperties } />
										<ValidatedInput
											className="txt"
											type="text"
											value={ parts.color }
											disabled={ isSaving }
											title={ parts.color }
											aria-label={ sprintf( /* translators: %s: token name. */ __( '%s color', 'blicks' ), titleCase( token ) ) }
											validate={ v => v === '' || isColorValue( v ) }
											onCommit={ v => commit( { color: v } ) }
											onRevert={ () => onTokenReset( 'shadow', token ) }
										/>
									</div>
								</label>
								<div className="cf">
									<span>{ __( 'Inset', 'blicks' ) }</span>
									<div className="ctl">
										<Toggle
											checked={ parts.inset }
											disabled={ isSaving }
											label={ sprintf( /* translators: %s: token name. */ __( '%s inset', 'blicks' ), titleCase( token ) ) }
											onChange={ inset => commit( { inset } ) }
										/>
									</div>
								</div>
							</>
						) : (
							<p className="parts__no">{ __( 'More than one layer, or an order these fields cannot rebuild exactly — edit the value as text above.', 'blicks' ) }</p>
						) }
					</div>
				) }
			</div>
		);
	};

	/**
	 * A gradient, previewed and taken apart: kind, repeat, geometry and as many colour stops
	 * as you like. Anything CSS can express is reachable — the geometry is a free text field
	 * with per-kind suggestions rather than a fixed set of directions, so `closest-side at
	 * 20% 30%` is as available as `to right`.
	 */
	const gradientRow = ( token: string ): JSX.Element | null => {
		const cssVar = `--blicks-gradient-${ token }`;
		if ( ! hit( token, cssVar, titleCase( token ) ) ) return null;
		const val = tokVal( 'gradient', token );
		const parts = parseGradient( val );
		const open = openRoles[ `gradient-${ token }` ] === true;

		const commit = ( next: Partial< GradientParts > ): void => {
			if ( ! parts ) return;
			onTokenChange( 'gradient', token, formatGradient( { ...parts, ...next } ) );
		};
		const commitStops = ( stops: GradientStopList ): void => commit( { stops } );
		// Rejected input reverts to the part's own stored value — the field re-renders from
		// its prop — rather than resetting the whole token to the theme's gradient.
		const keep = (): void => undefined;

		/**
		 * Accept a geometry only if the value we would store reads back as the same geometry.
		 * Text this parser does not recognise as geometry becomes the *first colour stop* when
		 * re-read (`conic-gradient(40, …)` → a stop called `40`), which is how a typo in this
		 * field used to turn into a colour.
		 */
		const geometryWritesBack = ( value: string ): boolean => {
			if ( ! parts ) return false;
			if ( value.trim() === '' ) return true;
			const candidate = formatGradient( { ...parts, geometry: value } );
			return cssAccepts( 'backgroundImage', candidate ) && parseGradient( candidate )?.geometry === value.trim();
		};
		const setStop = ( index: number, next: Partial< { color: string; pos: string; pos2: string } > ): void => {
			if ( ! parts ) return;
			commitStops( parts.stops.map( ( stop, i ) => ( i === index ? { ...stop, ...next } : stop ) ) );
		};

		return (
			<div className={ `prow${ open ? ' open' : '' }` } key={ token }>
				<div className="srow__n"><b>{ titleCase( token ) }</b><code>{ cssVar }</code></div>
				<div className="srow__pv">
					<i className="grad" style={ { background: val || undefined } } />
					{ /* The raw field takes any text, so say when the browser will not take it. */ }
					{ ! cssAccepts( 'backgroundImage', val ) && (
						<span className="srow__m bad" title={ val }>{ __( 'not valid CSS', 'blicks' ) }</span>
					) }
				</div>
				<div className="ctl">
					<span className="rstslot">
						{ tokenModified( 'gradient', token ) && ! isSaving && (
							<FieldReset onRevert={ () => onTokenReset( 'gradient', token ) } />
						) }
					</span>
					<div className="combo">
						<ValidatedInput
							className="txt"
							type="text"
							value={ val }
							disabled={ isSaving }
							title={ val }
							externalReset
							aria-label={ sprintf( /* translators: %s: token name. */ __( '%s value', 'blicks' ), titleCase( token ) ) }
							modified={ tokenModified( 'gradient', token ) }
							toEdit={ stripVars }
							fromEdit={ wrapVars }
							validate={ v => validateTokenValue( 'gradient', v ) }
							onCommit={ v => onTokenChange( 'gradient', token, v ) }
							onRevert={ () => onTokenReset( 'gradient', token ) }
						/>
						<button
							type="button"
							className="combo__more"
							aria-expanded={ open }
							aria-label={ sprintf( /* translators: %s: token name. */ __( 'Edit %s parts', 'blicks' ), titleCase( token ) ) }
							onClick={ () => setOpenRoles( o => ( { ...o, [ `gradient-${ token }` ]: ! open } ) ) }
						>
							<svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
						</button>
					</div>
				</div>

				{ open && (
					<div className="parts parts--gradient">
						{ parts ? (
							<>
								<label className="cf">
									<span>{ __( 'Kind', 'blicks' ) }</span>
									<select
										className="txt"
										value={ parts.kind }
										disabled={ isSaving }
										onChange={ e => {
											const kind = e.currentTarget.value as GradientKind;
											// The old geometry rarely means anything to the new kind — an angle
											// is not a shape — so it resets to that kind's own starting point.
											// Angle-unit stop positions are conic-only: carried into a linear or
											// radial gradient they make the whole value invalid, so they go too.
											const stops = kind === 'conic'
												? parts.stops
												: parts.stops.map( stop => ( { ...stop, pos: ANGLE_POS_RE.test( stop.pos ) ? '' : stop.pos } ) );
											commit( { kind, stops, geometry: parts.geometry === '' ? '' : GRADIENT_GEOMETRY[ kind ] } );
										} }
									>
										<option value="linear">{ __( 'Linear', 'blicks' ) }</option>
										<option value="radial">{ __( 'Radial', 'blicks' ) }</option>
										<option value="conic">{ __( 'Conic', 'blicks' ) }</option>
									</select>
								</label>
								<div className="cf">
									<span>{ __( 'Repeating', 'blicks' ) }</span>
									<div className="ctl">
										<Toggle
											checked={ parts.repeating }
											disabled={ isSaving }
											label={ sprintf( /* translators: %s: token name. */ __( '%s repeating', 'blicks' ), titleCase( token ) ) }
											onChange={ repeating => commit( { repeating } ) }
										/>
									</div>
								</div>
								<label className="cf wide">
									<span>{ parts.kind === 'linear' ? __( 'Angle or direction', 'blicks' ) : __( 'Shape and position', 'blicks' ) }</span>
									<div className="ctl">
										<ValidatedInput
											className="txt"
											type="text"
											value={ parts.geometry }
											disabled={ isSaving }
											list={ `grad-geo-${ parts.kind }` }
											placeholder={ GRADIENT_GEOMETRY[ parts.kind ] }
											aria-label={ __( 'Gradient geometry', 'blicks' ) }
											validate={ geometryWritesBack }
											onCommit={ v => commit( { geometry: v } ) }
											onRevert={ keep }
										/>
										{ /* Suggestions, not a menu: anything CSS accepts can still be typed. */ }
										<datalist id={ `grad-geo-${ parts.kind }` }>
											{ GRADIENT_GEOMETRY_HINTS[ parts.kind ].map( hint => <option key={ hint } value={ hint } /> ) }
										</datalist>
									</div>
								</label>

								<div className="stops">
									<span className="eyebrow">{ __( 'Color stops', 'blicks' ) }</span>
									{ parts.stops.map( ( stop, index ) => {
										// A stop with no colour is a hint: it only moves the midpoint of the blend.
										const isHint = stop.color === '';
										const colors = parts.stops.filter( s => s.color !== '' ).length;
										return (
											// Keyed by index deliberately: a stop has no identity beyond its place in the list.
											<div className={ `stop${ isHint ? ' hint' : '' }` } key={ index }>
												{ isHint ? (
													<span className="stop__hint" title={ __( 'Colour hint — moves the midpoint of the blend', 'blicks' ) }>◇</span>
												) : (
													<span className="stop__sw" style={ { '--c': stop.color } as React.CSSProperties }>
														<input
															type="color"
															value={ hexSafe( stop.color ) }
															disabled={ isSaving }
															aria-label={ sprintf( /* translators: %d: stop number. */ __( 'Stop %d color', 'blicks' ), index + 1 ) }
															onChange={ e => setStop( index, { color: e.currentTarget.value } ) }
														/>
													</span>
												) }
												<ValidatedInput
													className="txt"
													type="text"
													value={ stop.color }
													disabled={ isSaving }
													placeholder={ __( 'hint', 'blicks' ) }
													aria-label={ sprintf( /* translators: %d: stop number. */ __( 'Stop %d color value', 'blicks' ), index + 1 ) }
													validate={ v => v === '' || isColorValue( v ) }
													onCommit={ v => setStop( index, { color: v } ) }
													onRevert={ keep }
												/>
												<ValidatedInput
													className="txt stop__pos"
													type="text"
													value={ stop.pos }
													disabled={ isSaving }
													placeholder={ __( 'auto', 'blicks' ) }
													aria-label={ sprintf( /* translators: %d: stop number. */ __( 'Stop %d position', 'blicks' ), index + 1 ) }
													validate={ v => v === '' || isGradientPosition( v ) }
													onCommit={ v => setStop( index, { pos: v } ) }
													onRevert={ keep }
												/>
												{ /* The second position of a hard band; meaningless on a hint. */ }
												<ValidatedInput
													className="txt stop__pos"
													type="text"
													value={ stop.pos2 ?? '' }
													disabled={ isSaving || isHint }
													placeholder={ __( 'end', 'blicks' ) }
													title={ __( 'Second position — paints a hard band between the two', 'blicks' ) }
													aria-label={ sprintf( /* translators: %d: stop number. */ __( 'Stop %d end position', 'blicks' ), index + 1 ) }
													validate={ v => v === '' || isGradientPosition( v ) }
													onCommit={ v => setStop( index, { pos2: v } ) }
													onRevert={ keep }
												/>
												<button
													type="button"
													className="stop__x"
													disabled={ isSaving || ( ! isHint && colors <= 2 ) }
													title={ ! isHint && colors <= 2 ? __( 'A gradient needs two colour stops', 'blicks' ) : __( 'Remove', 'blicks' ) }
													aria-label={ sprintf( /* translators: %d: stop number. */ __( 'Remove stop %d', 'blicks' ), index + 1 ) }
													onClick={ () => commitStops( parts.stops.filter( ( _, i ) => i !== index ) ) }
												>✕</button>
											</div>
										);
									} ) }
									<button
										type="button"
										className="addtok sm"
										disabled={ isSaving }
										onClick={ () => commitStops( [ ...parts.stops, { color: parts.stops[ parts.stops.length - 1 ].color || '#000000', pos: '', pos2: '' } ] ) }
									>
										{ icon( <><path d="M12 5v14M5 12h14" /></> ) }
										{ __( 'Add stop', 'blicks' ) }
									</button>
								</div>
							</>
						) : (
							<p className="parts__no">{ __( 'Not a single gradient these fields can rebuild exactly — edit the value as text above.', 'blicks' ) }</p>
						) }
					</div>
				) }
			</div>
		);
	};

	/**
	 * A preview row: the value shown as the thing it is, then the raw value, and optionally a
	 * disclosure holding its parts. Everything that reached for `cssRow` and got a static box
	 * back — motion, rings, borders — draws its own preview and shares this row.
	 */
	const previewRow = (
		category: 'transition' | 'transform' | 'filter' | 'ring' | 'borderWidth' | 'borderStyle'
			| 'opacity' | 'zIndex' | 'aspect' | 'leading',
		token: string,
		preview: ( value: string ) => JSX.Element,
		more?: { open: boolean; toggle: () => void; parts: JSX.Element },
	): JSX.Element | null => {
		const cssVar = `--blicks-${ category }-${ token }`;
		if ( ! hit( token, cssVar, titleCase( token ) ) ) return null;
		const val = tokVal( category, token );
		// Two categories are not named after the property they set.
		const probe: ProbeProperty = category === 'ring' ? 'boxShadow'
			: category === 'borderWidth' ? 'borderTopWidth'
				: category === 'borderStyle' ? 'border'
					: category === 'aspect' ? 'aspectRatio'
						: category === 'leading' ? 'lineHeight' : category;
		// `z-index` only accepts integers, but a token may legitimately hold a `var()`; the
		// probe covers both, and the category's own validator covers the rest.

		return (
			<div className={ `prow${ more?.open ? ' open' : '' }` } key={ `${ category }-${ token }` }>
				<div className="srow__n"><b>{ titleCase( token ) }</b><code>{ cssVar }</code></div>
				<div className="srow__pv">{ preview( val ) }</div>
				<div className="ctl">
					<span className="rstslot">
						{ tokenModified( category, token ) && ! isSaving && (
							<FieldReset onRevert={ () => onTokenReset( category, token ) } />
						) }
					</span>
					<div className="combo">
						<ValidatedInput
							className="txt"
							type="text"
							value={ val }
							disabled={ isSaving }
							title={ val }
							externalReset
							aria-label={ sprintf( /* translators: %s: token name. */ __( '%s value', 'blicks' ), titleCase( token ) ) }
							modified={ tokenModified( category, token ) }
							toEdit={ stripVars }
							fromEdit={ wrapVars }
							/* Free text, but not free of consequences: the browser is asked whether it
							   would accept the value for this very property, so `blurr(4px)` is
							   refused at the field rather than saved and rendered as nothing. */
							validate={ v => validateTokenValue( category, v ) && cssAccepts( probe, v ) }
							onCommit={ v => onTokenChange( category, token, v ) }
							onRevert={ () => onTokenReset( category, token ) }
						/>
						{ more && (
							<button
								type="button"
								className="combo__more"
								aria-expanded={ more.open }
								aria-label={ sprintf( /* translators: %s: token name. */ __( 'Edit %s parts', 'blicks' ), titleCase( token ) ) }
								onClick={ more.toggle }
							>
								<svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
							</button>
						) }
					</div>
				</div>
				{ more?.open && more.parts }
			</div>
		);
	};

	/** Common `transition-property` and easing values — suggestions, not a closed set. */
	const TRANSITION_PROPERTIES = [ 'all', 'opacity', 'transform', 'color', 'background-color', 'border-color', 'box-shadow', 'filter' ];
	const TRANSITION_TIMINGS = [ 'ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'cubic-bezier(0.4, 0, 0.2, 1)', 'steps(4, end)' ];

	/**
	 * A transition, played and taken apart. Which two of the four fields hold a time is
	 * decided by their order in the string, so `all 200ms ease 50ms` and `all 50ms ease 200ms`
	 * differ only by position — the reason duration and delay get swapped by hand and the
	 * reason they are separate fields here.
	 */
	const transitionRow = ( token: string ): JSX.Element | null => {
		const val = tokVal( 'transition', token );
		const parts = parseTransition( stripVars( val ) );
		const open = openRoles[ `transition-${ token }` ] === true;
		const commit = ( next: Partial< TransitionParts > ): void => {
			if ( ! parts ) return;
			onTokenChange( 'transition', token, formatTransition( { ...parts, ...next } ) );
		};
		// Part fields revert to their own value; resetting the whole token is the row's job.
		const keep = (): void => undefined;
		const partField = (
			label: string,
			key: keyof TransitionParts,
			valid: ( v: string ) => boolean,
			hints?: readonly string[],
		): JSX.Element => (
			<label className="cf" key={ key }>
				<span>{ label }</span>
				<div className="ctl">
					<ValidatedInput
						className="txt"
						type="text"
						value={ parts?.[ key ] ?? '' }
						disabled={ isSaving }
						list={ hints ? `tr-${ token }-${ key }` : undefined }
						aria-label={ sprintf( /* translators: 1: token name, 2: transition part. */ __( '%1$s %2$s', 'blicks' ), titleCase( token ), label ) }
						validate={ v => v === '' || valid( v ) }
						onCommit={ v => commit( { [ key ]: v } ) }
						onRevert={ keep }
					/>
					{ hints && (
						<datalist id={ `tr-${ token }-${ key }` }>
							{ hints.map( hint => <option key={ hint } value={ hint } /> ) }
						</datalist>
					) }
				</div>
			</label>
		);

		return previewRow( 'transition', token, value => <TransitionDemo value={ value } label={ titleCase( token ) } />, {
			open,
			toggle: () => setOpenRoles( o => ( { ...o, [ `transition-${ token }` ]: ! open } ) ),
			parts: (
				<div className="parts parts--transition">
					{ parts ? (
						<>
							{ partField( __( 'Property', 'blicks' ), 'property', v => /^(--[\w-]+|[a-z-]+)$/i.test( v ), TRANSITION_PROPERTIES ) }
							{ partField( __( 'Duration', 'blicks' ), 'duration', isTimeValue ) }
							{ partField( __( 'Easing', 'blicks' ), 'timing', isTimingValue, TRANSITION_TIMINGS ) }
							{ partField( __( 'Delay', 'blicks' ), 'delay', isTimeValue ) }
						</>
					) : (
						<p className="parts__no">{ __( 'Several transitions at once, or an order these fields cannot rebuild exactly — edit the value as text above.', 'blicks' ) }</p>
					) }
				</div>
			),
		} );
	};

	/**
	 * A focus ring, previewed on a control and edited as a ring. `ring.brand` is stored as
	 * `0 0 0 3px rgba(0, 43, 255, 0.35)` — five numbers of which three are always zero, and
	 * the offset form (`0 0 0 2px #fff, 0 0 0 5px blue`) hides the visible thickness as the
	 * difference between two spreads. The fields are the two decisions actually being made:
	 * how thick, and how far off the control.
	 */
	const ringRow = ( token: string ): JSX.Element | null => {
		const val = tokVal( 'ring', token );
		const parts = parseRing( stripVars( val ) );
		const open = openRoles[ `ring-${ token }` ] === true;
		const gapped = !! parts && ! isZeroLength( parts.offset );
		const commit = ( next: Partial< RingParts > ): void => {
			if ( ! parts ) return;
			const merged = { ...parts, ...next };
			// A gap layer with no colour of its own paints in `currentColor` — so opening a gap
			// would drop a solid dark band around the control. It defaults to the page colour,
			// which is what a gap is: the background showing through.
			if ( ! isZeroLength( merged.offset ) && merged.offsetColor.trim() === '' ) {
				merged.offsetColor = 'var(--blicks-color-background)';
			}
			onTokenChange( 'ring', token, formatRing( merged ) );
		};
		// Part fields revert to their own value; resetting the whole token is the row's job.
		const keep = (): void => undefined;
		const lengthField = ( label: string, key: 'thickness' | 'offset' | 'blur', hint?: string ): JSX.Element => (
			<label className="cf" key={ key }>
				<span>{ label }</span>
				<div className="ctl">
					<ValidatedInput
						className="txt"
						type="text"
						value={ parts?.[ key ] ?? '' }
						disabled={ isSaving }
						unitSplit
						placeholder={ hint }
						aria-label={ sprintf( /* translators: 1: token name, 2: ring part. */ __( '%1$s %2$s', 'blicks' ), titleCase( token ), label ) }
						validate={ v => v === '' || isLengthValue( v ) }
						onCommit={ v => commit( { [ key ]: v } ) }
						onRevert={ keep }
					/>
				</div>
			</label>
		);
		const colorField = ( label: string, key: 'color' | 'offsetColor', disabled: boolean, hint: string ): JSX.Element => (
			<label className="cf span2" key={ key }>
				<span>{ label }</span>
				<div className="ctl shcol">
					{ /* Ring colours are nearly always translucent, so the swatch sits on a
					     checkerboard and the value stays text — a colour input drops the alpha. */ }
					<i className="shcol__sw" style={ { '--c': parts?.[ key ] || 'transparent' } as React.CSSProperties } />
					<ValidatedInput
						className="txt"
						type="text"
						value={ parts?.[ key ] ?? '' }
						disabled={ isSaving || disabled }
						title={ disabled ? hint : parts?.[ key ] }
						placeholder={ disabled ? hint : undefined }
						aria-label={ sprintf( /* translators: 1: token name, 2: ring part. */ __( '%1$s %2$s', 'blicks' ), titleCase( token ), label ) }
						validate={ v => v === '' || isColorValue( v ) }
						onCommit={ v => commit( { [ key ]: v } ) }
						onRevert={ keep }
					/>
				</div>
			</label>
		);

		return previewRow( 'ring', token, value => <RingDemo value={ value } />, {
			open,
			toggle: () => setOpenRoles( o => ( { ...o, [ `ring-${ token }` ]: ! open } ) ),
			parts: (
				<div className="parts parts--ring">
					{ parts ? (
						<>
							{ lengthField( __( 'Thickness', 'blicks' ), 'thickness' ) }
							{ lengthField( __( 'Offset', 'blicks' ), 'offset' ) }
							{ lengthField( __( 'Softness', 'blicks' ), 'blur', __( '0 — a ring, not a glow', 'blicks' ) ) }
							{ colorField( __( 'Color', 'blicks' ), 'color', false, '' ) }
							{ /* With no offset there is no gap, and nothing for a gap colour to paint. */ }
							{ colorField( __( 'Gap color', 'blicks' ), 'offsetColor', ! gapped, __( 'Set an offset first', 'blicks' ) ) }
						</>
					) : (
						<p className="parts__no">{ __( 'Not a ring these fields can rebuild exactly — inset, shifted, or more than two layers. Edit the value as text above.', 'blicks' ) }</p>
					) }
				</div>
			),
		} );
	};

	/**
	 * A border shorthand, previewed on a corner and edited as its three parts. The width
	 * field suggests the set's own `borderWidth` tokens, since a border that hardcodes `1px`
	 * beside a `hair` token is the scale quietly forking.
	 */
	const borderStyleRow = ( token: string ): JSX.Element | null => {
		const val = tokVal( 'borderStyle', token );
		const parts = parseBorder( stripVars( val ) );
		const open = openRoles[ `border-${ token }` ] === true;
		const commit = ( next: Partial< BorderParts > ): void => {
			if ( ! parts ) return;
			onTokenChange( 'borderStyle', token, formatBorder( { ...parts, ...next } ) );
		};
		// Part fields revert to their own value; resetting the whole token is the row's job.
		const keep = (): void => undefined;
		const widthTokens = slugsFor( 'borderWidth', snapshot.tokens.borderWidth )
			.map( slug => `var(--blicks-borderWidth-${ slug })` );

		return previewRow( 'borderStyle', token, value => <BorderDemo value={ value } />, {
			open,
			toggle: () => setOpenRoles( o => ( { ...o, [ `border-${ token }` ]: ! open } ) ),
			parts: (
				<div className="parts parts--border">
					{ parts ? (
						<>
							<label className="cf">
								<span>{ __( 'Width', 'blicks' ) }</span>
								<div className="ctl">
									<ValidatedInput
										className="txt"
										type="text"
										value={ parts.width }
										disabled={ isSaving }
										list={ `bw-${ token }` }
										title={ parts.width }
										aria-label={ sprintf( /* translators: %s: token name. */ __( '%s width', 'blicks' ), titleCase( token ) ) }
										validate={ v => v === '' || isLengthValue( v ) }
										onCommit={ v => commit( { width: v } ) }
										onRevert={ keep }
									/>
									<datalist id={ `bw-${ token }` }>
										{ widthTokens.map( hint => <option key={ hint } value={ hint } /> ) }
									</datalist>
								</div>
							</label>
							<label className="cf">
								<span>{ __( 'Style', 'blicks' ) }</span>
								<div className="ctl">
									<select
										className="sel"
										value={ parts.style }
										disabled={ isSaving }
										aria-label={ sprintf( /* translators: %s: token name. */ __( '%s style', 'blicks' ), titleCase( token ) ) }
										onChange={ event => commit( { style: event.currentTarget.value } ) }
									>
										{ BORDER_STYLES.map( style => <option key={ style } value={ style }>{ style }</option> ) }
									</select>
								</div>
							</label>
							<label className="cf span2">
								<span>{ __( 'Color', 'blicks' ) }</span>
								<div className="ctl shcol">
									<i className="shcol__sw" style={ { '--c': parts.color || 'transparent' } as React.CSSProperties } />
									<ValidatedInput
										className="txt"
										type="text"
										value={ parts.color }
										disabled={ isSaving }
										title={ parts.color }
										aria-label={ sprintf( /* translators: %s: token name. */ __( '%s color', 'blicks' ), titleCase( token ) ) }
										validate={ v => v === '' || isColorValue( v ) }
										onCommit={ v => commit( { color: v } ) }
										onRevert={ keep }
									/>
								</div>
							</label>
						</>
					) : (
						<p className="parts__no">{ __( 'Not a border these three fields can rebuild exactly — edit the value as text above.', 'blicks' ) }</p>
					) }
				</div>
			),
		} );
	};

	/**
	 * An alpha step: the ink, a slider, and the number. The slider stays — opacity really is
	 * continuous — but at `step: 0.01`, not the 0.05 it had, which could not reach `0.64` or
	 * `0.06`: two of the four values in the shipped set, both of which a drag silently rounded
	 * away. A `var()` or `calc()` value has no position on a slider and gets the field alone.
	 */
	const opacityRow = ( token: string ): JSX.Element | null => {
		const val = tokVal( 'opacity', token );
		const plain = isPlainNumber( val );
		return previewRow( 'opacity', token, value => (
			<>
				<OpacityDemo value={ value } />
				{ plain ? (
					<input
						type="range"
						className="oprange"
						min="0"
						max="1"
						step="0.01"
						value={ num( stripVars( value ) ) }
						disabled={ isSaving }
						aria-label={ sprintf( /* translators: %s: token name. */ __( '%s value', 'blicks' ), titleCase( token ) ) }
						onChange={ event => onTokenChange( 'opacity', token, event.currentTarget.value ) }
					/>
				) : <span className="srow__m">{ __( 'computed', 'blicks' ) }</span> }
			</>
		) );
	};

	/**
	 * A stacking level. The value column keeps the number — the number is what ships — but the
	 * preview answers the questions the number does not: where this sits in the order, and
	 * whether two tokens have quietly landed on the same layer.
	 */
	const zRow = ( token: string, order: readonly { token: string; value: number }[] ): JSX.Element | null => {
		const rank = Math.max( 0, order.findIndex( entry => entry.token === token ) );
		const mine = order[ rank ]?.value;
		const clash = order.find( entry => entry.token !== token && entry.value === mine );
		return previewRow( 'zIndex', token, () => (
			<ZStack rank={ rank } total={ order.length } clash={ clash ? titleCase( clash.token ) : '' } />
		) );
	};

	/**
	 * A container width, drawn to scale. The 0–1600 slider could not set these values: at a
	 * ~400px track each pixel of drag moved the width four, so `1080px` was unreachable by
	 * hand, and `full` sat pinned at the maximum with nowhere above it. Widths are only
	 * judged against each other anyway — the useful question is the ramp from prose to full —
	 * so they are bars on one shared scale with the measured pixels beside them.
	 */
	const widthRow = ( token: string ): JSX.Element | null => {
		const cssVar = `--blicks-width-${ token }`;
		if ( ! hit( token, cssVar, titleCase( token ) ) ) return null;
		const val = tokVal( 'width', token );
		const size = widthLengths[ val ];
		const round = ( px: number ): number => Math.round( px * 10 ) / 10;
		const span = ( px: number ): React.CSSProperties => ( { flex: `0 0 ${ px * widthScale }px` } );

		return (
			<div className="srow" key={ token }>
				<div className="srow__n"><b>{ titleCase( token ) }</b><code>{ cssVar }</code></div>
				<div className="srow__track">
					<i className="wbar" style={ span( size?.min ?? 0 ) } />
					{ /* A fluid width is a range: hatching covers what it can grow into. */ }
					{ size?.fluid && <i className="wbar wbar--ext" style={ span( size.max - size.min ) } /> }
					<span className="srow__m" title={ size?.fluid ? __( 'Fluid — grows with the viewport between these bounds', 'blicks' ) : undefined }>
						{ size === undefined ? '' : ( size.fluid ? `${ round( size.min ) }–${ round( size.max ) }px` : `${ round( size.min ) }px` ) }
					</span>
				</div>
				<div className="ctl">
					<span className="rstslot">
						{ tokenModified( 'width', token ) && ! isSaving && (
							<FieldReset onRevert={ () => onTokenReset( 'width', token ) } />
						) }
					</span>
					<ValidatedInput
						className="txt"
						type="text"
						value={ val }
						disabled={ isSaving }
						title={ val }
						unitSplit
						externalReset
						aria-label={ sprintf( /* translators: %s: token name. */ __( '%s value', 'blicks' ), titleCase( token ) ) }
						modified={ tokenModified( 'width', token ) }
						toEdit={ stripVars }
						fromEdit={ wrapVars }
						validate={ v => validateTokenValue( 'width', v ) }
						onCommit={ v => onTokenChange( 'width', token, v ) }
						onRevert={ () => onTokenReset( 'width', token ) }
					/>
				</div>
			</div>
		);
	};

	/** Every property of a role — all six live behind the row's disclosure. */
	const ROLE_PROPS = [ 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'textTransform', 'fontFamily' ] as const;

	/**
	 * A type role: the specimen IS the row. Six equally-weighted fields under every one of the
	 * 13 roles made the section 3298px deep and restated the same six labels 78 times, while
	 * the thing you actually judge — the type — was the smallest element in the row. Now the
	 * row shows nothing but the role rendered at its configured settings and the figures the
	 * browser resolved for it, so the 13 roles read as a scale; every field opens on demand.
	 * A dot beside the name marks a role changed from the theme while the row is shut.
	 */
	const roleRow = ( role: string ): JSX.Element | null => {
		const label = TYPE_ROLE_LABELS[ role ] ?? role;
		if ( ! hit( role, label, `type.${ role }` ) ) return null;
		const fs = roleVal( role, 'fontSize' ), fw = roleVal( role, 'fontWeight' ), lh = roleVal( role, 'lineHeight' );
		const ls = roleVal( role, 'letterSpacing' ), ff = roleVal( role, 'fontFamily' ), tt = roleVal( role, 'textTransform' );
		const open = openRoles[ role ] === true;
		const changed = ROLE_PROPS.some( p => roleModified( role, p ) );
		return (
			<div className={ `rrow${ open ? ' open' : '' }` } key={ role }>
				<button
					type="button"
					className="rrow__hd"
					title={ `type.${ role }` }
					aria-expanded={ open }
					onClick={ () => setOpenRoles( o => ( { ...o, [ role ]: ! open } ) ) }
				>
					<span className="rrow__nm">
						{ label }
						{ changed && <i className="d" aria-hidden="true" title={ __( 'Changed from the theme value', 'blicks' ) } /> }
					</span>
					<RoleSpecimen
						text={ __( 'The atomic builder', 'blicks' ) }
						family={ ff ? ( familyOptions.find( o => o.slug === familySlug( ff ) )?.name ?? titleCase( familySlug( ff ) ) ) : undefined }
						signature={ [ fs, fw, lh, ls, tt, ff ].join( '|' ) }
						style={ {
							fontSize: fs || undefined,
							fontWeight: ( fw as unknown as number ) || undefined,
							lineHeight: lh || undefined,
							letterSpacing: ls || undefined,
							textTransform: ( tt || undefined ) as React.CSSProperties[ 'textTransform' ],
							fontFamily: ff || undefined,
						} }
					/>
					<svg className="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
				</button>

				{ open && (
					<div className="role__ctl">
						{ /* Native roles read their size from theme.json, so this often holds a preset
						     reference rather than a number — truncated here, full value on hover. */ }
						<label className="cf">
							<span>{ __( 'Size', 'blicks' ) }</span>
							<div className="ctl"><ValidatedInput className="txt" type="text" value={ fs } disabled={ isSaving } unitSplit title={ isTokenRef( fs ) ? stripVars( fs ) : undefined } modified={ roleModified( role, 'fontSize' ) } toEdit={ stripVars } fromEdit={ wrapVars } validate={ v => validateTypeRoleValue( 'fontSize', v ) } onCommit={ v => onTypeRoleChange( role, 'fontSize', v ) } onRevert={ () => onTypeRoleReset( role, 'fontSize' ) } /></div>
						</label>
						<label className="cf">
							<span>{ __( 'Weight', 'blicks' ) }</span>
							<select className="txt" value={ fw } disabled={ isSaving } onChange={ e => onTypeRoleChange( role, 'fontWeight', e.currentTarget.value ) }>
								{ [ '100', '200', '300', '400', '500', '600', '700', '800', '900' ].map( w => <option key={ w } value={ w }>{ w }</option> ) }
							</select>
						</label>
						<label className="cf">
							<span>{ __( 'Line height', 'blicks' ) }</span>
							<div className="ctl"><ValidatedInput className="txt" type="text" value={ lh } disabled={ isSaving } modified={ roleModified( role, 'lineHeight' ) } toEdit={ stripVars } fromEdit={ wrapVars } validate={ v => validateTypeRoleValue( 'lineHeight', v ) } onCommit={ v => onTypeRoleChange( role, 'lineHeight', v ) } onRevert={ () => onTypeRoleReset( role, 'lineHeight' ) } /></div>
						</label>
						<label className="cf">
							<span>{ __( 'Tracking', 'blicks' ) }</span>
							<div className="ctl"><ValidatedInput className="txt" type="text" value={ ls } disabled={ isSaving } unitSplit modified={ roleModified( role, 'letterSpacing' ) } toEdit={ stripVars } fromEdit={ wrapVars } validate={ v => validateTypeRoleValue( 'letterSpacing', v ) } onCommit={ v => onTypeRoleChange( role, 'letterSpacing', v ) } onRevert={ () => onTypeRoleReset( role, 'letterSpacing' ) } /></div>
						</label>
						<label className="cf">
							<span>{ __( 'Transform', 'blicks' ) }</span>
							<select className="txt" value={ tt } disabled={ isSaving } onChange={ e => onTypeRoleChange( role, 'textTransform', e.currentTarget.value ) }>
								{ [ 'none', 'uppercase', 'lowercase', 'capitalize' ].map( t => <option key={ t } value={ t }>{ t }</option> ) }
							</select>
						</label>
						<label className="cf">
							<span>{ __( 'Family', 'blicks' ) }</span>
							<select className="txt" value={ familySlug( ff ) } disabled={ isSaving } onChange={ e => onTypeRoleChange( role, 'fontFamily', e.currentTarget.value ) }>
								{ familyOptions.map( o => <option key={ o.slug } value={ o.slug }>{ o.name }</option> ) }
								{ ! familyOptions.some( o => o.slug === familySlug( ff ) ) && <option value={ familySlug( ff ) }>{ familySlug( ff ) }</option> }
							</select>
						</label>
					</div>
				) }
			</div>
		);
	};

	const addTok = ( category: string ): JSX.Element => {
		if ( composer?.category !== category ) {
			return (
				<button type="button" className="addtok" disabled={ isSaving } onClick={ () => setComposer( { category, name: '', value: '' } ) }>
					{ icon( <><path d="M12 5v14M5 12h14" /></> ) }
					{ __( 'Add token', 'blicks' ) }
				</button>
			);
		}
		const onKey = ( e: React.KeyboardEvent ): void => {
			if ( e.key === 'Enter' ) { e.preventDefault(); submitComposer(); }
			else if ( e.key === 'Escape' ) { e.preventDefault(); setComposer( null ); }
		};
		const valueValid = composer.value.trim() === '' || validateTokenValue( category, wrapVars( composer.value.trim() ) );
		return (
			<div className="addnew" onKeyDown={ onKey }>
				<div className="addnew__row">
					{ category === 'color' && <span className="addnew__sw" style={ { '--c': composer.value.trim() || 'transparent' } as React.CSSProperties } /> }
					<input className="addnew__name" autoFocus placeholder={ __( 'token-name', 'blicks' ) } aria-label={ __( 'Token name', 'blicks' ) } value={ composer.name } disabled={ isSaving } onChange={ e => setComposer( { ...composer, name: e.currentTarget.value } ) } />
					<input className={ `addnew__val${ valueValid ? '' : ' is-invalid' }` } placeholder={ __( 'value', 'blicks' ) } aria-label={ __( 'Token value', 'blicks' ) } value={ composer.value } disabled={ isSaving } onChange={ e => setComposer( { ...composer, value: e.currentTarget.value } ) } />
					<button type="button" className="btn primary sm" disabled={ ! composerValid || isSaving } onClick={ submitComposer }>{ __( 'Add', 'blicks' ) }</button>
					<button type="button" className="addnew__x" onClick={ () => setComposer( null ) } aria-label={ __( 'Cancel', 'blicks' ) }>✕</button>
				</div>
				<div className="addnew__hint">
					{ composerSlug === '' ? __( 'Name the token to generate its slug.', 'blicks' )
						: composerTaken ? sprintf( __( '%s already exists.', 'blicks' ), `--blicks-${ category }-${ composerSlug }` )
						: <code>--blicks-{ category }-{ composerSlug }</code> }
				</div>
			</div>
		);
	};

	const groupReset = ( category: string ): JSX.Element => (
		<button
			type="button"
			className="rst"
			disabled={ isSaving }
			title={ __( 'Reset group', 'blicks' ) }
			onClick={ e => { e.stopPropagation(); onGroupReset( category ); } }
		>↺</button>
	);

	/** A collapsible section. `rows` is pre-filtered; an empty section hides while filtering. */
	const sectionUi = { q, hit, collapsed, setCollapsed, groupReset };

	const allColorTokens = slugsFor( 'color', colorTokens );
	const coreColors = allColorTokens.filter( t => ( TOKENS.color as readonly string[] ).includes( t ) );
	const accentColors = allColorTokens.filter( t => ! ( TOKENS.color as readonly string[] ).includes( t ) );
	const radiusSlugs = slugsFor( 'radius', snapshot.tokens.radius );
	const radiusLengths = useLengths( radiusSlugs.map( t => tokVal( 'radius', t ) ) );
	const spaceSlugs = slugsFor( 'spacing', snapshot.tokens.spacing );
	const spaceLengths = useLengths( spaceSlugs.map( t => tokVal( 'spacing', t ) ) );
	const spaceMax = Math.max( 0, ...Object.values( spaceLengths ).map( size => size.max ) );
	const { ref: spaceRowsRef, scale: spaceScale } = useTrackScale( spaceMax );

	const widthSlugs = slugsFor( 'width', snapshot.tokens.width );
	const widthLengths = useLengths( widthSlugs.map( t => tokVal( 'width', t ) ) );
	const widthMax = Math.max( 0, ...Object.values( widthLengths ).map( size => size.max ) );
	const { ref: widthRowsRef, scale: widthScale } = useTrackScale( widthMax );
	const viewportWidth = useViewportWidth();
	const paired = new Set( COLOR_PAIRS.flatMap( p => [ p.surface, p.text ] ) );
	const NOT_IN_PALETTE = __( 'Not a palette preset in the active theme — this colour exists only inside Blicks, so the Site Editor will not show it.', 'blicks' );
	const themePalette = useThemePalette( allColorTokens );
	const grouped = new Set( COLOR_GROUPS.flatMap( g => g.tokens ) );
	const ungrouped = coreColors.filter( t => ! grouped.has( t ) );
	const tiles = PALETTE_TOKENS.map( t => colorVal( t ) );
	const activeTheme = themes.themes.find( t => t.id === themes.active );

	// The generated-output pane shows what this save would actually write. With a clean
	// draft it falls back to a few live values so the pane is never an empty box.
	const outputLines = useMemo( () => {
		const lines: Array< { prop: string; value: string } > = [];
		for ( const [ category, tokens ] of Object.entries( tokenDraft ) ) {
			for ( const [ token, value ] of Object.entries( tokens ?? {} ) ) {
				lines.push( { prop: `--blicks-${ category }-${ token }`, value } );
			}
		}
		for ( const [ role, props ] of Object.entries( typeRoleDraft ) ) {
			for ( const [ prop, value ] of Object.entries( props ?? {} ) ) {
				lines.push( { prop: `--blicks-type-${ role }-${ prop }`, value } );
			}
		}
		for ( const [ id, value ] of Object.entries( breakpointDraft ) ) {
			lines.push( { prop: `--blicks-bp-${ id }`, value: `${ value }px` } );
		}
		if ( lines.length > 0 ) return lines.slice( 0, 8 );

		return PALETTE_TOKENS.slice( 0, 4 ).map( t => ( { prop: `--blicks-color-${ t }`, value: colorVal( t ) } ) );
	}, [ tokenDraft, typeRoleDraft, breakpointDraft, colorVal ] );

	return (
		<>
			<div className="ph">
				<div>
					<div className="eyebrow accent">{ __( 'Design system', 'blicks' ) }</div>
					<h1>{ __( 'Configure the token set.', 'blicks' ) }</h1>
					<div className="sub">{ __( 'Edit the colors, type, and spacing your theme exposes. Token values compile to reusable classes; custom values stay per-instance.', 'blicks' ) }</div>
				</div>
				<div className="ph-actions">
					<button type="button" className="theme-sel" onClick={ () => goSec( 'themes' ) }>
						<span className="sw" aria-hidden="true">
							{ PALETTE_TOKENS.slice( 0, 3 ).map( t => <i key={ t } style={ { '--c': colorVal( t ) } as React.CSSProperties } /> ) }
						</span>
						<b>{ activeTheme?.name ?? __( 'Custom', 'blicks' ) }</b>
						<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
					</button>
					<button type="button" className="lnk" disabled={ isSaving || ! isDirty } onClick={ onReset }>{ __( 'Reset defaults', 'blicks' ) }</button>
				</div>
			</div>

			<div className="ds">
				{ /* ── LEFT: category rail ── */ }
				<nav className="rail" aria-label={ __( 'Token groups', 'blicks' ) }>
					<div className="sticky">
						<div className="lbl">{ __( 'Token groups', 'blicks' ) }</div>
						{ NAV.map( n => (
							<button
								key={ n.id }
								type="button"
								className={ `navlink${ activeSec === n.id ? ' active' : '' }` }
								aria-current={ activeSec === n.id ? 'true' : undefined }
								onClick={ () => goSec( n.id ) }
							>
								{ n.label }
								{ sectionDirty( n.id ) && <span className="d" title={ __( 'Unsaved changes', 'blicks' ) } /> }
								{ n.count > 0 && <span className="c">{ n.count }</span> }
							</button>
						) ) }
						<div className="foot">
							<div className="eyebrow">{ __( 'Source', 'blicks' ) }</div>
							<p>
								{ snapshot.source.themeJson ? 'theme.json' : __( 'Fallback', 'blicks' ) }
								{ ` · ${ syncStatus.target }. ` }
								{ sprintf(
									/* translators: %d: number of tokens tracked. */
									_n( '%d token tracked.', '%d tokens tracked.', totalTokens, 'blicks' ),
									totalTokens
								) }
							</p>
						</div>
					</div>
				</nav>

				{ /* ── CENTRE: token groups ── */ }
				<div className="main">
					<div className="toolbar" ref={ toolbarRef }>
						<div className="tfilter">
							{ icon( <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></> ) }
							<input
								type="search"
								value={ filter }
								placeholder={ __( 'Filter tokens by name…', 'blicks' ) }
								aria-label={ __( 'Filter tokens by name', 'blicks' ) }
								onChange={ e => setFilter( e.currentTarget.value ) }
							/>
						</div>
						<span className="tcount">{ sprintf(
							/* translators: %d: number of tokens. */
							_n( '%d token', '%d tokens', totalTokens, 'blicks' ),
							totalTokens
						) }</span>
					</div>

					<Section ui={ sectionUi } id="themes" n={ themes.themes.length } title={ __( 'Themes', 'blicks' ) } desc={ __( 'Named token presets — apply one to repaint the set', 'blicks' ) } code="theme.*">
						<div className="themerail">
							{ themes.themes.map( theme => {
								const themeColor = ( slug: string ): string => theme.tokens.tokens.color?.[ slug ] || baseValues.color?.[ slug ] || COLOR_FALLBACKS[ slug ] || '#ffffff';
								const on = theme.id === themes.active;
								return (
									/* A card is not one control: applying, deleting and resetting a theme are
									   three actions, and they were three controls nested inside one <button>
									   — invalid, and unreachable in the order a keyboard reads them. */
									<div className={ `tcard${ on ? ' on' : '' }` } key={ theme.id }>
										<button
											type="button"
											className="tcard__apply"
											disabled={ isSaving }
											aria-pressed={ on }
											aria-label={ sprintf( /* translators: %s: theme name. */ __( 'Apply the %s theme', 'blicks' ), theme.name ) }
											onClick={ () => {
												// Applying saves immediately and adopts the returned snapshot, so
												// unsaved edits go with it and Discard cannot bring them back.
												if ( on ) return;
												if ( isDirty ) setConfirmApply( theme.id );
												else void onApplyTheme( theme.id );
											} }
										>
											<span className="tcard__sw">{ PALETTE_TOKENS.map( slug => <i key={ slug } style={ { '--c': themeColor( slug ) } as React.CSSProperties } /> ) }</span>
											<span className="tcard__ft">
												<span className="tcard__nm">
													{ theme.name }{ theme.edited && <span className="tcard__dot" title={ __( 'Customized', 'blicks' ) } /> }
													<small>{ theme.builtin ? __( 'preset', 'blicks' ) : __( 'custom', 'blicks' ) }</small>
												</span>
												<svg className="tcard__ck" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 12l5 5L20 6" /></svg>
											</span>
										</button>
										{ ! theme.builtin && ( confirmDel === theme.id ? (
											<span className="tcard__confirm">
												{ __( 'Delete?', 'blicks' ) }
												<button type="button" className="tcard__yes" title={ __( 'Confirm delete', 'blicks' ) } onClick={ () => { setConfirmDel( null ); void onDeleteTheme( theme.id ); } }>✓</button>
												<button type="button" className="tcard__no" title={ __( 'Cancel', 'blicks' ) } onClick={ () => setConfirmDel( null ) }>✕</button>
											</span>
										) : (
											<button type="button" className="tcard__del" title={ __( 'Delete theme', 'blicks' ) } aria-label={ sprintf( /* translators: %s: theme name. */ __( 'Delete the %s theme', 'blicks' ), theme.name ) } onClick={ () => setConfirmDel( theme.id ) }>✕</button>
										) ) }
										{ on && theme.edited && ( confirmReset === theme.id ? (
											<span className="tcard__confirm reset">
												{ __( 'Reset?', 'blicks' ) }
												<button type="button" className="tcard__yes" title={ __( 'Confirm reset', 'blicks' ) } onClick={ () => { setConfirmReset( null ); void onResetTheme( theme.id ); } }>✓</button>
												<button type="button" className="tcard__no" title={ __( 'Cancel', 'blicks' ) } onClick={ () => setConfirmReset( null ) }>✕</button>
											</span>
										) : (
											<button type="button" className="tcard__reset" title={ theme.builtin ? __( 'Reset to preset', 'blicks' ) : __( 'Reset overrides', 'blicks' ) } aria-label={ theme.builtin ? __( 'Reset this theme to its preset values', 'blicks' ) : __( 'Reset this theme\u2019s overrides', 'blicks' ) } onClick={ () => setConfirmReset( theme.id ) }>↺</button>
										) ) }
										{ confirmApply === theme.id && (
											/* Named, not just counted: "apply" reads as additive, and what it
											   actually does to work in progress is replace it. */
											<div className="tcard__ask">
												<p>{ sprintf(
													/* translators: %d: number of unsaved token edits. */
													_n( 'Replace %d unsaved edit?', 'Replace %d unsaved edits?', dirtyCount, 'blicks' ),
													dirtyCount
												) }</p>
												<div className="tcard__askact">
													<button type="button" className="btn primary sm" onClick={ () => { setConfirmApply( null ); void onApplyTheme( theme.id ); } }>{ __( 'Apply', 'blicks' ) }</button>
													<button type="button" className="btn sm" onClick={ () => setConfirmApply( null ) }>{ __( 'Keep editing', 'blicks' ) }</button>
												</div>
											</div>
										) }
									</div>
								);
							} ) }
							{ themeComposer === null ? (
								<button type="button" className="tcard new" disabled={ isSaving } onClick={ () => setThemeComposer( '' ) }>
									<b>+ { __( 'New theme', 'blicks' ) }</b>
									<span>{ __( 'Snapshot the current token values', 'blicks' ) }</span>
								</button>
							) : (
								<div
									className="tcard new"
									onKeyDown={ e => {
										if ( e.key === 'Enter' ) { e.preventDefault(); if ( themeComposer.trim() !== '' ) { onCreateTheme( themeComposer.trim() ); setThemeComposer( null ); } }
										else if ( e.key === 'Escape' ) { e.preventDefault(); setThemeComposer( null ); }
									} }
								>
									<input className="tcard__newin" autoFocus placeholder={ __( 'Name this theme', 'blicks' ) } aria-label={ __( 'Theme name', 'blicks' ) } value={ themeComposer } disabled={ isSaving } onChange={ e => setThemeComposer( e.currentTarget.value ) } />
									<div className="tcard__newact">
										<button type="button" className="btn primary sm" disabled={ themeComposer.trim() === '' || isSaving } onClick={ () => { onCreateTheme( themeComposer.trim() ); setThemeComposer( null ); } }>{ __( 'Add', 'blicks' ) }</button>
										<button type="button" className="tcard__newx" onClick={ () => setThemeComposer( null ) } aria-label={ __( 'Cancel', 'blicks' ) }>✕</button>
									</div>
								</div>
							) }
						</div>
					</Section>

					<Section ui={ sectionUi } id="color" n={ snapshot.tokens.color.length } title={ __( 'Color', 'blicks' ) } desc={ __( 'Surfaces, text, brand and status', 'blicks' ) } code="color.*" reset="color">
						{ ( () => {
							const tiles = COLOR_PAIRS.map( pairTile ).filter( Boolean );
							if ( tiles.length === 0 ) return null;
							return (
								<Fragment key="pairs">
									<div className="grp eyebrow">{ __( 'Pairs · a surface and its text', 'blicks' ) }</div>
									<div className="pgrid">{ tiles }</div>
								</Fragment>
							);
						} )() }
						{ COLOR_GROUPS.map( group => colorGroup( group.label, group.tokens.filter( t => coreColors.includes( t ) && ! paired.has( t ) ), group.strip ) ) }
						{ colorGroup( __( 'Other', 'blicks' ), ungrouped.filter( t => ! paired.has( t ) ) ) }
						{ colorGroup( __( 'Accent', 'blicks' ), accentColors ) }
						{ addTok( 'color' ) }
					</Section>

					<Section ui={ sectionUi } id="type" n={ snapshot.typeRoles.roles.length } title={ __( 'Typography', 'blicks' ) } desc={ __( 'Type scale, weight, and leading roles', 'blicks' ) } code="type.*" reset="fontFamily">
						<div className="tpv">
							<span className="eyebrow">{ __( 'Live preview · reflects the roles below', 'blicks' ) }</span>
							<div
								className="h"
								style={ {
									fontSize: roleVal( 'h2', 'fontSize' ) || undefined,
									fontFamily: roleVal( 'h2', 'fontFamily' ) || undefined,
									letterSpacing: roleVal( 'h2', 'letterSpacing' ) || undefined,
								} }
							>{ __( 'The atomic builder', 'blicks' ) }</div>
							<p
								style={ {
									fontSize: roleVal( 'body', 'fontSize' ) || undefined,
									lineHeight: roleVal( 'body', 'lineHeight' ) || undefined,
									fontFamily: roleVal( 'body', 'fontFamily' ) || undefined,
								} }
							>{ __( 'Compose pages, not markup. Every block reads from these type roles, so one edit here restyles the whole site.', 'blicks' ) }</p>
						</div>
						{ [ 'sans', 'mono' ].map( slug => {
							const val = tokVal( 'fontFamily', slug );
							if ( ! hit( slug, `--blicks-fontFamily-${ slug }` ) ) return null;
							return (
								<div className="trow" key={ slug }>
									<div className="tn"><b>{ slug === 'mono' ? __( 'Mono family', 'blicks' ) : __( 'Sans family', 'blicks' ) }</b><code>--blicks-fontFamily-{ slug }</code></div>
									<div className="ctl">
										<select className="txt" value={ familySlug( val ) } disabled={ isSaving } aria-label={ sprintf( __( '%s family', 'blicks' ), slug ) } onChange={ e => onTokenChange( 'fontFamily', slug, `var(--wp--preset--font-family--${ e.currentTarget.value })` ) }>
											{ familyOptions.map( o => <option key={ o.slug } value={ o.slug }>{ o.name }</option> ) }
											{ ! familyOptions.some( o => o.slug === familySlug( val ) ) && <option value={ familySlug( val ) }>{ familySlug( val ) }</option> }
										</select>
									</div>
									<div className="val" style={ { fontFamily: val || undefined } }>Aa</div>
								</div>
							);
						} ) }
						{ snapshot.typeRoles.roles.map( roleRow ) }
					</Section>

					<Section ui={ sectionUi } id="space" n={ snapshot.tokens.spacing.length } title={ __( 'Spacing', 'blicks' ) } desc={ __( 'The scale every block draws from', 'blicks' ) } code="space.*" reset="spacing">
						{ /* The ref sits on this wrapper, not on the rows: the note below appears and
						     disappears, and React rebuilds the node after it — an observer bound there
						     ends up watching a detached node that measures 0 for ever. */ }
						<div className="srows" ref={ spaceRowsRef }>
							{ spaceScale < 1 && (
								<div className="srow__note">{ sprintf(
									/* translators: %d: percentage the spacing bars are drawn at. */
									__( 'Bars drawn at %d%% — the largest step does not fit at true size here.', 'blicks' ),
									Math.round( spaceScale * 100 )
								) }</div>
							) }
							{ spaceSlugs.map( spaceRow ) }
						</div>
						{ addTok( 'spacing' ) }
					</Section>

					<Section ui={ sectionUi } id="radius" n={ snapshot.tokens.radius.length } title={ __( 'Radius', 'blicks' ) } desc={ __( 'Corner rounding · Blicks ships sharp', 'blicks' ) } code="radius.*" reset="radius">
						{ radiusSlugs.map( radiusRow ) }
						{ addTok( 'radius' ) }
					</Section>

					<Section ui={ sectionUi } id="shadow" n={ snapshot.tokens.shadow.length } title={ __( 'Shadow', 'blicks' ) } desc={ __( 'Elevation for popovers, drawers and drag states', 'blicks' ) } code="shadow.*" reset="shadow">
						{ slugsFor( 'shadow', snapshot.tokens.shadow ).map( shadowRow ) }
						{ addTok( 'shadow' ) }
					</Section>

					<Section ui={ sectionUi } id="gradient" n={ snapshot.tokens.gradient.length } title={ __( 'Gradient', 'blicks' ) } desc={ __( 'Low-contrast gradients for hero wells and accents', 'blicks' ) } code="gradient.*" reset="gradient">
						{ slugsFor( 'gradient', snapshot.tokens.gradient ).map( gradientRow ) }
						{ addTok( 'gradient' ) }
					</Section>

					<Section ui={ sectionUi } id="motion" n={ snapshot.tokens.transition.length + snapshot.tokens.transform.length + snapshot.tokens.filter.length } title={ __( 'Motion', 'blicks' ) } desc={ __( 'Transition, transform and filter values', 'blicks' ) } code="transition · transform · filter">
						{ slugsFor( 'transition', snapshot.tokens.transition ).map( t => transitionRow( t ) ) }
						{ slugsFor( 'transform', snapshot.tokens.transform ).map( t => previewRow( 'transform', t, v => <TransformDemo value={ v } /> ) ) }
						{ slugsFor( 'filter', snapshot.tokens.filter ).map( t => previewRow( 'filter', t, v => <FilterDemo value={ v } /> ) ) }
						{ addTok( 'transition' ) }
					</Section>

					<Section ui={ sectionUi } id="anim" n={ animations.library.length } title={ __( 'Animation', 'blicks' ) } desc={ __( 'The custom keyframe library', 'blicks' ) } code="@keyframes">
						<AnimationSection
							animations={ animations.animations }
							library={ animations.library }
							isLoading={ animations.isLoading }
							isSaving={ animations.isSaving }
							error={ animations.error }
							onSave={ animations.save }
							onDelete={ animations.remove }
							onDismissError={ animations.clearError }
						/>
					</Section>

					<Section ui={ sectionUi } id="z" n={ snapshot.tokens.zIndex.length } title={ __( 'Z-index', 'blicks' ) } desc={ __( 'Stacking order for layered UI', 'blicks' ) } code="z.*" reset="zIndex">
						{ ( () => {
							// Rank by value, but keep the rows where they were: the diagram is what
							// moves when a level changes, not the row under the cursor mid-edit.
							const slugs = slugsFor( 'zIndex', snapshot.tokens.zIndex );
							const order = slugs
								.map( t => ( { token: t, value: num( stripVars( tokVal( 'zIndex', t ) ) ) } ) )
								.sort( ( a, b ) => a.value - b.value );
							return slugs.map( t => zRow( t, order ) );
						} )() }
						{ addTok( 'zIndex' ) }
					</Section>

					<Section ui={ sectionUi } id="opacity" n={ snapshot.tokens.opacity.length } title={ __( 'Opacity', 'blicks' ) } desc={ __( 'Alpha steps for disabled, ghosted and scrim states', 'blicks' ) } code="opacity.*" reset="opacity">
						{ slugsFor( 'opacity', snapshot.tokens.opacity ).map( t => opacityRow( t ) ) }
						{ addTok( 'opacity' ) }
					</Section>

					<Section ui={ sectionUi } id="border" n={ snapshot.tokens.borderWidth.length + snapshot.tokens.borderStyle.length } title={ __( 'Border', 'blicks' ) } desc={ __( 'Hairline widths and edge styles', 'blicks' ) } code="border.*">
						{ slugsFor( 'borderWidth', snapshot.tokens.borderWidth ).map( t => previewRow( 'borderWidth', t, v => <WidthDemo value={ v } /> ) ) }
						{ slugsFor( 'borderStyle', snapshot.tokens.borderStyle ).map( t => borderStyleRow( t ) ) }
						{ addTok( 'borderWidth' ) }
					</Section>

					<Section ui={ sectionUi } id="ring" n={ snapshot.tokens.ring.length } title={ __( 'Focus ring', 'blicks' ) } desc={ __( 'Keyboard-focus outlines', 'blicks' ) } code="ring.*" reset="ring">
						{ slugsFor( 'ring', snapshot.tokens.ring ).map( t => ringRow( t ) ) }
						{ addTok( 'ring' ) }
					</Section>

					<Section ui={ sectionUi } id="sizing" n={ snapshot.tokens.width.length + snapshot.tokens.aspect.length } title={ __( 'Sizing', 'blicks' ) } desc={ __( 'Container widths and media ratios', 'blicks' ) } code="width · aspect">
						<div className="srows" ref={ widthRowsRef }>
							{ widthScale < 1 && (
								<p className="srow__note">{ sprintf(
									/* translators: %d: percentage the bars are drawn at. */
									__( 'Bars drawn at %d%% — the widest container does not fit here at full size.', 'blicks' ),
									Math.round( widthScale * 100 )
								) }</p>
							) }
							{ widthSlugs.map( t => widthRow( t ) ) }
						</div>
						{ slugsFor( 'aspect', snapshot.tokens.aspect ).map( t => previewRow( 'aspect', t, v => <AspectDemo value={ v } /> ) ) }
						{ addTok( 'width' ) }
					</Section>

					<Section ui={ sectionUi } id="leading" n={ snapshot.tokens.leading.length } title={ __( 'Line-height', 'blicks' ) } desc={ __( 'Leading ratios across the type scale', 'blicks' ) } code="leading.*" reset="leading">
						{ slugsFor( 'leading', snapshot.tokens.leading ).map( t => previewRow( 'leading', t, v => <LeadingDemo value={ v } /> ) ) }
						{ addTok( 'leading' ) }
					</Section>

					<Section ui={ sectionUi } id="bp" n={ snapshot.breakpoints.length } title={ __( 'Breakpoints', 'blicks' ) } desc={ __( 'Responsive layout thresholds', 'blicks' ) } code="custom.blicks.breakpoints">
						{ ( () => {
							// Each breakpoint's floor is the next one down's ceiling — a threshold on
							// its own says nothing, which is why the number alone never read as a range.
							const ceilings = snapshot.breakpoints
								.map( bp => breakpointDraft[ bp.id ] ?? bp.max )
								.filter( ( max ): max is number => max !== null )
								.sort( ( a, b ) => a - b );

							return snapshot.breakpoints.map( ( bp, index ) => {
								if ( ! hit( bp.id, bp.label ) ) return null;
								const max = breakpointDraft[ bp.id ] ?? bp.max;
								const below = ceilings.filter( ceiling => max === null || ceiling < max );
								const lower = below.length === 0 ? BP_MIN : below[ below.length - 1 ] + 1;
								// Declaration order is the intended ladder, widest first; a step that
								// does not go down from the one before it has swallowed it.
								const previous = snapshot.breakpoints[ index - 1 ];
								const previousMax = previous ? ( breakpointDraft[ previous.id ] ?? previous.max ) : null;
								const overlaps = max !== null && previousMax !== null && max >= previousMax;
								const active = viewportWidth >= lower && ( max === null || viewportWidth <= max );

								return (
									<div className="srow" key={ bp.id }>
										<div className="srow__n"><b>{ bp.label }</b><code>bp.{ bp.id }</code></div>
										<div className="srow__track bptrack">
											<BpBand lower={ lower } upper={ max } viewport={ viewportWidth } />
											<span className={ `srow__m${ overlaps ? ' bad' : '' }` }>
												{ overlaps && previous
													? sprintf( /* translators: %s: the wider breakpoint's name. */ __( 'overlaps %s', 'blicks' ), previous.label )
													: [
														max === null
															? sprintf( /* translators: %d: pixel width. */ __( '%dpx and up', 'blicks' ), lower )
															: ( lower === BP_MIN
																? sprintf( /* translators: %d: pixel width. */ __( 'up to %dpx', 'blicks' ), max )
																: sprintf( /* translators: 1: lower bound, 2: upper bound, both px. */ __( '%1$d–%2$dpx', 'blicks' ), lower, max ) ),
														active ? __( 'now', 'blicks' ) : '',
													].filter( part => part !== '' ).join( ' · ' ) }
											</span>
										</div>
										<div className="ctl">
											<span className="rstslot">
												{ bpModified( bp.id ) && ! isSaving && (
													<FieldReset onRevert={ () => onBreakpointReset( bp.id ) } />
												) }
											</span>
											{ max === null ? (
												/* The widest step has no ceiling to edit: it is whatever is left. */
												<span className="fixedv" title={ __( 'The widest step: everything above the one below it.', 'blicks' ) }>
													{ __( 'base', 'blicks' ) }
												</span>
											) : (
												<ValidatedInput
													className="txt"
													type="text"
													value={ String( max ) }
													disabled={ isSaving }
													externalReset
													aria-label={ sprintf( /* translators: %s: breakpoint name. */ __( '%s breakpoint value', 'blicks' ), bp.label ) }
													modified={ bpModified( bp.id ) }
													validate={ v => { const n = Number.parseInt( v, 10 ); return /^\d+$/.test( v ) && n >= BP_MIN && n <= BP_MAX; } }
													onCommit={ v => onBreakpointChange( bp, v ) }
													onRevert={ () => onBreakpointReset( bp.id ) }
												/>
											) }
										</div>
									</div>
								);
							} );
						} )() }
					</Section>

					<Section ui={ sectionUi } id="out" n={ 0 } title={ __( 'theme.json output', 'blicks' ) } desc={ __( 'Where these tokens come from, and where the next save goes', 'blicks' ) } code="output">
						{ /* Two rows that disagreed with each other: "Write target" carried the *source*
						     in its value (`theme.json`) beside the *destination* in its code chip
						     (`Blicks option`). They are two halves of a pipeline, so they read as one. */ }
						<div className="flow">
							<div className="flow__step">
								<span className="flow__k">{ __( 'Read from', 'blicks' ) }</span>
								<b>{ syncStatus.readValue }</b>
								<span className="flow__note">{ syncStatus.readText }</span>
							</div>
							<svg className="flow__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" /></svg>
							<div className="flow__step">
								<span className="flow__k">{ __( 'Edited in', 'blicks' ) }</span>
								<b>{ __( 'Blicks', 'blicks' ) }</b>
								<span className="flow__note">{ isDirty
									? sprintf(
										/* translators: %d: number of unsaved changes. */
										_n( '%d change not saved yet', '%d changes not saved yet', dirtyCount, 'blicks' ),
										dirtyCount
									)
									: __( 'Nothing pending', 'blicks' ) }</span>
							</div>
							<svg className="flow__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" /></svg>
							<div className={ `flow__step${ syncStatus.warn ? ' warn' : '' }` }>
								<span className="flow__k">{ __( 'Saved to', 'blicks' ) }</span>
								<b>{ syncStatus.target }</b>
								<span className="flow__note">{ syncStatus.nextSaveText }</span>
							</div>
						</div>
						<p className="flow__body">{ syncStatus.body }</p>
						{ /* A stated fact, not a control: the row holds the label and the value, and
						     skips the control column instead of leaving an empty one behind. */ }
						<div className="trow trow--stated">
							<div className="tn"><b>{ __( 'Global Styles sync', 'blicks' ) }</b><code>{ __( 'Managed in Settings', 'blicks' ) }</code></div>
							<div className="val">{ snapshot.source.globalStyles ? __( 'On', 'blicks' ) : __( 'Off', 'blicks' ) }</div>
						</div>
					</Section>
				</div>

				{ /* ── RIGHT: live preview + output ── */ }
				<aside className="prev" aria-label={ __( 'Live preview', 'blicks' ) }>
					<div className="sticky">
						<span className="eyebrow">{ __( 'Live preview', 'blicks' ) }</span>
						<div className="pv-card" style={ { borderColor: colorVal( 'border' ) } }>
							<div className="kick">{ __( 'Section · live', 'blicks' ) }</div>
							<h2 style={ { color: colorVal( 'foreground' ) } }>
								{ __( 'The atomic builder.', 'blicks' ) }{ ' ' }
								<span style={ { color: colorVal( 'primary' ) } }>{ __( 'Clean code.', 'blicks' ) }</span>
							</h2>
							<p style={ { color: colorVal( 'muted-foreground' ) } }>{ __( 'Edit a token on the left — this preview repaints with the new value.', 'blicks' ) }</p>
							<div className="row">
								<span className="pv-btn p" style={ { background: colorVal( 'primary' ), color: colorVal( 'primary-foreground' ) } }>{ __( 'Create page', 'blicks' ) }</span>
								<span className="pv-btn s">{ __( 'Preview', 'blicks' ) }</span>
							</div>
							<div className="pv-swatches">
								{ tiles.map( ( c, i ) => <i key={ i } style={ { '--c': c } as React.CSSProperties } /> ) }
							</div>
						</div>

						<div className="out">
							<span className="k">{ isDirty ? __( 'Pending output', 'blicks' ) : __( 'Generated output', 'blicks' ) }</span>
							<pre>{ outputLines.map( ( line, i ) => (
								<Fragment key={ line.prop }>
									<span className="p">{ line.prop }</span>: <span className="v">{ line.value }</span>;
									{ i < outputLines.length - 1 && '\n' }
								</Fragment>
							) ) }</pre>
						</div>

						{ isDirty && (
							<div className="dirty">
								<span className="d" />
								{ sprintf(
									/* translators: %d: number of changed tokens. */
									_n( '%d token changed · unsaved', '%d tokens changed · unsaved', dirtyCount, 'blicks' ),
									dirtyCount
								) }
							</div>
						) }

						<div className="save">
							<button className="btn" type="button" disabled={ isSaving || ! isDirty } onClick={ onReset }>{ __( 'Discard', 'blicks' ) }</button>
							<button className="btn primary" type="button" disabled={ isSaving || ! isDirty } onClick={ () => void onSave() }>
								{ isSaving ? __( 'Saving…', 'blicks' ) : __( 'Save changes', 'blicks' ) }
							</button>
						</div>
					</div>
				</aside>
			</div>
		</>
	);
}
