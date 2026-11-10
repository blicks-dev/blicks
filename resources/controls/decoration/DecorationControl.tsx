import { __ } from '@wordpress/i18n';
import { getValue, setValue } from '@/framework/values';
import { FieldHead } from '@/controls/common';
import { ELEMENT_PART, PART_IDS, parseSlot, partSuffix, slotId } from '@/framework/parts';
import { DECO_PRESETS } from './presets';
import './decoration.scss';

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	/** The composed value-tree slot (part + state). */
	state: string;
	breakpoint: string;
	part?: string;
	setPart?: ( id: string ) => void;
}

/**
 * The **Pseudo-elements** facet.
 *
 * A `::before` or `::after` is styled by switching the context bar's part and using the ordinary
 * facets — the same tokens, breakpoints, states and resets the element gets. This facet keeps only
 * what has no home elsewhere:
 *
 *  - **`content`**, which belongs to a pseudo-element and nothing else, shown while a part is
 *    selected because that is the slot it writes into;
 *  - the **presets**, whole looks rather than one property;
 *  - the **counters**, set on the element and read by its pseudo-elements.
 */
export function DecorationControl( { attributes, setAttributes, state, breakpoint, part, setPart }: Props ) {
	const activePart = part ?? parseSlot( state ).part;
	const onPart = activePart !== ELEMENT_PART;

	const content = String( getValue( attributes, 'decoration.content', state, breakpoint ) ?? '' );
	const counterReset = String( getValue( attributes, 'decoration.counterReset', state, breakpoint ) || '' );
	const counterIncrement = String( getValue( attributes, 'decoration.counterIncrement', state, breakpoint ) || '' );

	const set = ( id: string, v: string ) => setValue( attributes, setAttributes, id, state, breakpoint, v || undefined );

	/**
	 * Write a preset into `::before`'s base slot in one batch, anchor the block, then switch the
	 * part to it so the next edit lands on the mark that just appeared.
	 */
	const applyPreset = ( values: Record< string, unknown > ) => {
		const blicks: Record< string, any > = { ...( attributes.blicks ?? {} ) };
		const target = slotId( 'before', 'default' );
		for ( const [ id, value ] of Object.entries( values ) ) {
			blicks[ id ] = { ...( blicks[ id ] ?? {} ), [ target ]: { base: value } };
		}
		const position = String( getValue( attributes, 'position.type', 'default', 'base' ) || '' );
		if ( ! position || position === 'static' ) {
			blicks[ 'position.type' ] = { ...( blicks[ 'position.type' ] ?? {} ), default: { base: 'relative' } };
		}
		setAttributes( { blicks } );
		setPart?.( 'before' );
	};

	return (
		<div className="bl-decoration">
			{ onPart ? (
				<div className="field">
					<FieldHead
						label={ __( 'Content', 'blicks' ) }
						showReset={ content !== '' }
						onReset={ () => set( 'decoration.content', '' ) }
					/>
					<input
						className="dim__inner"
						value={ content }
						placeholder={ '"" · counter(item) · attr(data-x)' }
						onChange={ ( e ) => set( 'decoration.content', e.target.value ) }
					/>
					<p className="bl-deco-hint">
						{ /* translators: %s: a CSS pseudo-element, e.g. ::before */
						  __( '%s renders once anything is set on it; leave content empty for a shape.', 'blicks' ).replace( '%s', partSuffix( activePart ) ) }
					</p>
				</div>
			) : (
				<div className="field">
					<FieldHead label={ __( 'Pseudo-elements', 'blicks' ) } />
					<p className="bl-deco-hint">
						{ __( 'Pick a part, then style it with any facet — spacing, type, border, effects, states and breakpoints all apply.', 'blicks' ) }
					</p>
					<div className="bl-deco-parts">
						{ PART_IDS.filter( ( id ) => id !== ELEMENT_PART ).map( ( id ) => (
							<button key={ id } type="button" className="bl-deco-presets__btn" disabled={ ! setPart } onClick={ () => setPart?.( id ) }>
								{ partSuffix( id ) }
							</button>
						) ) }
					</div>
				</div>
			) }

			<hr />

			<div className="bl-deco-presets">
				<span className="sub">{ __( 'Presets', 'blicks' ) }</span>
				<div className="bl-deco-presets__grid">
					{ DECO_PRESETS.map( ( preset ) => (
						<button key={ preset.id } type="button" className="bl-deco-presets__btn" title={ preset.label } onClick={ () => applyPreset( preset.values ) }>
							{ preset.label }
						</button>
					) ) }
				</div>
			</div>

			<hr />

			<div className="grid2">
				<div>
					<div className="sub-row"><span className="sub">{ __( 'counter-reset', 'blicks' ) }</span></div>
					<input className="dim__inner" placeholder="item" value={ counterReset } onChange={ ( e ) => set( 'decoration.counterReset', e.target.value ) } />
				</div>
				<div>
					<div className="sub-row"><span className="sub">{ __( 'counter-increment', 'blicks' ) }</span></div>
					<input className="dim__inner" placeholder="item" value={ counterIncrement } onChange={ ( e ) => set( 'decoration.counterIncrement', e.target.value ) } />
				</div>
			</div>
		</div>
	);
}
