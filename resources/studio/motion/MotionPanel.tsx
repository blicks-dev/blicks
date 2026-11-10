/**
 * The Motion tab: give the selected block an animation, and make new ones.
 *
 * Three views, one at a time — the list, a record's keyframes, the starters. A sub-view replaces
 * the list rather than stacking under it, and backs out with an arrow.
 *
 * What it writes, and where:
 *
 * - **The block's animation** is ordinary `animation.*` controls on its tree (`motion-tree.ts`),
 *   through the mounted store, so it is part of the Studio's history like any inspector edit.
 *   Sliders write when they are let go, never per frame: a drag is one undo step.
 * - **Keyframes** go to the session (`session.ts`), not the tree and not the site. They are drafts
 *   until Insert or Save as pattern, and preview live while they are drafts.
 */
import { useMemo, useRef, useState } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { getBlockType } from '@wordpress/blocks';
import { __, _n, sprintf } from '@wordpress/i18n';
import type { BlockNode } from '../mount';
import {
	REST_POSE,
	countUses,
	freeSlug,
	keyframesCss,
	nameOf,
	readPose,
	slugOf,
	splitAfter,
	writePose,
	type Arrival,
	type Keyframes,
	type Pose,
} from './keyframes';
import { animationSupport, readMotion, toMs, writeMotion, type Motion, type Plays } from './motion-tree';
import * as session from './session';
import { starters } from './starters';

type View = { kind: 'list' } | { kind: 'edit'; slug: string } | { kind: 'starters' };

interface Props {
	blocks: BlockNode[];
	applyBurst: ( run: () => void ) => void;
}

interface Selected {
	clientId: string;
	name: string;
	tree: Record< string, Record< string, Record< string, unknown > > >;
}

export function MotionPanel( { blocks, applyBurst }: Props ): JSX.Element {
	session.useMotionSession();
	const [ view, setView ] = useState< View >( { kind: 'list' } );

	const selected = useSelect( ( select: ( store: unknown ) => unknown ) => {
		const store = select( blockEditorStore ) as {
			getSelectedBlockClientId: () => string | null;
			getBlock: ( id: string ) => { name: string; attributes: Record< string, unknown > } | null;
		};
		const id = store.getSelectedBlockClientId();
		const block = id ? store.getBlock( id ) : null;

		return block && id ? { clientId: id, name: block.name, tree: ( block.attributes.blicks ?? {} ) as Selected[ 'tree' ] } : null;
	}, [] ) as Selected | null;

	const { updateBlockAttributes } = useDispatch( blockEditorStore ) as unknown as {
		updateBlockAttributes: ( id: string, attributes: Record< string, unknown > ) => void;
	};

	const setMotion = ( motion: Motion | null ): void => {
		if ( selected ) {
			applyBurst( () => updateBlockAttributes( selected.clientId, { blicks: writeMotion( selected.tree, motion ) } ) );
		}
	};

	/** Write a whole new tree back, block by block — only the blocks whose attributes changed. */
	const writeTree = ( next: BlockNode[] ): void => {
		const walk = ( before: BlockNode[], after: BlockNode[] ): void =>
			after.forEach( ( node, i ) => {
				if ( node.clientId && node.attributes !== before[ i ]?.attributes ) {
					updateBlockAttributes( node.clientId, node.attributes ?? {} );
				}
				walk( before[ i ]?.innerBlocks ?? [], node.innerBlocks ?? [] );
			} );

		applyBurst( () => walk( blocks, next ) );
	};

	if ( view.kind === 'starters' ) {
		return (
			<StartersView
				onBack={ () => setView( { kind: 'list' } ) }
				onUse={ ( record ) => {
					session.put( record );
					if ( selected ) {
						setMotion( motionFor( nameOf( record.slug ), record.defaults, readMotion( selected.tree ) ) );
					}
					setView( { kind: 'edit', slug: record.slug } );
				} }
			/>
		);
	}

	if ( view.kind === 'edit' ) {
		const record = session.known().find( ( k ) => k.slug === view.slug );

		if ( record ) {
			return <KeyframeEditor record={ record } uses={ countUses( blocks, record.slug ) } onBack={ () => setView( { kind: 'list' } ) } />;
		}
	}

	return (
		<div className="bl-motion">
			<Arrivals onUseMine={ ( arrival ) => writeTree( session.useMine( blocks, arrival ) ) } />
			{ selected ? (
				<BlockMotion
					selected={ selected }
					blocks={ blocks }
					onChange={ setMotion }
					onEdit={ ( slug ) => setView( { kind: 'edit', slug } ) }
					onNew={ () => setView( { kind: 'starters' } ) }
				/>
			) : (
				<p className="bl-motion__empty">{ __( 'Select a block on the canvas to animate it.', 'blicks' ) }</p>
			) }
			<Pending />
		</div>
	);
}

/** A motion for a newly picked animation, keeping how and when the block already plays. */
function motionFor( name: string, defaults: Record< string, string > | undefined, was: Motion | null ): Motion {
	return {
		name,
		plays: was?.plays ?? 'always',
		duration: toMs( defaults?.duration ?? '', was?.duration ?? 1000 ),
		delay: was?.delay ?? 0,
		loop: defaults?.iteration ? defaults.iteration === 'infinite' : was?.loop ?? true,
		easing: defaults?.easing || was?.easing || 'ease-in-out',
	};
}

/* ------------------------------------------------------------------ the list */

function BlockMotion( {
	selected,
	blocks,
	onChange,
	onEdit,
	onNew,
}: {
	selected: Selected;
	blocks: BlockNode[];
	onChange: ( motion: Motion | null ) => void;
	onEdit: ( slug: string ) => void;
	onNew: () => void;
} ): JSX.Element {
	const type = getBlockType( selected.name ) as { title?: string; supports?: { blicks?: unknown } } | undefined;
	const support = animationSupport( type?.supports?.blicks );
	const motion = readMotion( selected.tree );
	const { canEdit } = session.settings();
	const custom = session.known();
	const slug = motion ? slugOf( motion.name ) : null;
	const record = slug ? custom.find( ( k ) => k.slug === slug ) : undefined;

	const head = (
		<div className="bl-motion__head">
			<span className="bl-motion__title">{ type?.title ?? selected.name }</span>
		</div>
	);

	if ( ! support.animate ) {
		return (
			<>
				{ head }
				<p className="bl-motion__empty">{ __( 'This block cannot carry an animation.', 'blicks' ) }</p>
			</>
		);
	}

	const tiles = [
		{ key: 'none', name: '', label: __( 'None', 'blicks' ), draft: false, defaults: undefined },
		...session.builtins().map( ( a ) => ( { key: a.name, name: a.name, label: a.label, draft: false, defaults: a.defaults } ) ),
		...custom.map( ( k ) => ( { key: nameOf( k.slug ), name: nameOf( k.slug ), label: k.label, draft: session.isDraft( k.slug ), defaults: k.defaults } ) ),
	];

	const set = ( patch: Partial< Motion > ): void => {
		if ( motion ) {
			onChange( { ...motion, ...patch } );
		}
	};

	return (
		<>
			{ head }

			<section className="bl-motion__sec">
				<h3 className="bl-motion__label">{ __( 'Animation', 'blicks' ) }</h3>
				<div className="bl-motion__tiles">
					{ tiles.map( ( tile ) => {
						const on = ( motion?.name ?? '' ) === tile.name;

						return (
							<button
								key={ tile.key }
								type="button"
								className={ on ? 'bl-motion__tile bl-motion__tile--on' : 'bl-motion__tile' }
								aria-pressed={ on }
								onClick={ () => onChange( tile.name ? motionFor( tile.name, tile.defaults, motion ) : null ) }
							>
								<span className="bl-motion__pv" style={ tile.name ? { animation: `${ tile.name } 1.6s ease-in-out infinite both` } : undefined } />
								<span className="bl-motion__tilename">{ tile.label }</span>
								{ tile.draft && <span className="bl-motion__dot" title={ __( 'Not saved yet', 'blicks' ) } /> }
							</button>
						);
					} ) }
					{ canEdit && (
						<button type="button" className="bl-motion__tile bl-motion__tile--new" onClick={ onNew }>
							<span className="bl-motion__plus" aria-hidden="true">+</span>
							<span className="bl-motion__tilename">{ __( 'New', 'blicks' ) }</span>
						</button>
					) }
				</div>
			</section>

			{ motion && (
				<>
					<section className="bl-motion__sec">
						<h3 className="bl-motion__label">{ __( 'Plays', 'blicks' ) }</h3>
						<div className="bl-motion__seg" role="group" aria-label={ __( 'Plays', 'blicks' ) }>
							{ ( [
								[ 'always', __( 'Always', 'blicks' ) ],
								[ 'view', __( 'In view', 'blicks' ) ],
								[ 'hover', __( 'On hover', 'blicks' ) ],
							] as Array< [ Plays, string ] > ).map( ( [ id, label ] ) => (
								<button
									key={ id }
									type="button"
									className={ motion.plays === id ? 'bl-motion__segbtn bl-motion__segbtn--on' : 'bl-motion__segbtn' }
									aria-pressed={ motion.plays === id }
									disabled={ id === 'hover' && ! support.hover }
									onClick={ () => set( { plays: id } ) }
								>
									{ label }
								</button>
							) ) }
						</div>
					</section>

					<section className="bl-motion__group">
						<Slider label={ __( 'Length', 'blicks' ) } min={ 100 } max={ 8000 } step={ 100 } value={ motion.duration } format={ seconds } onCommit={ ( duration ) => set( { duration } ) } />
						<Slider label={ __( 'Wait first', 'blicks' ) } min={ 0 } max={ 4000 } step={ 100 } value={ motion.delay } format={ seconds } onCommit={ ( delay ) => set( { delay } ) } />
						{ motion.plays !== 'view' && (
							<label className="bl-motion__switch">
								<span>{ __( 'Keep repeating', 'blicks' ) }</span>
								<input type="checkbox" checked={ motion.loop } onChange={ () => set( { loop: ! motion.loop } ) } />
							</label>
						) }
					</section>

					{ record && canEdit && (
						<button type="button" className="bl-motion__row" onClick={ () => onEdit( record.slug ) }>
							<span>{ __( 'Edit keyframes', 'blicks' ) }</span>
							<span className="bl-motion__rowmeta">
								{ sprintf(
									/* translators: %d: how many blocks in the Studio use this animation */
									_n( 'Used on %d block here', 'Used on %d blocks here', countUses( blocks, record.slug ), 'blicks' ),
									countUses( blocks, record.slug )
								) }
							</span>
						</button>
					) }
				</>
			) }
		</>
	);
}

const seconds = ( ms: number ): string => `${ ( ms / 1000 ).toFixed( 1 ) } s`;

/**
 * A range that writes when it is let go. Moving it updates only its own readout, so a drag across
 * the track is one history step rather than one per pixel.
 */
function Slider( {
	label,
	min,
	max,
	step,
	value,
	format,
	onCommit,
	onLive,
}: {
	label: string;
	min: number;
	max: number;
	step: number;
	value: number;
	format: ( v: number ) => string;
	onCommit?: ( v: number ) => void;
	/** Called on every movement instead — for values that are not history (a draft's keyframes). */
	onLive?: ( v: number ) => void;
} ): JSX.Element {
	const [ local, setLocal ] = useState< number | null >( null );
	const shown = local ?? value;
	const pending = useRef< number | null >( null );

	const finish = (): void => {
		if ( pending.current !== null && onCommit ) {
			onCommit( pending.current );
		}
		pending.current = null;
		setLocal( null );
	};

	return (
		<label className="bl-motion__slider">
			<span className="bl-motion__sliderhead">
				<span>{ label }</span>
				<span className="bl-motion__value">{ format( shown ) }</span>
			</span>
			<input
				type="range"
				min={ min }
				max={ max }
				step={ step }
				value={ shown }
				onChange={ ( event ) => {
					const v = Number( event.target.value );

					if ( onLive ) {
						onLive( v );
						return;
					}
					pending.current = v;
					setLocal( v );
				} }
				onPointerUp={ finish }
				onKeyUp={ finish }
				onBlur={ finish }
			/>
		</label>
	);
}

/* ------------------------------------------------------------------ arrivals and pending */

function Arrivals( { onUseMine }: { onUseMine: ( arrival: Arrival ) => void } ): JSX.Element | null {
	const shown = session.arrivals().filter( ( a ) => a.kind !== 'same' );

	if ( shown.length === 0 ) {
		return null;
	}

	return (
		<section className="bl-motion__arrivals" aria-label={ __( 'Animations this brought', 'blicks' ) }>
			<h3 className="bl-motion__label">{ __( 'Brought with this', 'blicks' ) }</h3>
			{ shown.map( ( arrival ) => (
				<div key={ arrival.keyframes.slug } className="bl-motion__arrival">
					<span className="bl-motion__pv" style={ { animation: `${ nameOf( arrival.keyframes.slug ) } 1.6s ease-in-out infinite both` } } />
					<span className="bl-motion__arrivaltext">
						<strong>{ arrival.keyframes.label }</strong>
						<small>
							{ arrival.kind === 'new'
								? __( 'New to this site', 'blicks' )
								: sprintf(
									/* translators: %s: the name the incoming animation was saved under instead */
									__( 'Yours moves differently — theirs is kept as %s', 'blicks' ),
									arrival.keyframes.slug
								) }
						</small>
					</span>
					{ arrival.kind === 'renamed' && (
						<button type="button" className="bl-motion__link" onClick={ () => onUseMine( arrival ) }>
							{ __( 'Use mine', 'blicks' ) }
						</button>
					) }
				</div>
			) ) }
		</section>
	);
}

function Pending(): JSX.Element | null {
	const count = session.drafts().length;

	if ( count === 0 ) {
		return null;
	}

	return (
		<p className={ session.settings().canEdit ? 'bl-motion__foot' : 'bl-motion__foot bl-motion__foot--warn' }>
			{ session.settings().canEdit
				? sprintf(
					/* translators: %d: how many animations are not saved yet */
					_n(
						'%d animation is not saved yet. It joins the site’s library when you Insert or Save as pattern.',
						'%d animations are not saved yet. They join the site’s library when you Insert or Save as pattern.',
						count,
						'blicks'
					),
					count
				)
				: __( 'This brings animations only an administrator can add to the site. Without them, those blocks will not move.', 'blicks' ) }
		</p>
	);
}

/* ------------------------------------------------------------------ starters */

function StartersView( { onBack, onUse }: { onBack: () => void; onUse: ( record: Keyframes ) => void } ): JSX.Element {
	const list = useMemo( starters, [] );
	const [ picked, setPicked ] = useState( list[ 1 ]?.id ?? 'blank' );
	const { properties } = session.settings();

	// Each starter previews under a name of its own, so the tiles move before anything is saved.
	const previewSlug = ( id: string ): string => `studio-starter-${ id }`;
	const css = keyframesCss( list.map( ( s ) => ( { slug: previewSlug( s.id ), ...s.keyframes } ) ), properties );
	const chosen = list.find( ( s ) => s.id === picked ) ?? list[ 0 ]!;

	return (
		<div className="bl-motion">
			<style>{ css }</style>
			<SubHead title={ __( 'New animation', 'blicks' ) } onBack={ onBack } />
			<h3 className="bl-motion__label">{ __( 'Start from', 'blicks' ) }</h3>
			<div className="bl-motion__starters">
				{ list.map( ( s ) => (
					<button
						key={ s.id }
						type="button"
						className={ s.id === picked ? 'bl-motion__starter bl-motion__starter--on' : 'bl-motion__starter' }
						aria-pressed={ s.id === picked }
						onClick={ () => setPicked( s.id ) }
					>
						<span className="bl-motion__pvbox">
							<span className="bl-motion__pv" style={ { animation: `${ nameOf( previewSlug( s.id ) ) } ${ s.keyframes.defaults?.duration ?? '1s' } ${ s.keyframes.defaults?.easing ?? 'ease' } infinite both` } } />
						</span>
						<span className="bl-motion__startertext">
							<strong>{ s.label }</strong>
							<small>{ s.hint }</small>
						</span>
					</button>
				) ) }
			</div>
			<div className="bl-motion__actions">
				<button type="button" className="bl-studio__btn" onClick={ onBack }>
					{ __( 'Cancel', 'blicks' ) }
				</button>
				<button
					type="button"
					className="bl-studio__btn bl-studio__btn--filled"
					onClick={ () =>
						onUse( {
							...chosen.keyframes,
							slug: freeSlug( chosen.keyframes.label, session.known().map( ( k ) => k.slug ) ),
						} )
					}
				>
					{ sprintf(
						/* translators: %s: the starter's name */
						__( 'Use %s', 'blicks' ),
						chosen.label
					) }
				</button>
			</div>
		</div>
	);
}

function SubHead( { title, onBack, children }: { title: string; onBack: () => void; children?: JSX.Element } ): JSX.Element {
	return (
		<div className="bl-motion__subhead">
			<button type="button" className="bl-motion__back" aria-label={ __( 'Back to Motion', 'blicks' ) } onClick={ onBack }>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
					<path d="M15 5l-7 7 7 7" />
				</svg>
			</button>
			{ children ?? <span className="bl-motion__title">{ title }</span> }
		</div>
	);
}

/* ------------------------------------------------------------------ the keyframe editor */

const POSE_SLIDERS: Array< [ keyof Pose, string, number, number, number, ( v: number ) => string ] > = [
	[ 'x', __( 'Move ←→', 'blicks' ), -200, 200, 1, ( v ) => `${ v } px` ],
	[ 'y', __( 'Move ↑↓', 'blicks' ), -200, 200, 1, ( v ) => `${ v } px` ],
	[ 'scale', __( 'Size', 'blicks' ), 0, 3, 0.01, ( v ) => `${ Math.round( v * 100 ) }%` ],
	[ 'turn', __( 'Turn', 'blicks' ), -360, 360, 1, ( v ) => `${ v }°` ],
	[ 'show', __( 'Show', 'blicks' ), 0, 1, 0.05, ( v ) => `${ Math.round( v * 100 ) }%` ],
	[ 'blur', __( 'Blur', 'blicks' ), 0, 20, 0.5, ( v ) => `${ v } px` ],
];

/** Properties the sliders own; everything else allowed is offered as a typed row. */
const POSED = [ 'transform', 'opacity', 'filter' ];

function KeyframeEditor( { record, uses, onBack }: { record: Keyframes; uses: number; onBack: () => void } ): JSX.Element {
	const sorted = [ ...record.steps ].sort( ( a, b ) => a.offset - b.offset );
	const [ at, setAt ] = useState( sorted[ 0 ]?.offset ?? 0 );
	const [ adding, setAdding ] = useState( '' );
	const step = sorted.find( ( s ) => s.offset === at ) ?? sorted[ 0 ];
	const { pose, extra } = readPose( step?.declarations ?? {} );
	const draft = session.isDraft( record.slug );
	const { properties } = session.settings();
	const offerable = properties.filter( ( p ) => ! POSED.includes( p ) && ! ( p in extra ) );

	const save = ( next: Keyframes ): void => session.put( next );
	const setStep = ( declarations: Record< string, string > ): void =>
		save( { ...record, steps: record.steps.map( ( s ) => ( s.offset === at ? { ...s, declarations } : s ) ) } );

	return (
		<div className="bl-motion">
			<SubHead title={ record.label } onBack={ onBack }>
				<span className="bl-motion__namebox">
					<input
						className="bl-motion__name"
						value={ record.label }
						aria-label={ __( 'Animation name', 'blicks' ) }
						onChange={ ( event ) => save( { ...record, label: event.target.value } ) }
					/>
					<small className="bl-motion__namemeta">
						{ draft ? __( 'Not saved yet', 'blicks' ) : __( 'In this site’s library', 'blicks' ) }
						{ ' · ' }
						{ sprintf(
							/* translators: %d: how many blocks in the Studio use this animation */
							_n( 'used on %d block here', 'used on %d blocks here', uses, 'blicks' ),
							uses
						) }
					</small>
				</span>
			</SubHead>

			<section className="bl-motion__sec">
				<div className="bl-motion__labelrow">
					<h3 className="bl-motion__label">{ __( 'Keyframes', 'blicks' ) }</h3>
					<span className="bl-motion__tools">
						<button
							type="button"
							className="bl-motion__icon"
							aria-label={ __( 'Add a keyframe after this one', 'blicks' ) }
							onClick={ () => {
								const split = splitAfter( record, at );
								save( split.record );
								setAt( split.offset );
							} }
						>
							+
						</button>
						<button
							type="button"
							className="bl-motion__icon"
							aria-label={ __( 'Remove this keyframe', 'blicks' ) }
							disabled={ record.steps.length <= 2 }
							onClick={ () => {
								const steps = record.steps.filter( ( s ) => s.offset !== at );
								save( { ...record, steps } );
								setAt( steps[ 0 ]?.offset ?? 0 );
							} }
						>
							−
						</button>
					</span>
				</div>
				<div className="bl-motion__track">
					<span className="bl-motion__rail" />
					{ sorted.map( ( s ) => (
						<button
							key={ s.offset }
							type="button"
							className={ s.offset === at ? 'bl-motion__stop bl-motion__stop--on' : 'bl-motion__stop' }
							style={ { left: `${ s.offset }%` } }
							aria-label={ sprintf(
								/* translators: %d: percent through the animation */
								__( 'Keyframe at %d%%', 'blicks' ),
								s.offset
							) }
							aria-pressed={ s.offset === at }
							onClick={ () => setAt( s.offset ) }
						>
							<i />
						</button>
					) ) }
				</div>
				<label className="bl-motion__offset">
					<span>{ __( 'At', 'blicks' ) }</span>
					<input
						type="number"
						min={ 0 }
						max={ 100 }
						value={ at }
						onChange={ ( event ) => {
							const to = Math.max( 0, Math.min( 100, Math.round( Number( event.target.value ) ) ) );

							if ( ! record.steps.some( ( s ) => s.offset === to ) ) {
								save( { ...record, steps: record.steps.map( ( s ) => ( s.offset === at ? { ...s, offset: to } : s ) ) } );
								setAt( to );
							}
						} }
					/>
					<span>%</span>
				</label>
			</section>

			<section className="bl-motion__group">
				{ POSE_SLIDERS.map( ( [ key, label, min, max, stepSize, format ] ) => (
					<Slider
						key={ key }
						label={ label }
						min={ min }
						max={ max }
						step={ stepSize }
						value={ pose[ key ] }
						format={ format }
						onLive={ ( v ) => setStep( writePose( { ...pose, [ key ]: v }, extra ) ) }
					/>
				) ) }
				{ JSON.stringify( pose ) !== JSON.stringify( REST_POSE ) && (
					<button type="button" className="bl-motion__link" onClick={ () => setStep( writePose( REST_POSE, extra ) ) }>
						{ __( 'Back to rest', 'blicks' ) }
					</button>
				) }
			</section>

			{ Object.keys( extra ).length > 0 && (
				<section className="bl-motion__sec">
					{ Object.entries( extra ).map( ( [ property, value ] ) => (
						<div key={ property } className="bl-motion__decl">
							<span className="bl-motion__prop">{ property }</span>
							<input
								className="bl-motion__declvalue"
								value={ value }
								aria-label={ property }
								onChange={ ( event ) => setStep( writePose( pose, { ...extra, [ property ]: event.target.value } ) ) }
							/>
							<button
								type="button"
								className="bl-motion__icon"
								aria-label={ sprintf(
									/* translators: %s: a CSS property name */
									__( 'Remove %s', 'blicks' ),
									property
								) }
								onClick={ () => {
									const rest = { ...extra };
									delete rest[ property ];
									setStep( writePose( pose, rest ) );
								} }
							>
								×
							</button>
						</div>
					) ) }
				</section>
			) }

			<label className="bl-motion__add">
				<span className="screen-reader-text">{ __( 'Add a property to this keyframe', 'blicks' ) }</span>
				<select
					value={ adding }
					onChange={ ( event ) => {
						const property = event.target.value;
						setAdding( '' );
						if ( property ) {
							setStep( writePose( pose, { ...extra, [ property ]: '' } ) );
						}
					} }
				>
					<option value="">{ __( '+ Add a property', 'blicks' ) }</option>
					{ offerable.map( ( p ) => (
						<option key={ p } value={ p }>
							{ p }
						</option>
					) ) }
				</select>
			</label>

			{ draft && (
				<div className="bl-motion__actions">
					<button
						type="button"
						className="bl-motion__link"
						onClick={ () => {
							session.discard( record.slug );
							onBack();
						} }
					>
						{ __( 'Discard changes', 'blicks' ) }
					</button>
				</div>
			) }
		</div>
	);
}
