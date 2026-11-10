import { __, _n, sprintf } from '@wordpress/i18n';
import { useEffect, useRef, useState } from '@wordpress/element';
import { ANIMATION_PROPERTIES, ANIMATION_STARTER_STEPS } from '../constants';
import { slugify } from '../design-model';
import { useToast } from './Toast';
import type { useAnimations } from '../hooks/useAnimations';
import type { CustomAnimation } from '../types';

type AnimationsApi = ReturnType< typeof useAnimations >;

const PREFIX = 'bl-anim-';
const DRAFT_NAME = `${ PREFIX }__draft`;
const DRAFT_STYLE_ID = 'blicks-draft-keyframes';
const PLUS = <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z" /></svg>;

const easings = (): Array< [ string, string ] > => [
	[ 'ease', __( 'Smooth', 'blicks' ) ],
	[ 'ease-out', __( 'Slows at the end', 'blicks' ) ],
	[ 'ease-in', __( 'Speeds up', 'blicks' ) ],
	[ 'ease-in-out', __( 'Slow, fast, slow', 'blicks' ) ],
	[ 'linear', __( 'Steady', 'blicks' ) ],
	[ 'cubic-bezier(0.2, 0, 0, 1)', __( 'Snappy', 'blicks' ) ],
];

/**
 * The unsaved draft has no server-rendered keyframes yet, so the preview gets its own. Only
 * properties the server accepts are written, and values cannot close the rule they sit in.
 */
function writeDraftKeyframes( draft: CustomAnimation | null ): void {
	let tag = document.getElementById( DRAFT_STYLE_ID );
	if ( ! draft ) {
		tag?.remove();
		return;
	}
	if ( ! tag ) {
		tag = document.createElement( 'style' );
		tag.id = DRAFT_STYLE_ID;
		document.head.appendChild( tag );
	}
	const clean = ( value: string ): string => value.replace( /[{}<;]/g, '' );
	tag.textContent = `@keyframes ${ DRAFT_NAME } { ${ draft.steps.map( step => `${ Math.max( 0, Math.min( 100, step.offset ) ) }% { ${ Object.entries( step.declarations )
		.filter( ( [ property ] ) => ANIMATION_PROPERTIES.includes( property ) )
		.map( ( [ property, value ] ) => `${ property }: ${ clean( value ) };` ).join( ' ' ) } }` ).join( ' ' ) } }`;
}

function replay( element: HTMLElement | null ): void {
	if ( ! element ) return;
	const name = element.style.animationName;
	element.style.animationName = 'none';
	void element.offsetWidth;
	element.style.animationName = name;
}

/** A stage the animation plays on; pressing it plays it again. */
function Stage( { name, duration, easing, label, big = false }: { name: string; duration?: string; easing?: string; label: string; big?: boolean } ): JSX.Element {
	const box = useRef< HTMLElement >( null );
	return (
		<button type="button" className={ `stage${ big ? ' big' : '' }` } aria-label={ label } onClick={ () => replay( box.current ) }>
			<i ref={ box } style={ { animationName: name, animationDuration: duration || '600ms', animationTimingFunction: easing || 'ease-out', animationFillMode: 'both' } } />
		</button>
	);
}

export function AnimationsView( { animations, head }: { animations: AnimationsApi; head: ( extra?: React.ReactNode ) => JSX.Element } ): JSX.Element {
	const toast = useToast();
	const { library, isLoading, isSaving, error } = animations;
	const [ draft, setDraft ] = useState< CustomAnimation | null >( null );
	const [ original, setOriginal ] = useState( '' );
	const [ asking, setAsking ] = useState( '' );
	const preview = useRef< HTMLDivElement >( null );
	const easeList = easings();
	const easeName = ( value?: string ): string => easeList.find( ( [ v ] ) => v === value )?.[ 1 ] ?? value ?? '';

	useEffect( () => {
		writeDraftKeyframes( draft );
		replay( preview.current?.querySelector( 'i' ) ?? null );
	}, [ draft ] );
	useEffect( () => () => writeDraftKeyframes( null ), [] );

	const start = ( from: CustomAnimation | null ): void => {
		animations.clearError();
		setOriginal( from?.slug ?? '' );
		setDraft( from
			? JSON.parse( JSON.stringify( from ) ) as CustomAnimation
			: { slug: '', label: '', defaults: { duration: '600ms', easing: 'ease-out' }, steps: ANIMATION_STARTER_STEPS.map( step => ( { offset: step.offset, declarations: { ...step.declarations } } ) ) } );
		window.setTimeout( () => document.getElementById( 'anim-name' )?.focus(), 0 );
	};
	const close = (): void => {
		setDraft( null );
		setOriginal( '' );
		animations.clearError();
	};

	const patchStep = ( index: number, fn: ( declarations: Record< string, string >, offset: number ) => { declarations?: Record< string, string >; offset?: number } ): void => {
		setDraft( current => current && {
			...current,
			steps: current.steps.map( ( step, i ) => ( i === index ? { ...step, ...fn( { ...step.declarations }, step.offset ) } : step ) ),
		} );
	};

	let check: { ok: boolean; bad?: boolean; msg: string } = { ok: false, msg: '' };
	if ( draft ) {
		const slug = original || slugify( draft.label );
		if ( ! draft.label.trim() ) check = { ok: false, msg: __( 'Give it a name. Blocks offer it by that name.', 'blicks' ) };
		else if ( ! original && library.some( entry => entry.slug === slug || entry.name === `${ PREFIX }${ slug }` ) ) check = { ok: false, bad: true, msg: sprintf( /* translators: %s: animation name. */ __( 'There’s already an animation called “%s”.', 'blicks' ), draft.label.trim() ) };
		else if ( ! /^\d+(\.\d+)?m?s$/.test( ( draft.defaults.duration ?? '' ).trim() ) ) check = { ok: false, bad: true, msg: __( 'Length needs a unit, like 600ms or 1.2s.', 'blicks' ) };
		else if ( draft.steps.length < 2 ) check = { ok: false, bad: true, msg: __( 'An animation needs at least two steps.', 'blicks' ) };
		else if ( draft.steps.some( step => ! Number.isFinite( step.offset ) || step.offset < 0 || step.offset > 100 ) ) check = { ok: false, bad: true, msg: __( 'Each step needs a place between 0 and 100%.', 'blicks' ) };
		else check = { ok: true, msg: sprintf( /* translators: %s: animation name. */ __( 'Blocks offer it as “%s” in their Motion settings.', 'blicks' ), draft.label.trim() ) };
	}

	const save = async (): Promise< void > => {
		if ( ! draft || ! check.ok ) return;
		const slug = original || slugify( draft.label );
		const steps = draft.steps.slice().sort( ( a, b ) => a.offset - b.offset ).map( step => ( {
			offset: step.offset,
			declarations: Object.fromEntries( Object.entries( step.declarations ).filter( ( [ property, value ] ) => property && value.trim() !== '' ) ),
		} ) );
		const ok = await animations.save( { ...draft, slug, label: draft.label.trim(), steps }, original );
		if ( ok ) {
			toast( sprintf( /* translators: %s: animation name. */ __( '“%s” saved', 'blicks' ), draft.label.trim() ) );
			close();
		}
	};

	const editor = draft && (
		<div className="anim-ed" role="group" aria-label={ original ? __( 'Edit animation', 'blicks' ) : __( 'New animation', 'blicks' ) }>
			<div className="anim-ed-top">
				<div ref={ preview }><Stage name={ DRAFT_NAME } duration={ draft.defaults.duration } easing={ draft.defaults.easing } label={ __( 'Play the preview', 'blicks' ) } big /></div>
				<div className="anim-fields">
					<label>{ __( 'Name', 'blicks' ) }<span className="vfield"><input id="anim-name" value={ draft.label } placeholder={ __( 'Like Drift in', 'blicks' ) } autoComplete="off" spellCheck={ false } disabled={ isSaving } onChange={ event => { const label = event.currentTarget.value; setDraft( current => current && { ...current, label } ); } } /></span></label>
					<label>{ __( 'Length', 'blicks' ) }<span className="vfield"><input value={ draft.defaults.duration ?? '' } spellCheck={ false } disabled={ isSaving } onChange={ event => { const duration = event.currentTarget.value; setDraft( current => current && { ...current, defaults: { ...current.defaults, duration } } ); } } /></span></label>
					<label>{ __( 'Speed curve', 'blicks' ) }<span className="vfield">
						<select value={ draft.defaults.easing ?? 'ease-out' } disabled={ isSaving } onChange={ event => { const easing = event.currentTarget.value; setDraft( current => current && { ...current, defaults: { ...current.defaults, easing } } ); } }>
							{ easeList.map( ( [ value, label ] ) => <option key={ value } value={ value }>{ label }</option> ) }
							{ ! easeList.some( ( [ value ] ) => value === draft.defaults.easing ) && draft.defaults.easing && <option value={ draft.defaults.easing }>{ draft.defaults.easing }</option> }
						</select>
					</span></label>
					<p className={ `hint${ check.bad ? ' bad' : '' }` } role="status">{ check.msg }</p>
				</div>
			</div>
			<div className="steps">
				{ draft.steps.map( ( step, i ) => (
					<div className="astep" key={ i }>
						<label>{ __( 'At', 'blicks' ) }<span className="vfield">
							<input value={ String( step.offset ) } inputMode="decimal" aria-label={ sprintf( /* translators: %d: step number. */ __( 'Step %d place, in percent', 'blicks' ), i + 1 ) } disabled={ isSaving } onChange={ event => { const offset = parseFloat( event.currentTarget.value ); patchStep( i, () => ( { offset: Number.isFinite( offset ) ? offset : NaN } ) ); } } />
							<span className="u">%</span>
						</span></label>
						<div className="decls">
							{ Object.entries( step.declarations ).map( ( [ property, value ], j ) => (
								<div className="decl" key={ j }>
									<span className="vfield">
										<select value={ property } aria-label={ sprintf( /* translators: 1: step number, 2: property number. */ __( 'Step %1$d property %2$d', 'blicks' ), i + 1, j + 1 ) } disabled={ isSaving } onChange={ event => {
											const next = event.currentTarget.value;
											patchStep( i, declarations => ( { declarations: Object.fromEntries( Object.entries( declarations ).map( ( [ p, v ], x ) => ( x === j ? [ next, v ] : [ p, v ] ) ) ) } ) );
										} }>
											{ ANIMATION_PROPERTIES.map( option => <option key={ option } value={ option }>{ option }</option> ) }
										</select>
									</span>
									<label className="vfield"><input value={ value } spellCheck={ false } aria-label={ sprintf( /* translators: 1: step number, 2: CSS property. */ __( 'Step %1$d %2$s value', 'blicks' ), i + 1, property ) } disabled={ isSaving } onChange={ event => {
										const next = event.currentTarget.value;
										patchStep( i, declarations => ( { declarations: { ...declarations, [ property ]: next } } ) );
									} } /></label>
									<button type="button" className="icon-btn sm" aria-label={ sprintf( /* translators: 1: CSS property, 2: step number. */ __( 'Remove %1$s from step %2$d', 'blicks' ), property, i + 1 ) } disabled={ isSaving } onClick={ () => patchStep( i, declarations => ( { declarations: Object.fromEntries( Object.entries( declarations ).filter( ( _, x ) => x !== j ) ) } ) ) }>×</button>
								</div>
							) ) }
							<button type="button" className="link-btn sm" disabled={ isSaving } onClick={ () => patchStep( i, declarations => {
								const property = ANIMATION_PROPERTIES.find( p => ! ( p in declarations ) ) ?? 'opacity';
								return { declarations: { ...declarations, [ property ]: '' } };
							} ) }>{ __( 'Add a property', 'blicks' ) }</button>
						</div>
						<button type="button" className="icon-btn sm" aria-label={ sprintf( /* translators: %d: step number. */ __( 'Remove step %d', 'blicks' ), i + 1 ) } disabled={ isSaving || draft.steps.length <= 2 } onClick={ () => setDraft( current => current && { ...current, steps: current.steps.filter( ( _, x ) => x !== i ) } ) }>×</button>
					</div>
				) ) }
				<div><button type="button" className="link-btn" disabled={ isSaving } onClick={ () => setDraft( current => current && { ...current, steps: [ ...current.steps, { offset: 100, declarations: { ...current.steps[ current.steps.length - 1 ]?.declarations } } ] } ) }>{ __( 'Add a step', 'blicks' ) }</button></div>
			</div>
			{ error && <p className="result bad" role="alert">{ error }</p> }
			<div className="anim-ed-foot">
				<p>{ __( 'Saved straight away, on its own. It doesn’t wait for the Save button at the top.', 'blicks' ) }</p>
				<button type="button" className="pill sm" onClick={ close }>{ __( 'Cancel', 'blicks' ) }</button>
				<button type="button" className="pill pill--filled sm" disabled={ ! check.ok || isSaving } onClick={ () => void save() }>
					{ isSaving ? __( 'Saving…', 'blicks' ) : original ? __( 'Save changes', 'blicks' ) : __( 'Save animation', 'blicks' ) }
				</button>
			</div>
		</div>
	);

	const own = animations.animations;
	const builtin = library.filter( entry => entry.builtin );
	const meta = ( duration?: string, easing?: string, steps?: number ): string =>
		[ duration, easeName( easing ), steps ? sprintf( /* translators: %d: number of steps. */ _n( '%d step', '%d steps', steps, 'blicks' ), steps ) : '' ].filter( Boolean ).join( ' · ' );

	return (
		<>
			{ head( draft ? undefined : <button type="button" className="pill pill--filled sm" disabled={ isLoading } onClick={ () => start( null ) }>{ PLUS } { __( 'New animation', 'blicks' ) }</button> ) }
			{ editor }
			{ ! draft && error && <p className="result bad" role="alert">{ error }</p> }
			<div className="sub"><h3>{ __( 'Yours', 'blicks' ) }</h3><p>{ __( 'Edit or delete any time', 'blicks' ) }</p></div>
			<div className="list">
				{ isLoading && <div className="loading">{ __( 'Loading animations…', 'blicks' ) }</div> }
				{ ! isLoading && own.length === 0 && <div className="empty">{ __( 'No animations of your own yet.', 'blicks' ) }</div> }
				{ own.map( animation => (
					<div className="anim-row" key={ animation.slug }>
						<Stage name={ `${ PREFIX }${ animation.slug }` } duration={ animation.defaults.duration } easing={ animation.defaults.easing } label={ sprintf( /* translators: %s: animation name. */ __( 'Play %s', 'blicks' ), animation.label ) } />
						<div className="anim-name">
							<b>{ animation.label }<span className="src-own">{ __( 'yours', 'blicks' ) }</span></b>
							<span>{ meta( animation.defaults.duration, animation.defaults.easing, animation.steps.length ) }</span>
							<code>{ `${ PREFIX }${ animation.slug }` }</code>
						</div>
						<div className="anim-acts">
							<button type="button" className="pill sm" disabled={ isSaving } onClick={ () => start( animation ) }>{ __( 'Edit', 'blicks' ) }</button>
							<button type="button" className="icon-btn sm" disabled={ isSaving } aria-label={ sprintf( /* translators: %s: animation name. */ __( 'Delete %s', 'blicks' ), animation.label ) } onClick={ () => setAsking( animation.slug ) }>×</button>
						</div>
						{ asking === animation.slug && (
							<div className="confirm-del" role="alert">
								<span>{ sprintf( /* translators: %s: animation name. */ __( 'Delete “%s”? Blocks that use it stop animating.', 'blicks' ), animation.label ) }</span>
								<button type="button" className="pill sm" onClick={ () => setAsking( '' ) }>{ __( 'Keep', 'blicks' ) }</button>
								<button type="button" className="pill sm pill--danger" onClick={ async () => {
									setAsking( '' );
									await animations.remove( animation.slug );
									toast( sprintf( /* translators: %s: animation name. */ __( '“%s” deleted', 'blicks' ), animation.label ), () => void animations.save( animation ) );
								} }>{ __( 'Delete', 'blicks' ) }</button>
							</div>
						) }
					</div>
				) ) }
			</div>
			<div className="sub"><h3>{ __( 'Built in', 'blicks' ) }</h3><p>{ __( 'Press a stage to play it', 'blicks' ) }</p></div>
			<div className="list">
				{ builtin.map( entry => (
					<div className="anim-row" key={ entry.name }>
						<Stage name={ entry.name } duration={ entry.defaults.duration } easing={ entry.defaults.easing } label={ sprintf( /* translators: %s: animation name. */ __( 'Play %s', 'blicks' ), entry.label ) } />
						<div className="anim-name">
							<b>{ entry.label }</b>
							<span>{ entry.description || meta( entry.defaults.duration, entry.defaults.easing ) }</span>
							<code>{ entry.name }</code>
						</div>
						<div className="anim-acts"><span className="fixed">{ __( 'Ships with Blicks', 'blicks' ) }</span></div>
					</div>
				) ) }
			</div>
		</>
	);
}
