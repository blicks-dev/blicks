import { __ } from '@wordpress/i18n';
import { getValue, setValue, setValueSlots } from '@/framework/values';
import { FieldHead, MoreSettings, SubReset, ValueDatalist } from '@/controls/common';
import './scene-child.scss';

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
}

/**
 * The nine anchor slugs, as `bl-sca--{slug}` in runtime.scss. The centre one is `center`, not
 * `center-center` — it reads better in markup and is the value authors see most often.
 */
type VPart = 'top' | 'center' | 'bottom';
type HPart = 'left' | 'center' | 'right';

const V_PARTS: VPart[] = [ 'top', 'center', 'bottom' ];
const H_PARTS: HPart[] = [ 'left', 'center', 'right' ];

function anchorSlug( v: VPart, h: HPart ): string {
	return v === 'center' && h === 'center' ? 'center' : `${ v }-${ h }`;
}

/** Unset anchors to `top-left` — the CSS default, and what a freshly dropped item behaves like. */
function anchorParts( slug: unknown ): [ VPart, HPart ] {
	const s = String( slug ?? '' ).trim();
	if ( s === '' ) return [ 'top', 'left' ];
	if ( s === 'center' ) return [ 'center', 'center' ];
	const [ v, h ] = s.split( '-' );
	return [
		V_PARTS.includes( v as VPart ) ? ( v as VPart ) : 'top',
		H_PARTS.includes( h as HPart ) ? ( h as HPart ) : 'left',
	];
}

/**
 * Aligning to an edge is two writes, not one: the coordinate moves to the edge AND the anchor
 * moves to the matching corner of the item. Setting only the coordinate would hang the item's
 * top-left on the right edge, pushing it entirely outside the stage.
 */
const H_ALIGN: Array< { part: HPart; x: string; title: string; icon: JSX.Element } > = [
	{ part: 'left', x: '0', title: __( 'Align left', 'blicks' ), icon: <><path d="M4 4v16" /><rect x="7" y="7" width="11" height="4" /><rect x="7" y="14" width="7" height="4" /></> },
	{ part: 'center', x: '50%', title: __( 'Align centre', 'blicks' ), icon: <><path d="M12 4v16" /><rect x="5" y="7" width="14" height="4" /><rect x="8" y="14" width="8" height="4" /></> },
	{ part: 'right', x: '100%', title: __( 'Align right', 'blicks' ), icon: <><path d="M20 4v16" /><rect x="6" y="7" width="11" height="4" /><rect x="10" y="14" width="7" height="4" /></> },
];

const V_ALIGN: Array< { part: VPart; y: string; title: string; icon: JSX.Element } > = [
	{ part: 'top', y: '0', title: __( 'Align top', 'blicks' ), icon: <><path d="M4 4h16" /><rect x="7" y="7" width="4" height="11" /><rect x="14" y="7" width="4" height="7" /></> },
	{ part: 'center', y: '50%', title: __( 'Align middle', 'blicks' ), icon: <><path d="M4 12h16" /><rect x="7" y="5" width="4" height="14" /><rect x="14" y="8" width="4" height="8" /></> },
	{ part: 'bottom', y: '100%', title: __( 'Align bottom', 'blicks' ), icon: <><path d="M4 20h16" /><rect x="7" y="6" width="4" height="11" /><rect x="14" y="10" width="4" height="7" /></> },
];

const ANCHOR_OPTIONS: Array< { value: string; label: string } > = [
	{ value: 'top-left', label: __( 'Top left', 'blicks' ) },
	{ value: 'top-center', label: __( 'Top centre', 'blicks' ) },
	{ value: 'top-right', label: __( 'Top right', 'blicks' ) },
	{ value: 'center-left', label: __( 'Middle left', 'blicks' ) },
	{ value: 'center', label: __( 'Centre', 'blicks' ) },
	{ value: 'center-right', label: __( 'Middle right', 'blicks' ) },
	{ value: 'bottom-left', label: __( 'Bottom left', 'blicks' ) },
	{ value: 'bottom-center', label: __( 'Bottom centre', 'blicks' ) },
	{ value: 'bottom-right', label: __( 'Bottom right', 'blicks' ) },
];

const COORD_SUGGESTIONS = [ '0', '50%', '100%', '120px' ];
const SIZE_SUGGESTIONS = [ 'auto', '100%', '320px', '640px' ];
const SCALE_SUGGESTIONS = [ '0.5', '1', '1.5', '2' ];
const ROTATE_SUGGESTIONS = [ '-15deg', '0deg', '15deg', '90deg' ];

/** A design-pixel length, a percentage of the stage, or `auto` for the size fields. */
const COORD_PATTERN = /^(0|-?\d+(\.\d+)?(px|%|em|rem))$/;
const SIZE_PATTERN = /^(auto|0|\d+(\.\d+)?(px|%|em|rem))$/;
const SCALE_PATTERN = /^\d+(\.\d+)?$/;
const ROTATE_PATTERN = /^-?\d+(\.\d+)?(deg|turn|rad)$/;

function clean( value: string, pattern: RegExp ): string {
	const trimmed = value.trim();
	if ( trimmed === '' ) return '';
	return pattern.test( trimmed ) ? trimmed : '';
}

/** A bare number is the common case for a coordinate — treat it as design pixels. */
function cleanCoord( value: string ): string {
	const trimmed = value.trim();
	if ( /^-?\d+(\.\d+)?$/.test( trimmed ) ) return trimmed === '0' ? '0' : `${ trimmed }px`;
	return clean( trimmed, COORD_PATTERN );
}

function cleanSize( value: string ): string {
	const trimmed = value.trim();
	if ( /^\d+(\.\d+)?$/.test( trimmed ) ) return `${ trimmed }px`;
	return clean( trimmed, SIZE_PATTERN );
}

/** Rotation is nearly always typed as a bare number of degrees. */
function cleanRotate( value: string ): string {
	const trimmed = value.trim();
	if ( /^-?\d+(\.\d+)?$/.test( trimmed ) ) return `${ trimmed }deg`;
	return clean( trimmed, ROTATE_PATTERN );
}

function Field( {
	label,
	value,
	placeholder,
	list,
	onCommit,
	onReset,
}: {
	label: string;
	value: string;
	placeholder: string;
	list: string;
	onCommit: ( v: string ) => void;
	onReset: () => void;
} ) {
	return (
		<div>
			<div className="sub-row">
				<span className="sub">{ label }</span>
				{ value && <SubReset onClick={ onReset } /> }
			</div>
			<div className="dim">
				<input
					type="text"
					inputMode="decimal"
					list={ list }
					value={ value }
					placeholder={ placeholder }
					onChange={ ( event ) => onCommit( event.currentTarget.value ) }
					onBlur={ ( event ) => onCommit( event.currentTarget.value ) }
				/>
			</div>
		</div>
	);
}

const ico = ( path: JSX.Element ): JSX.Element => (
	<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
		{ path }
	</svg>
);

/**
 * Scene-child control — where a block sits on its parent `blicks/scene` stage, shown only when
 * that parent is a scene (see `useHasSceneParent()` in Inspector.tsx). The stage parallel to
 * `GridChildControl` / `FlexChildControl`, and it reuses `.bl-layout`'s grid2/sub/sub-row
 * foundation the same way they do.
 *
 * Coordinates are DESIGN pixels against the scene's design size, so they carry no per-breakpoint
 * authoring: the stage scales as one piece and the composition holds at every width.
 */
export function SceneChildControl( { attributes, setAttributes, state, breakpoint }: Props ) {
	const read = ( id: string ) => String( getValue( attributes, id, state, breakpoint ) ?? '' );

	const x = read( 'sceneChild.x' );
	const y = read( 'sceneChild.y' );
	const width = read( 'sceneChild.width' );
	const height = read( 'sceneChild.height' );
	const scale = read( 'sceneChild.scale' );
	const rotate = read( 'sceneChild.rotate' );
	const anchor = read( 'sceneChild.anchor' );

	const [ vPart, hPart ] = anchorParts( anchor );

	const write = ( id: string, value: string ) =>
		setValue( attributes, setAttributes, id, state, breakpoint, value || undefined );

	// The anchor is a base/default-slot enum (one class, no var), so it is always written to the
	// default state at the base breakpoint regardless of which slot the inspector is showing.
	const writeAnchor = ( slug: string ) =>
		setValue( attributes, setAttributes, 'sceneChild.anchor', 'default', 'base', slug || undefined );

	// Aligning moves the coordinate AND the anchor. They go through `setValueSlots` because they
	// live in different slots — the coordinate on whichever breakpoint is being edited, the anchor
	// always on base — and two separate writes would derive from the same stale snapshot, so only
	// the second would survive.
	const align = ( controlId: string, coord: string, slug: string ) =>
		setValueSlots( attributes, setAttributes, [
			{ controlId, state, breakpoint, value: coord || undefined },
			{ controlId: 'sceneChild.anchor', state: 'default', breakpoint: 'base', value: slug || undefined },
		] );

	const alignH = ( part: HPart, coord: string ) => align( 'sceneChild.x', coord, anchorSlug( vPart, part ) );
	const alignV = ( part: VPart, coord: string ) => align( 'sceneChild.y', coord, anchorSlug( part, hPart ) );

	return (
		<div className="bl-scene-child bl-layout">
			<ValueDatalist id="bl-scene-child-coord" values={ COORD_SUGGESTIONS } />
			<ValueDatalist id="bl-scene-child-size" values={ SIZE_SUGGESTIONS } />
			<ValueDatalist id="bl-scene-child-scale" values={ SCALE_SUGGESTIONS } />
			<ValueDatalist id="bl-scene-child-rotate" values={ ROTATE_SUGGESTIONS } />

			<div className="bl-scene-child__align">
				<div className="seg-row" role="radiogroup" aria-label={ __( 'Horizontal alignment', 'blicks' ) }>
					{ H_ALIGN.map( ( item ) => (
						<button
							key={ item.part }
							type="button"
							role="radio"
							aria-checked={ hPart === item.part }
							className={ hPart === item.part ? 'on' : '' }
							title={ item.title }
							aria-label={ item.title }
							onClick={ () => alignH( item.part, item.x ) }
						>
							{ ico( item.icon ) }
						</button>
					) ) }
				</div>
				<div className="seg-row" role="radiogroup" aria-label={ __( 'Vertical alignment', 'blicks' ) }>
					{ V_ALIGN.map( ( item ) => (
						<button
							key={ item.part }
							type="button"
							role="radio"
							aria-checked={ vPart === item.part }
							className={ vPart === item.part ? 'on' : '' }
							title={ item.title }
							aria-label={ item.title }
							onClick={ () => alignV( item.part, item.y ) }
						>
							{ ico( item.icon ) }
						</button>
					) ) }
				</div>
			</div>

			<div className="grid2">
				<Field
					label="X"
					value={ x }
					placeholder="0"
					list="bl-scene-child-coord"
					onCommit={ ( v ) => write( 'sceneChild.x', cleanCoord( v ) ) }
					onReset={ () => write( 'sceneChild.x', '' ) }
				/>
				<Field
					label="Y"
					value={ y }
					placeholder="0"
					list="bl-scene-child-coord"
					onCommit={ ( v ) => write( 'sceneChild.y', cleanCoord( v ) ) }
					onReset={ () => write( 'sceneChild.y', '' ) }
				/>
			</div>

			<div className="grid2">
				<Field
					label={ __( 'Scale', 'blicks' ) }
					value={ scale }
					placeholder="1"
					list="bl-scene-child-scale"
					onCommit={ ( v ) => write( 'sceneChild.scale', clean( v, SCALE_PATTERN ) ) }
					onReset={ () => write( 'sceneChild.scale', '' ) }
				/>
				<Field
					label={ __( 'Rotation', 'blicks' ) }
					value={ rotate }
					placeholder="0deg"
					list="bl-scene-child-rotate"
					onCommit={ ( v ) => write( 'sceneChild.rotate', cleanRotate( v ) ) }
					onReset={ () => write( 'sceneChild.rotate', '' ) }
				/>
			</div>

			<div className="field">
				<FieldHead
					label={ __( 'Origin', 'blicks' ) }
					showReset={ Boolean( anchor ) }
					onReset={ () => writeAnchor( '' ) }
				/>
				<select value={ anchor } onChange={ ( e ) => writeAnchor( e.target.value ) }>
					<option value="">{ __( 'Top left (default)', 'blicks' ) }</option>
					{ ANCHOR_OPTIONS.map( ( option ) => (
						<option key={ option.value } value={ option.value }>{ option.label }</option>
					) ) }
				</select>
			</div>

			<MoreSettings label={ __( 'Size', 'blicks' ) } defaultOpen={ Boolean( width || height ) }>
				<div className="grid2">
					<Field
						label={ __( 'Width', 'blicks' ) }
						value={ width }
						placeholder="auto"
						list="bl-scene-child-size"
						onCommit={ ( v ) => write( 'sceneChild.width', cleanSize( v ) ) }
						onReset={ () => write( 'sceneChild.width', '' ) }
					/>
					<Field
						label={ __( 'Height', 'blicks' ) }
						value={ height }
						placeholder="auto"
						list="bl-scene-child-size"
						onCommit={ ( v ) => write( 'sceneChild.height', cleanSize( v ) ) }
						onReset={ () => write( 'sceneChild.height', '' ) }
					/>
				</div>
			</MoreSettings>
		</div>
	);
}
