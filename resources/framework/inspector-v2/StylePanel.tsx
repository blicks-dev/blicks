import { useMemo, useState, type ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { MediaUpload, MediaUploadCheck, store as blockEditorStore, useBlockEditContext } from '@wordpress/block-editor';
import { getBlockType } from '@wordpress/blocks';
import { useDispatch, useRegistry, useSelect } from '@wordpress/data';
import { CARD_CONTROL, canBeCard, cardToMark, isCard, markCard, type Ancestor } from './card';
import { DecorationEditor, DecorationsSec } from './Decorations';
import { AllSettings, AllSettingsSec, EditInStudioSec } from './AllSettings';
import { doorFor, hiddenFor, hiddenOf, type Entry } from './all-settings-model';
import { requestFocus } from './design-focus';
import { resolveTokenValues } from '@/controls/token-utils';
import {
	Chips, Icon, Note, Opts, Row, SegIcons, SegSource, SegText, Sec, Slider, Steps, SubView, Swatches, Switch,
	type Option, type Swatch,
} from './kit';
import {
	BADGE_PADS, FOCUS_OUTLINE, FONTS, GRADIENTS, SHADOW_PRESETS, colourCss, finishOf, gradLayers, lookValues, readStyle, stateOf, turnsIn3d, writeStyle,
	type BorderSpec, type Fill, type FocusOutline, type GradLayer, type Look, type ShadowLayer, type StateLook, type Tree,
} from './style-model';

export interface StylePanelProps {
	attributes: any;
	setAttributes: ( a: any ) => void;
	/** Which sections the block shows — a card and a divider share the panel but not its sections. */
	kind: 'box' | 'badge' | 'divider' | 'image' | 'button' | 'icon';
	/** Click and keyboard focus only exist on something that can be clicked. */
	linked: boolean;
	/** The block's own sections around the shared ones; hidden while a sub-view is open. */
	before?: ReactNode;
	after?: ReactNode;
	/** Style values the block's own rows (`before`/`after`) show, so they never count as custom. */
	shown?: readonly string[];
}

type Edit = null | 'fill' | 'text' | 'image' | 'finish' | 'border' | 'space' | 'corners' | 'shadow' | 'depth' | 'text-style' | 'hover' | 'press' | 'deco-before' | 'deco-after' | 'all';

const THEME: Array< [ string, string ] > = [
	[ 'background', __( 'White', 'blicks' ) ], [ 'foreground', __( 'Ink', 'blicks' ) ], [ 'primary', __( 'Brand', 'blicks' ) ],
	[ 'accent', __( 'Soft brand', 'blicks' ) ], [ 'secondary', __( 'Light gray', 'blicks' ) ], [ 'muted', __( 'Mist', 'blicks' ) ],
	[ 'border', __( 'Line gray', 'blicks' ) ], [ 'muted-foreground', __( 'Slate', 'blicks' ) ], [ 'destructive', __( 'Warning red', 'blicks' ) ],
];
const BG: Array< [ string, string ] > = [ [ '', __( 'None', 'blicks' ) ], [ 'background', __( 'White', 'blicks' ) ], [ 'secondary', __( 'Light gray', 'blicks' ) ], [ 'accent', __( 'Soft brand', 'blicks' ) ], [ 'primary', __( 'Brand', 'blicks' ) ], [ 'foreground', __( 'Dark', 'blicks' ) ] ];
const LINES: Array< [ string, string ] > = [ [ 'border', __( 'Line gray', 'blicks' ) ], [ 'muted-foreground', __( 'Slate', 'blicks' ) ], [ 'foreground', __( 'Ink', 'blicks' ) ], [ 'primary', __( 'Brand', 'blicks' ) ], [ 'destructive', __( 'Warning red', 'blicks' ) ] ];
const TEXTS: Array< [ string, string ] > = [ [ '', __( 'Readable (automatic)', 'blicks' ) ], [ 'foreground', __( 'Dark', 'blicks' ) ], [ 'background', __( 'White', 'blicks' ) ], [ 'primary', __( 'Brand', 'blicks' ) ] ];
const OUTS: Option[] = [ [ '', __( 'None', 'blicks' ) ], [ '16', __( 'Small', 'blicks' ) ], [ '32', __( 'Medium', 'blicks' ) ], [ '48', __( 'Large', 'blicks' ) ] ];
const PADS: Option[] = [ [ '', __( 'None', 'blicks' ) ], [ 'sm', __( 'Small', 'blicks' ) ], [ 'xl', __( 'Medium', 'blicks' ) ], [ '3xl', __( 'Large', 'blicks' ) ] ];
/** A button's inside space, as up-and-down,left-and-right px; '' keeps what its size gives it. */
const BUTTON_P: Option[] = [ [ '', __( 'From size', 'blicks' ) ], [ '6,12', __( 'Snug', 'blicks' ) ], [ '10,20', __( 'Roomy', 'blicks' ) ], [ '12,32', __( 'Wide', 'blicks' ) ] ];
/** A button's corners: its look's own, or one of three shapes. */
const BUTTON_RADII: Option[] = [
	[ '', __( 'From theme', 'blicks' ), 'M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8zM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z' ],
	[ 'none', __( 'Square', 'blicks' ), 'M5 19V5h14' ],
	[ 'md', __( 'Rounded', 'blicks' ), 'M5 19V12a7 7 0 0 1 7-7h7' ],
	[ 'full', __( 'Pill', 'blicks' ), 'M8 19a7 7 0 0 1 0-14h11' ],
];
/** An icon's colour: the text around it, or one of the theme's. Settings shows the same row. */
export const ICON_COLOURS: Array< [ string, string ] > = [
	[ '', __( 'Same as text', 'blicks' ) ], [ 'primary', __( 'Brand', 'blicks' ) ], [ 'foreground', __( 'Dark', 'blicks' ) ],
	[ 'muted-foreground', __( 'Gray', 'blicks' ) ], [ 'destructive', __( 'Warning red', 'blicks' ) ], [ 'background', __( 'White', 'blicks' ) ],
];
const ICON_SHAPES: Option[] = [
	[ 'full', __( 'Circle', 'blicks' ), 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z' ],
	[ 'md', __( 'Rounded', 'blicks' ), 'M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z' ],
	[ 'none', __( 'Square', 'blicks' ), 'M4 4h16v16H4z' ],
];
const AROUND: Option[] = [ [ '', __( 'None', 'blicks' ) ], [ '8', __( 'Small', 'blicks' ) ], [ '16', __( 'Medium', 'blicks' ) ], [ '32', __( 'Large', 'blicks' ) ] ];
/** The room a ring or badge leaves round the glyph, so the shape does not touch it. */
const ICON_ROOM = [ 12, 12, 12, 12 ];
const BADGE_P: Option[] =[ [ 'b1', __( 'Snug', 'blicks' ) ], [ 'b2', __( 'Normal', 'blicks' ) ], [ 'b3', __( 'Roomy', 'blicks' ) ] ];
const BADGE_WEIGHT = '600';
const SIZES_T: Option[] = [ [ '13', __( 'Small', 'blicks' ) ], [ '', __( 'Normal', 'blicks' ) ], [ '17', __( 'Large', 'blicks' ) ], [ '20', __( 'Huge', 'blicks' ) ] ];
const PAD_PX: Record< string, number[] > = { sm: [ 8, 8, 8, 8 ], xl: [ 24, 24, 24, 24 ], '3xl': [ 48, 48, 48, 48 ], ...BADGE_PADS };
const RADIUS_PX: Record< string, number > = { none: 0, sm: 4, md: 8, lg: 12, xl: 16, full: 999 };
const RADII: Option[] = [ [ '', __( 'Square', 'blicks' ), 'M5 19V5h14' ], [ 'sm', __( 'Slight', 'blicks' ), 'M5 19V8a3 3 0 0 1 3-3h11' ], [ 'lg', __( 'Rounded', 'blicks' ), 'M5 19V12a7 7 0 0 1 7-7h7' ], [ 'full', __( 'Round', 'blicks' ), 'M8 19a7 7 0 0 1 0-14h11' ] ];
const SHAPES: Array< [ string, number[] | 'sketch' ] > = [
	[ __( 'Square', 'blicks' ), [ 0, 0, 0, 0 ] ], [ __( 'Slight', 'blicks' ), [ 4, 4, 4, 4 ] ], [ __( 'Rounded', 'blicks' ), [ 8, 8, 8, 8 ] ],
	[ __( 'Soft', 'blicks' ), [ 14, 14, 14, 14 ] ], [ __( 'Pill', 'blicks' ), [ 999, 999, 999, 999 ] ], [ __( 'Leaf', 'blicks' ), [ 20, 0, 20, 0 ] ],
	[ __( 'Tab', 'blicks' ), [ 14, 14, 0, 0 ] ], [ __( 'Speech', 'blicks' ), [ 16, 16, 16, 0 ] ], [ __( 'Drop', 'blicks' ), [ 0, 20, 20, 20 ] ], [ __( 'Sketch', 'blicks' ), 'sketch' ],
];
const HOVERS: Option[] = [
	[ 'none', __( 'Nothing', 'blicks' ), 'M6 12h12' ], [ 'lift', __( 'Lift', 'blicks' ), 'M12 18V6M7 11l5-5 5 5' ],
	[ 'glow', __( 'Glow', 'blicks' ), 'M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2' ],
	[ 'darken', __( 'Darken', 'blicks' ), 'M12 3a9 9 0 1 0 0 18z' ], [ 'grow', __( 'Grow', 'blicks' ), 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' ],
	[ 'tilt', __( 'Tilt', 'blicks' ), 'M6 16l10-8M5 9a9 9 0 0 1 12-3' ],
];
/** Reveals: only offered when the block answers to its card — a hidden block is not pointed at. */
const REVEALS: Option[] = [
	[ 'appear', __( 'Appear', 'blicks' ), 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9v6' ],
	[ 'slide', __( 'Slide in', 'blicks' ), 'M4 12h14M13 7l5 5-5 5' ],
];
const PRESSES: Option[] = [ [ 'none', __( 'Nothing', 'blicks' ), 'M6 12h12' ], [ 'press', __( 'Press in', 'blicks' ), 'M8 8l8 8M16 8l-8 8' ], [ 'push', __( 'Push down', 'blicks' ), 'M12 5v12M7 12l5 5 5-5M5 20h14' ], [ 'sink', __( 'Sink', 'blicks' ), 'M5 8h14v10H5zM8 11h8' ] ];
const DEPTHS: Array< [ Look[ 'depth' ], string, string ] > = [ [ '', __( 'Flat', 'blicks' ), '' ], [ 'edge', __( '3D edge', 'blicks' ), '0 3px 0 #2f28a8' ], [ 'block', __( 'Block', 'blicks' ), '3px 3px 0 #18181b' ], [ 'frame', __( 'Frame', 'blicks' ), '4px 4px 0 -1px #fff, 4px 4px 0 0 #18181b' ] ];
const WEIGHTS: Array< [ string, string ] > = [ [ '300', 'Light' ], [ '400', 'Regular' ], [ '500', 'Medium' ], [ '600', 'Semibold' ], [ '700', 'Bold' ], [ '800', 'Extra bold' ], [ '900', 'Black' ] ];
const POS = [ '20% 20%', '50% 20%', '80% 20%', '20% 50%', '50% 50%', '80% 50%', '20% 80%', '50% 80%', '80% 80%' ];
const DIMS: Option[] = [ [ '', __( 'None', 'blicks' ) ], [ 'light', __( 'Light', 'blicks' ) ], [ 'medium', __( 'Medium', 'blicks' ) ], [ 'strong', __( 'Strong', 'blicks' ) ] ];
const SIDE_ICONS = [ [ __( 'Top', 'blicks' ), 'M5 5h14M12 9v10' ], [ __( 'Right', 'blicks' ), 'M19 5v14M15 12H5' ], [ __( 'Bottom', 'blicks' ), 'M5 19h14M12 15V5' ], [ __( 'Left', 'blicks' ), 'M5 5v14M9 12h10' ] ];
const CORNER_ICONS = [ [ __( 'Top left', 'blicks' ), 'M5 19V9a4 4 0 0 1 4-4h10' ], [ __( 'Top right', 'blicks' ), 'M5 5h10a4 4 0 0 1 4 4v10' ], [ __( 'Bottom right', 'blicks' ), 'M19 5v10a4 4 0 0 1-4 4H5' ], [ __( 'Bottom left', 'blicks' ), 'M19 19H9a4 4 0 0 1-4-4V5' ] ];
const UPDOWN = 'M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4';
const LEFTRIGHT = 'M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4';

const isHex = ( v: string ) => /^#([0-9a-f]{3}){1,2}$/i.test( v );
const expandHex = ( v: string ) => ( v.length === 4 ? `#${ v.slice( 1 ).split( '' ).map( ( c ) => c + c ).join( '' ) }` : v ).toLowerCase();

/** The Style tab: goal-named sections, each opening a sub-view that replaces the list. */
export function StylePanel( { attributes, setAttributes, kind, linked, before, after, shown = [] }: StylePanelProps ) {
	const tree: Tree = attributes.blicks ?? {};
	const opts = { linked, kind };
	const { look } = readStyle( tree, opts );
	const [ edit, setEdit ] = useState< Edit >( null );
	const [ allStart, setAllStart ] = useState< Entry | null >( null );
	const palette = useMemo( () => resolveTokenValues( 'color' as any ), [] );
	const card = useCard();
	// Decorations (::before / ::after) are a Studio tool: the post editor keeps the simpler panel.
	const inStudio = useSelect( ( select: any ) => !! select( blockEditorStore ).getSettings()?.blicksStudio, [] );
	const { name: blockName, clientId } = useBlockEditContext();
	const supports = ( blockName ? ( getBlockType( blockName )?.supports as any )?.blicks : undefined ) ?? {};

	const set =( patch: Partial< Look > ) => setAttributes( { blicks: writeStyle( tree, { ...look, ...patch }, opts ) } );
	const css = ( c: string ) => ( palette[ c ] || colourCss( c ) );
	const sw = ( list: Array< [ string, string ] > ): Swatch[] => list.map( ( [ v, l ] ) => ( v ? { value: v, label: l, css: css( v ) } : { value: '', label: l } ) );
	const fillCss = ( f: Fill ) => ( typeof f === 'string' ? ( f ? ( isHex( f ) ? f : css( f ) ) : 'transparent' ) : gradientCss( gradLayers( f ), css ) );
	const back = () => setEdit( null );
	// Another finish starts its own fine-tuning over.
	const pickFinish = ( finish: string ) => set( { finish: finish as Look[ 'finish' ], finishX: {} } );
	const finishes: Array< [ string, string, JSX.Element ] > = [
						[ '', __( 'Flat', 'blicks' ), <span key="f" className="hov"><span className="mini" style={ { width: 30, background: '#4f46e5' } } /></span> ],
						[ 'gloss', __( 'Gloss', 'blicks' ), <span key="g" className="hov"><span className="mini" style={ { width: 30, background: '#4f46e5', backgroundImage: 'linear-gradient(180deg, rgb(255 255 255 / 42%), rgb(255 255 255 / 12%) 50%, rgb(255 255 255 / 0) 50%)', boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 45%)' } } /></span> ],
						[ 'soft', __( 'Soft', 'blicks' ), <span key="s" className="hov"><span className="mini" style={ { width: 30, background: '#4f46e5', boxShadow: 'inset 0 -10px 14px -8px rgb(0 0 0 / 28%), inset 0 1px 1px rgb(255 255 255 / 35%)' } } /></span> ],
						[ 'glass', __( 'Glass', 'blicks' ), <span key="gl" className="hov" style={ { background: 'linear-gradient(135deg, #f97316, #6366f1)', borderRadius: 4, padding: '4px 6px' } }><span className="mini" style={ { width: 30, background: 'rgb(255 255 255 / 22%)', border: '1px solid rgb(255 255 255 / 50%)' } } /></span> ],
	];

	// ── sub-views ────────────────────────────────────────────────────────────
	if ( edit === 'all' ) {
		return <AllSettings tree={ tree } setTree={ ( blicks ) => setAttributes( { blicks } ) } onBack={ () => { setAllStart( null ); back(); } } controls={ supports.controls } states={ supports.states } start={ allStart } />;
	}
	if ( edit === 'deco-before' || edit === 'deco-after' ) {
		return <DecorationEditor tree={ tree } part={ edit === 'deco-before' ? 'before' : 'after' } setTree={ ( blicks ) => setAttributes( { blicks } ) } onBack={ back } />;
	}
	if ( edit === 'fill' || edit === 'text' ) {
		return <ColourEditor which={ edit } look={ look } set={ set } back={ back } css={ css } fillCss={ fillCss } kind={ kind } />;
	}
	if ( edit === 'image' ) {
		return (
			<SubView title={ __( 'Picture', 'blicks' ) } onBack={ back } clearLabel={ __( 'No picture', 'blicks' ) } onClear={ () => set( { img: '', dim: '', ifit: 'cover', ipos: '50% 50%', ifixed: false } ) }>
				<Row label={ __( 'Picture', 'blicks' ) } stack set={ !! look.img }>
					<PicturePicker value={ look.img } onChange={ ( img ) => set( { img, dim: img && ! look.dim ? 'medium' : look.dim } ) } />
				</Row>
				{ look.img && (
					<>
						<Row label={ __( 'Darken it', 'blicks' ) } stack set={ !! look.dim }>
							<Steps label={ __( 'Darken it', 'blicks' ) } options={ DIMS } value={ look.dim } onChange={ ( dim ) => set( { dim: dim as Look[ 'dim' ] } ) } />
						</Row>
						<Row label={ __( 'Fit', 'blicks' ) } set={ look.ifit !== 'cover' }>
							<SegText label={ __( 'Fit', 'blicks' ) } options={ [ [ 'cover', __( 'Fill', 'blicks' ) ], [ 'contain', __( 'Whole', 'blicks' ) ], [ 'tile', __( 'Repeat', 'blicks' ) ] ] } value={ look.ifit } onChange={ ( ifit ) => set( { ifit: ifit as Look[ 'ifit' ] } ) } />
						</Row>
						<Row label={ __( 'Keep in view', 'blicks' ) } set={ look.ipos !== '50% 50%' } note={ __( 'The part that stays visible when the picture is cropped.', 'blicks' ) }>
							<div className="dpad">
								{ POS.map( ( q ) => <button key={ q } type="button" aria-pressed={ look.ipos === q } aria-label={ q } onClick={ () => set( { ipos: q } ) }><i /></button> ) }
							</div>
						</Row>
						<Switch label={ __( 'Stays put when scrolling', 'blicks' ) } hint={ __( 'The page slides over it', 'blicks' ) } checked={ look.ifixed } onChange={ ( ifixed ) => set( { ifixed } ) } />
					</>
				) }
			</SubView>
		);
	}
	if ( edit === 'finish' ) {
		const { k, edge, blur } = finishOf( look );
		const fx = look.finishX ?? {};
		const strength = { gloss: __( 'Shine', 'blicks' ), soft: __( 'Shading', 'blicks' ), glass: __( 'Frost', 'blicks' ), '': '' }[ look.finish ];
		return (
			<SubView title={ __( 'Finish', 'blicks' ) } onBack={ back } clearLabel={ __( 'Back to the preset', 'blicks' ) } onClear={ () => set( { finishX: {} } ) }>
				<Row label={ __( 'Finish', 'blicks' ) } stack set={ !! look.finish }>
					<Opts columns={ 4 } value={ look.finish } onChange={ pickFinish } options={ finishes } />
				</Row>
				{ look.finish ? (
					<>
						<Slider label={ strength } min={ 0 } max={ 150 } step={ 5 } value={ Math.round( k * 100 ) } unit="%" onChange={ ( v ) => set( { finishX: { ...fx, s: v } } ) } />
						{ look.finish === 'glass' && <Slider label={ __( 'Blur behind', 'blicks' ) } min={ 0 } max={ 24 } value={ blur } unit="px" onChange={ ( v ) => set( { finishX: { ...fx, blur: v } } ) } /> }
						<Switch label={ __( 'Light along the top edge', 'blicks' ) } checked={ edge } onChange={ ( on ) => set( { finishX: { ...fx, edge: on } } ) } />
						{ look.finish === 'glass' && <Note>{ __( 'Glass shows best over a picture or a colorful section.', 'blicks' ) }</Note> }
					</>
				) : <Note>{ __( 'Pick a finish to fine-tune it.', 'blicks' ) }</Note> }
			</SubView>
		);
	}
	if ( edit === 'border' ) {
		const bd: BorderSpec = typeof look.border === 'object' ? look.border : { w: look.border === 'thick' ? 2 : look.border ? 1 : 1.5, style: 'solid', sides: 'all' };
		const setB = ( p: Partial< BorderSpec > ) => set( { border: { ...bd, ...p } } );
		return (
			<SubView title={ __( 'Border', 'blicks' ) } onBack={ back } clearLabel={ __( 'No border', 'blicks' ) } onClear={ () => set( { border: '', bcol: '' } ) }>
				<Slider label={ __( 'Width', 'blicks' ) } min={ 1 } max={ 8 } step={ 0.5 } value={ look.border ? bd.w : 1.5 } onChange={ ( w ) => setB( { w } ) } />
				<Row label={ __( 'Line', 'blicks' ) } stack set={ bd.style !== 'solid' }>
					<SegText label={ __( 'Line', 'blicks' ) } options={ [ [ 'solid', __( 'Solid', 'blicks' ) ], [ 'dashed', __( 'Dashed', 'blicks' ) ], [ 'dotted', __( 'Dotted', 'blicks' ) ], [ 'double', __( 'Double', 'blicks' ) ] ] } value={ bd.style } onChange={ ( style ) => setB( { style: style as BorderSpec[ 'style' ] } ) } />
				</Row>
				<Row label={ __( 'Sides', 'blicks' ) } set={ bd.sides !== 'all' }>
					<SegIcons label={ __( 'Sides', 'blicks' ) } options={ [ [ 'all', __( 'All sides', 'blicks' ), 'M5 5h14v14H5z' ], [ 'bottom', __( 'Bottom only', 'blicks' ), 'M5 19h14' ], [ 'tb', __( 'Top and bottom', 'blicks' ), 'M5 5h14M5 19h14' ], [ 'left', __( 'Left only', 'blicks' ), 'M5 5v14' ] ] } value={ bd.sides } onChange={ ( sides ) => setB( { sides: sides as BorderSpec[ 'sides' ] } ) } />
				</Row>
				<Row label={ __( 'Color', 'blicks' ) } stack set={ !! look.bcol }>
					<div className="ce-grid">
						{ THEME.map( ( [ t, l ] ) => <button key={ t } type="button" className="swc" style={ { background: css( t ) } } aria-pressed={ ( look.bcol || 'foreground' ) === t } title={ l } aria-label={ l } onClick={ () => set( { bcol: t, border: look.border || 'thin' } ) } /> ) }
					</div>
				</Row>
				<Row label={ __( 'Any color', 'blicks' ) } stack>
					<HexField value={ isHex( look.bcol ) ? look.bcol : '' } fallback="#18181b" onChange={ ( bcol ) => set( { bcol, border: look.border || 'thin' } ) } />
				</Row>
			</SubView>
		);
	}
	if ( edit === 'space' ) {
		const pv = Array.isArray( look.pad ) ? look.pad : PAD_PX[ look.pad as string ] ?? [ 0, 0, 0, 0 ];
		const out = look.out ?? [ 0, 0, 0, 0 ];
		const paired = pv[ 0 ] === pv[ 2 ] && pv[ 1 ] === pv[ 3 ];
		const setPad = ( i: number | 'v' | 'h', n: number ) => {
			const v = [ ...pv ];
			if ( i === 'v' ) { v[ 0 ] = n; v[ 2 ] = n; } else if ( i === 'h' ) { v[ 1 ] = n; v[ 3 ] = n; } else v[ i ] = n;
			set( { pad: v } );
		};
		const setOut = ( axis: 'v' | 'h', n: number ) => {
			const v = [ ...out ];
			if ( axis === 'v' ) { v[ 0 ] = n; v[ 2 ] = n; } else { v[ 1 ] = n; v[ 3 ] = n; }
			set( { out: v.some( Boolean ) ? v : null } );
		};
		return (
			<SubView title={ __( 'Space', 'blicks' ) } onBack={ back } clearLabel={ __( 'No extra space', 'blicks' ) } onClear={ () => set( { pad: '', out: null } ) }>
				{ /* An image has nothing inside to space out; its space is all outside. */ }
				{ kind !== 'image' && (
					<Sec title={ __( 'Inside', 'blicks' ) } icon="padding">
						<div className="spbox"><span className="spv" style={ { padding: pv.map( ( n ) => `${ Math.round( n / 2 ) }px` ).join( ' ' ) } }><i>Text</i></span></div>
						<SpaceSliders pv={ pv } paired={ paired } setPad={ setPad } />
					</Sec>
				) }
				<Sec title={ __( 'Outside', 'blicks' ) } icon="open_with">
					<Slider label={ __( 'Above and below', 'blicks' ) } icon={ UPDOWN } min={ 0 } max={ 96 } value={ out[ 0 ] } onChange={ ( n ) => setOut( 'v', n ) } />
					<Slider label={ __( 'Left and right', 'blicks' ) } icon={ LEFTRIGHT } min={ 0 } max={ 48 } value={ out[ 1 ] } onChange={ ( n ) => setOut( 'h', n ) } />
					{ kind === 'box' && <Note>{ __( 'Space between what’s inside is under Settings › Layout.', 'blicks' ) }</Note> }
				</Sec>
			</SubView>
		);
	}
	if ( edit === 'corners' ) {
		// Clearing goes back to what the block draws with no value: a button the theme's corners,
		// a framed icon its circle, anything else square.
		const clear: [ string, Look[ 'radius' ] ] = kind === 'button' ? [ __( 'Back to the theme’s corners', 'blicks' ), '' ] : kind === 'icon' ? [ __( 'Back to a circle', 'blicks' ), 'full' ] : [ __( 'Square corners', 'blicks' ), '' ];
		return <CornerEditor look={ look } set={ set } back={ back } clear={ clear } />;
	}
	if ( edit === 'shadow' ) {
		return <ShadowEditor look={ look } set={ set } back={ back } css={ css } />;
	}
	if ( edit === 'depth' ) {
		const n = look.depthX.n ?? { edge: 4, block: 5, frame: 6 }[ look.depth as 'edge' ] ?? 4;
		return (
			<SubView title={ __( 'Depth and tilt', 'blicks' ) } onBack={ back } clearLabel={ __( 'Flat, no tilt', 'blicks' ) } onClear={ () => set( { depth: '', depthX: {}, tilt: 0, press: look.press === 'push' ? 'none' : look.press } ) }>
				<Sec title={ __( 'Depth', 'blicks' ) } icon="shadow">
				<Row label={ __( 'Look', 'blicks' ) } stack set={ !! look.depth }>
					<DepthCards value={ look.depth } onChange={ ( depth ) => set( { depth, depthX: {} } ) } />
				</Row>
				{ look.depth && (
					<>
						<Slider label={ __( 'Depth', 'blicks' ) } min={ 1 } max={ 12 } value={ n } onChange={ ( v ) => set( { depthX: { ...look.depthX, n: v } } ) } />
						<Row label={ __( 'Color', 'blicks' ) } stack set={ !! look.depthX.c }>
						<div className="ce-grid">
							{ look.depth === 'edge' && <button type="button" className="swc auto" aria-pressed={ ! look.depthX.c } title={ __( 'A darker shade of the fill', 'blicks' ) } onClick={ () => set( { depthX: { ...look.depthX, c: undefined } } ) }>Aa</button> }
							{ THEME.filter( ( [ t ] ) => t !== 'border' ).map( ( [ t, l ] ) => <button key={ t } type="button" className="swc" style={ { background: css( t ) } } aria-pressed={ look.depthX.c === t } title={ l } aria-label={ l } onClick={ () => set( { depthX: { ...look.depthX, c: t } } ) } /> ) }
						</div>
						</Row>
						<Row label={ __( 'On hover', 'blicks' ) } set={ !! look.depthX.hover && look.depthX.hover !== 'lift' }>
							<SegText label={ __( 'On hover', 'blicks' ) } options={ [ [ 'lift', __( 'Lift', 'blicks' ) ], [ 'settle', look.depth === 'edge' ? __( 'Sink', 'blicks' ) : __( 'Settle', 'blicks' ) ], [ 'stay', __( 'Stay', 'blicks' ) ] ] } value={ look.depthX.hover ?? 'lift' } onChange={ ( hover ) => set( { depthX: { ...look.depthX, hover: hover as 'lift' } } ) } />
						</Row>
					</>
				) }
				</Sec>
				<Sec title={ __( 'Tilt', 'blicks' ) } icon="rotate_right">
					<Slider label={ __( 'Angle', 'blicks' ) } min={ -6 } max={ 6 } step={ 0.5 } value={ look.tilt } unit="°" onChange={ ( tilt ) => set( { tilt } ) } />
				</Sec>
			</SubView>
		);
	}
	if ( edit === 'text-style' ) {
		const wv = Number( look.weight || 500 );
		return (
			<SubView title={ __( 'Text', 'blicks' ) } onBack={ back } clearLabel={ __( 'Back to the theme’s text', 'blicks' ) } onClear={ () => set( { font: '', fsize: '', weight: '', italic: false, track: '', tcase: '', deco: '', tsh: '' } ) }>
				<Sec title={ __( 'Font', 'blicks' ) } icon="text_fields">
				<Row label={ __( 'Font', 'blicks' ) } stack set={ !! look.font }>
				<Opts columns={ 3 } options={ [ [ '', __( 'From theme', 'blicks' ), <span key="t" className="tf">Aa</span> ], ...Object.entries( FONTS ).map( ( [ k, [ l, f ] ] ) => [ k, l, <span key={ k } className="tf" style={ { fontFamily: f === 'sans' || f === 'serif' || f === 'mono' ? `var(--blicks-font-${ f })` : f } }>Aa</span> ] as [ string, string, JSX.Element ] ) ] } value={ look.font } onChange={ ( font ) => set( { font } ) } />
				</Row>
				<Slider label={ __( 'Size', 'blicks' ) } min={ 11 } max={ 28 } value={ typeof look.fsize === 'number' ? look.fsize : 16 } onChange={ ( fsize ) => set( { fsize } ) } />
				<Slider label={ __( 'Weight', 'blicks' ) } min={ 300 } max={ 900 } step={ 100 } value={ wv } display={ WEIGHTS.find( ( q ) => q[ 0 ] === String( wv ) )?.[ 1 ] ?? String( wv ) } onChange={ ( w ) => set( { weight: w === 500 ? '' : String( w ) } ) } />
				<Switch label={ __( 'Italic', 'blicks' ) } checked={ look.italic } onChange={ ( italic ) => set( { italic } ) } />
				</Sec>
				<Sec title={ __( 'Letters', 'blicks' ) } icon="format_letter_spacing">
				<Row label={ __( 'Case', 'blicks' ) } stack set={ !! look.tcase }>
					<SegText label={ __( 'Case', 'blicks' ) } options={ [ [ '', 'Aa' ], [ 'uppercase', 'AA' ], [ 'lowercase', 'aa' ], [ 'capitalize', 'Ab Cd' ] ] } value={ look.tcase } onChange={ ( tcase ) => set( { tcase: tcase as Look[ 'tcase' ] } ) } />
				</Row>
				<Slider label={ __( 'Spacing', 'blicks' ) } min={ -5 } max={ 20 } value={ Math.round( Number( look.track || 0 ) * 100 ) } display={ `${ look.track || 0 }em` } onChange={ ( n ) => set( { track: n ? n / 100 : '' } ) } />
				<Row label={ __( 'Line', 'blicks' ) } stack set={ !! look.deco }>
					<SegText label={ __( 'Line', 'blicks' ) } options={ [ [ '', __( 'None', 'blicks' ) ], [ 'underline', __( 'Underline', 'blicks' ) ], [ 'line-through', __( 'Strike', 'blicks' ) ] ] } value={ look.deco } styles={ { underline: { textDecoration: 'underline' }, 'line-through': { textDecoration: 'line-through' } } } onChange={ ( deco ) => set( { deco: deco as Look[ 'deco' ] } ) } />
				</Row>
				<Row label={ __( 'Shadow', 'blicks' ) } stack set={ !! look.tsh }>
					<Chips label={ __( 'Text shadow', 'blicks' ) } options={ [ [ '', __( 'None', 'blicks' ) ], [ 'soft', __( 'Soft', 'blicks' ) ], [ 'lift', __( 'Lifted', 'blicks' ) ], [ 'glow', __( 'Glow', 'blicks' ) ], [ 'retro', __( 'Retro', 'blicks' ) ] ] } value={ look.tsh } onChange={ ( tsh ) => set( { tsh: tsh as Look[ 'tsh' ] } ) } />
				</Row>
				</Sec>
			</SubView>
		);
	}
	if ( edit === 'hover' || edit === 'press' ) {
		return <StateEditor which={ edit } look={ look } set={ set } back={ back } css={ css } />;
	}

	// ── the section list ─────────────────────────────────────────────────────
	const finishCustom = Object.keys( look.finishX ?? {} ).length > 0;
	// Values no quick choice reproduces: All settings lists them, and each section links to its own.
	const hiddenAll = hiddenOf( tree, lookValues( look, opts ) ).filter( ( e ) => ! ( shown.includes( e.id ) && e.part === 'element' && e.state === 'default' && e.breakpoint === 'base' ) );
	// In the Studio every section is a door into the design panel, opened on its own row; the
	// post editor keeps All settings as the sub-view for what the choices cannot show.
	const door = ( section: string ) => {
		const target = inStudio && clientId ? doorFor( section, hiddenAll ) : null;
		return target ? () => requestFocus( { clientId, ...target } ) : undefined;
	};
	const more = ( section: string ) => {
		const list = inStudio ? hiddenFor( hiddenAll, section ) : [];
		const onFineTune = door( section );
		// In the Studio the door already opens on the first of them, so the section just reads Custom.
		if ( onFineTune ) return { onFineTune, ...( list.length ? { custom: true } : {} ) };
		return list.length ? { hidden: { count: list.length, onOpen: () => { setAllStart( list[ 0 ] ); setEdit( 'all' ); } } } : {};
	};

	// Each goal section names its current value on the right, as plan §4 draws them: the choice it
	// matches, or Custom when a value matches none. Empty when nothing is set.
	const nameIn = ( opts: ReadonlyArray< readonly [ unknown, string, ...unknown[] ] >, v: unknown ) => opts.find( ( o ) => o[ 0 ] === v )?.[ 1 ];
	const custom = __( 'Custom', 'blicks' );
	const join = ( ...parts: Array< string | undefined | false > ) => parts.filter( Boolean ).join( ' · ' );
	const summary = {
		fill: join(
			look.img ? __( 'Picture', 'blicks' ) : look.fill ? ( typeof look.fill === 'string' ? nameIn( BG, look.fill ) ?? custom : __( 'Gradient', 'blicks' ) ) : '',
			look.finish ? __( 'Finish', 'blicks' ) : ''
		),
		border: join(
			look.border ? ( typeof look.border === 'string' ? nameIn( [ [ 'thin', __( 'Thin', 'blicks' ) ], [ 'thick', __( 'Thick', 'blicks' ) ] ], look.border ) : custom ) : '',
			look.radius ? ( typeof look.radius === 'string' ? nameIn( RADII, look.radius === 'md' ? 'lg' : look.radius ) ?? custom : custom ) : ''
		),
		shadow: join(
			look.shadow ? ( typeof look.shadow === 'string' ? nameIn( [ [ 'sm', __( 'Soft', 'blicks' ) ], [ 'md', __( 'Medium', 'blicks' ) ], [ 'lg', __( 'Strong', 'blicks' ) ] ], look.shadow ) ?? custom : custom ) : '',
			look.depth ? nameIn( DEPTHS, look.depth ) : ''
		),
		space: join(
			look.pad ? ( typeof look.pad === 'string' ? nameIn( PADS, look.pad ) ?? custom : custom ) : '',
			look.out ? __( 'Outside', 'blicks' ) : ''
		),
		states: look.hover && look.hover !== 'none' ? nameIn( [ ...HOVERS, ...REVEALS ], look.hover ) ?? custom : look.press && look.press !== 'none' ? nameIn( PRESSES, look.press ) ?? custom : look.focus ? __( 'Focus ring', 'blicks' ) : '',
	};
	const fillIsCustom = typeof look.fill === 'object' || ( !! look.fill && ! BG.some( ( [ v ] ) => v === look.fill ) && ! ( kind === 'divider' && LINES.some( ( [ v ] ) => v === look.fill ) ) );
	const fillSwatch = fillIsCustom ? { css: fillCss( look.fill ), label: __( 'Custom — edit', 'blicks' ), onEdit: () => setEdit( 'fill' ) } : undefined;
	const radiusCustom = typeof look.radius === 'object';
	const shadowCustom = typeof look.shadow === 'object';
	const borderCustom = typeof look.border === 'object' || ( !! look.bcol && ! [ 'border', 'foreground', 'primary', 'background', 'destructive' ].includes( look.bcol ) );
	const padCustom = Array.isArray( look.pad ) || ( !! look.out && ! ( look.out[ 0 ] === look.out[ 2 ] && ! look.out[ 1 ] && ! look.out[ 3 ] && [ 16, 32, 48 ].includes( look.out[ 0 ] ) ) );
	const outKey = look.out && ! padCustom ? String( look.out[ 0 ] ) : '';
	// A badge's own text (semi-bold, 12px — the Box model's badge look) is its Normal, not a change.
	const badge = kind === 'badge';
	const normalSize = badge ? 12 : '';
	const weightCustom = !! look.weight && ! ( badge && look.weight === BADGE_WEIGHT );
	const textCustom = !! ( look.tsh || look.font || look.italic || look.track !== '' || look.tcase || look.deco || weightCustom || ( look.fsize !== normalSize && ! [ 13, 17, 20 ].includes( look.fsize as number ) ) );
	const hoverCustom = !! look.hoverX;
	const pressCustom = !! look.pressX;

	// Every Style tab reads in one order — Text · Fill · Border and corners · Shadow and depth ·
	// Space · States — and a kind skips what it has nothing for. A section holds Rows; a setting
	// with a fuller editor offers it at the end of its row ("Customise ›").
	const door2 = ( on: boolean, ed: Edit ) => ( { label: on ? __( 'Edit', 'blicks' ) : __( 'Customize', 'blicks' ), run: () => setEdit( ed ) } );
	const fineTune = ( section: string, on: boolean, ed: Edit ) => {
		const tune = door( section );
		return tune ? { label: on ? __( 'Edit in Design', 'blicks' ) : __( 'Fine-tune', 'blicks' ), run: tune } : door2( on, ed );
	};

	const fillRows = (
		<>
			<Row label={ kind === 'badge' ? __( 'Fill', 'blicks' ) : __( 'Background', 'blicks' ) } stack set={ !! look.fill } action={ fillIsCustom ? door2( true, 'fill' ) : undefined }>
				<Swatches swatches={ sw( kind === 'button' ? BG.map( ( [ v, l ] ) => [ v, v ? l : __( 'From look', 'blicks' ) ] as [ string, string ] ) : BG ) } value={ typeof look.fill === 'string' ? look.fill : null } onChange={ ( fill ) => set( { fill } ) } custom={ fillSwatch } onMore={ () => setEdit( 'fill' ) } moreLabel={ __( 'More colors and gradients', 'blicks' ) } />
			</Row>
			<Row label={ __( 'Text', 'blicks' ) } stack set={ !! look.text }>
				<Swatches swatches={ sw( TEXTS ) } empty="auto" value={ look.text } onChange={ ( text ) => set( { text } ) } custom={ look.text && ! TEXTS.some( ( [ v ] ) => v === look.text ) ? { css: css( look.text ), label: __( 'Custom — edit', 'blicks' ), onEdit: () => setEdit( 'text' ) } : undefined } onMore={ () => setEdit( 'text' ) } moreLabel={ __( 'More colors', 'blicks' ) } />
			</Row>
			{ kind === 'box' && (
				<Row label={ __( 'Picture', 'blicks' ) } stack set={ !! look.img } action={ door2( !! look.img, 'image' ) }>
					<PicturePicker value={ look.img } onChange={ ( img ) => set( { img, dim: img && ! look.dim ? 'medium' : img ? look.dim : '' } ) } />
				</Row>
			) }
			{ kind === 'box' && look.img && (
				<Row label={ __( 'Darken it', 'blicks' ) } stack set={ !! look.dim }>
					<Steps options={ DIMS } value={ look.dim } onChange={ ( dim ) => set( { dim: dim as Look[ 'dim' ] } ) } />
				</Row>
			) }
			{ ( kind === 'box' || kind === 'button' ) && (
				<Row label={ __( 'Finish', 'blicks' ) } stack set={ !! look.finish } action={ look.finish ? door2( finishCustom, 'finish' ) : undefined }>
					<Opts columns={ 4 } value={ look.finish } onChange={ pickFinish } options={ finishes } />
				</Row>
			) }
		</>
	);
	const fill = <Sec title={ __( 'Fill', 'blicks' ) } icon="format_color_fill" value={ summary.fill } { ...more( 'fill' ) }>{ fillRows }</Sec>;

	// A button's theme already rounds its corners, so "no value" is the theme's and Square is 0.
	// A radius no choice names (set in the design panel, say) presses none of them.
	const buttonRadius = typeof look.radius === 'string' && ! hiddenFor( hiddenAll, 'corners' ).length ? ( look.radius === 'lg' ? 'md' : look.radius ) : null;
	const borderRows = (
		<>
			<Row label={ __( 'Border', 'blicks' ) } set={ !! look.border } action={ look.border || borderCustom ? fineTune( 'border', borderCustom, 'border' ) : undefined }>
				<SegText label={ __( 'Border', 'blicks' ) } options={ [ [ '', __( 'None', 'blicks' ) ], [ 'thin', __( 'Thin', 'blicks' ) ], [ 'thick', __( 'Thick', 'blicks' ) ] ] } value={ typeof look.border === 'object' ? null : look.border } onChange={ ( b ) => set( { border: b as Look[ 'border' ], bcol: b ? look.bcol : '' } ) } />
			</Row>
			{ look.border && (
				<Row label={ __( 'Line color', 'blicks' ) } stack set={ !! look.bcol }>
					<Swatches small swatches={ sw( [ [ 'border', __( 'Line gray', 'blicks' ) ], [ 'foreground', __( 'Ink', 'blicks' ) ], [ 'primary', __( 'Brand', 'blicks' ) ], [ 'background', __( 'White', 'blicks' ) ], [ 'destructive', __( 'Warning red', 'blicks' ) ] ] ) } value={ look.bcol || 'foreground' } onChange={ ( bcol ) => set( { bcol } ) } onMore={ () => setEdit( 'border' ) } moreLabel={ __( 'More colors', 'blicks' ) } />
				</Row>
			) }
			{ kind === 'button' ? (
				<Row label={ __( 'Corners', 'blicks' ) } set={ !! look.radius } note={ buttonRadius === '' ? __( 'From the theme', 'blicks' ) : undefined } noteIcon="north_west" action={ fineTune( 'corners', radiusCustom, 'corners' ) }>
					<SegIcons label={ __( 'Corners', 'blicks' ) } options={ BUTTON_RADII } value={ buttonRadius } onChange={ ( radius ) => set( { radius } ) } />
				</Row>
			) : (
				<Row label={ __( 'Corners', 'blicks' ) } set={ !! look.radius } action={ fineTune( 'corners', radiusCustom, 'corners' ) }>
					<SegIcons label={ __( 'Corners', 'blicks' ) } options={ RADII } value={ typeof look.radius === 'string' ? ( look.radius === 'md' ? 'lg' : look.radius ) : null } onChange={ ( radius ) => set( { radius } ) } />
				</Row>
			) }
		</>
	);
	const borderCorners = <Sec title={ __( 'Border and corners', 'blicks' ) } icon="border_style" value={ summary.border } { ...more( 'border' ) }>{ borderRows }</Sec>;

	const textSec = (
		<Sec title={ __( 'Text', 'blicks' ) } icon="text_fields" value={ look.fsize !== normalSize ? nameIn( SIZES_T, String( look.fsize ) ) ?? custom : '' } { ...more( 'text-style' ) }>
			<Row label={ __( 'Size', 'blicks' ) } stack set={ look.fsize !== normalSize || textCustom } action={ fineTune( 'text-style', textCustom, 'text-style' ) }>
				<Steps label={ __( 'Text size', 'blicks' ) } options={ SIZES_T } value={ look.fsize === normalSize ? '' : String( look.fsize ) } onChange={ ( n ) => set( { fsize: n ? Number( n ) : normalSize } ) } />
			</Row>
		</Sec>
	);

	// ── States: what it does when pointed at, pressed, and reached by keyboard ──
	// Keyboard focus: a ring drawn with a shadow, or an outline (dashed rings and the like).
	const ol = { ...FOCUS_OUTLINE, ...look.focusOl };
	const setOl = ( p: Partial< FocusOutline > ) => set( { focusOl: { ...look.focusOl, ...p } } );
	const focusRow = (
		<>
			<Row label={ __( 'Keyboard focus', 'blicks' ) } stack set={ !! look.focus } note={ __( 'Shown when someone reaches it with Tab', 'blicks' ) } noteIcon="keyboard">
				<SegText label={ __( 'Keyboard focus', 'blicks' ) } options={ [ [ '', __( 'Browser', 'blicks' ) ], [ 'ring', __( 'Ring', 'blicks' ) ], [ 'gap', __( 'Gap', 'blicks' ) ], [ 'glow', __( 'Glow', 'blicks' ) ], [ 'outline', __( 'Outline', 'blicks' ) ] ] } value={ look.focus } onChange={ ( focus ) => set( { focus: focus as Look[ 'focus' ] } ) } />
			</Row>
			{ look.focus === 'outline' && (
				<>
					<Row label={ __( 'Outline line', 'blicks' ) } stack>
						<SegText label={ __( 'Line', 'blicks' ) } options={ [ [ 'dashed', __( 'Dashed', 'blicks' ) ], [ 'dotted', __( 'Dotted', 'blicks' ) ], [ 'solid', __( 'Solid', 'blicks' ) ] ] } value={ ol.line } onChange={ ( line ) => setOl( { line: line as FocusOutline[ 'line' ] } ) } />
					</Row>
					<Row label={ __( 'Outline color', 'blicks' ) } stack>
						<Swatches small swatches={ sw( [ [ 'primary', __( 'Brand', 'blicks' ) ], [ 'foreground', __( 'Ink', 'blicks' ) ], [ 'background', __( 'White', 'blicks' ) ] ] ) } value={ ol.col } onChange={ ( col ) => setOl( { col } ) } />
					</Row>
					<Slider label={ __( 'Width', 'blicks' ) } min={ 1 } max={ 4 } value={ ol.w } onChange={ ( w ) => setOl( { w } ) } />
					<Slider label={ __( 'Gap', 'blicks' ) } min={ 0 } max={ 6 } value={ ol.off } onChange={ ( off ) => setOl( { off } ) } />
				</>
			) }
		</>
	);
	const hoverRow = ( options: Option[] = look.hoverFrom === 'card' ? [ HOVERS[ 0 ]!, ...REVEALS, ...HOVERS.slice( 1 ) ] : HOVERS ) => (
		<Row label={ __( 'On hover', 'blicks' ) } stack set={ !! look.hover && look.hover !== 'none' } action={ fineTune( 'hover', hoverCustom, 'hover' ) }
			note={ look.hoverFrom === 'card' ? __( 'Plays when anything on its card is pointed at or has keyboard focus.', 'blicks' ) : undefined } noteIcon="info">
			{ card.available && (
				<SegText
					label={ __( 'Reacts when', 'blicks' ) }
					options={ [ [ 'self', __( 'Pointed at', 'blicks' ) ], [ 'card', __( 'Its card is', 'blicks' ) ] ] }
					value={ look.hoverFrom }
					onChange={ ( from ) => {
						const hoverFrom = from as Look[ 'hoverFrom' ];
						// A reveal on the block itself would hide what has to be pointed at.
						const reveal = hoverFrom === 'self' && ( look.hover === 'appear' || look.hover === 'slide' );
						set( { hoverFrom, ...( reveal ? { hover: 'none', hoverX: null } : {} ) } );
						if ( hoverFrom === 'card' ) card.mark();
					} }
				/>
			) }
			<Chips label={ __( 'On hover', 'blicks' ) } options={ options } value={ hoverCustom ? null : look.hover } onChange={ ( h ) => set( { hover: h, hoverX: null } ) } />
		</Row>
	);
	const hoverSwitches = (
		<>
			{ turnsIn3d( tree ) && (
				<Switch
					label={ __( 'Hide its back when turned', 'blicks' ) }
					checked={ tree[ 'effects.backfaceVisibility' ]?.default?.base === 'hidden' }
					onChange={ ( on ) => {
						const next = { ...tree };
						if ( on ) next[ 'effects.backfaceVisibility' ] = { default: { base: 'hidden' } };
						else delete next[ 'effects.backfaceVisibility' ];
						setAttributes( { blicks: next } );
					} }
				/>
			) }
			{ card.container && (
				<Switch
					label={ __( 'Blocks inside react to this', 'blicks' ) }
					checked={ isCard( tree ) }
					onChange={ ( on ) => {
						const next = { ...tree };
						delete next[ CARD_CONTROL ];
						setAttributes( { blicks: on ? markCard( next ) : next } );
					} }
				/>
			) }
		</>
	);

	// When clicked: a linked block's own press, or — for a block that answers to its card — the card
	// being pressed. A block nobody clicks directly only has the card.
	const pressable = linked || card.available;
	const pressRow = ( options: Option[] ) => (
		<Row label={ __( 'When clicked', 'blicks' ) } stack set={ !! look.press && look.press !== 'none' } action={ fineTune( 'press', pressCustom, 'press' ) }
			note={ ! linked || look.pressFrom === 'card' ? __( 'Plays while anything on its card is pressed.', 'blicks' ) : undefined } noteIcon="info">
			{ linked && card.available && (
				<SegText
					label={ __( 'Reacts when', 'blicks' ) }
					options={ [ [ 'self', __( 'Pressed', 'blicks' ) ], [ 'card', __( 'Its card is', 'blicks' ) ] ] }
					value={ look.pressFrom }
					onChange={ ( from ) => {
						set( { pressFrom: from as Look[ 'pressFrom' ] } );
						if ( from === 'card' ) card.mark();
					} }
				/>
			) }
			<Chips
				label={ __( 'When clicked', 'blicks' ) }
				options={ options }
				value={ pressCustom ? null : look.press }
				onChange={ ( p ) => {
					const pressFrom = linked ? look.pressFrom : 'card';
					set( { press: p, pressX: null, pressFrom } );
					if ( pressFrom === 'card' && p !== 'none' ) card.mark();
				} }
			/>
		</Row>
	);
	const states = ( rows: ReactNode ) => <Sec title={ __( 'States', 'blicks' ) } icon="arrow_selector_tool" value={ summary.states }>{ rows }</Sec>;

	const decorations = inStudio ? (
		<>
			<DecorationsSec tree={ tree } onOpen={ ( part ) => setEdit( part === 'before' ? 'deco-before' : 'deco-after' ) } />
			<AllSettingsSec tree={ tree } hidden={ hiddenAll.length } onOpen={ () => setEdit( 'all' ) } />
		</>
	) : (
		<EditInStudioSec hidden={ hiddenAll } />
	);

	const outRow = ( custom = padCustom ) => (
		<Row label={ __( 'Above and below', 'blicks' ) } stack set={ !! look.out } action={ fineTune( 'space', custom, 'space' ) }>
			<Steps label={ __( 'Space above and below', 'blicks' ) } options={ OUTS } value={ custom ? null : outKey } onChange={ ( o ) => set( { out: o ? [ Number( o ), 0, Number( o ), 0 ] : null } ) } />
		</Row>
	);

	if ( kind === 'divider' ) {
		return (
			<>
				{ before }
				<Sec title={ __( 'Fill', 'blicks' ) } icon="format_color_fill" value={ summary.fill } { ...more( 'fill' ) }>
					<Row label={ __( 'Color', 'blicks' ) } stack set={ !! look.fill }>
						<Swatches swatches={ sw( LINES ) } value={ typeof look.fill === 'string' ? look.fill : null } onChange={ ( fill ) => set( { fill } ) } custom={ fillSwatch } onMore={ () => setEdit( 'fill' ) } moreLabel={ __( 'More colors', 'blicks' ) } />
					</Row>
					<Row label={ __( 'Line', 'blicks' ) } stack set={ !! look.dline && look.dline !== 'solid' }>
						<SegText label={ __( 'Line', 'blicks' ) } options={ [ [ 'solid', __( 'Solid', 'blicks' ) ], [ 'dashed', __( 'Dashed', 'blicks' ) ], [ 'dotted', __( 'Dotted', 'blicks' ) ], [ 'double', __( 'Double', 'blicks' ) ] ] } value={ look.dline } onChange={ ( dline ) => set( { dline: dline as Look[ 'dline' ] } ) } />
					</Row>
				</Sec>
				<Sec title={ __( 'Space', 'blicks' ) } icon="padding" value={ summary.space }>{ outRow( false ) }</Sec>
				{ after }
			</>
		);
	}

	const shadowRow = (
		<Row label={ __( 'Shadow', 'blicks' ) } stack set={ !! look.shadow } action={ fineTune( 'shadow', shadowCustom, 'shadow' ) }>
			<Opts columns={ 4 } value={ shadowCustom ? null : ( look.shadow as string ) } onChange={ ( sh ) => set( { shadow: sh as Look[ 'shadow' ] } ) } options={ ( [ [ '', __( 'None', 'blicks' ), 'none' ], [ 'sm', __( 'Soft', 'blicks' ), '0 1px 2px rgb(0 0 0/22%)' ], [ 'md', __( 'Medium', 'blicks' ), '0 3px 8px rgb(0 0 0/25%)' ], [ 'lg', __( 'Strong', 'blicks' ), '0 8px 14px -4px rgb(0 0 0/40%)' ] ] as const ).map( ( [ v, l, s ] ) => [ v, l, <span key={ v } className="shv" style={ { boxShadow: s } } /> ] ) } />
		</Row>
	);
	const depthRow = ( pushOnLink: boolean ) => (
		<Row label={ __( 'Depth', 'blicks' ) } stack set={ !! look.depth } action={ door2( !! ( Object.keys( look.depthX ).length || look.tilt ), 'depth' ) }>
			<DepthCards value={ look.depth } onChange={ ( depth ) => set( { depth, depthX: {}, press: depth && look.press === 'none' && pushOnLink ? 'push' : ! depth && look.press === 'push' ? 'none' : look.press } ) } />
		</Row>
	);
	const shadowDepth = ( withDepth: boolean, pushOnLink = true ) => (
		<Sec title={ __( 'Shadow and depth', 'blicks' ) } icon="shadow" value={ summary.shadow } { ...more( 'shadow' ) }>
			{ shadowRow }
			{ withDepth && depthRow( pushOnLink ) }
		</Sec>
	);

	// An image keeps its own colour, caption and hover (its `before` and `after`); the frame around
	// it is what is shared, its depth tiles included. It is never pressed, so a depth adds no push.
	if ( kind === 'image' ) {
		return (
			<>
				{ before }
				{ borderCorners }
				{ shadowDepth( true, false ) }
				<Sec title={ __( 'Space', 'blicks' ) } icon="padding" value={ summary.space }>{ outRow() }</Sec>
				{ after }
				{ decorations }
			</>
		);
	}

	// An icon is drawn in its text colour; a ring or a badge behind it gives it a shape and room.
	if ( kind === 'icon' ) {
		const room = Array.isArray( look.pad ) && look.pad.every( ( n ) => n === 12 );
		const framed = ( p: Partial< Look > ) => ! ( p.border ?? look.border ) && ! ( p.fill ?? look.fill );
		// Turning the last of ring and badge off takes the shape and the room it brought with it.
		const frame = ( p: Partial< Look > ) => set( framed( p )
			? { ...p, radius: typeof look.radius === 'string' ? '' : look.radius, pad: room ? '' : look.pad }
			: { radius: look.radius || 'full', pad: look.pad || ICON_ROOM, ...p } );
		const out = look.out;
		const aroundKey = ! out ? '' : out.every( ( n ) => n === out[ 0 ] ) && [ '8', '16', '32' ].includes( String( out[ 0 ] ) ) ? String( out[ 0 ] ) : null;
		const spaceCustom = aroundKey === null || ( !! look.pad && ! room );
		const iconTextCustom = !! look.text && ! ICON_COLOURS.some( ( [ v ] ) => v === look.text );
		return (
			<>
				{ before }
				<Sec title={ __( 'Fill', 'blicks' ) } icon="format_color_fill" value={ summary.fill } { ...more( 'fill' ) }>
					<Row label={ __( 'Color', 'blicks' ) } stack set={ !! look.text }>
						<Swatches swatches={ sw( ICON_COLOURS ) } empty="auto" value={ look.text } onChange={ ( text ) => set( { text } ) } custom={ iconTextCustom ? { css: css( look.text ), label: __( 'Custom — edit', 'blicks' ), onEdit: () => setEdit( 'text' ) } : undefined } onMore={ () => setEdit( 'text' ) } moreLabel={ __( 'More colors', 'blicks' ) } />
					</Row>
					<Switch label={ __( 'Badge behind it', 'blicks' ) } checked={ !! look.fill } onChange={ ( on ) => frame( { fill: on ? 'secondary' : '' } ) } />
					{ look.fill && (
						<Row label={ __( 'Badge', 'blicks' ) } stack set>
							<Swatches small swatches={ sw( BG.filter( ( [ v ] ) => v ) ) } value={ typeof look.fill === 'string' ? look.fill : null } onChange={ ( f ) => set( { fill: f } ) } custom={ fillSwatch } onMore={ () => setEdit( 'fill' ) } moreLabel={ __( 'More colors', 'blicks' ) } />
						</Row>
					) }
				</Sec>
				<Sec title={ __( 'Border and corners', 'blicks' ) } icon="border_style" value={ summary.border } { ...more( 'border' ) }>
					<Row label={ __( 'Ring', 'blicks' ) } set={ !! look.border }>
						<SegText label={ __( 'Ring', 'blicks' ) } options={ [ [ '', __( 'None', 'blicks' ) ], [ 'thin', __( 'Thin', 'blicks' ) ], [ 'thick', __( 'Thick', 'blicks' ) ] ] } value={ typeof look.border === 'object' ? null : look.border } onChange={ ( b ) => frame( { border: b as Look[ 'border' ], bcol: b ? look.bcol || 'currentcolor' : '' } ) } />
					</Row>
					{ ( look.border || look.fill ) && (
						<Row label={ __( 'Shape', 'blicks' ) } set={ !! look.radius } action={ fineTune( 'corners', radiusCustom, 'corners' ) }>
							<SegIcons label={ __( 'Shape', 'blicks' ) } options={ ICON_SHAPES } value={ radiusCustom ? null : String( look.radius || 'none' ) } onChange={ ( radius ) => set( { radius } ) } />
						</Row>
					) }
				</Sec>
				<Sec title={ __( 'Space', 'blicks' ) } icon="padding" value={ summary.space }>
					<Row label={ __( 'Around', 'blicks' ) } stack set={ !! look.out } action={ fineTune( 'space', spaceCustom, 'space' ) }>
						<Steps label={ __( 'Space around', 'blicks' ) } options={ AROUND } value={ aroundKey } onChange={ ( o ) => set( { out: o ? [ Number( o ), Number( o ), Number( o ), Number( o ) ] : null } ) } />
					</Row>
				</Sec>
				{ states( <>
					{ hoverRow( [ 'none', 'lift', 'grow', 'darken', 'glow' ].map( ( k ) => HOVERS.find( ( h ) => h[ 0 ] === k )! ) ) }
					{ pressable && pressRow( PRESSES.slice( 0, 2 ) ) }
					{ linked && focusRow }
				</> ) }
				{ after }
				{ decorations }
			</>
		);
	}

	if ( kind === 'button' ) {
		const pv = Array.isArray( look.pad ) ? look.pad : null;
		const pairKey = pv && pv[ 0 ] === pv[ 2 ] && pv[ 1 ] === pv[ 3 ] ? `${ pv[ 0 ] },${ pv[ 1 ] }` : '';
		const padKey = look.pad === '' ? '' : BUTTON_P.some( ( [ v ] ) => v && v === pairKey ) ? pairKey : null;
		const outCustom = !! look.out && ! ( look.out[ 0 ] === look.out[ 2 ] && ! look.out[ 1 ] && ! look.out[ 3 ] && [ 16, 32, 48 ].includes( look.out[ 0 ] ) );
		const pair = ( k: string ) => { const [ y, x ] = k.split( ',' ).map( Number ); return [ y, x, y, x ]; };
		return (
			<>
				{ before }
				{ textSec }
				{ fill }
				{ borderCorners }
				{ shadowDepth( true ) }
				<Sec title={ __( 'Space', 'blicks' ) } icon="padding" value={ summary.space }>
					<Row label={ __( 'Inside', 'blicks' ) } stack set={ !! look.pad } action={ fineTune( 'space', padKey === null, 'space' ) }>
						<Steps label={ __( 'Space inside', 'blicks' ) } options={ BUTTON_P } value={ padKey } onChange={ ( k ) => set( { pad: k ? pair( k ) : '' } ) } />
					</Row>
					{ outRow( outCustom ) }
				</Sec>
				{ states( <>
					{ hoverRow() }
					{ hoverSwitches }
					{ pressRow( PRESSES ) }
					{ focusRow }
				</> ) }
				{ after }
				{ decorations }
			</>
		);
	}

	if ( kind === 'badge' ) {
		return (
			<>
				{ before }
				{ textSec }
				{ fill }
				{ borderCorners }
				<Sec title={ __( 'Space', 'blicks' ) } icon="padding" value={ summary.space }>
					<Row label={ __( 'Inside', 'blicks' ) } stack set={ !! look.pad } action={ fineTune( 'space', Array.isArray( look.pad ) || !! look.out, 'space' ) }>
						<Steps label={ __( 'Space inside', 'blicks' ) } options={ BADGE_P } value={ typeof look.pad === 'string' ? look.pad : null } onChange={ ( pad ) => set( { pad } ) } />
					</Row>
				</Sec>
				{ states( <>{ hoverRow() }{ hoverSwitches }</> ) }
				{ after }
				{ decorations }
			</>
		);
	}

	return (
		<>
			{ before }
			{ textSec }
			{ fill }
			{ borderCorners }
			{ shadowDepth( true, linked ) }
			<Sec title={ __( 'Space', 'blicks' ) } icon="padding" value={ summary.space }>
				<Row label={ __( 'Inside', 'blicks' ) } stack set={ !! look.pad } action={ fineTune( 'space', padCustom, 'space' ) }>
					<Steps label={ __( 'Space inside', 'blicks' ) } options={ PADS } value={ typeof look.pad === 'string' ? look.pad : null } onChange={ ( pad ) => set( { pad } ) } />
				</Row>
				{ outRow() }
			</Sec>
			{ states( <>
				{ hoverRow() }
				{ hoverSwitches }
				{ pressable && pressRow( PRESSES ) }
				{ linked && focusRow }
			</> ) }
			{ after }
			{ decorations }
		</>
	);
}

// ── pieces ───────────────────────────────────────────────────────────────────

function gradientCss( layers: GradLayer[], css: ( c: string ) => string ): string {
	const stop = ( s: GradLayer[ 'stops' ][ number ] ) => {
		const c = isHex( s.c ) ? s.c : css( s.c );
		return `${ s.a >= 100 ? c : `color-mix(in srgb, ${ c } ${ s.a }%, transparent)` } ${ s.p }%`;
	};
	return layers.map( ( l ) => {
		const stops = [ ...l.stops ].sort( ( a, b ) => a.p - b.p ).map( stop ).join( ', ' );
		if ( l.type === 'radial' ) return `radial-gradient(${ l.shape } at ${ l.pos }, ${ stops })`;
		if ( l.type === 'conic' ) return `conic-gradient(from ${ l.angle }deg at ${ l.pos }, ${ stops })`;
		return `linear-gradient(${ l.angle }deg, ${ stops })`;
	} ).join( ', ' ) || 'transparent';
}

function HexField( { value, fallback, onChange, className }: { value: string; fallback: string; onChange: ( v: string ) => void; className?: string } ) {
	const [ draft, setDraft ] = useState( value );
	return (
		<div className={ `ce-custom ${ className ?? '' }` }>
			<input type="color" value={ isHex( value ) ? expandHex( value ) : fallback } aria-label={ __( 'Pick any color', 'blicks' ) } onChange={ ( e ) => onChange( e.currentTarget.value ) } />
			<label className="inp">
				<input
					value={ draft }
					placeholder={ fallback.toUpperCase() }
					spellCheck={ false }
					aria-label={ __( 'Color code', 'blicks' ) }
					onChange={ ( e ) => setDraft( e.currentTarget.value ) }
					onBlur={ () => {
						const h = draft.trim().startsWith( '#' ) ? draft.trim() : `#${ draft.trim() }`;
						if ( isHex( h ) ) onChange( expandHex( h ) );
					} }
				/>
			</label>
		</div>
	);
}

function PicturePicker( { value, onChange }: { value: string; onChange: ( url: string ) => void } ) {
	return (
		<div className="pics">
			<button type="button" className="pic" aria-pressed={ ! value } title={ __( 'No picture', 'blicks' ) } aria-label={ __( 'No picture', 'blicks' ) } onClick={ () => onChange( '' ) }><span className="nopic" /></button>
			{ value && <button type="button" className="pic" aria-pressed="true" title={ __( 'Current picture', 'blicks' ) } aria-label={ __( 'Current picture', 'blicks' ) }><span style={ { backgroundImage: `url("${ value }")` } } /></button> }
			<MediaUploadCheck>
				<MediaUpload
					allowedTypes={ [ 'image' ] }
					onSelect={ ( media: any ) => onChange( media?.url ?? '' ) }
					render={ ( { open }: { open: () => void } ) => (
						<button type="button" className="pic more" title={ __( 'Choose from Media Library', 'blicks' ) } aria-label={ __( 'Choose from Media Library', 'blicks' ) } onClick={ open }>
							<Icon d="M12 7v10M7 12h10" size={ 16 } />
						</button>
					) }
				/>
			</MediaUploadCheck>
		</div>
	);
}

function DepthCards( { value, onChange }: { value: Look[ 'depth' ]; onChange: ( v: Look[ 'depth' ] ) => void } ) {
	return (
		<Opts columns={ 4 } value={ value } onChange={ onChange } options={ DEPTHS.map( ( [ v, l, sh ] ) => [ v, l, <span key={ v } className="hov"><span className="mini" style={ { background: '#4f46e5', color: '#fff', boxShadow: sh || undefined } }>Aa</span></span> ] ) } />
	);
}

function SpaceSliders( { pv, paired: initial, setPad }: { pv: number[]; paired: boolean; setPad: ( i: number | 'v' | 'h', n: number ) => void } ) {
	const [ paired, setPaired ] = useState( initial );
	return (
		<>
			<Switch label={ __( 'Same top and bottom, left and right', 'blicks' ) } checked={ paired } onChange={ setPaired } />
			{ paired ? (
					<>
						<Slider label={ __( 'Up and down', 'blicks' ) } icon={ UPDOWN } min={ 0 } max={ 96 } value={ pv[ 0 ] } onChange={ ( n ) => setPad( 'v', n ) } />
						<Slider label={ __( 'Left and right', 'blicks' ) } icon={ LEFTRIGHT } min={ 0 } max={ 96 } value={ pv[ 1 ] } onChange={ ( n ) => setPad( 'h', n ) } />
					</>
				) : SIDE_ICONS.map( ( [ l, ic ], i ) => <Slider key={ l } label={ l } icon={ ic } min={ 0 } max={ 96 } value={ pv[ i ] } onChange={ ( n ) => setPad( i, n ) } /> ) }
		</>
	);
}

function CornerEditor( { look, set, back, clear }: { look: Look; set: ( p: Partial< Look > ) => void; back: () => void; clear: [ string, Look[ 'radius' ] ] } ) {
	const c = typeof look.radius === 'object' && 'c' in look.radius ? look.radius.c : Array( 4 ).fill( RADIUS_PX[ look.radius as string ] ?? 0 );
	const sketch = typeof look.radius === 'object' && 'sketch' in look.radius;
	const [ linked, setLinked ] = useState( c.every( ( n: number ) => n === c[ 0 ] ) );
	const scale = ( n: number ) => ( n >= 999 ? 99 : Math.round( n * 0.6 ) );
	const setCorner = ( i: number, n: number ) => set( { radius: { c: linked ? [ n, n, n, n ] : c.map( ( v: number, j: number ) => ( j === i ? n : v ) ) } } );
	return (
		<SubView title={ __( 'Corners', 'blicks' ) } onBack={ back } preview={ { background: 'var(--primary)', border: 0, backgroundImage: 'none', borderRadius: sketch ? '22px 4px 18px 4px / 4px 18px 4px 22px' : c.map( ( n: number ) => `${ scale( n ) }px` ).join( ' ' ) } } clearLabel={ clear[ 0 ] } onClear={ () => set( { radius: clear[ 1 ] } ) }>
			<Sec title={ __( 'Ready-made', 'blicks' ) } icon="crop_square">
			<Row label={ __( 'Shapes', 'blicks' ) } stack>
			<Opts columns={ 5 } showLabels={ false } value={ sketch ? 'sketch' : c.join( ',' ) } onChange={ ( v ) => set( { radius: v === 'sketch' ? { sketch: true } : { c: v.split( ',' ).map( Number ) } } ) } options={ SHAPES.map( ( [ l, arr ] ) => [
				arr === 'sketch' ? 'sketch' : arr.join( ',' ), l,
				<span key={ l } className="mb2" style={ { borderRadius: arr === 'sketch' ? '22px 4px 18px 4px / 4px 18px 4px 22px' : arr.map( ( n ) => `${ scale( n ) }px` ).join( ' ' ) } } />,
			] ) } />
			</Row>
			</Sec>
			<Sec title={ __( 'Exact', 'blicks' ) } icon="tune">
			<Switch label={ __( 'Same for all corners', 'blicks' ) } checked={ linked } onChange={ setLinked } />
				{ linked
					? <Slider label={ __( 'All corners', 'blicks' ) } min={ 0 } max={ 48 } value={ Math.min( c[ 0 ], 48 ) } display={ c[ 0 ] >= 999 ? 'pill' : `${ c[ 0 ] }px` } onChange={ ( n ) => setCorner( 0, n ) } />
					: CORNER_ICONS.map( ( [ l, ic ], i ) => <Slider key={ l } label={ l } icon={ ic } min={ 0 } max={ 48 } value={ Math.min( c[ i ], 48 ) } display={ c[ i ] >= 999 ? 'pill' : `${ c[ i ] }px` } onChange={ ( n ) => setCorner( i, n ) } /> ) }
			</Sec>
		</SubView>
	);
}

function ShadowEditor( { look, set, back, css }: { look: Look; set: ( p: Partial< Look > ) => void; back: () => void; css: ( c: string ) => string } ) {
	const TOK: Record< string, string > = { sm: 'soft', md: 'medium', lg: 'strong' };
	const layers: ShadowLayer[] = typeof look.shadow === 'object' ? look.shadow.layers : look.shadow ? SHADOW_PRESETS[ TOK[ look.shadow ] ].layers : [];
	const [ li, setLi ] = useState( 0 );
	const l = layers[ Math.min( li, layers.length - 1 ) ] ?? { inset: false, x: 0, y: 4, b: 12, s: 0, c: '#000000', a: 20 };
	const one = ( q: ShadowLayer ) => `${ q.inset ? 'inset ' : '' }${ q.x }px ${ q.y }px ${ q.b }px ${ q.s }px ${ q.a >= 100 ? ( isHex( q.c ) ? q.c : css( q.c ) ) : `color-mix(in srgb, ${ isHex( q.c ) ? q.c : css( q.c ) } ${ q.a }%, transparent)` }`;
	const edit = ( p: Partial< ShadowLayer > ) => {
		const ls = layers.length ? layers.map( ( q, i ) => ( i === Math.min( li, layers.length - 1 ) ? { ...q, ...p } : q ) ) : [ { ...l, ...p } ];
		set( { shadow: { layers: ls } } );
	};
	const preset = typeof look.shadow === 'object' ? look.shadow.preset : TOK[ look.shadow as string ];
	return (
		<SubView title={ __( 'Shadow', 'blicks' ) } onBack={ back } preview={ { background: '#fff', backgroundImage: 'none', border: 0, boxShadow: layers.map( one ).join( ', ' ) || 'none' } } clearLabel={ __( 'No shadow', 'blicks' ) } onClear={ () => set( { shadow: '' } ) }>
			<Sec title={ __( 'Ready-made', 'blicks' ) } icon="shadow">
			<div className="lrows">
				{ Object.entries( SHADOW_PRESETS ).map( ( [ k, p ] ) => (
					<button key={ k } type="button" aria-pressed={ preset === k } onClick={ () => { setLi( 0 ); set( { shadow: { preset: k, layers: p.layers.map( ( q ) => ( { ...q } ) ) } } ); } }>
						<span className="shv" style={ { boxShadow: p.layers.map( one ).join( ', ' ) } } />{ p.label }
					</button>
				) ) }
			</div>
			</Sec>
			<Sec title={ __( 'Make your own', 'blicks' ) } icon="tune">
			<Row label={ __( 'Falls', 'blicks' ) } set={ l.inset }>
				<SegSource label={ __( 'Falls', 'blicks' ) } options={ [ [ 'out', __( 'Outside', 'blicks' ) ], [ 'in', __( 'Inside', 'blicks' ) ] ] } value={ l.inset ? 'in' : 'out' } onChange={ ( v ) => edit( { inset: v === 'in' } ) } />
			</Row>
			<Slider label={ __( 'Across', 'blicks' ) } min={ -40 } max={ 40 } value={ l.x } onChange={ ( x ) => edit( { x } ) } />
			<Slider label={ __( 'Down', 'blicks' ) } min={ -40 } max={ 40 } value={ l.y } onChange={ ( y ) => edit( { y } ) } />
			<Slider label={ __( 'Blur', 'blicks' ) } min={ 0 } max={ 80 } value={ l.b } onChange={ ( b ) => edit( { b } ) } />
			<Slider label={ __( 'Size', 'blicks' ) } min={ -20 } max={ 40 } value={ l.s } onChange={ ( s ) => edit( { s } ) } />
			<Row label={ __( 'Color', 'blicks' ) } stack>
				<div className="swatches sm">
					{ [ [ '#000000', __( 'Black', 'blicks' ) ], ...THEME.filter( ( [ t ] ) => ! [ 'border', 'muted', 'secondary' ].includes( t ) ) ].map( ( [ t, tl ] ) => <button key={ t } type="button" className="swc" style={ { background: isHex( t ) ? t : css( t ) } } aria-pressed={ l.c === t } title={ tl } aria-label={ tl } onClick={ () => edit( { c: t } ) } /> ) }
				</div>
			</Row>
			<Row label={ __( 'Any color', 'blicks' ) } stack>
				<HexField value={ isHex( l.c ) ? l.c : '' } fallback="#000000" onChange={ ( c ) => edit( { c } ) } />
			</Row>
			<Slider label={ __( 'Opacity', 'blicks' ) } min={ 0 } max={ 100 } value={ l.a } unit="%" onChange={ ( a ) => edit( { a } ) } />
			<button type="button" className="link-add" onClick={ () => { set( { shadow: { layers: [ ...layers, { inset: false, x: 0, y: 2, b: 6, s: 0, c: '#000000', a: 15 } ] } } ); setLi( layers.length ); } }>
				<Icon d="M12 7v10M7 12h10" size={ 14 } />{ __( 'Add another shadow', 'blicks' ) }
			</button>
			</Sec>
		</SubView>
	);
}

function StateEditor( { which, look, set, back, css }: { which: 'hover' | 'press'; look: Look; set: ( p: Partial< Look > ) => void; back: () => void; css: ( c: string ) => string } ) {
	const isH = which === 'hover';
	const c = stateOf( look, which );
	const presets = isH ? HOVERS : PRESSES;
	const custom = isH ? look.hoverX : look.pressX;
	const editC = ( p: Partial< StateLook > ) => {
		const next = { ...c, ...p };
		for ( const k of Object.keys( next ) as Array< keyof StateLook > ) if ( next[ k ] === undefined ) delete next[ k ];
		set( isH ? { hover: 'custom', hoverX: next } : { press: 'custom', pressX: next } );
	};
	const small = ( key: 'fill' | 'text' | 'bcol', list: Array< [ string, string ] > ) => (
		<div className="swatches sm">
			<button type="button" className="swc nochange" aria-pressed={ ! c[ key ] } title={ __( 'No change', 'blicks' ) } aria-label={ __( 'No change', 'blicks' ) } onClick={ () => editC( { [ key ]: undefined } ) } />
			{ list.map( ( [ t, l ] ) => <button key={ t } type="button" className="swc" style={ { background: css( t ) } } aria-pressed={ c[ key ] === t } title={ l } aria-label={ l } onClick={ () => editC( { [ key ]: t } ) } /> ) }
		</div>
	);
	return (
		<SubView title={ isH ? __( 'On hover', 'blicks' ) : __( 'When clicked', 'blicks' ) } onBack={ back } clearLabel={ isH ? __( 'Nothing changes on hover', 'blicks' ) : __( 'Nothing changes when clicked', 'blicks' ) } onClear={ () => set( isH ? { hover: 'none', hoverX: null } : { press: 'none', pressX: null } ) }>
			<Sec title={ __( 'Ready-made', 'blicks' ) } icon="arrow_selector_tool">
				<Row label={ isH ? __( 'On hover', 'blicks' ) : __( 'When clicked', 'blicks' ) } stack set={ ! custom && ( isH ? look.hover : look.press ) !== 'none' }>
					<Chips label={ __( 'Ready-made', 'blicks' ) } options={ presets.map( ( [ v, l ] ) => [ v, l ] as Option ) } value={ custom ? null : ( isH ? look.hover : look.press ) } onChange={ ( v ) => set( isH ? { hover: v, hoverX: null } : { press: v, pressX: null } ) } />
				</Row>
			</Sec>
			<Sec title={ __( 'Make your own', 'blicks' ) } icon="tune">
				<Row label={ __( 'Fill', 'blicks' ) } stack set={ !! c.fill }>
					{ small( 'fill', THEME.filter( ( [ t ] ) => ! [ 'border', 'muted' ].includes( t ) ) ) }
				</Row>
				<Row label={ __( 'Text color', 'blicks' ) } stack set={ !! c.text }>
					{ small( 'text', [ [ 'background', __( 'White', 'blicks' ) ], [ 'foreground', __( 'Ink', 'blicks' ) ], [ 'primary', __( 'Brand', 'blicks' ) ], [ 'destructive', __( 'Warning red', 'blicks' ) ] ] ) }
				</Row>
				{ look.border && (
					<Row label={ __( 'Border', 'blicks' ) } stack set={ !! c.bcol }>
						{ small( 'bcol', [ [ 'foreground', __( 'Ink', 'blicks' ) ], [ 'primary', __( 'Brand', 'blicks' ) ], [ 'accent', __( 'Soft brand', 'blicks' ) ], [ 'destructive', __( 'Warning red', 'blicks' ) ] ] ) }
					</Row>
				) }
				<Slider label={ __( 'Move', 'blicks' ) } min={ -8 } max={ 8 } value={ c.move ?? 0 } onChange={ ( move ) => editC( { move: move || undefined } ) } />
				<Slider label={ __( 'Size', 'blicks' ) } min={ 90 } max={ 110 } value={ c.scale ?? 100 } unit="%" onChange={ ( scale ) => editC( { scale: scale === 100 ? undefined : scale } ) } />
				<Slider label={ __( 'Tilt', 'blicks' ) } min={ -8 } max={ 8 } value={ c.tilt ?? 0 } unit="°" onChange={ ( tilt ) => editC( { tilt: tilt || undefined } ) } />
				<Slider label={ __( 'Light', 'blicks' ) } min={ 70 } max={ 130 } value={ c.bright ?? 100 } unit="%" onChange={ ( bright ) => editC( { bright: bright === 100 ? undefined : bright } ) } />
				<Row label={ __( 'Shadow', 'blicks' ) } stack set={ !! c.shadow }>
					<Chips label={ __( 'Shadow', 'blicks' ) } options={ [ [ '', __( 'No change', 'blicks' ) ], [ 'sm', __( 'Soft', 'blicks' ) ], [ 'md', __( 'Medium', 'blicks' ) ], [ 'lg', __( 'Strong', 'blicks' ) ], [ 'glow', __( 'Glow', 'blicks' ) ], [ 'inset', __( 'Pressed in', 'blicks' ) ] ] } value={ c.shadow ?? '' } onChange={ ( s ) => editC( { shadow: ( s || undefined ) as StateLook[ 'shadow' ] } ) } />
				</Row>
				{ ! isH && look.depth && <Switch label={ __( 'Push down into its depth', 'blicks' ) } checked={ !! c.push } onChange={ ( push ) => editC( { push: push || undefined } ) } /> }
			</Sec>
		</SubView>
	);
}

function ColourEditor( { which, look, set, back, css, fillCss, kind }: {
	which: 'fill' | 'text';
	look: Look;
	set: ( p: Partial< Look > ) => void;
	back: () => void;
	css: ( c: string ) => string;
	fillCss: ( f: Fill ) => string;
	kind: StylePanelProps[ 'kind' ];
} ) {
	const isFill = which === 'fill';
	const v: Fill = isFill ? look.fill : look.text;
	const [ tab, setTab ] = useState< 'solid' | 'gradient' >( typeof v === 'object' ? 'gradient' : 'solid' );
	const [ li, setLi ] = useState( 0 );
	const [ si, setSi ] = useState( 0 );
	const setV = ( next: Fill ) => set( isFill ? { fill: next } : { text: next as string } );
	const title = isFill ? ( kind === 'divider' ? __( 'Line color', 'blicks' ) : kind === 'badge' ? __( 'Fill', 'blicks' ) : __( 'Background', 'blicks' ) ) : __( 'Text color', 'blicks' );

	const layers = typeof v === 'object' ? gradLayers( v ) : [ L0() ];
	const l = layers[ Math.min( li, layers.length - 1 ) ];
	const sp = l.stops[ Math.min( si, l.stops.length - 1 ) ];
	const editLayers = ( fn: ( ls: GradLayer[] ) => void ) => {
		const ls: GradLayer[] = JSON.parse( JSON.stringify( layers ) );
		fn( ls );
		setV( { k: 'grad', layers: ls } );
	};

	return (
		<SubView title={ title } onBack={ back } preview={ { background: v ? fillCss( v ) : 'transparent' } } clearLabel={ isFill ? ( kind === 'divider' ? __( 'Back to line gray', 'blicks' ) : __( 'No background', 'blicks' ) ) : __( 'Back to automatic', 'blicks' ) } onClear={ () => setV( isFill && kind === 'divider' ? 'border' : '' ) }>
			{ isFill && kind !== 'divider' && (
				<Row label={ __( 'Kind', 'blicks' ) } set={ tab === 'gradient' }>
					<SegSource label={ __( 'Solid or gradient', 'blicks' ) } options={ [ [ 'solid', __( 'Solid', 'blicks' ) ], [ 'gradient', __( 'Gradient', 'blicks' ) ] ] } value={ tab } onChange={ setTab } />
				</Row>
			) }
			{ tab === 'solid' ? (
				<>
					<Row label={ __( 'Theme colors', 'blicks' ) } stack set={ typeof v === 'string' && !! v && ! isHex( v ) }>
						<div className="ce-grid">
							{ THEME.map( ( [ t, lbl ] ) => <button key={ t } type="button" className="swc" style={ { background: css( t ) } } aria-pressed={ v === t } title={ lbl } aria-label={ lbl } onClick={ () => setV( t ) } /> ) }
						</div>
					</Row>
					<Row label={ __( 'Any color', 'blicks' ) } stack set={ typeof v === 'string' && isHex( v ) }>
						<HexField value={ typeof v === 'string' && isHex( v ) ? v : '' } fallback="#4f46e5" onChange={ setV } />
					</Row>
				</>
			) : (
				<>
					<Sec title={ __( 'Ready-made', 'blicks' ) } icon="gradient">
						<div className="ce-grads">
							{ Object.entries( GRADIENTS ).map( ( [ k, g ] ) => (
								<button key={ k } type="button" className="gtile" aria-pressed={ typeof v === 'object' && v.preset === k && ! v.layers } onClick={ () => { setLi( 0 ); setSi( 0 ); setV( { k: 'grad', preset: k } ); } }>
									<span style={ { background: gradientCss( g.layers, css ) } } />{ g.label }
								</button>
							) ) }
						</div>
					</Sec>
					<Sec title={ __( 'Make your own', 'blicks' ) } icon="tune">
						<Row label={ __( 'Layers', 'blicks' ) } stack note={ layers.length > 1 ? (
							<button type="button" className="link-x muted" onClick={ () => { editLayers( ( ls ) => ls.splice( li, 1 ) ); setLi( 0 ); } }>{ __( 'Remove layer', 'blicks' ) }</button>
						) : undefined }>
							<div className="gb-row">
								{ layers.map( ( x, i ) => (
									<button key={ i } type="button" className="swc gb-chip" style={ { background: gradientCss( [ x ], css ) } } aria-pressed={ i === li } title={ `${ __( 'Layer', 'blicks' ) } ${ i + 1 }` } aria-label={ `${ __( 'Layer', 'blicks' ) } ${ i + 1 }` } onClick={ () => { setLi( i ); setSi( 0 ); } } />
								) ) }
								<button type="button" className="swc gb-chip add" title={ __( 'Add a layer on top', 'blicks' ) } aria-label={ __( 'Add a layer on top', 'blicks' ) } onClick={ () => { editLayers( ( ls ) => ls.unshift( { type: 'radial', angle: 0, pos: '50% 20%', shape: 'ellipse', stops: [ { c: '#ffffff', a: 60, p: 0 }, { c: '#ffffff', a: 0, p: 60 } ] } ) ); setLi( 0 ); setSi( 0 ); } }>
									<Icon d="M12 7v10M7 12h10" size={ 14 } />
								</button>
							</div>
						</Row>
						<Row label={ __( 'Shape', 'blicks' ) } stack>
							<SegSource label={ __( 'Gradient shape', 'blicks' ) } options={ [ [ 'linear', __( 'Linear', 'blicks' ) ], [ 'radial', __( 'Round', 'blicks' ) ], [ 'conic', __( 'Sweep', 'blicks' ) ] ] } value={ l.type } onChange={ ( t ) => editLayers( ( ls ) => { ls[ li ].type = t; } ) } />
						</Row>
						<Row label={ __( 'Colors', 'blicks' ) } stack note={ l.stops.length > 2 ? (
							<button type="button" className="link-x muted" onClick={ () => { editLayers( ( ls ) => ls[ li ].stops.splice( si, 1 ) ); setSi( 0 ); } }>{ __( 'Remove this color', 'blicks' ) }</button>
						) : undefined }>
							<div className="gb-row">
								{ l.stops.map( ( st, i ) => (
									<button key={ i } type="button" className="swc gb-stop" style={ { background: isHex( st.c ) ? st.c : css( st.c ) } } aria-pressed={ i === si } title={ `${ __( 'Color', 'blicks' ) } ${ i + 1 } — ${ st.p }%` } aria-label={ `${ __( 'Color', 'blicks' ) } ${ i + 1 }` } onClick={ () => setSi( i ) } />
								) ) }
								<button type="button" className="link-add" onClick={ () => { editLayers( ( ls ) => ls[ li ].stops.push( { ...sp, p: Math.min( 100, sp.p + 20 ) } ) ); setSi( l.stops.length ); } }>
									<Icon d="M12 7v10M7 12h10" size={ 14 } />{ __( 'Color', 'blicks' ) }
								</button>
							</div>
						</Row>
						<Row label={ __( 'This color', 'blicks' ) } stack>
							<div className="swatches sm">
								{ THEME.map( ( [ t, lbl ] ) => <button key={ t } type="button" className="swc" style={ { background: css( t ) } } aria-pressed={ sp.c === t } title={ lbl } aria-label={ lbl } onClick={ () => editLayers( ( ls ) => { ls[ li ].stops[ si ].c = t; } ) } /> ) }
							</div>
						</Row>
						<Row label={ __( 'Any color', 'blicks' ) } stack>
							<HexField value={ isHex( sp.c ) ? sp.c : '' } fallback="#4f46e5" onChange={ ( c ) => editLayers( ( ls ) => { ls[ li ].stops[ si ].c = c; } ) } />
						</Row>
						<Slider label={ __( 'Opacity', 'blicks' ) } min={ 0 } max={ 100 } value={ sp.a } unit="%" onChange={ ( a ) => editLayers( ( ls ) => { ls[ li ].stops[ si ].a = a; } ) } />
						<Slider label={ __( 'Position', 'blicks' ) } min={ 0 } max={ 100 } value={ sp.p } unit="%" onChange={ ( p ) => editLayers( ( ls ) => { ls[ li ].stops[ si ].p = p; } ) } />
						{ l.type !== 'radial' && <Slider label={ l.type === 'conic' ? __( 'Start', 'blicks' ) : __( 'Angle', 'blicks' ) } min={ 0 } max={ 359 } value={ l.angle } unit="°" onChange={ ( angle ) => editLayers( ( ls ) => { ls[ li ].angle = angle; } ) } /> }
						{ l.type !== 'linear' && (
							<Row label={ __( 'Center', 'blicks' ) }>
								<div className="dpad">{ POS.map( ( q ) => <button key={ q } type="button" aria-pressed={ l.pos === q } aria-label={ q } onClick={ () => editLayers( ( ls ) => { ls[ li ].pos = q; } ) }><i /></button> ) }</div>
							</Row>
						) }
						{ l.type === 'radial' && (
							<Row label={ __( 'Round as', 'blicks' ) }>
								<SegSource label={ __( 'Round as', 'blicks' ) } options={ [ [ 'circle', __( 'Circle', 'blicks' ) ], [ 'ellipse', __( 'Oval', 'blicks' ) ] ] } value={ l.shape } onChange={ ( shape ) => editLayers( ( ls ) => { ls[ li ].shape = shape; } ) } />
							</Row>
						) }
					</Sec>
				</>
			) }
		</SubView>
	);
}

const L0 = (): GradLayer => ( { type: 'linear', angle: 135, pos: '50% 50%', shape: 'circle', stops: [ { c: 'primary', a: 100, p: 0 }, { c: 'accent', a: 100, p: 100 } ] } );

/**
 * Whether this block can answer to its card (its states include the engine's `group`), and how to
 * mark that card. The ancestors are read when the choice is made rather than subscribed to: the
 * panel has no reason to re-render as blocks above it change.
 */
function useCard(): { available: boolean; container: boolean; mark: () => void } {
	const { clientId, name } = useBlockEditContext();
	const registry = useRegistry();
	const { updateBlockAttributes } = useDispatch( blockEditorStore ) as unknown as { updateBlockAttributes: ( id: string, a: Record< string, unknown > ) => void };
	const supportsOf = ( blockName: string | undefined ) => ( blockName ? ( getBlockType( blockName )?.supports as any )?.blicks : undefined );
	const states = supportsOf( name )?.states;

	return {
		available: Array.isArray( states ) && states.includes( 'group' ),
		container: canBeCard( supportsOf( name )?.controls ),
		mark: () => {
			if ( ! clientId ) return;
			const store = registry.select( blockEditorStore ) as any;
			const ancestors: Ancestor[] = ( store.getBlockParents( clientId, true ) as string[] ).map( ( id ) => {
				const block = store.getBlock( id );
				return { clientId: id, controls: supportsOf( block?.name )?.controls, blicks: block?.attributes?.blicks };
			} );
			const target = cardToMark( ancestors );
			if ( target ) updateBlockAttributes( target.clientId, { blicks: markCard( target.blicks ) } );
		},
	};
}
