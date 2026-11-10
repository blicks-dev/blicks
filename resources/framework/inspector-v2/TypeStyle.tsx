import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { resolveTokenValues } from '@/controls/token-utils';
import { Chips, Note, Opts, Row, Sec, SegIcons, SegText, Slider, Steps, SubView, Swatches, Switch, type Option, type Swatch } from './kit';
import { FONTS, GRADIENTS, colourCss, gradLayers, readStyle, writeStyle, type BorderSpec, type Look, type Tree } from './style-model';

/**
 * The Style tab for Text and Heading, as their inspector designs draw it: the type first (font,
 * size, weight, spacing, letters, colour), then what sits around the words (a colour behind them,
 * an accent line, space above and below). Written through the shared style model, so a Text or
 * Heading looks the same to every other tool that reads the tree.
 */
type Kind = 'text' | 'heading';

/**
 * Each type role's size in px and line height as Blicks ships them (src/DesignSystem/TypeRoles.php).
 * A theme can change them; these are where the Size sliders start until a size is set.
 */
const ROLE_SIZE: Record< string, [ number, number ] > = {
	display: [ 56, 1.05 ], h1: [ 36, 1.1 ], h2: [ 30, 1.15 ], h3: [ 24, 1.2 ], h4: [ 20, 1.3 ], h5: [ 18, 1.4 ], h6: [ 16, 1.4 ],
	body: [ 16, 1.6 ], lead: [ 20, 1.6 ], small: [ 12, 1.45 ], caption: [ 14, 1.4 ],
};

/** The role a block is drawn at: its Looks like / Kind, else its heading level, else body (or the old Lead variant). */
export function roleOf( attributes: any, kind: Kind ): string {
	const role = attributes.blicks?.[ 'typography.role' ]?.default?.base;
	if ( typeof role === 'string' && ROLE_SIZE[ role ] ) return role;
	if ( kind === 'heading' ) return `h${ Math.min( 6, Math.max( 1, Number( attributes.level ) || 2 ) ) }`;
	return attributes.variant === 'lead' ? 'lead' : 'body';
}
type Edit = null | 'size' | 'letters' | 'ink' | 'behind' | 'space';

const SIZES: Record< Kind, Option[] > = {
	text: [ [ '', __( 'Its kind', 'blicks' ) ], [ '14', __( 'Small', 'blicks' ) ], [ '17', __( 'Normal', 'blicks' ) ], [ '21', __( 'Large', 'blicks' ) ], [ '26', __( 'Huge', 'blicks' ) ] ],
	heading: [ [ '', __( 'Its level', 'blicks' ) ], [ '24', __( 'Small', 'blicks' ) ], [ '32', __( 'Medium', 'blicks' ) ], [ '44', __( 'Large', 'blicks' ) ], [ '60', __( 'Huge', 'blicks' ) ] ],
};
const OUTS: Record< Kind, Option[] > = {
	text: [ [ '', __( 'Theme', 'blicks' ) ], [ '8', __( 'Tight', 'blicks' ) ], [ '16', __( 'Normal', 'blicks' ) ], [ '32', __( 'Roomy', 'blicks' ) ] ],
	heading: [ [ '', __( 'Theme', 'blicks' ) ], [ '8', __( 'Tight', 'blicks' ) ], [ '24', __( 'Normal', 'blicks' ) ], [ '48', __( 'Roomy', 'blicks' ) ] ],
};
const WEIGHTS: Option[] = [ [ '', __( 'From theme', 'blicks' ) ], [ '300', __( 'Light', 'blicks' ) ], [ '400', __( 'Regular', 'blicks' ) ], [ '600', __( 'Semibold', 'blicks' ) ], [ '800', __( 'Heavy', 'blicks' ) ] ];
const LINES: Option[] = [ [ '', __( 'Theme', 'blicks' ) ], [ '1.15', __( 'Tight', 'blicks' ) ], [ '1.35', __( 'Snug', 'blicks' ) ], [ '1.6', __( 'Normal', 'blicks' ) ], [ '1.85', __( 'Loose', 'blicks' ) ] ];
const CASES: Option[] = [ [ '', 'Aa' ], [ 'uppercase', 'AA' ], [ 'lowercase', 'aa' ], [ 'capitalize', 'Ab Cd' ] ];
const INKS: Array< [ string, string ] > = [ [ '', __( 'From theme', 'blicks' ) ], [ 'foreground', __( 'Ink', 'blicks' ) ], [ 'muted-foreground', __( 'Slate', 'blicks' ) ], [ 'primary', __( 'Brand', 'blicks' ) ], [ 'destructive', __( 'Warning red', 'blicks' ) ], [ 'background', __( 'White', 'blicks' ) ] ];
const THEME: Array< [ string, string ] > = [ [ 'background', __( 'White', 'blicks' ) ], [ 'foreground', __( 'Ink', 'blicks' ) ], [ 'primary', __( 'Brand', 'blicks' ) ], [ 'accent', __( 'Soft brand', 'blicks' ) ], [ 'secondary', __( 'Light gray', 'blicks' ) ], [ 'muted', __( 'Mist', 'blicks' ) ], [ 'border', __( 'Line gray', 'blicks' ) ], [ 'muted-foreground', __( 'Slate', 'blicks' ) ], [ 'destructive', __( 'Warning red', 'blicks' ) ] ];
const BEHIND: Array< [ string, string ] > = [ [ '', __( 'None', 'blicks' ) ], [ 'accent', __( 'Soft brand', 'blicks' ) ], [ 'secondary', __( 'Light gray', 'blicks' ) ], [ 'muted', __( 'Mist', 'blicks' ) ], [ 'primary', __( 'Brand', 'blicks' ) ], [ 'foreground', __( 'Dark', 'blicks' ) ] ];
const BAR_COLOURS: Array< [ string, string ] > = [ [ 'primary', __( 'Brand', 'blicks' ) ], [ 'foreground', __( 'Ink', 'blicks' ) ], [ 'border', __( 'Line gray', 'blicks' ) ], [ 'destructive', __( 'Warning red', 'blicks' ) ] ];
const LETTER_GRADS = [ 'brand', 'sunset', 'ocean', 'atomic', 'night' ];
/** Room inside a colour behind the words: up-and-down, left-and-right. */
const ROOM: Record< string, [ number, number ] > = { snug: [ 4, 8 ], roomy: [ 10, 16 ], wide: [ 18, 24 ] };
const ROOMS: Option[] = [ [ 'snug', __( 'Snug', 'blicks' ) ], [ 'roomy', __( 'Roomy', 'blicks' ) ], [ 'wide', __( 'Wide', 'blicks' ) ] ];
const BARS: Option[] = [ [ '', __( 'None', 'blicks' ), 'M6 12h12' ], [ 'left', __( 'Line on the left', 'blicks' ), 'M5 4v16M10 8h9M10 12h9M10 16h6' ], [ 'under', __( 'Line under', 'blicks' ), 'M4 9h16M4 13h11M4 19h16' ] ];
const CORNERS: Option[] = [ [ 'none', __( 'Square', 'blicks' ), 'M5 19V5h14' ], [ 'sm', __( 'Slight', 'blicks' ), 'M5 19V8a3 3 0 0 1 3-3h11' ], [ 'md', __( 'Rounded', 'blicks' ), 'M5 19V12a7 7 0 0 1 7-7h7' ], [ 'full', __( 'Pill', 'blicks' ), 'M8 19a7 7 0 0 1 0-14h11' ] ];

const isHex = ( v: string ) => /^#([0-9a-f]{3}){1,2}$/i.test( v );

/** Which accent line the border is, if it is one of ours. */
export function barOf( look: Look ): '' | 'left' | 'under' {
	const b = look.border;
	if ( typeof b !== 'object' ) return '';
	return b.sides === 'left' ? 'left' : b.sides === 'bottom' ? 'under' : '';
}

/** Which room a colour behind the words has, read from the padding it wrote. */
export function roomOf( look: Look ): string {
	if ( ! Array.isArray( look.pad ) ) return '';
	const [ t, r ] = look.pad;
	return Object.entries( ROOM ).find( ( [ , [ y, x ] ] ) => y === t && ( x === r || x === look.pad[ 3 ] ) )?.[ 0 ] ?? '';
}

/** Padding for a room behind the words and an accent line beside or under them, together. */
export function padFor( room: string, bar: '' | 'left' | 'under' ): number[] | '' {
	const [ y, x ] = ROOM[ room ] ?? [ 0, 0 ];
	const pad = [ y, x, y, x ];
	if ( bar === 'left' ) pad[ 3 ] = Math.max( pad[ 3 ], 16 );
	if ( bar === 'under' ) pad[ 2 ] = Math.max( pad[ 2 ], 10 );
	return pad.some( Boolean ) ? pad : '';
}

/** One breakpoint's value of a control, written straight into the tree (the look owns `base` only). */
function withSlot( tree: Tree, id: string, value: string | undefined, bp: string ): Tree {
	const control = { ...( tree[ id ] ?? {} ) };
	const slot = { ...( control.default ?? {} ) };
	if ( value === undefined ) delete slot[ bp ];
	else slot[ bp ] = value;
	if ( Object.keys( slot ).length ) control.default = slot;
	else delete control.default;
	const next = { ...tree };
	if ( Object.keys( control ).length ) next[ id ] = control;
	else delete next[ id ];
	return next;
}

/**
 * `fill` adds a block's own rows (a list's Marker, a step's line) at the top of the Fill section, so
 * the tab keeps one Fill section in its fixed place rather than a second one beside it.
 */
export function TypeStyle( { attributes, setAttributes, kind, fill }: { attributes: any; setAttributes: ( a: any ) => void; kind: Kind; fill?: ReactNode } ) {
	const tree: Tree = attributes.blicks ?? {};
	const opts = { kind };
	const { look } = readStyle( tree, opts );
	const [ edit, setEdit ] = useState< Edit >( null );
	const palette = useMemo( () => resolveTokenValues( 'color' as any ), [] );
	const css = ( c: string ) => palette[ c ] || colourCss( c );
	const sw = ( list: Array< [ string, string ] > ): Swatch[] => list.map( ( [ v, l ] ) => ( v ? { value: v, label: l, css: css( v ) } : { value: '', label: l } ) );
	const set = ( patch: Partial< Look > ) => setAttributes( { blicks: writeStyle( tree, { ...look, ...patch }, opts ) } );
	const back = () => setEdit( null );
	const gradient = look.clip && typeof look.fill === 'object' ? look.fill : null;
	const gradCss = ( preset: string ) => {
		const l = gradLayers( { k: 'grad', preset } as any )[ 0 ];
		return l ? `linear-gradient(90deg, ${ l.stops.map( ( s ) => css( s.c ) ).join( ', ' ) })` : '';
	};
	const phone = String( tree[ 'typography.fontSize' ]?.default?.mobile ?? '' );
	const bar = barOf( look );
	const room = roomOf( look );
	const behind = gradient ? '' : typeof look.fill === 'string' ? look.fill : '';
	const setBehind = ( fill: string ) => set( { fill, clip: false, pad: padFor( fill ? room || 'snug' : '', bar ), radius: fill ? look.radius || 'sm' : '' } );
	const setBar = ( b: '' | 'left' | 'under' ) => set( {
		border: b ? { w: b === 'left' ? 3 : 2, style: 'solid', sides: b === 'left' ? 'left' : 'bottom' } as BorderSpec : '',
		bcol: b ? look.bcol || 'primary' : '',
		pad: padFor( behind ? room : '', b ),
	} );
	const out = look.out;
	const outKey = ! out ? '' : out[ 0 ] === out[ 2 ] && ! out[ 1 ] && ! out[ 3 ] && OUTS[ kind ].some( ( [ v ] ) => v === String( out[ 0 ] ) ) ? String( out[ 0 ] ) : null;

	if ( edit === 'size' ) {
		const [ roleSize, roleLh ] = ROLE_SIZE[ roleOf( attributes, kind ) ];
		const desk = typeof look.fsize === 'number' ? look.fsize : roleSize;
		const ph = /^\d+(\.\d+)?px$/.test( phone ) ? Number( phone.slice( 0, -2 ) ) : Math.round( desk > 30 ? desk * 0.72 : desk > 20 ? desk * 0.88 : desk );
		const lh = Number( look.lh ) || roleLh;
		return (
			<SubView title={ __( 'Size', 'blicks' ) } onBack={ back } clearLabel={ kind === 'heading' ? __( 'Back to its level’s size', 'blicks' ) : __( 'Back to its kind’s size', 'blicks' ) } onClear={ () => setAttributes( { blicks: withSlot( writeStyle( tree, { ...look, fsize: '', lh: '' }, opts ), 'typography.fontSize', undefined, 'mobile' ) } ) }>
				<Slider label={ __( 'Size', 'blicks' ) } min={ kind === 'heading' ? 14 : 11 } max={ kind === 'heading' ? 88 : 32 } value={ desk } onChange={ ( fsize ) => set( { fsize } ) } />
				<Slider label={ __( 'On phones', 'blicks' ) } min={ kind === 'heading' ? 14 : 11 } max={ kind === 'heading' ? 64 : 28 } value={ ph } onChange={ ( n ) => setAttributes( { blicks: withSlot( tree, 'typography.fontSize', `${ n }px`, 'mobile' ) } ) } />
				<Slider label={ __( 'Lines', 'blicks' ) } min={ 0.9 } max={ 2.1 } step={ 0.05 } value={ lh } unit="" display={ lh.toFixed( 2 ) } onChange={ ( n ) => set( { lh: String( n ) } ) } />
				<Note>{ phone ? __( 'Phones use the size you set.', 'blicks' ) : __( 'Phones step it down on their own until you set one.', 'blicks' ) }</Note>
			</SubView>
		);
	}
	if ( edit === 'letters' ) {
		return (
			<SubView title={ __( 'Letters', 'blicks' ) } onBack={ back } clearLabel={ __( 'Back to the theme’s letters', 'blicks' ) } onClear={ () => set( { tcase: '', track: '', italic: false, deco: '', tsh: '' } ) }>
				<Row label={ __( 'Capitals', 'blicks' ) } hint="text-transform" stack set={ !! look.tcase }>
					<SegText label={ __( 'Capitals', 'blicks' ) } options={ CASES } value={ look.tcase } onChange={ ( tcase ) => set( { tcase: tcase as Look[ 'tcase' ] } ) } />
				</Row>
				<Slider label={ __( 'Spacing', 'blicks' ) } min={ -5 } max={ 20 } value={ Math.round( Number( look.track || 0 ) * 100 ) } display={ `${ look.track || 0 }em` } onChange={ ( n ) => set( { track: n ? n / 100 : '' } ) } />
				<Switch label={ __( 'Italic', 'blicks' ) } checked={ look.italic } onChange={ ( italic ) => set( { italic } ) } />
				<Row label={ __( 'Line', 'blicks' ) } hint="text-decoration" set={ !! look.deco }>
					<SegText label={ __( 'Line', 'blicks' ) } options={ [ [ '', __( 'None', 'blicks' ) ], [ 'underline', __( 'Underline', 'blicks' ) ], [ 'line-through', __( 'Strike', 'blicks' ) ] ] } value={ look.deco } styles={ { underline: { textDecoration: 'underline' }, 'line-through': { textDecoration: 'line-through' } } } onChange={ ( deco ) => set( { deco: deco as Look[ 'deco' ] } ) } />
				</Row>
				<Row label={ __( 'Shadow', 'blicks' ) } hint="text-shadow" stack set={ !! look.tsh }>
					<Chips label={ __( 'Shadow', 'blicks' ) } options={ [ [ '', __( 'None', 'blicks' ) ], [ 'soft', __( 'Soft', 'blicks' ) ], [ 'lift', __( 'Lifted', 'blicks' ) ], [ 'glow', __( 'Glow', 'blicks' ) ], [ 'retro', __( 'Retro', 'blicks' ) ] ] } value={ look.tsh } onChange={ ( tsh ) => set( { tsh: tsh as Look[ 'tsh' ] } ) } />
				</Row>
			</SubView>
		);
	}
	if ( edit === 'ink' ) {
		const hex = isHex( look.text ) ? look.text : '';
		return (
			<SubView title={ __( 'Text color', 'blicks' ) } onBack={ back } clearLabel={ __( 'Back to the theme’s color', 'blicks' ) } onClear={ () => set( { text: '', clip: false, fill: gradient ? '' : look.fill } ) }>
				<Row label={ __( 'Theme', 'blicks' ) } stack set={ ! gradient && THEME.some( ( [ t ] ) => t === look.text ) }>
					<div className="ce-grid">
						{ THEME.map( ( [ t, l ] ) => <button key={ t } type="button" className="swc" style={ { background: css( t ) } } aria-pressed={ ! gradient && look.text === t } title={ l } aria-label={ l } onClick={ () => set( { text: t, clip: false, fill: gradient ? '' : look.fill } ) } /> ) }
					</div>
				</Row>
				<Row label={ __( 'Exact', 'blicks' ) } hint="color" set={ !! hex }>
					<label className="inp">
						<span className="hexdot" style={ { background: hex || '#ffffff' } } />
						<input defaultValue={ hex } placeholder="#1f2937" spellCheck={ false } aria-label={ __( 'Hex color', 'blicks' ) } onBlur={ ( e ) => { const v = e.currentTarget.value.trim(); if ( isHex( v ) ) set( { text: v.toLowerCase(), clip: false, fill: gradient ? '' : look.fill } ); } } />
					</label>
				</Row>
				<Row label={ __( 'Gradient letters', 'blicks' ) } stack set={ !! gradient } note={ __( 'Gradient letters replace any color behind the words.', 'blicks' ) } noteIcon="info">
					<div className="ltiles">
						{ LETTER_GRADS.map( ( g ) => (
							<button key={ g } type="button" className="ltile" aria-pressed={ !! gradient && ( gradient as any ).preset === g } onClick={ () => set( { fill: { k: 'grad', preset: g } as any, clip: true, pad: padFor( '', bar ), radius: '' } ) }>
								<span style={ { backgroundImage: gradCss( g ) } }>Aa</span>{ GRADIENTS[ g ]?.label }
							</button>
						) ) }
					</div>
				</Row>
			</SubView>
		);
	}
	if ( edit === 'behind' ) {
		return (
			<SubView title={ kind === 'heading' ? __( 'Behind the words', 'blicks' ) : __( 'Background', 'blicks' ) } onBack={ back } clearLabel={ __( 'No color behind', 'blicks' ) } onClear={ () => setBehind( '' ) }>
				<Row label={ __( 'Color', 'blicks' ) } hint="background-color" stack set={ !! behind }>
					<Swatches swatches={ sw( BEHIND.filter( ( [ v ] ) => v ) ) } value={ behind } onChange={ ( fill ) => set( { fill, clip: false } ) } />
				</Row>
				<Row label={ __( 'Space inside', 'blicks' ) } hint="padding" set={ !! room && room !== 'snug' }>
					<Steps label={ __( 'Space inside', 'blicks' ) } options={ ROOMS } value={ room || null } onChange={ ( r ) => set( { pad: padFor( r, bar ) } ) } />
				</Row>
				<Row label={ __( 'Corners', 'blicks' ) } hint="border-radius" set={ look.radius !== '' && look.radius !== 'sm' }>
					<SegIcons label={ __( 'Corners', 'blicks' ) } options={ CORNERS } value={ typeof look.radius === 'string' ? look.radius || 'none' : null } onChange={ ( radius ) => set( { radius: radius === 'none' ? '' : radius } ) } />
				</Row>
			</SubView>
		);
	}
	if ( edit === 'space' ) {
		const o = look.out ?? [ 0, 0, 0, 0 ];
		return (
			<SubView title={ __( 'Space above and below', 'blicks' ) } onBack={ back } clearLabel={ __( 'Back to the theme’s space', 'blicks' ) } onClear={ () => set( { out: null } ) }>
				<Slider label={ __( 'Above', 'blicks' ) } min={ 0 } max={ 96 } step={ 4 } value={ o[ 0 ] } onChange={ ( n ) => set( { out: [ n, 0, o[ 2 ], 0 ] } ) } />
				<Slider label={ __( 'Below', 'blicks' ) } min={ 0 } max={ 96 } step={ 4 } value={ o[ 2 ] } onChange={ ( n ) => set( { out: [ o[ 0 ], 0, n, 0 ] } ) } />
			</SubView>
		);
	}

	const sizeKey = look.fsize === '' ? '' : String( look.fsize );
	const sizeStep = SIZES[ kind ].some( ( [ v ] ) => v === sizeKey );
	const sizeCustom = ! sizeStep || !! phone || ( kind === 'heading' && !! look.lh );
	const lettersCustom = !! ( look.track !== '' || look.italic || look.deco || look.tsh );
	const inkCustom = !! gradient || ( !! look.text && ! INKS.some( ( [ v ] ) => v === look.text ) );
	const behindCustom = !! behind && ( room !== 'snug' || ( look.radius !== 'sm' && look.radius !== '' ) );
	const fonts: Array< [ string, string, JSX.Element ] > = [ [ '', __( 'From theme', 'blicks' ), <span key="t" className="tf">Aa</span> ], ...Object.entries( FONTS ).map( ( [ k, [ l, f ] ] ) => [ k, l, <span key={ k } className="tf" style={ { fontFamily: f === 'sans' || f === 'serif' || f === 'mono' ? `var(--blicks-font-${ f })` : f } }>Aa</span> ] as [ string, string, JSX.Element ] ) ];

	// Each section names its current value on the right, or Custom when no choice matches it.
	const nameIn = ( opts: ReadonlyArray< readonly [ unknown, string, ...unknown[] ] >, v: unknown ) => opts.find( ( o ) => o[ 0 ] === v )?.[ 1 ];
	const join = ( ...parts: Array< string | undefined | false > ) => parts.filter( Boolean ).join( ' · ' );
	const custom = __( 'Custom', 'blicks' );
	const textValue = join( look.font ? nameIn( fonts, look.font ) : '', sizeKey ? ( sizeStep ? nameIn( SIZES[ kind ], sizeKey ) : custom ) : '', look.weight ? nameIn( WEIGHTS, look.weight ) ?? custom : '' );
	const fillValue = join( gradient ? __( 'Gradient', 'blicks' ) : look.text ? nameIn( INKS, look.text ) ?? custom : '', behind ? nameIn( BEHIND, behind ) ?? custom : '' );
	const borderValue = bar ? nameIn( BARS, bar ) ?? '' : '';
	const spaceValue = look.out ? ( outKey === null ? custom : nameIn( OUTS[ kind ], outKey ) ?? '' ) : '';

	// The Style tab's fixed order: Text · Fill · Border and corners · Space.
	return (
		<>
			<Sec title={ __( 'Text', 'blicks' ) } icon="text_fields" value={ textValue }>
				<Row label={ __( 'Font', 'blicks' ) } stack set={ !! look.font }>
					<Opts columns={ 3 } options={ fonts } value={ look.font } onChange={ ( font ) => set( { font } ) } />
				</Row>
				<Row label={ __( 'Size', 'blicks' ) } stack set={ !! sizeKey || sizeCustom } action={ { label: sizeCustom ? __( 'Edit', 'blicks' ) : __( 'Customize', 'blicks' ), run: () => setEdit( 'size' ) } }>
					<Steps label={ __( 'Size', 'blicks' ) } options={ SIZES[ kind ] } value={ sizeStep ? sizeKey : null } onChange={ ( n ) => setAttributes( { blicks: withSlot( writeStyle( tree, { ...look, fsize: n ? Number( n ) : '' }, opts ), 'typography.fontSize', undefined, 'mobile' ) } ) } />
				</Row>
				<Row label={ __( 'Weight', 'blicks' ) } stack set={ !! look.weight }>
					<Steps label={ __( 'Weight', 'blicks' ) } options={ WEIGHTS } value={ WEIGHTS.some( ( [ v ] ) => v === look.weight ) ? look.weight : null } onChange={ ( weight ) => set( { weight } ) } />
				</Row>
				{ kind === 'text' && (
					<Row label={ __( 'Line spacing', 'blicks' ) } stack set={ !! look.lh }>
						<Steps label={ __( 'Line spacing', 'blicks' ) } options={ LINES } value={ LINES.some( ( [ v ] ) => v === look.lh ) ? look.lh : null } onChange={ ( lh ) => set( { lh } ) } />
					</Row>
				) }
				<Row label={ __( 'Letters', 'blicks' ) } stack set={ !! look.tcase || lettersCustom } action={ { label: lettersCustom ? __( 'Edit', 'blicks' ) : __( 'Customize', 'blicks' ), run: () => setEdit( 'letters' ) } }>
					<SegText label={ __( 'Letters', 'blicks' ) } options={ CASES } value={ look.tcase } onChange={ ( tcase ) => set( { tcase: tcase as Look[ 'tcase' ] } ) } />
				</Row>
			</Sec>
			<Sec title={ __( 'Fill', 'blicks' ) } icon="format_color_fill" value={ fillValue }>
				{ fill }
				<Row label={ __( 'Color', 'blicks' ) } stack set={ !! look.text || !! gradient } note={ gradient ? `${ GRADIENTS[ ( gradient as any ).preset ]?.label ?? '' } ${ __( 'gradient', 'blicks' ) }` : undefined } noteIcon="gradient">
					<Swatches
						swatches={ sw( INKS ) }
						empty="auto"
						value={ gradient ? null : look.text }
						onChange={ ( text ) => set( { text, clip: false, fill: gradient ? '' : look.fill } ) }
						custom={ inkCustom ? { css: gradient ? gradCss( ( gradient as any ).preset ) : css( look.text ), label: __( 'Custom — edit', 'blicks' ), onEdit: () => setEdit( 'ink' ) } : undefined }
						onMore={ () => setEdit( 'ink' ) }
						moreLabel={ __( 'More colors and gradients', 'blicks' ) }
					/>
				</Row>
				<Row label={ kind === 'heading' ? __( 'Behind the words', 'blicks' ) : __( 'Background', 'blicks' ) } stack set={ !! behind } action={ behind ? { label: behindCustom ? __( 'Edit', 'blicks' ) : __( 'Customize', 'blicks' ), run: () => setEdit( 'behind' ) } : undefined }>
					<Swatches swatches={ sw( BEHIND ) } value={ behind } onChange={ setBehind } />
				</Row>
			</Sec>
			<Sec title={ __( 'Border and corners', 'blicks' ) } icon="border_style" value={ borderValue }>
				<Row label={ __( 'Accent line', 'blicks' ) } set={ !! bar }>
					<SegIcons label={ __( 'Accent line', 'blicks' ) } options={ BARS } value={ bar } onChange={ ( b ) => setBar( b as '' | 'left' | 'under' ) } />
				</Row>
				{ bar && (
					<Row label={ __( 'Line color', 'blicks' ) } stack set={ !! look.bcol }>
						<Swatches small swatches={ sw( BAR_COLOURS ) } value={ look.bcol || 'primary' } onChange={ ( bcol ) => set( { bcol } ) } />
					</Row>
				) }
			</Sec>
			<Sec title={ __( 'Space', 'blicks' ) } icon="padding" value={ spaceValue }>
				<Row label={ __( 'Above and below', 'blicks' ) } stack set={ !! look.out } action={ { label: outKey === null ? __( 'Edit', 'blicks' ) : __( 'Customize', 'blicks' ), run: () => setEdit( 'space' ) } }>
					<Steps label={ __( 'Space above and below', 'blicks' ) } options={ OUTS[ kind ] } value={ outKey } onChange={ ( o ) => set( { out: o ? [ Number( o ), 0, Number( o ), 0 ] : null } ) } />
				</Row>
			</Sec>
		</>
	);
}

