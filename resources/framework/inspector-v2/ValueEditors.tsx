import { useMemo, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { resolveTokenValues, tokenOptions } from '@/controls/token-utils';
import { paletteSlugOfValue, paletteStoreValue } from '@/controls/color/palette';
import { Chips, Field, Note, Select, SegText, Slider, Sub, Switch, type Option } from './kit';
import { asLength, CHOICES, msOf, timeOf, tokensOf } from './all-settings-model';

/** A typed editor writes one value, or undefined to remove it; the caller validates and saves. */
export interface EditorProps {
	id: string;
	value: unknown;
	onChange: ( value: unknown ) => void;
}

const isHex = ( v: string ) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test( v );
const fullHex = ( v: string ) => ( v.length === 4 ? `#${ [ ...v.slice( 1 ) ].map( ( c ) => c + c ).join( '' ) }` : v );

/** One colour: the theme's colours, then any colour as a picker and a code. */
function Colour( { value, onChange, label }: { value: string; onChange: ( v: string ) => void; label: string } ) {
	const palette = useMemo( () => resolveTokenValues( 'color' as any ), [] );
	return (
		<>
			<div className="swatches sm">
				{ Object.entries( palette ).map( ( [ slug, css ] ) => (
					<button key={ slug } type="button" className="swc" style={ { background: css } } aria-pressed={ paletteSlugOfValue( value ) === slug } title={ slug } aria-label={ slug } onClick={ () => onChange( paletteStoreValue( slug ) ) } />
				) ) }
			</div>
			<div className="alls-colour mt">
				<input type="color" value={ isHex( value ) ? fullHex( value ) : '#000000' } aria-label={ __( 'Pick any color', 'blicks' ) } onChange={ ( e ) => onChange( e.currentTarget.value ) } />
				<Field label={ label } value={ value } placeholder="#000000" onChange={ onChange } />
			</div>
		</>
	);
}

export function ColourEditor( { value, onChange }: EditorProps ) {
	return <Colour value={ typeof value === 'string' ? value : '' } label={ __( 'Color code', 'blicks' ) } onChange={ ( v ) => onChange( v.trim() || undefined ) } />;
}

/** Theme steps for a length's token category, when it has one. */
function Steps( { id, value, onChange }: EditorProps ) {
	const category = tokensOf( id );
	const steps = useMemo( () => ( category ? tokenOptions( category as any ) : [] ), [ category ] );
	if ( ! steps.length ) return null;
	// A theme step is stored as its variable (tokenStoreValue), so it carries the theme's value.
	return <Chips options={ steps.map( ( t ) => [ t.value, t.label ] as Option ) } value={ typeof value === 'string' ? value : null } onChange={ onChange } />;
}

export function LengthEditor( { id, value, onChange }: EditorProps ) {
	const text = typeof value === 'string' || typeof value === 'number' ? String( value ) : '';
	return (
		<>
			<Steps id={ id } value={ value } onChange={ onChange } />
			<div className="mt"><Field label={ __( 'Exact value', 'blicks' ) } value={ text } placeholder="24px" onChange={ ( v ) => onChange( v.trim() ? asLength( v ) : undefined ) } /></div>
			<Note>{ __( 'A plain number is pixels.', 'blicks' ) }</Note>
		</>
	);
}

/** A small field that keeps its name visible once filled. */
function Num( { label, value, onChange }: { label: string; value: string; onChange: ( v: string ) => void } ) {
	return (
		<div className="alls-num">
			<small>{ label }</small>
			<Field label={ label } value={ value } placeholder="0" onChange={ onChange } />
		</div>
	);
}

const SIDE_LABEL: Record< string, string > = {
	top: __( 'Top', 'blicks' ), right: __( 'Right', 'blicks' ), bottom: __( 'Bottom', 'blicks' ), left: __( 'Left', 'blicks' ),
	topLeft: __( 'Top left', 'blicks' ), topRight: __( 'Top right', 'blicks' ), bottomRight: __( 'Bottom right', 'blicks' ), bottomLeft: __( 'Bottom left', 'blicks' ),
};

/** Four sides or corners: one value for all, or one each. */
export function SidesEditor( { id, value, onChange, keys }: EditorProps & { keys: readonly string[] } ) {
	const each = value && typeof value === 'object' && ! Array.isArray( value ) ? ( value as Record< string, unknown > ) : null;
	const [ split, setSplit ] = useState( !! each );
	const one = each ? String( each[ keys[ 0 ] ] ?? '' ) : typeof value === 'string' || typeof value === 'number' ? String( value ) : '';
	const side = ( k: string ) => ( each ? String( each[ k ] ?? '' ) : one );
	const setSide = ( k: string, v: string ) => onChange( Object.fromEntries( keys.map( ( key ) => [ key, key === k ? asLength( v ) || '0' : side( key ) || '0' ] ) ) );
	return (
		<>
			<Steps id={ id } value={ each ? null : value } onChange={ onChange } />
			<div className="mt"><Switch label={ __( 'Different on each side', 'blicks' ) } checked={ split } onChange={ ( on ) => {
				setSplit( on );
				if ( ! on && each ) onChange( one || undefined );
			} } /></div>
			{ split ? (
				<div className="alls-nums mt">
					{ keys.map( ( k ) => <Num key={ k } label={ SIDE_LABEL[ k ] ?? k } value={ side( k ) } onChange={ ( v ) => setSide( k, v ) } /> ) }
				</div>
			) : (
				<div className="mt"><Field label={ __( 'All sides', 'blicks' ) } value={ one } placeholder="16px" onChange={ ( v ) => onChange( v.trim() ? asLength( v ) : undefined ) } /></div>
			) }
		</>
	);
}

/** A keyword: chips for a short list, a dropdown for a long one; "Other…" is the CSS text. */
export function ChoiceEditor( { id, value, onChange, onOther }: EditorProps & { onOther: () => void } ) {
	const list = CHOICES[ id ] ?? [];
	const current = typeof value === 'string' ? value : '';
	const options = list.map( ( v ) => [ v, v ] as Option );
	if ( list.length > 7 ) {
		return (
			<>
				<Select label={ id } value={ list.includes( current ) ? current : '' } options={ [ [ '', current && ! list.includes( current ) ? current : '—' ], ...options ] } onChange={ ( v ) => v && onChange( v ) } />
				<button type="button" className="alls-mode" onClick={ onOther }>{ __( 'Other…', 'blicks' ) }</button>
			</>
		);
	}
	return <Chips options={ [ ...options, [ '\u0000other', __( 'Other…', 'blicks' ) ] ] } value={ list.includes( current ) ? current : null } onChange={ ( v ) => ( v === '\u0000other' ? onOther() : onChange( v ) ) } />;
}

const EASINGS: Option[] = [
	[ 'linear', __( 'Linear', 'blicks' ) ],
	[ 'ease', __( 'Ease', 'blicks' ) ],
	[ 'ease-out', __( 'Ease out', 'blicks' ) ],
	[ 'ease-in-out', __( 'Ease in and out', 'blicks' ) ],
	[ 'cubic-bezier(0.34, 1.56, 0.64, 1)', __( 'Spring', 'blicks' ) ],
];

/** The animations the design system offers, plus whatever the block already names. */
function library( current: string ): Option[] {
	const list = ( window as unknown as { blicksEditorSettings?: { animations?: Array< { name?: string; label?: string } > } } ).blicksEditorSettings?.animations;
	const names: Option[] = ( Array.isArray( list ) ? list : [] ).filter( ( a ) => a?.name ).map( ( a ) => [ a.name!, a.label || a.name! ] );
	return current && ! names.some( ( [ n ] ) => n === current ) ? [ [ current, current ], ...names ] : names;
}

/**
 * The animation settings as one editor: name, times, easing, repeat, direction and fill. A name
 * that is a comma list (several animations) stays CSS text.
 */
export function MotionEditor( { get, set, onOther }: { get: ( id: string ) => unknown; set: ( id: string, value: unknown ) => void; onOther: () => void } ) {
	const name = String( get( 'animation.name' ) ?? '' );
	const iteration = String( get( 'animation.iteration' ) ?? '' );
	const repeat = iteration === 'infinite' ? 'forever' : iteration && iteration !== '1' ? 'times' : 'once';
	const time = ( id: string, label: string, max: number ) => {
		const ms = msOf( get( id ) );
		return ms === null && get( id ) !== undefined ? (
			<Field label={ label } value={ String( get( id ) ) } onChange={ ( v ) => set( id, v.trim() || undefined ) } />
		) : (
			<Slider label={ label } min={ 0 } max={ max } step={ 50 } unit="" value={ ms ?? 0 } display={ timeOf( ms ?? 0 ) } onChange={ ( v ) => set( id, v ? timeOf( v ) : undefined ) } />
		);
	};
	if ( name.includes( ',' ) ) {
		return (
			<>
				<Note>{ __( 'Several animations run on this block, so each setting is a list. Edit them as CSS.', 'blicks' ) }</Note>
				<button type="button" className="alls-mode" onClick={ onOther }>{ __( 'Edit as CSS', 'blicks' ) }</button>
			</>
		);
	}
	return (
		<>
			<Sub>{ __( 'Animation', 'blicks' ) }</Sub>
			{ library( name ).length > 8 ? (
				<Select label={ __( 'Animation', 'blicks' ) } value={ name } options={ [ [ '', __( 'None', 'blicks' ) ], ...library( name ) ] } onChange={ ( v ) => set( 'animation.name', v || undefined ) } />
			) : (
				<Chips options={ [ [ '', __( 'None', 'blicks' ) ], ...library( name ) ] } value={ name } onChange={ ( v ) => set( 'animation.name', v || undefined ) } />
			) }
			<div className="gstop mt">
				{ time( 'animation.duration', __( 'Length', 'blicks' ), 10000 ) }
				{ time( 'animation.delay', __( 'Delay', 'blicks' ), 5000 ) }
			</div>
			<Sub>{ __( 'Easing', 'blicks' ) }</Sub>
			<Chips options={ EASINGS } value={ String( get( 'animation.easing' ) ?? '' ) } onChange={ ( v ) => set( 'animation.easing', v ) } />
			<Sub>{ __( 'Repeat', 'blicks' ) }</Sub>
			<SegText options={ [ [ 'once', __( 'Once', 'blicks' ) ], [ 'forever', __( 'Forever', 'blicks' ) ], [ 'times', __( 'Times…', 'blicks' ) ] ] } value={ repeat } onChange={ ( r ) => set( 'animation.iteration', r === 'forever' ? 'infinite' : r === 'times' ? '2' : undefined ) } />
			{ repeat === 'times' && <div className="mt"><Field label={ __( 'Times', 'blicks' ) } value={ iteration } onChange={ ( v ) => set( 'animation.iteration', v.trim() || undefined ) } /></div> }
			<Sub>{ __( 'Direction', 'blicks' ) }</Sub>
			<Chips options={ ( CHOICES[ 'animation.direction' ] ?? [] ).map( ( v ) => [ v, v ] as Option ) } value={ String( get( 'animation.direction' ) ?? 'normal' ) } onChange={ ( v ) => set( 'animation.direction', v === 'normal' ? undefined : v ) } />
			<Sub>{ __( 'Before and after it runs', 'blicks' ) }</Sub>
			<Chips options={ ( CHOICES[ 'animation.fillMode' ] ?? [] ).map( ( v ) => [ v, v ] as Option ) } value={ String( get( 'animation.fillMode' ) ?? 'none' ) } onChange={ ( v ) => set( 'animation.fillMode', v === 'none' ? undefined : v ) } />
		</>
	);
}

type Layer = Record< string, unknown >;

/** Shadow layers, top first: offsets, blur, size (box only), colour and inside (box only). */
export function ShadowEditor( { id, value, onChange }: EditorProps ) {
	const box = id === 'effects.boxShadow';
	const token = typeof value === 'string' ? value : '';
	const layers: Layer[] = Array.isArray( value ) ? value : value && typeof value === 'object' ? [ value as Layer ] : [];
	const write = ( next: Layer[] ) => onChange( next.length === 0 ? undefined : next.length === 1 ? next[ 0 ] : next );
	const edit = ( i: number, patch: Layer ) => write( layers.map( ( l, n ) => ( n === i ? { ...l, ...patch } : l ) ) );
	const fields: Array< [ string, string ] > = [ [ 'x', __( 'Across', 'blicks' ) ], [ 'y', __( 'Down', 'blicks' ) ], [ 'blur', __( 'Blur', 'blicks' ) ], ...( box ? [ [ 'spread', __( 'Size', 'blicks' ) ] as [ string, string ] ] : [] ) ];
	return (
		<>
			{ box && <Steps id={ id } value={ token } onChange={ onChange } /> }
			{ token && <Note>{ sprintf( /* translators: %s: shadow token */ __( 'Uses the theme shadow “%s”. Add a layer to draw your own.', 'blicks' ), token ) }</Note> }
			{ layers.map( ( l, i ) => (
				<div key={ i } className="alls-layer mt">
					<div className="alls-layer-h">
						<b>{ sprintf( /* translators: %d: layer number */ __( 'Layer %d', 'blicks' ), i + 1 ) }</b>
						<button type="button" className="link-x" onClick={ () => write( layers.filter( ( _, n ) => n !== i ) ) }>{ __( 'Remove', 'blicks' ) }</button>
					</div>
					<div className="alls-nums">
						{ fields.map( ( [ k, label ] ) => <Num key={ k } label={ label } value={ String( l[ k ] ?? '' ) } onChange={ ( v ) => edit( i, { [ k ]: v.trim() ? asLength( v ) : '0' } ) } /> ) }
					</div>
					<div className="mt"><Colour value={ String( l.color ?? '' ) } label={ __( 'Shadow color', 'blicks' ) } onChange={ ( color ) => edit( i, { color } ) } /></div>
					{ box && <div className="mt"><Switch label={ __( 'Inside', 'blicks' ) } checked={ !! l.inset } onChange={ ( on ) => edit( i, { inset: on || undefined } ) } /></div> }
				</div>
			) ) }
			<div className="mt">
				<button type="button" className="deco-row add" onClick={ () => write( [ ...layers, { x: '0', y: '8px', blur: '24px', color: 'rgba(0, 0, 0, 0.2)' } ] ) }>
					<span className="deco-thumb empty" aria-hidden="true">+</span>
					<span className="deco-txt"><b>{ __( 'Add a layer', 'blicks' ) }</b></span>
				</button>
			</div>
		</>
	);
}
