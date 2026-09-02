import { __ } from '@wordpress/i18n';
import { getValue, setValue } from '@/framework/values';
import { FieldHead } from '@/controls/common';
import { DECO_PRESETS } from './presets';
import './decoration.scss';

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
}

type Side = 'before' | 'after';
type DecoVal = Record< string, any >;

const SELECTS: Record< string, string[] > = {
	position: [ 'absolute', 'relative', 'fixed', 'static', 'sticky' ],
	display: [ '', 'block', 'flex', 'inline-flex', 'grid', 'inline-block', 'none' ],
	alignItems: [ '', 'stretch', 'flex-start', 'center', 'flex-end', 'baseline' ],
	justifyContent: [ '', 'flex-start', 'center', 'flex-end', 'space-between', 'space-around' ],
	flexDirection: [ '', 'row', 'column', 'row-reverse', 'column-reverse' ],
	flexWrap: [ '', 'nowrap', 'wrap', 'wrap-reverse' ],
	textAlign: [ '', 'left', 'center', 'right', 'justify' ],
	textTransform: [ '', 'none', 'uppercase', 'lowercase', 'capitalize' ],
	textDecoration: [ '', 'none', 'underline', 'line-through', 'overline' ],
	whiteSpace: [ '', 'normal', 'nowrap', 'pre', 'pre-wrap' ],
	overflow: [ '', 'visible', 'hidden', 'auto', 'clip', 'scroll' ],
	backgroundRepeat: [ '', 'no-repeat', 'repeat', 'repeat-x', 'repeat-y' ],
	backgroundClip: [ '', 'border-box', 'padding-box', 'content-box', 'text' ],
	mixBlendMode: [ '', 'normal', 'multiply', 'screen', 'overlay', 'difference', 'soft-light', 'color-dodge' ],
	pointerEvents: [ '', 'auto', 'none' ],
};

function DecoPanel( {
	side,
	value,
	onChange,
}: {
	side: Side;
	value: DecoVal;
	onChange: ( next: DecoVal | undefined ) => void;
} ) {
	const enabled = Boolean( value?.enabled );
	const patch = ( delta: Partial< DecoVal > ) => onChange( { ...value, ...delta } );
	const set = ( key: string ) => ( v: string ) => patch( { [ key ]: v || undefined } );
	const insetStr = typeof value.inset === 'string' ? value.inset : '';

	// Field factories — keep the (large) panel terse.
	const Txt = ( label: string, key: string, ph = '' ) => (
		<label className="bl-deco-field">
			<span>{ label }</span>
			<input value={ value[ key ] ?? '' } placeholder={ ph } onChange={ ( e ) => set( key )( e.target.value ) } />
		</label>
	);
	const Sel = ( label: string, key: string ) => (
		<label className="bl-deco-field">
			<span>{ label }</span>
			<select value={ value[ key ] ?? '' } onChange={ ( e ) => set( key )( e.target.value ) }>
				{ SELECTS[ key ].map( ( o ) => (
					<option key={ o } value={ o }>{ o || __( '— default —', 'blicks' ) }</option>
				) ) }
			</select>
		</label>
	);
	const Group = ( title: string, open: boolean, children: React.ReactNode ) => (
		<details className="bl-deco-group" open={ open }>
			<summary>{ title }</summary>
			<div className="bl-deco-grid">{ children }</div>
		</details>
	);

	return (
		<div className="bl-deco-panel">
			<div className="field">
				<FieldHead
					label={ side === 'before' ? __( '::before', 'blicks' ) : __( '::after', 'blicks' ) }
					showReset={ Boolean( value && Object.keys( value ).length ) }
					onReset={ () => onChange( undefined ) }
				/>
				<label className="bl-deco-enable">
					<input type="checkbox" checked={ enabled } onChange={ ( e ) => patch( { enabled: e.target.checked } ) } />
					{ __( 'Enable', 'blicks' ) }
				</label>
			</div>

			{ enabled && (
				<>
					{ Group( __( 'Content & position', 'blicks' ), true, <>
						<label className="bl-deco-field bl-deco-field--wide">
							<span>{ __( 'Content', 'blicks' ) }</span>
							<input value={ value.content ?? '' } placeholder={ '"" · counter(item) · attr(data-x)' } onChange={ ( e ) => set( 'content' )( e.target.value ) } />
						</label>
						{ Sel( __( 'Position', 'blicks' ), 'position' ) }
						{ Sel( __( 'Pointer events', 'blicks' ), 'pointerEvents' ) }
						{ Txt( __( 'z-index', 'blicks' ), 'zIndex', '-1 · 0 · 1' ) }
					</> ) }

					{ Group( __( 'Size', 'blicks' ), true, <>
						{ Txt( __( 'Width', 'blicks' ), 'width', '40px' ) }
						{ Txt( __( 'Height', 'blicks' ), 'height', '40px' ) }
						{ Txt( __( 'Min width', 'blicks' ), 'minWidth' ) }
						{ Txt( __( 'Max width', 'blicks' ), 'maxWidth' ) }
						{ Txt( __( 'Min height', 'blicks' ), 'minHeight' ) }
						{ Txt( __( 'Max height', 'blicks' ), 'maxHeight' ) }
						{ Txt( __( 'Aspect ratio', 'blicks' ), 'aspectRatio', '1 / 1' ) }
						{ Sel( __( 'Overflow', 'blicks' ), 'overflow' ) }
					</> ) }

					{ Group( __( 'Spacing', 'blicks' ), false, <>
						<label className="bl-deco-field bl-deco-field--wide">
							<span>{ __( 'Inset', 'blicks' ) }</span>
							<input value={ insetStr } placeholder="0 auto auto 0" onChange={ ( e ) => set( 'inset' )( e.target.value ) } />
						</label>
						{ Txt( __( 'Margin', 'blicks' ), 'margin' ) }
						{ Txt( __( 'Padding', 'blicks' ), 'padding' ) }
						{ Txt( __( 'Gap', 'blicks' ), 'gap' ) }
					</> ) }

					{ Group( __( 'Layout', 'blicks' ), false, <>
						{ Sel( __( 'Display', 'blicks' ), 'display' ) }
						{ Sel( __( 'Direction', 'blicks' ), 'flexDirection' ) }
						{ Sel( __( 'Align items', 'blicks' ), 'alignItems' ) }
						{ Sel( __( 'Justify', 'blicks' ), 'justifyContent' ) }
						{ Sel( __( 'Wrap', 'blicks' ), 'flexWrap' ) }
					</> ) }

					{ Group( __( 'Border', 'blicks' ), false, <>
						{ Txt( __( 'Border', 'blicks' ), 'border', '1px solid #000' ) }
						{ Txt( __( 'Radius', 'blicks' ), 'borderRadius', '50%' ) }
						{ Txt( __( 'Outline', 'blicks' ), 'outline' ) }
					</> ) }

					{ Group( __( 'Background', 'blicks' ), false, <>
						<label className="bl-deco-field bl-deco-field--wide">
							<span>{ __( 'Background', 'blicks' ) }</span>
							<input value={ typeof value.background === 'string' ? value.background : ( value.bgColor ?? '' ) } placeholder="#000 · linear-gradient(...)" onChange={ ( e ) => patch( { background: e.target.value || undefined, bgColor: undefined } ) } />
						</label>
						<label className="bl-deco-field bl-deco-field--wide">
							<span>{ __( 'Image', 'blicks' ) }</span>
							<input value={ value.backgroundImage ?? '' } placeholder="url(...)" onChange={ ( e ) => set( 'backgroundImage' )( e.target.value ) } />
						</label>
						{ Txt( __( 'Size', 'blicks' ), 'backgroundSize', 'cover' ) }
						{ Txt( __( 'Position', 'blicks' ), 'backgroundPosition', 'center' ) }
						{ Sel( __( 'Repeat', 'blicks' ), 'backgroundRepeat' ) }
						{ Sel( __( 'Clip', 'blicks' ), 'backgroundClip' ) }
					</> ) }

					{ Group( __( 'Typography', 'blicks' ), false, <>
						{ Txt( __( 'Color', 'blicks' ), 'color', '#fff' ) }
						{ Txt( __( 'Font family', 'blicks' ), 'fontFamily' ) }
						{ Txt( __( 'Font size', 'blicks' ), 'fontSize', '14px' ) }
						{ Txt( __( 'Font weight', 'blicks' ), 'fontWeight', '600' ) }
						{ Sel( __( 'Transform', 'blicks' ), 'textTransform' ) }
						{ Sel( __( 'Decoration', 'blicks' ), 'textDecoration' ) }
						{ Sel( __( 'Align', 'blicks' ), 'textAlign' ) }
						{ Sel( __( 'White space', 'blicks' ), 'whiteSpace' ) }
						{ Txt( __( 'Line height', 'blicks' ), 'lineHeight' ) }
						{ Txt( __( 'Letter spacing', 'blicks' ), 'letterSpacing' ) }
						{ Txt( __( 'Word spacing', 'blicks' ), 'wordSpacing' ) }
					</> ) }

					{ Group( __( 'Effects', 'blicks' ), false, <>
						{ Txt( __( 'Opacity', 'blicks' ), 'opacity', '0–1' ) }
						{ Txt( __( 'Blur', 'blicks' ), 'blur', '20px' ) }
						{ Txt( __( 'Filter', 'blicks' ), 'filter', 'brightness(1.2)' ) }
						{ Txt( __( 'Backdrop filter', 'blicks' ), 'backdropFilter', 'blur(8px)' ) }
						{ Txt( __( 'Box shadow', 'blicks' ), 'boxShadow' ) }
						{ Txt( __( 'Clip path', 'blicks' ), 'clipPath', 'circle(50%)' ) }
						{ Txt( __( 'Mask', 'blicks' ), 'mask' ) }
						{ Sel( __( 'Blend mode', 'blicks' ), 'mixBlendMode' ) }
					</> ) }

					{ Group( __( 'Motion & transform', 'blicks' ), false, <>
						{ Txt( __( 'Transform', 'blicks' ), 'transform', 'rotate(45deg)' ) }
						{ Txt( __( 'Origin', 'blicks' ), 'transformOrigin', 'center' ) }
						{ Txt( __( 'Rotate', 'blicks' ), 'rotate', '45deg' ) }
						{ Txt( __( 'Scale', 'blicks' ), 'scale', '1.1' ) }
						{ Txt( __( 'Transition', 'blicks' ), 'transition', 'all .3s ease' ) }
						{ Txt( __( 'Animation', 'blicks' ), 'animation' ) }
						{ Txt( __( 'Cursor', 'blicks' ), 'cursor', 'pointer' ) }
					</> ) }
				</>
			) }
		</div>
	);
}

export function DecorationControl( { attributes, setAttributes, state, breakpoint }: Props ) {
	const before = ( getValue( attributes, 'decoration.before', state, breakpoint ) || {} ) as DecoVal;
	const after  = ( getValue( attributes, 'decoration.after',  state, breakpoint ) || {} ) as DecoVal;
	const counterReset     = String( getValue( attributes, 'decoration.counterReset',     state, breakpoint ) || '' );
	const counterIncrement = String( getValue( attributes, 'decoration.counterIncrement', state, breakpoint ) || '' );

	const setDeco = ( side: Side ) => ( next: DecoVal | undefined ) =>
		setValue( attributes, setAttributes, `decoration.${ side }`, state, breakpoint, next );

	const setCnt = ( id: string, v: string ) =>
		setValue( attributes, setAttributes, id, state, breakpoint, v || undefined );

	// Apply a preset to ::before. Also set the block to position:relative (unless already positioned)
	// so the absolutely-positioned mark anchors to the block instead of the page.
	const applyPreset = ( value: Record< string, any > ) => {
		setValue( attributes, setAttributes, 'decoration.before', state, breakpoint, value );
		const pos = String( getValue( attributes, 'position.type', state, breakpoint ) || '' );
		if ( ! pos || pos === 'static' ) {
			setValue( attributes, setAttributes, 'position.type', state, breakpoint, 'relative' );
		}
	};

	return (
		<div className="bl-decoration">
			<div className="bl-deco-presets">
				<span className="sub">{ __( 'Presets', 'blicks' ) }</span>
				<div className="bl-deco-presets__grid">
					{ DECO_PRESETS.map( ( preset ) => (
						<button
							key={ preset.id }
							type="button"
							className="bl-deco-presets__btn"
							title={ preset.label }
							onClick={ () => applyPreset( preset.value ) }
						>
							{ preset.label }
						</button>
					) ) }
				</div>
			</div>
			<hr />
			<DecoPanel side="before" value={ before } onChange={ setDeco( 'before' ) } />
			<hr />
			<DecoPanel side="after"  value={ after }  onChange={ setDeco( 'after' ) } />
			<hr />
			<div className="grid2">
				<div>
					<div className="sub-row"><span className="sub">{ __( 'counter-reset', 'blicks' ) }</span></div>
					<input className="dim__inner" placeholder="item" value={ counterReset } onChange={ ( e ) => setCnt( 'decoration.counterReset', e.target.value ) } />
				</div>
				<div>
					<div className="sub-row"><span className="sub">{ __( 'counter-increment', 'blicks' ) }</span></div>
					<input className="dim__inner" placeholder="item" value={ counterIncrement } onChange={ ( e ) => setCnt( 'decoration.counterIncrement', e.target.value ) } />
				</div>
			</div>
		</div>
	);
}
