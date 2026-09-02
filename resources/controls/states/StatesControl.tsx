import { __ } from '@wordpress/i18n';
import { getValue, setValue } from '@/framework/values';
import { STATE_LABELS } from '@/framework/states';
import { FieldHead, SubReset, setOrClear } from '@/controls/common';
import './states.scss';

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
	/** Supplied by the Inspector so the facet's picker drives the same state as the context bar. */
	states?: string[];
	setState?: ( s: string ) => void;
}

/** `effects.boxShadow` → "Box shadow". Good enough for a review list; no per-control registry. */
function humanize( controlId: string ): string {
	const leaf = controlId.split( '.' ).pop() ?? controlId;
	const spaced = leaf.replace( /([a-z0-9])([A-Z])/g, '$1 $2' );
	return spaced.charAt( 0 ).toUpperCase() + spaced.slice( 1 ).toLowerCase();
}

/** Compact one-line rendering of whatever shape a control stores (string, or sides/corners object). */
function summarize( value: unknown ): string {
	if ( value === null || value === undefined ) return '';
	if ( typeof value === 'object' ) {
		const parts = Object.values( value as Record< string, unknown > )
			.filter( ( v ) => v !== undefined && v !== null && v !== '' )
			.map( String );
		return parts.length ? parts.join( ' ' ) : '—';
	}
	return String( value );
}

interface Override {
	controlId: string;
	breakpoint: string;
	value: unknown;
}

/**
 * The **States** facet — pseudo-*classes* (`:hover`, `:focus`, `:active`) plus the interaction
 * properties that belong with them.
 *
 * Distinct from the Decoration facet, which edits pseudo-*elements* (`::before` / `::after`).
 * The two were previously conflated under one "Pseudo" label; they are different CSS features
 * and now have different homes.
 *
 * The overrides list is a pure read over the value tree: it answers "what does this block
 * actually change in this state?", which is otherwise invisible until you tab through every
 * facet with the state switched on.
 */
export function StatesControl( { attributes, setAttributes, state, breakpoint, states, setState }: Props ) {
	const available = states && states.length > 1 ? states : [ 'default' ];
	const cursor = getValue( attributes, 'effects.cursor', state, breakpoint ) || '';

	const tree: Record< string, Record< string, Record< string, unknown > > > = attributes?.blicks ?? {};

	const overrides: Override[] = [];
	for ( const controlId of Object.keys( tree ) ) {
		const slot = tree[ controlId ]?.[ state ];
		if ( ! slot ) continue;
		for ( const bp of Object.keys( slot ) ) {
			overrides.push( { controlId, breakpoint: bp, value: slot[ bp ] } );
		}
	}
	overrides.sort( ( a, b ) => a.controlId.localeCompare( b.controlId ) );

	const removeOverride = ( o: Override ) =>
		setValue( attributes, setAttributes, o.controlId, state, o.breakpoint, undefined );

	return (
		<div className="bl-states bl-layout">
			<div className="field">
				<FieldHead label={ __( 'State', 'blicks' ) } />
				<div className="bl-states__grid" role="radiogroup" aria-label={ __( 'Editing state', 'blicks' ) }>
					{ available.map( ( s ) => (
						<button
							key={ s }
							type="button"
							role="radio"
							aria-checked={ state === s }
							className={ state === s ? 'on' : '' }
							title={ s === 'default' ? __( 'Base styles', 'blicks' ) : `:${ s }` }
							disabled={ ! setState }
							onClick={ () => setState?.( s ) }
						>
							{ STATE_LABELS[ s ] ?? s }
						</button>
					) ) }
				</div>
				<p className="bl-states__hint">
					{ state === 'default'
						? __( 'Editing base styles — every state inherits from here.', 'blicks' )
						: /* translators: %s: a CSS pseudo-class, e.g. :hover */
						  __( 'Editing %s — only changed properties override the base.', 'blicks' ).replace( '%s', `:${ state }` ) }
				</p>
			</div>

			<div className="field">
				<FieldHead label={ __( 'Overrides', 'blicks' ) } />
				{ overrides.length === 0 ? (
					<p className="bl-empty">
						{ /* translators: %s: the current state's label */
						  __( 'Nothing overridden for %s yet. Change any property in another facet while this state is active and it lands here.', 'blicks' ).replace(
								'%s',
								state === 'default' ? __( 'the base state', 'blicks' ) : `:${ state }`
						  ) }
					</p>
				) : (
					<ul className="bl-ovr">
						{ overrides.map( ( o ) => (
							<li key={ `${ o.controlId }:${ o.breakpoint }` }>
								<span className="bl-ovr__prop">{ humanize( o.controlId ) }</span>
								{ o.breakpoint !== 'base' && <span className="bl-ovr__bp">{ o.breakpoint }</span> }
								<span className="bl-ovr__val">{ summarize( o.value ) }</span>
								<button
									type="button"
									className="bl-ovr__x"
									title={ __( 'Remove override', 'blicks' ) }
									aria-label={ __( 'Remove override', 'blicks' ) }
									onClick={ () => removeOverride( o ) }
								>
									×
								</button>
							</li>
						) ) }
					</ul>
				) }
			</div>

			<div className="field" style={ { marginBottom: 0 } }>
				<div className="sub-row">
					<span className="sub">{ __( 'Cursor', 'blicks' ) }</span>
					{ cursor && <SubReset onClick={ () => setOrClear( attributes, setAttributes, 'effects.cursor', state, breakpoint, '' ) } /> }
				</div>
				<select
					value={ cursor }
					onChange={ ( e ) => setOrClear( attributes, setAttributes, 'effects.cursor', state, breakpoint, e.target.value ) }
				>
					<option value="">—</option>
					{ [ 'auto', 'default', 'pointer', 'text', 'move', 'grab', 'not-allowed', 'wait', 'help', 'zoom-in' ].map( ( v ) => (
						<option key={ v } value={ v }>{ v }</option>
					) ) }
				</select>
			</div>
		</div>
	);
}
