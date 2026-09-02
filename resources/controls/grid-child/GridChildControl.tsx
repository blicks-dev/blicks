import { getValue, setValue } from '@/framework/values';
import { FieldHead, MoreSettings, SubReset, ValueDatalist } from '@/controls/common';
import './grid-child.scss';

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
}

const SPAN_SUGGESTIONS = [ '1', '2', '3', '4', '6', '12' ];
const ORDER_SUGGESTIONS = [ '-2', '-1', '0', '1', '2' ];

function cleanSpan( value: string ): string {
	const n = Number.parseInt( value, 10 );
	if ( ! Number.isFinite( n ) ) return '';
	return String( Math.max( 1, Math.min( 12, n ) ) );
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

function IconBtn( {
	active,
	title,
	onClick,
	children,
}: {
	active?: boolean;
	title: string;
	onClick: () => void;
	children: React.ReactNode;
} ) {
	return (
		<button
			type="button"
			title={ title }
			className={ active ? 'is-active' : '' }
			onClick={ onClick }
		>
			{ children }
		</button>
	);
}

function IconSeg( {
	fill,
	children,
}: {
	fill?: boolean;
	children: React.ReactNode;
} ) {
	return <div className={ `iconseg ${ fill ? 'fill' : '' }` }>{ children }</div>;
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
				inputMode="numeric"
				list={ list }
				value={ value }
				placeholder={ placeholder }
				onChange={ ( event ) => onChange( event.currentTarget.value ) }
				onBlur={ ( event ) => onChange( clean( event.currentTarget.value ) ) }
			/>
		</div>
	);
}

export function GridChildControl( { attributes, setAttributes, state, breakpoint }: Props ) {
	const columnSpan = getValue( attributes, 'gridChild.columnSpan', state, breakpoint ) || '';
	const rowSpan = getValue( attributes, 'gridChild.rowSpan', state, breakpoint ) || '';
	const alignSelf = getValue( attributes, 'gridChild.alignSelf', state, breakpoint ) || '';
	const justifySelf = getValue( attributes, 'gridChild.justifySelf', state, breakpoint ) || '';
	const order = getValue( attributes, 'gridChild.order', state, breakpoint ) || '';
	const gridArea = getValue( attributes, 'gridChild.gridArea', state, breakpoint ) || '';
	const scrollSnapAlign = getValue( attributes, 'gridChild.scrollSnapAlign', state, breakpoint ) || '';

	const setVal = ( controlId: string ) => ( value: string ) =>
		setOrClear( attributes, setAttributes, controlId, state, breakpoint, value );

	const setClick = ( controlId: string, value: string ) => () =>
		setOrClear( attributes, setAttributes, controlId, state, breakpoint, value );

	return (
		<div className="bl-grid-child bl-layout">
			<ValueDatalist id="bl-grid-child-span-values" values={ SPAN_SUGGESTIONS } />
			<ValueDatalist id="bl-grid-child-order-values" values={ ORDER_SUGGESTIONS } />
			<div className="grid2">
				<div>
					<div className="sub-row">
						<span className="sub">Column span</span>
						{ columnSpan && <SubReset onClick={ () => setVal( 'gridChild.columnSpan' )( '' ) } /> }
					</div>
					<NumberField
						value={ columnSpan }
						placeholder="1"
						list="bl-grid-child-span-values"
						clean={ cleanSpan }
						onChange={ setVal( 'gridChild.columnSpan' ) }
					/>
				</div>
				<div>
					<div className="sub-row">
						<span className="sub">Row span</span>
						{ rowSpan && <SubReset onClick={ () => setVal( 'gridChild.rowSpan' )( '' ) } /> }
					</div>
					<NumberField
						value={ rowSpan }
						placeholder="1"
						list="bl-grid-child-span-values"
						clean={ cleanSpan }
						onChange={ setVal( 'gridChild.rowSpan' ) }
					/>
				</div>
			</div>

			<div className="grid2">
				<div className="field">
					<FieldHead
						label="Justify self"
						showReset={ Boolean( justifySelf ) }
						onReset={ () => setVal( 'gridChild.justifySelf' )( '' ) }
					/>
					<IconSeg fill>
						<IconBtn title="Start" active={ justifySelf === 'start' } onClick={ setClick( 'gridChild.justifySelf', 'start' ) }>
							<svg viewBox="0 0 24 24" fill="currentColor">
								<rect x="3" y="5" width="4" height="14" />
							</svg>
						</IconBtn>
						<IconBtn title="Center" active={ justifySelf === 'center' } onClick={ setClick( 'gridChild.justifySelf', 'center' ) }>
							<svg viewBox="0 0 24 24" fill="currentColor">
								<rect x="10" y="5" width="4" height="14" />
							</svg>
						</IconBtn>
						<IconBtn title="End" active={ justifySelf === 'end' } onClick={ setClick( 'gridChild.justifySelf', 'end' ) }>
							<svg viewBox="0 0 24 24" fill="currentColor">
								<rect x="17" y="5" width="4" height="14" />
							</svg>
						</IconBtn>
						<IconBtn title="Stretch" active={ justifySelf === 'stretch' } onClick={ setClick( 'gridChild.justifySelf', 'stretch' ) }>
							<svg viewBox="0 0 24 24" fill="currentColor">
								<rect x="4" y="5" width="16" height="14" />
							</svg>
						</IconBtn>
					</IconSeg>
				</div>

				<div className="field">
					<FieldHead
						label="Align self"
						showReset={ Boolean( alignSelf ) }
						onReset={ () => setVal( 'gridChild.alignSelf' )( '' ) }
					/>
					<IconSeg fill>
						<IconBtn title="Start" active={ alignSelf === 'start' } onClick={ setClick( 'gridChild.alignSelf', 'start' ) }>
							<svg viewBox="0 0 24 24" fill="currentColor">
								<rect x="5" y="3" width="14" height="4" />
							</svg>
						</IconBtn>
						<IconBtn title="Center" active={ alignSelf === 'center' } onClick={ setClick( 'gridChild.alignSelf', 'center' ) }>
							<svg viewBox="0 0 24 24" fill="currentColor">
								<rect x="5" y="10" width="14" height="4" />
							</svg>
						</IconBtn>
						<IconBtn title="End" active={ alignSelf === 'end' } onClick={ setClick( 'gridChild.alignSelf', 'end' ) }>
							<svg viewBox="0 0 24 24" fill="currentColor">
								<rect x="5" y="17" width="14" height="4" />
							</svg>
						</IconBtn>
						<IconBtn title="Stretch" active={ alignSelf === 'stretch' } onClick={ setClick( 'gridChild.alignSelf', 'stretch' ) }>
							<svg viewBox="0 0 24 24" fill="currentColor">
								<rect x="5" y="4" width="14" height="16" />
							</svg>
						</IconBtn>
					</IconSeg>
				</div>
			</div>

			<MoreSettings label="Placement & order" defaultOpen={ Boolean( order || gridArea || scrollSnapAlign ) }>
			<div className="field">
				<FieldHead
					label="Order"
					showReset={ Boolean( order ) }
					onReset={ () => setVal( 'gridChild.order' )( '' ) }
				/>
				<NumberField
					value={ order }
					placeholder="0"
					list="bl-grid-child-order-values"
					clean={ cleanOrder }
					onChange={ setVal( 'gridChild.order' ) }
				/>
			</div>

			<div className="field">
				<FieldHead
					label="Grid area"
					showReset={ Boolean( gridArea ) }
					onReset={ () => setVal( 'gridChild.gridArea' )( '' ) }
				/>
				<div className="dim">
					<input
						type="text"
						value={ gridArea }
						placeholder="e.g. header"
						onChange={ ( e ) => setVal( 'gridChild.gridArea' )( e.target.value ) }
						onBlur={ ( e ) => setVal( 'gridChild.gridArea' )( e.target.value.trim() ) }
					/>
				</div>
			</div>

			<div className="field" style={ { marginBottom: 0 } }>
				<FieldHead
					label="Snap align"
					showReset={ Boolean( scrollSnapAlign ) }
					onReset={ () => setVal( 'gridChild.scrollSnapAlign' )( '' ) }
				/>
				<IconSeg fill>
					{ ( [ [ 'none', 'None' ], [ 'start', 'Start' ], [ 'center', 'Center' ], [ 'end', 'End' ] ] as Array< [ string, string ] > ).map( ( [ v, label ] ) => (
						<IconBtn key={ v } title={ label } active={ scrollSnapAlign === v } onClick={ setClick( 'gridChild.scrollSnapAlign', v ) }>{ label }</IconBtn>
					) ) }
				</IconSeg>
			</div>
			</MoreSettings>
		</div>
	);
}
