import { getValue, setValue } from '@/framework/values';
import { FieldHead, MoreSettings, SubReset, ValueDatalist } from '@/controls/common';
import { lengthOrTokenPattern } from '@/controls/token-utils';
import { TokenCombobox } from '@/controls/TokenCombobox';
import './flex-child.scss';

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
}

const FACTOR_SUGGESTIONS = [ '0', '1', '2', '3' ];
const ORDER_SUGGESTIONS = [ '-2', '-1', '0', '1', '2' ];
// Basis accepts `auto`/`content`, a length, or a `width` token slug — same scale as the Layout
// group's width/height fields (see `valOrToken`/`cssValueForCategory` in the style engine).
const BASIS_PATTERN = lengthOrTokenPattern( 'width', /^(auto|content|0|-?\d+(\.\d+)?(px|%|em|rem|vh|vw))$/ );
const BASIS_LITERALS = [ 'auto', 'content' ];
const ALIGN_SELF_OPTIONS = [ 'auto', 'flex-start', 'flex-end', 'center', 'stretch', 'baseline' ];

function cleanFactor( value: string ): string {
	const trimmed = value.trim();
	if ( trimmed === '' ) return '';
	const n = Number.parseFloat( trimmed );
	return Number.isFinite( n ) && n >= 0 ? String( n ) : '';
}

function cleanOrder( value: string ): string {
	const trimmed = value.trim();
	if ( trimmed === '' ) return '';
	const n = Number.parseInt( trimmed, 10 );
	return Number.isFinite( n ) ? String( n ) : '';
}

function setOrClear(
	attributes: any,
	setAttributes: ( a: any ) => void,
	controlId: string,
	state: string,
	breakpoint: string,
	value: string
) {
	setValue( attributes, setAttributes, controlId, state, breakpoint, value || undefined );
}

function NumberField( {
	value,
	placeholder,
	list,
	clean,
	onChange,
}: {
	value: string;
	placeholder: string;
	list: string;
	clean: ( value: string ) => string;
	onChange: ( value: string ) => void;
} ) {
	return (
		<div className="dim">
			<input
				type="text"
				inputMode="decimal"
				list={ list }
				value={ value }
				placeholder={ placeholder }
				onChange={ ( event ) => onChange( event.currentTarget.value ) }
				onBlur={ ( event ) => onChange( clean( event.currentTarget.value ) ) }
			/>
		</div>
	);
}

/**
 * Flex-child control — the flexbox parallel to `GridChildControl`: how a block behaves as an
 * ITEM inside its parent's flex layout (grow/shrink/basis/order/align-self), shown only when
 * that parent is a flex container (see `useHasFlexParent()` in Inspector.tsx). Reuses
 * `.bl-layout`'s grid2/sub/sub-row/reset foundation styles, same as GridChildControl.
 */
export function FlexChildControl( { attributes, setAttributes, state, breakpoint }: Props ) {
	const grow = getValue( attributes, 'flexChild.grow', state, breakpoint ) || '';
	const shrink = getValue( attributes, 'flexChild.shrink', state, breakpoint ) || '';
	const basis = getValue( attributes, 'flexChild.basis', state, breakpoint ) || '';
	const alignSelf = getValue( attributes, 'flexChild.alignSelf', state, breakpoint ) || '';
	const order = getValue( attributes, 'flexChild.order', state, breakpoint ) || '';

	const setVal = ( controlId: string ) => ( value: string ) =>
		setOrClear( attributes, setAttributes, controlId, state, breakpoint, value );

	return (
		<div className="bl-flex-child bl-layout">
			<ValueDatalist id="bl-flex-child-factor-values" values={ FACTOR_SUGGESTIONS } />
			<ValueDatalist id="bl-flex-child-order-values" values={ ORDER_SUGGESTIONS } />
			<div className="grid2">
				<div>
					<div className="sub-row">
						<span className="sub">Grow</span>
						{ grow && <SubReset onClick={ () => setVal( 'flexChild.grow' )( '' ) } /> }
					</div>
					<NumberField
						value={ grow }
						placeholder="0"
						list="bl-flex-child-factor-values"
						clean={ cleanFactor }
						onChange={ setVal( 'flexChild.grow' ) }
					/>
				</div>
				<div>
					<div className="sub-row">
						<span className="sub">Shrink</span>
						{ shrink && <SubReset onClick={ () => setVal( 'flexChild.shrink' )( '' ) } /> }
					</div>
					<NumberField
						value={ shrink }
						placeholder="1"
						list="bl-flex-child-factor-values"
						clean={ cleanFactor }
						onChange={ setVal( 'flexChild.shrink' ) }
					/>
				</div>
			</div>

			<div className="grid2">
				<div>
					<div className="sub-row">
						<span className="sub">Basis</span>
						{ basis && <SubReset onClick={ () => setVal( 'flexChild.basis' )( '' ) } /> }
					</div>
					<TokenCombobox
						category="width"
						value={ basis }
						placeholder="auto"
						literals={ BASIS_LITERALS }
						pattern={ BASIS_PATTERN }
						onChange={ setVal( 'flexChild.basis' ) }
					/>
				</div>
				<div>
					<div className="sub-row">
						<span className="sub">Align self</span>
						{ alignSelf && <SubReset onClick={ () => setVal( 'flexChild.alignSelf' )( '' ) } /> }
					</div>
					<select value={ alignSelf } onChange={ ( e ) => setOrClear( attributes, setAttributes, 'flexChild.alignSelf', state, breakpoint, e.target.value ) }>
						<option value="">—</option>
						{ ALIGN_SELF_OPTIONS.map( ( v ) => <option key={ v } value={ v }>{ v }</option> ) }
					</select>
				</div>
			</div>

			<MoreSettings label="Order" defaultOpen={ Boolean( order ) }>
			<div className="field" style={ { marginBottom: 0 } }>
				<FieldHead
					label="Order"
					showReset={ Boolean( order ) }
					onReset={ () => setVal( 'flexChild.order' )( '' ) }
				/>
				<NumberField
					value={ order }
					placeholder="0"
					list="bl-flex-child-order-values"
					clean={ cleanOrder }
					onChange={ setVal( 'flexChild.order' ) }
				/>
			</div>
			</MoreSettings>
		</div>
	);
}
