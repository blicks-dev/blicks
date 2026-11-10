import { useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { findStyleProblems, type StyleProblem, type StyleProblemReason } from '@/framework/css/vars';
import { Icon } from './kit';

const WHY: Record< StyleProblemReason, string > = {
	'unknown-control': __( 'not a style setting', 'blicks' ),
	'not-allowed': __( 'this block does not take it', 'blicks' ),
	'unknown-slot': __( 'unknown state or part', 'blicks' ),
	'unknown-breakpoint': __( 'unknown screen size', 'blicks' ),
	'not-on-part': __( 'a ::before or ::after cannot take it', 'blicks' ),
	'invalid-value': __( 'the value is not valid', 'blicks' ),
};

/** The tree without the values the problems name: a whole control, or just that slot and breakpoint. */
export function withoutProblems( tree: Record< string, any >, problems: StyleProblem[] ): Record< string, any > {
	const next: Record< string, any > = { ...tree };
	for ( const p of problems ) {
		if ( ! p.slot ) {
			delete next[ p.id ];
			continue;
		}
		const control = { ...( next[ p.id ] ?? {} ) };
		const slot = { ...( control[ p.slot ] ?? {} ) };
		if ( p.breakpoint ) delete slot[ p.breakpoint ];
		if ( ! p.breakpoint || ! Object.keys( slot ).length ) delete control[ p.slot ];
		else control[ p.slot ] = slot;
		if ( Object.keys( control ).length ) next[ p.id ] = control;
		else delete next[ p.id ];
	}
	return next;
}

/**
 * Style values on this block that the page will not show — set by an agent, a pattern or an older
 * version — named with the reason, so nothing is dropped without anyone knowing.
 */
export function Problems( { attributes, setAttributes, controls }: { attributes: any; setAttributes: ( a: any ) => void; controls?: string[] } ) {
	const [ open, setOpen ] = useState( false );
	const problems = findStyleProblems( attributes.blicks, controls );
	if ( ! problems.length ) return null;
	return (
		<div className="probs" role="status">
			<button type="button" className="probs-h" aria-expanded={ open } onClick={ () => setOpen( ! open ) }>
				<Icon d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" size={ 16 } />
				<span>{ sprintf( _n( '%d style value is not used', '%d style values are not used', problems.length, 'blicks' ), problems.length ) }</span>
				<Icon d={ open ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6' } size={ 14 } />
			</button>
			{ open && (
				<>
					<ul>
						{ problems.map( ( p, i ) => (
							<li key={ i }>
								<code>{ p.id }{ p.slot && p.slot !== 'default' ? ` · ${ p.slot }` : '' }{ p.breakpoint && p.breakpoint !== 'base' ? ` · ${ p.breakpoint }` : '' }</code>
								<span>{ WHY[ p.reason ] }</span>
							</li>
						) ) }
					</ul>
					<button type="button" className="link-x" onClick={ () => setAttributes( { blicks: withoutProblems( attributes.blicks ?? {}, problems ) } ) }>
						{ __( 'Remove them', 'blicks' ) }
					</button>
				</>
			) }
		</div>
	);
}
