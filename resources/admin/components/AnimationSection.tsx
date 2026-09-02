import { __, _n, sprintf } from '@wordpress/i18n';
import { useEffect, useState } from '@wordpress/element';
import { ANIMATION_PROPERTIES, ANIMATION_STARTER_STEPS } from '../constants';
import type { AnimationStep, CustomAnimation, LibraryAnimation } from '../types';

const PREFIX = 'bl-anim-';

function blankAnimation(): CustomAnimation {
	return {
		slug: '',
		label: '',
		defaults: { duration: '600ms', easing: 'ease-out', iteration: '1', fillMode: 'both' },
		steps: ANIMATION_STARTER_STEPS.map( step => ( { offset: step.offset, declarations: { ...step.declarations } } ) ),
	};
}

function slugify( value: string ): string {
	return value.toLowerCase().replace( /[^a-z0-9-]+/g, '-' ).replace( /-+/g, '-' ).replace( /^-|-$/g, '' );
}

/**
 * The Design System → Animation section: a library list plus a step editor. Steps are structured
 * (offset + declarations) rather than raw CSS, so the emitted `@keyframes` stays fully ours —
 * see docs/plans/custom-animations.md.
 */
export function AnimationSection( {
	animations,
	library,
	isLoading,
	isSaving,
	error,
	onSave,
	onDelete,
	onDismissError,
}: {
	animations: CustomAnimation[];
	library: LibraryAnimation[];
	isLoading: boolean;
	isSaving: boolean;
	error: string;
	onSave: ( animation: CustomAnimation, originalSlug?: string ) => Promise< boolean >;
	onDelete: ( slug: string ) => Promise< void >;
	onDismissError: () => void;
} ): JSX.Element {
	const [ draft, setDraft ] = useState< CustomAnimation | null >( null );
	const [ editingSlug, setEditingSlug ] = useState( '' );
	const [ confirmDelete, setConfirmDelete ] = useState( '' );
	const [ previewKey, setPreviewKey ] = useState( 0 );

	// Restart the preview whenever the definition changes, otherwise an already-finished
	// animation would not replay and the editor would look inert.
	useEffect( () => { setPreviewKey( key => key + 1 ); }, [ draft ] );

	const startNew = (): void => { onDismissError(); setEditingSlug( '' ); setDraft( blankAnimation() ); };
	const startEdit = ( animation: CustomAnimation ): void => {
		onDismissError();
		setEditingSlug( animation.slug );
		setDraft( { ...animation, steps: animation.steps.map( s => ( { ...s, declarations: { ...s.declarations } } ) ) } );
	};
	const cancel = (): void => { setDraft( null ); setEditingSlug( '' ); onDismissError(); };

	const patch = ( next: Partial< CustomAnimation > ): void => setDraft( current => ( current ? { ...current, ...next } : current ) );
	const patchStep = ( index: number, next: Partial< AnimationStep > ): void => setDraft( current => {
		if ( ! current ) return current;
		const steps = current.steps.map( ( step, i ) => ( i === index ? { ...step, ...next } : step ) );
		return { ...current, steps };
	} );

	const setDeclaration = ( index: number, property: string, value: string, previousProperty?: string ): void => setDraft( current => {
		if ( ! current ) return current;
		const steps = current.steps.map( ( step, i ) => {
			if ( i !== index ) return step;
			const declarations = { ...step.declarations };
			if ( previousProperty && previousProperty !== property ) delete declarations[ previousProperty ];
			if ( property === '' ) return { ...step, declarations };
			if ( value === '' && previousProperty === property ) delete declarations[ property ];
			else declarations[ property ] = value;
			return { ...step, declarations };
		} );
		return { ...current, steps };
	} );

	const commit = async (): Promise< void > => {
		if ( ! draft ) return;
		const slug = slugify( draft.slug || draft.label );
		if ( ! slug ) return;
		const ok = await onSave( { ...draft, slug, label: draft.label || slug }, editingSlug );
		if ( ok ) cancel();
	};

	const previewStyle = draft
		? {
			animationName: `${ PREFIX }${ slugify( draft.slug || draft.label ) || 'preview' }`,
			animationDuration: draft.defaults.duration || '600ms',
			animationTimingFunction: draft.defaults.easing || 'ease-out',
			animationIterationCount: draft.defaults.iteration || '1',
			animationDirection: draft.defaults.direction || 'normal',
			animationFillMode: draft.defaults.fillMode || 'both',
		} as React.CSSProperties
		: {};

	return (
		<>
			<p className="anim__lead">
				{ __( 'Define reusable keyframe animations. Each one becomes a preset in every block’s Motion control, and is emitted as CSS on the front end.', 'blicks' ) }
			</p>

			{ ! isLoading && library.length > 0 && (
				<p className="anim__count">
					{ sprintf(
						/* translators: %d: total number of animations available to blocks. */
						_n( '%d animation available to every block.', '%d animations available to every block.', library.length, 'blicks' ),
						library.length
					) }
				</p>
			) }

			{ error && (
				<p className="anim__error" role="alert">{ error }</p>
			) }

			<div className="anim__sub">{ __( 'Predefined', 'blicks' ) }</div>
			<div className="anim__list">
				{ library.filter( a => a.builtin ).map( animation => (
					<div className="anim__row is-builtin" key={ animation.name }>
						<div className="anim__demo" aria-hidden="true">
							<span style={ {
								animationName: animation.name,
								animationDuration: animation.defaults.duration || '1.5s',
								animationTimingFunction: animation.defaults.easing || 'ease-out',
								animationIterationCount: 'infinite',
								animationDirection: animation.defaults.direction || 'normal',
								animationFillMode: animation.defaults.fillMode || 'both',
							} as React.CSSProperties } />
						</div>
						<div className="anim__meta">
							<b>{ animation.label }</b>
							<span>{ animation.name }</span>
						</div>
						<div className="anim__facts">{ animation.description }</div>
						<div className="anim__act"><span className="anim__tag">{ __( 'Built in', 'blicks' ) }</span></div>
					</div>
				) ) }
			</div>

			<div className="anim__sub">{ __( 'Your animations', 'blicks' ) }</div>
			<div className="anim__list">
				{ isLoading && <p className="anim__empty">{ __( 'Loading animations…', 'blicks' ) }</p> }
				{ ! isLoading && animations.length === 0 && (
					<p className="anim__empty">{ __( 'None yet. Add one and it joins the list above in every block’s Motion control.', 'blicks' ) }</p>
				) }
				{ animations.map( animation => (
					<div className="anim__row" key={ animation.slug }>
						<div className="anim__demo" aria-hidden="true">
							<span style={ {
								animationName: `${ PREFIX }${ animation.slug }`,
								animationDuration: animation.defaults.duration || '600ms',
								animationTimingFunction: animation.defaults.easing || 'ease-out',
								animationIterationCount: animation.defaults.iteration || 'infinite',
								animationDirection: animation.defaults.direction || 'normal',
								animationFillMode: animation.defaults.fillMode || 'both',
							} as React.CSSProperties } />
						</div>
						<div className="anim__meta">
							<b>{ animation.label }</b>
							<span>{ PREFIX }{ animation.slug }</span>
						</div>
						<div className="anim__facts">
							{ sprintf(
								/* translators: %d: number of keyframe steps. */
								_n( '%d step', '%d steps', animation.steps.length, 'blicks' ),
								animation.steps.length
							) }
							{ animation.defaults.duration ? ` · ${ animation.defaults.duration }` : '' }
						</div>
						<div className="anim__act">
							{ confirmDelete === animation.slug ? (
								<>
									<span className="anim__warn">{ __( 'Blocks using it lose their motion.', 'blicks' ) }</span>
									<button type="button" className="anim__danger" disabled={ isSaving } onClick={ () => { void onDelete( animation.slug ); setConfirmDelete( '' ); } }>{ __( 'Delete', 'blicks' ) }</button>
									<button type="button" disabled={ isSaving } onClick={ () => setConfirmDelete( '' ) }>{ __( 'Cancel', 'blicks' ) }</button>
								</>
							) : (
								<>
									<button type="button" disabled={ isSaving } onClick={ () => startEdit( animation ) }>{ __( 'Edit', 'blicks' ) }</button>
									<button type="button" disabled={ isSaving } onClick={ () => setConfirmDelete( animation.slug ) }>{ __( 'Delete', 'blicks' ) }</button>
								</>
							) }
						</div>
					</div>
				) ) }
			</div>

			{ ! draft && (
				<button type="button" className="addtok" disabled={ isSaving } onClick={ startNew }>
					{ __( 'Add animation', 'blicks' ) }
				</button>
			) }

			{ draft && (
				<div className="animed">
					<div className="animed__head">
						<b>{ editingSlug ? __( 'Edit animation', 'blicks' ) : __( 'New animation', 'blicks' ) }</b>
						<div className="animed__preview" aria-hidden="true">
							<span key={ previewKey } style={ previewStyle } />
						</div>
					</div>

					<div className="animed__grid">
						<label className="cf">
							<span>{ __( 'Name', 'blicks' ) }</span>
							<div className="ctl">
								<input
									type="text"
									value={ draft.label }
									placeholder={ __( 'Pulse glow', 'blicks' ) }
									onChange={ e => patch( { label: e.currentTarget.value } ) }
								/>
							</div>
						</label>
						<label className="cf">
							<span>{ __( 'CSS name', 'blicks' ) }</span>
							<div className="ctl">
								<input
									type="text"
									value={ draft.slug }
									placeholder={ slugify( draft.label ) || 'pulse-glow' }
									onChange={ e => patch( { slug: e.currentTarget.value } ) }
								/>
							</div>
						</label>
						<label className="cf">
							<span>{ __( 'Duration', 'blicks' ) }</span>
							<div className="ctl"><input type="text" value={ draft.defaults.duration ?? '' } placeholder="600ms" onChange={ e => patch( { defaults: { ...draft.defaults, duration: e.currentTarget.value } } ) } /></div>
						</label>
						<label className="cf">
							<span>{ __( 'Easing', 'blicks' ) }</span>
							<div className="ctl"><input type="text" value={ draft.defaults.easing ?? '' } placeholder="ease-out" onChange={ e => patch( { defaults: { ...draft.defaults, easing: e.currentTarget.value } } ) } /></div>
						</label>
						<label className="cf">
							<span>{ __( 'Iterations', 'blicks' ) }</span>
							<div className="ctl"><input type="text" value={ draft.defaults.iteration ?? '' } placeholder="1" onChange={ e => patch( { defaults: { ...draft.defaults, iteration: e.currentTarget.value } } ) } /></div>
						</label>
						<label className="cf">
							<span>{ __( 'Direction', 'blicks' ) }</span>
							<div className="ctl">
								<select value={ draft.defaults.direction ?? 'normal' } onChange={ e => patch( { defaults: { ...draft.defaults, direction: e.currentTarget.value } } ) }>
									{ [ 'normal', 'reverse', 'alternate', 'alternate-reverse' ].map( v => <option key={ v } value={ v }>{ v }</option> ) }
								</select>
							</div>
						</label>
					</div>

					<div className="animed__steps">
						<div className="anim__sub">{ __( 'Steps', 'blicks' ) }</div>
						{ draft.steps.map( ( step, index ) => (
							<div className="animst" key={ index }>
								<label className="animst__off">
									<span>{ __( 'At', 'blicks' ) }</span>
									<div className="ctl">
										<input
											type="number"
											min={ 0 }
											max={ 100 }
											value={ step.offset }
											onChange={ e => patchStep( index, { offset: Math.max( 0, Math.min( 100, Number( e.currentTarget.value ) || 0 ) ) } ) }
										/>
										<span className="u">%</span>
									</div>
								</label>

								<div className="animst__decls">
									{ [ ...Object.entries( step.declarations ), [ '', '' ] as [ string, string ] ].map( ( [ property, value ], row ) => (
										<div className="animst__d" key={ `${ index }-${ row }-${ property }` }>
											<div className="ctl">
												<select
													value={ property }
													onChange={ e => setDeclaration( index, e.currentTarget.value, value || defaultValueFor( e.currentTarget.value ), property ) }
												>
													<option value="">{ __( '— property —', 'blicks' ) }</option>
													{ ANIMATION_PROPERTIES.map( p => <option key={ p } value={ p }>{ p }</option> ) }
												</select>
											</div>
											<div className="ctl">
												<input
													type="text"
													value={ value }
													disabled={ property === '' }
													placeholder={ defaultValueFor( property ) }
													onChange={ e => setDeclaration( index, property, e.currentTarget.value, property ) }
												/>
											</div>
										</div>
									) ) }
								</div>

								{ draft.steps.length > 2 && (
									<button
										type="button"
										className="animst__rm"
										aria-label={ sprintf( /* translators: %d: keyframe offset percentage. */ __( 'Remove the %d%% step', 'blicks' ), step.offset ) }
										onClick={ () => patch( { steps: draft.steps.filter( ( _, i ) => i !== index ) } ) }
									>×</button>
								) }
							</div>
						) ) }
						<button
							type="button"
							className="addtok"
							onClick={ () => patch( { steps: [ ...draft.steps, { offset: 100, declarations: { opacity: '1' } } ] } ) }
						>{ __( 'Add step', 'blicks' ) }</button>
					</div>

					<div className="animed__act">
						<button type="button" className="btn" disabled={ isSaving } onClick={ cancel }>{ __( 'Cancel', 'blicks' ) }</button>
						<button type="button" className="btn primary" disabled={ isSaving || ! slugify( draft.slug || draft.label ) } onClick={ () => void commit() }>
							{ isSaving ? __( 'Saving…', 'blicks' ) : __( 'Save animation', 'blicks' ) }
						</button>
					</div>
				</div>
			) }
		</>
	);
}

function defaultValueFor( property: string ): string {
	switch ( property ) {
		case 'opacity': return '1';
		case 'transform': return 'translateY(0)';
		case 'filter': return 'blur(0)';
		case 'scale': return '1';
		case 'rotate': return '0deg';
		case 'translate': return '0 0';
		default: return '';
	}
}
