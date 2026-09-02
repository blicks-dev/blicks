import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';
import { getValue, setValue } from '@/framework/values';
import { MoreSettings, NoMatches, ResetButton, makeMatcher } from '@/controls/common';
import { IconField, IconValueField, type IconChoice } from '@/controls/IconValueField';
import { ValueField } from '@/controls/ValueField';
import './animation.scss';

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
	isAllowed?: ( controlId: string ) => boolean;
	/** Property-search query from the Inspector. Absent/empty → every section renders. */
	query?: string;
}

interface KeyframeDef {
	name: string;
	label: string;
	description?: string;
	defaults?: {
		duration?: string;
		easing?: string;
		iteration?: string;
		direction?: string;
		fillMode?: string;
	};
	custom?: boolean;
}

/**
 * The animation library, injected by BlockServiceProvider — predefined animations (declared in
 * runtime.scss) plus whatever the user defined in Blicks → Design System → Animation. This
 * control holds **no** list of its own: the design system is the single source of truth, so a
 * new animation shows up here without a code change.
 */
function animationLibrary(): KeyframeDef[] {
	const settings = ( window as unknown as { blicksEditorSettings?: { animations?: unknown } } ).blicksEditorSettings;
	const list = Array.isArray( settings?.animations ) ? settings.animations : [];

	return list.flatMap( ( entry: any ): KeyframeDef[] => {
		const name = typeof entry?.name === 'string' ? entry.name : '';
		if ( ! name ) return [];

		return [ {
			name,
			label: typeof entry.label === 'string' && entry.label ? entry.label : name,
			description: typeof entry.description === 'string' ? entry.description : '',
			defaults: entry.defaults && typeof entry.defaults === 'object' ? entry.defaults : undefined,
			custom: ! entry.builtin,
		} ];
	} );
}

const choice = ( value: string, title: string, icon: JSX.Element ): IconChoice => ( { value, title, icon } );
const opts = ( values: string[] ) => values.map( ( value ) => ( { value, label: value } ) );

const curve = ( d: string ) => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
		<path d={ d } />
	</svg>
);

/**
 * The four easings that describe a *shape* get an icon — the curve itself is the clearest label a
 * timing function can have. `ease` and the cubic-beziers live in the dropdown; they are values you
 * pick by name, not by eye.
 */
const EASING_CHOICES: IconChoice[] = [
	choice( 'linear', 'Linear', curve( 'M4 20 20 4' ) ),
	choice( 'ease-in', 'Ease in', curve( 'M4 20C12 20 18 14 20 4' ) ),
	choice( 'ease-out', 'Ease out', curve( 'M4 20C6 10 12 4 20 4' ) ),
	choice( 'ease-in-out', 'Ease in-out', curve( 'M4 20C10 20 14 4 20 4' ) ),
];
const EASING_OPTIONS = opts( [
	'linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
	'cubic-bezier(0, 0, 0.2, 1)', 'cubic-bezier(0.16, 1, 0.3, 1)', 'cubic-bezier(0.4, 0, 0.2, 1)',
] );

/** `animation-fill-mode` is exactly these four and will never be a fifth — icons, no field. */
const FILL_CHOICES: IconChoice[] = [
	choice( 'none', 'None',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="4" y1="12" x2="20" y2="12" strokeDasharray="3 3" />
		</svg> ),
	choice( 'forwards', 'Forwards',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="4" y1="12" x2="18" y2="12" strokeDasharray="3 3" /><line x1="20" y1="5" x2="20" y2="19" strokeWidth="3" />
		</svg> ),
	choice( 'backwards', 'Backwards',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="4" y1="5" x2="4" y2="19" strokeWidth="3" /><line x1="6" y1="12" x2="20" y2="12" strokeDasharray="3 3" />
		</svg> ),
	choice( 'both', 'Both',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
			<line x1="4" y1="5" x2="4" y2="19" strokeWidth="3" /><line x1="6" y1="12" x2="18" y2="12" strokeDasharray="3 3" /><line x1="20" y1="5" x2="20" y2="19" strokeWidth="3" />
		</svg> ),
];

/** Same for `animation-direction`. */
const DIRECTION_CHOICES: IconChoice[] = [
	choice( 'normal', 'Normal',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<line x1="4" y1="12" x2="19" y2="12" /><polyline points="14 7 19 12 14 17" />
		</svg> ),
	choice( 'reverse', 'Reverse',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<line x1="20" y1="12" x2="5" y2="12" /><polyline points="10 7 5 12 10 17" />
		</svg> ),
	choice( 'alternate', 'Alternate',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M4 9h16m-4-4 4 4-4 4" /><path d="M20 17H4m4-4-4 4 4 4" />
		</svg> ),
	choice( 'alternate-reverse', 'Alternate reverse',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M20 9H4m4-4-4 4 4 4" /><path d="M4 17h16m-4-4 4 4-4 4" />
		</svg> ),
];

/** `scroll()` and `view()` are the whole set the engine understands; empty means "time-driven". */
const TIMELINE_CHOICES: IconChoice[] = [
	choice( 'scroll()', 'Scroll timeline — driven by the scroll position',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<rect x="8" y="3" width="8" height="18" rx="4" /><line x1="12" y1="7" x2="12" y2="11" />
		</svg> ),
	choice( 'view()', 'View timeline — driven by the block entering the viewport',
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.5" />
		</svg> ),
];

const DURATION_OPTIONS = opts( [ '150ms', '300ms', '600ms', '900ms', '1s', '2s' ] );
const DELAY_OPTIONS = opts( [ '0s', '100ms', '300ms', '600ms', '1s' ] );
const ITERATION_OPTIONS = opts( [ '1', '2', '3', 'infinite' ] );
// A count, not a time: `600ms` here emits an `animation-iteration-count` the browser throws away,
// leaving an animation that silently runs once.
const ITERATION_PATTERN = /^(infinite|\d+(\.\d+)?)$/;
const RANGE_OPTIONS = [
	{ value: 'entry 0% entry 100%', label: 'On entry' },
	{ value: 'entry 0% entry 60%', label: 'Early entry' },
	{ value: 'cover 0% cover 100%', label: 'Whole pass' },
	{ value: 'exit 0% exit 100%', label: 'On exit' },
];

/**
 * Per-section search keywords, re-exported flat for the Inspector's rail filter so the two can
 * never disagree. See `LAYOUT_KEYWORDS` for the rationale.
 */
const K = {
	preset: [ 'motion', 'animation', 'animate', 'keyframe', 'preset', 'reveal', 'fade', 'slide' ],
	timing: [ 'duration', 'delay', 'easing', 'ease', 'linear', 'cubic', 'bezier', 'speed', 'fill', 'mode', 'forwards', 'backwards' ],
	loop: [ 'iteration', 'iterations', 'loop', 'repeat', 'infinite', 'direction', 'reverse', 'alternate' ],
	timeline: [ 'timeline', 'scroll', 'view', 'range', 'entry', 'exit', 'cover', 'target' ],
};

export const MOTION_KEYWORDS: string[] = [ ...new Set( Object.values( K ).flat() ) ];

/**
 * Motion — which animation plays, how long it takes, and what drives it.
 *
 * The preset grid stays a grid: it is a *library*, not an enum, and its contents come from the
 * design system rather than from this file. Everything below it is a property with a known value
 * set, so it takes the shared field shapes — curves for easing, arrows for direction, a marked
 * timeline for fill mode.
 */
export function AnimationControl( { attributes, setAttributes, state, breakpoint, isAllowed, query }: Props ) {
	const can = ( controlId: string ) => ! isAllowed || isAllowed( controlId );
	const m = makeMatcher( query );
	const searching = Boolean( query && query.trim() );
	const anyMatch = Object.values( K ).some( ( keywords ) => m( keywords ) );

	const KEYFRAMES = useMemo( animationLibrary, [] );
	const name      = String( getValue( attributes, 'animation.name',      state, breakpoint ) || '' );
	const duration  = String( getValue( attributes, 'animation.duration',  state, breakpoint ) || '' );
	const easing    = String( getValue( attributes, 'animation.easing',    state, breakpoint ) || '' );
	const iteration = String( getValue( attributes, 'animation.iteration', state, breakpoint ) || '' );
	const direction = String( getValue( attributes, 'animation.direction', state, breakpoint ) || '' );
	const fillMode  = String( getValue( attributes, 'animation.fillMode',  state, breakpoint ) || '' );
	const delay     = String( getValue( attributes, 'animation.delay',     state, breakpoint ) || '' );
	const timeline  = String( getValue( attributes, 'animation.timeline',  state, breakpoint ) || '' );
	const range     = String( getValue( attributes, 'animation.range',     state, breakpoint ) || '' );
	const target    = String( getValue( attributes, 'animation.target',    state, breakpoint ) || '' );

	const set = ( id: string ) => ( val: string ) =>
		setValue( attributes, setAttributes, id, state, breakpoint, val || undefined );

	const choosePreset = ( presetName: string ) => {
		const blicks = { ...( attributes.blicks ?? {} ) };
		const apply = ( controlId: string, value: any ) => {
			const slot = { ...( blicks[ controlId ] ?? {} ) };
			const stSlot = { ...( slot[ state ] ?? {} ) };
			if ( value === '' || value === undefined ) {
				delete stSlot[ breakpoint ];
			} else {
				stSlot[ breakpoint ] = value;
			}
			if ( Object.keys( stSlot ).length ) slot[ state ] = stSlot; else delete slot[ state ];
			if ( Object.keys( slot ).length )    blicks[ controlId ] = slot;
			else                                  delete blicks[ controlId ];
		};
		apply( 'animation.name', presetName );
		const def = KEYFRAMES.find( ( k ) => k.name === presetName )?.defaults;
		if ( def ) {
			if ( def.duration )  apply( 'animation.duration',  def.duration );
			if ( def.easing )    apply( 'animation.easing',    def.easing );
			if ( def.iteration ) apply( 'animation.iteration', def.iteration );
			if ( def.direction ) apply( 'animation.direction', def.direction );
			if ( def.fillMode )  apply( 'animation.fillMode',  def.fillMode );
		}
		setAttributes( { blicks } );
	};

	const clearAll = () => {
		const blicks = { ...( attributes.blicks ?? {} ) };
		for ( const id of [ 'animation.name', 'animation.duration', 'animation.easing', 'animation.iteration', 'animation.direction', 'animation.fillMode', 'animation.delay', 'animation.timeline', 'animation.range', 'animation.target', 'animation.targetAngle' ] ) {
			delete blicks[ id ];
		}
		setAttributes( { blicks } );
	};

	const loopCount = [ iteration, direction ].filter( Boolean ).length;
	const timelineCount = [ timeline, range, target ].filter( Boolean ).length;

	return (
		<div className="bl-animation">
			{ ! anyMatch && <NoMatches query={ query ?? '' } /> }

			{ can( 'animation.name' ) && m( K.preset ) && (
			<div className="bl-anim-group">
				<div className="bl-spacing-head">
					<span>{ __( 'Preset', 'blicks' ) }</span>
					{ name && <span className="bl-mod-dot" aria-hidden="true" /> }
					<div className="bl-spacing-actions">
						{ /* Resets the whole facet, not just the name: a preset writes five properties,
						     so clearing only the name would leave its timing behind with nothing playing. */ }
						<ResetButton idle={ ! name } onClick={ clearAll } />
					</div>
				</div>
				<div className="bl-anim-presets">
					{ KEYFRAMES.length === 0 && (
						<p className="bl-anim-presets__empty">{ __( 'No animations available. Add one in Blicks → Design System → Animation.', 'blicks' ) }</p>
					) }
					{ KEYFRAMES.map( ( kf ) => (
						<button
							key={ kf.name }
							type="button"
							title={ kf.description || kf.label }
							aria-pressed={ name === kf.name }
							className={ `bl-anim-presets__item${ name === kf.name ? ' is-active' : '' }${ kf.custom ? ' is-custom' : '' }` }
							onClick={ () => choosePreset( kf.name ) }
						>
							{ kf.label }
						</button>
					) ) }
				</div>
			</div>
			) }

			{ m( K.timing ) && (
			<div className="bl-anim-group">
				<div className="bl-spacing-head">
					<span>{ __( 'Timing', 'blicks' ) }</span>
					{ ( duration || delay || easing || fillMode ) && <span className="bl-mod-dot" aria-hidden="true" /> }
				</div>

				{ ( can( 'animation.duration' ) || can( 'animation.delay' ) ) && (
				<div className="bl-fields bl-fields--2">
					{ can( 'animation.duration' ) && (
					<ValueField
						affix={ <span className="bl-valuefield__cap" title={ __( 'How long one run takes', 'blicks' ) }>DUR</span> }
						listLabel="DURATIONS"
						value={ duration }
						options={ DURATION_OPTIONS }
						placeholder="600ms"
						modified={ Boolean( duration ) }
						onChange={ set( 'animation.duration' ) }
					/>
					) }
					{ can( 'animation.delay' ) && (
					<ValueField
						affix={ <span className="bl-valuefield__cap" title={ __( 'Wait before it starts', 'blicks' ) }>WAIT</span> }
						listLabel="DELAYS"
						value={ delay }
						options={ DELAY_OPTIONS }
						placeholder="0s"
						modified={ Boolean( delay ) }
						onChange={ set( 'animation.delay' ) }
					/>
					) }
				</div>
				) }

				<div className="bl-fields">
					{ can( 'animation.easing' ) && (
					<IconValueField
						label="EASE"
						hint={ __( 'Easing — the shape of the motion over time', 'blicks' ) }
						value={ easing }
						choices={ EASING_CHOICES }
						options={ EASING_OPTIONS }
						placeholder="ease"
						listLabel="EASINGS"
						onChange={ set( 'animation.easing' ) }
					/>
					) }
					{ can( 'animation.fillMode' ) && (
					<IconField
						label="FILL"
						hint={ __( 'Fill mode — whether the first and last frames hold', 'blicks' ) }
						value={ fillMode }
						choices={ FILL_CHOICES }
						onChange={ set( 'animation.fillMode' ) }
						onReset={ () => set( 'animation.fillMode' )( '' ) }
					/>
					) }
				</div>
			</div>
			) }

			{ ( can( 'animation.iteration' ) || can( 'animation.direction' ) ) && m( K.loop ) && (
			<div className="bl-anim-group">
				<MoreSettings
					label="Repeat"
					badge={ loopCount }
					defaultOpen={ loopCount > 0 }
					forceOpen={ searching }
				>
					<div className="bl-fields">
						{ can( 'animation.iteration' ) && (
						<ValueField
							affix={ <span className="bl-valuefield__cap" title={ __( 'How many times it runs', 'blicks' ) }>LOOP</span> }
							listLabel="ITERATIONS"
							value={ iteration }
							options={ ITERATION_OPTIONS }
							placeholder="1"
							modified={ Boolean( iteration ) }
							pattern={ ITERATION_PATTERN }
							onChange={ set( 'animation.iteration' ) }
						/>
						) }
						{ can( 'animation.direction' ) && (
						<IconField
							label="DIR"
							hint={ __( 'Direction — which way each run plays', 'blicks' ) }
							value={ direction }
							choices={ DIRECTION_CHOICES }
							onChange={ set( 'animation.direction' ) }
							onReset={ () => set( 'animation.direction' )( '' ) }
						/>
						) }
					</div>
				</MoreSettings>
			</div>
			) }

			{ can( 'animation.timeline' ) && m( K.timeline ) && (
			<div className="bl-anim-group">
				<MoreSettings
					label="Timeline"
					badge={ timelineCount }
					defaultOpen={ timelineCount > 0 }
					forceOpen={ searching }
				>
					<div className="bl-fields">
						<IconField
							label="DRIVE"
							hint={ __( 'What advances the animation — time, the scroll position, or the viewport', 'blicks' ) }
							value={ timeline }
							choices={ TIMELINE_CHOICES }
							onChange={ set( 'animation.timeline' ) }
							onReset={ () => set( 'animation.timeline' )( '' ) }
						/>
						{ /* Range only means something against a timeline; on a time-driven animation it
						     would be a field that changes nothing. */ }
						{ timeline && can( 'animation.range' ) && (
						<ValueField
							affix={ <span className="bl-valuefield__cap" title={ __( 'Which part of the timeline the animation covers', 'blicks' ) }>RANGE</span> }
							listLabel="RANGES"
							value={ range }
							options={ RANGE_OPTIONS }
							placeholder="entry 0% entry 60%"
							modified={ Boolean( range ) }
							onChange={ set( 'animation.range' ) }
						/>
						) }
						{ /* The fill animation drives a custom property the others do not have. */ }
						{ name === 'bl-fill' && can( 'animation.target' ) && (
						<ValueField
							affix={ <span className="bl-valuefield__cap" title={ __( 'Target value for --bl-p-target', 'blicks' ) }>TARGET</span> }
							value={ target }
							options={ [] }
							placeholder="1"
							modified={ Boolean( target ) }
							onChange={ set( 'animation.target' ) }
						/>
						) }
					</div>
				</MoreSettings>
			</div>
			) }
		</div>
	);
}
