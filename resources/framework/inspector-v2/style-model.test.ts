import { describe, expect, it } from 'vitest';
import { buildElementStyle, STYLE_MAP } from '@/framework/css/vars';
import { EMPTY_LOOK, META, OWNED, readStyle, turnsIn3d, writeStyle, type Look, type Tree } from './style-model';

const look = ( patch: Partial< Look > ): Look => ( { ...EMPTY_LOOK, ...patch } );

/** A spread of looks touching every section, including the layered ones. */
const LOOKS: Record< string, Look > = {
	card: look( { fill: 'background', pad: 'xl', radius: 'lg', border: 'thin', bcol: 'border', shadow: 'sm' } ),
	cover: look( { fill: { k: 'grad', preset: 'brand' }, pad: '3xl' } ),
	aurora: look( { fill: { k: 'grad', preset: 'aurora' } } ),
	picture: look( { img: 'https://example.com/a.jpg', dim: 'medium', ifit: 'tile', ifixed: true, finish: 'gloss' } ),
	glass: look( { fill: 'primary', finish: 'glass' } ),
	glassTuned: look( { fill: 'primary', finish: 'glass', finishX: { s: 60, blur: 0, edge: false } } ),
	glossTuned: look( { fill: 'primary', finish: 'gloss', finishX: { s: 150 } } ),
	softTuned: look( { fill: 'primary', finish: 'soft', finishX: { s: 0, edge: false } } ),
	border: look( { border: { w: 3, style: 'dashed', sides: 'bottom' }, bcol: '#ff0000' } ),
	space: look( { pad: [ 8, 16, 8, 16 ], out: [ 32, 0, 32, 0 ] } ),
	badge: look( { fill: 'accent', pad: 'b2', radius: 'full', weight: '600', fsize: 12 } ),
	corners: look( { radius: { c: [ 20, 0, 20, 0 ] } } ),
	sketch: look( { radius: { sketch: true } } ),
	shadow: look( { shadow: { preset: 'floating', layers: [ { inset: false, x: 0, y: 4, b: 12, s: 0, c: 'primary', a: 40 } ] } } ),
	depth: look( { fill: 'primary', depth: 'edge', tilt: 2, shadow: 'md' } ),
	frame: look( { depth: 'frame', depthX: { n: 8, c: 'destructive', hover: 'settle' } } ),
	text: look( { font: 'serif', fsize: 20, weight: '700', italic: true, track: 0.05, tcase: 'uppercase', deco: 'underline', tsh: 'soft' } ),
	hover: look( { hover: 'lift', speed: 'smooth', feel: 'spring' } ),
	custom: look( { hover: 'custom', hoverX: { fill: 'foreground', move: -4, scale: 102, bright: 110, shadow: 'glow' } } ),
	press: look( { depth: 'block', press: 'push', focus: 'gap' } ),
};

describe( 'style model', () => {
	for ( const [ name, l ] of Object.entries( LOOKS ) ) {
		it( `round-trips ${ name }`, () => {
			const tree = writeStyle( {}, l, { linked: true } );
			expect( readStyle( tree, { linked: true } ) ).toEqual( { look: l, stale: false } );
		} );

		it( `writes ${ name } with nothing the engine drops`, () => {
			const tree = writeStyle( {}, l, { linked: true } );
			const { vars } = buildElementStyle( tree );
			for ( const id of OWNED ) {
				const rule = STYLE_MAP.find( ( r ) => r.attr === id )!;
				if ( rule.kind !== 'single' ) continue;
				for ( const [ slot, key ] of [ [ 'default', '' ], [ 'hover', '-hov' ], [ 'active', '-act' ], [ 'focus', '-foc' ] ] ) {
					if ( tree[ id ]?.[ slot ]?.base === undefined ) continue;
					// A value written but not emitted would do nothing on the page.
					expect( vars[ `${ rule.v }${ key }` ], `${ name }: ${ id } (${ slot })` ).toBeTruthy();
				}
			}
		} );
	}

	it( 'stacks depth under the shadow in one list', () => {
		const { vars } = buildElementStyle( writeStyle( {}, LOOKS.depth ) );
		expect( vars[ '--bl-bsh' ] ).toBe( '0 4px 0px 0px color-mix(in srgb, var(--blicks-color-primary) 65%, #000), var(--blicks-shadow-md)' );
	} );

	it( 'reads a readable text colour from the fill instead of storing it', () => {
		const tree = writeStyle( {}, LOOKS.card );
		expect( tree[ 'colors.text' ].default.base ).toBe( 'foreground' );
		expect( readStyle( tree ).look.text ).toBe( '' );
	} );

	it( 'reports the copy stale once something else changes an owned value', () => {
		const tree = writeStyle( {}, LOOKS.card );
		tree[ 'colors.background' ] = { default: { base: 'secondary' } };
		const { look: read, stale } = readStyle( tree );
		expect( stale ).toBe( true );
		expect( read.fill ).toBe( 'secondary' );
	} );

	it( 'keeps values it does not own, and responsive overrides of ones it does', () => {
		const tree = writeStyle( { 'layout.width': { default: { base: '100%' } }, 'colors.background': { default: { mobile: 'muted' } } }, LOOKS.card );
		expect( tree[ 'layout.width' ] ).toEqual( { default: { base: '100%' } } );
		expect( tree[ 'colors.background' ].default ).toEqual( { mobile: 'muted', base: 'background' } );
	} );

	it( 'clears what a new look no longer sets', () => {
		const tree = writeStyle( writeStyle( {}, LOOKS.card ), look( { fill: 'primary' } ) );
		expect( tree[ 'border.width' ] ).toBeUndefined();
		expect( tree[ 'effects.boxShadow' ] ).toBeUndefined();
		expect( tree[ META ].fill ).toBe( 'primary' );
	} );

	it( 'writes no click or focus look on a box that is not a link', () => {
		const tree = writeStyle( {}, LOOKS.press );
		expect( tree[ 'effects.boxShadow' ].active ).toBeUndefined();
		expect( tree[ 'effects.boxShadow' ].focus ).toBeUndefined();
	} );

	it( 'writes the preset unchanged until the finish is fine-tuned', () => {
		const plain = writeStyle( {}, LOOKS.glass );
		expect( plain[ 'colors.background' ].default.base ).toContain( ' 35%, transparent)' );
		expect( plain[ 'effects.backdropFilter' ].default.base ).toEqual( { blur: '10px', saturate: '1.6' } );
	} );

	it( 'scales the finish and drops the parts turned off', () => {
		const glass = writeStyle( {}, LOOKS.glassTuned );
		expect( glass[ 'colors.background' ].default.base ).toContain( ' 21%, transparent)' );
		expect( glass[ 'effects.backdropFilter' ].default.base ).toEqual( { saturate: '1.6' } );
		expect( glass[ 'effects.boxShadow' ]?.default.base ?? [] ).not.toContainEqual( expect.objectContaining( { role: 'finish' } ) );

		const gloss = writeStyle( {}, LOOKS.glossTuned );
		expect( JSON.stringify( gloss[ 'background.layers' ].default.base ) ).toContain( 'rgb(255 255 255 / 63%)' );

		// Soft at zero with no edge line leaves nothing of the finish behind.
		const soft = writeStyle( {}, LOOKS.softTuned );
		expect( soft[ 'effects.boxShadow' ]?.default.base ?? [] ).not.toContainEqual( expect.objectContaining( { role: 'finish' } ) );
	} );
} );

describe( 'type written elsewhere survives the first edit', () => {
	it( 'reads the rail inspector’s typography back, and writes it again unchanged', () => {
		const tree = {
			'typography.fontSize': { default: { base: '1.5rem', mobile: '1.1rem' } },
			'typography.lineHeight': { default: { base: '1.3' } },
			'typography.fontWeight': { default: { base: '700' } },
			'typography.letterSpacing': { default: { base: '0.02em' } },
			'typography.textTransform': { default: { base: 'uppercase' } },
			'typography.textAlign': { default: { base: 'center' } },
		};
		const { look } = readStyle( tree, { kind: 'text' } );
		expect( look ).toMatchObject( { fsize: '1.5rem', lh: '1.3', weight: '700', track: 0.02, tcase: 'uppercase' } );
		const next = writeStyle( tree, { ...look, text: 'primary' }, { kind: 'text' } );
		for ( const id of Object.keys( tree ) ) expect( next[ id ], id ).toEqual( ( tree as any )[ id ] );
		expect( next[ 'colors.text' ] ).toEqual( { default: { base: 'primary' } } );
	} );

	it( 'paints a gradient into the letters and drops the text colour', () => {
		const next = writeStyle( {}, look( { fill: { k: 'grad', preset: 'sunset' }, clip: true, text: 'primary' } ), { kind: 'text' } );
		expect( next[ 'colors.clipText' ] ).toEqual( { default: { base: 'text' } } );
		expect( next[ 'colors.text' ] ).toBeUndefined();
		expect( next[ 'background.layers' ] ).toBeTruthy();
	} );
} );

describe( 'keyboard focus as an outline', () => {
	it( 'writes the outline and its gap in the focus state, not a shadow', () => {
		const next = writeStyle( {}, look( { focus: 'outline', focusOl: { line: 'dotted', col: 'foreground' } } ), { kind: 'button', linked: true } );
		expect( next[ 'effects.outline' ] ).toEqual( { focus: { base: { width: '2px', style: 'dotted', color: 'foreground' } } } );
		expect( next[ 'effects.outlineOffset' ] ).toEqual( { focus: { base: '3px' } } );
		expect( next[ 'effects.boxShadow' ] ).toBeUndefined();
	} );
} );

describe( 'reacting to the card around it', () => {
	const at = ( tree: any, id: string, slot: string ) => tree[ id ]?.[ slot ]?.base;

	it( 'writes the hover look into the group slot, not hover', () => {
		const tree = writeStyle( {}, { ...EMPTY_LOOK, hover: 'lift', hoverFrom: 'card' } );

		expect( at( tree, 'effects.boxShadow', 'group' ) ).toBeDefined();
		expect( at( tree, 'effects.boxShadow', 'hover' ) ).toBeUndefined();
		expect( readStyle( tree ).look ).toMatchObject( { hover: 'lift', hoverFrom: 'card' } );
		expect( readStyle( tree ).stale ).toBe( false );
	} );

	it( 'writes a card press to the pressed-card state, on blocks nobody clicks too', () => {
		const tree = writeStyle( {}, { ...EMPTY_LOOK, press: 'press', pressFrom: 'card' } );

		expect( tree[ 'effects.transform' ]?.groupActive?.base ).toEqual( { scale: '0.97' } );
		expect( tree[ 'effects.transform' ]?.active ).toBeUndefined();
		expect( readStyle( tree ).look ).toMatchObject( { press: 'press', pressFrom: 'card' } );
	} );

	it( 'keeps a linked block\'s own press on its active state', () => {
		const tree = writeStyle( {}, { ...EMPTY_LOOK, press: 'press' }, { linked: true } );

		expect( tree[ 'effects.transform' ]?.active?.base ).toEqual( { scale: '0.97' } );
		expect( tree[ 'effects.transform' ]?.groupActive ).toBeUndefined();
	} );

	it( 'a reveal hides the block at rest and shows it in the state', () => {
		const tree = writeStyle( {}, { ...EMPTY_LOOK, hover: 'slide', hoverFrom: 'card' } );

		expect( at( tree, 'effects.opacity', 'default' ) ).toBe( '0' );
		expect( at( tree, 'effects.opacity', 'group' ) ).toBe( '1' );
		expect( at( tree, 'effects.transform', 'default' ) ).toMatchObject( { translateX: '-10px' } );
		expect( at( tree, 'effects.transform', 'group' ) ).toMatchObject( { translateX: '0px' } );
		expect( at( tree, 'effects.transition', 'default' ) ).toContain( 'opacity' );
	} );

	it( 'leaving a reveal takes its opacity back out', () => {
		const shown = writeStyle( {}, { ...EMPTY_LOOK, hover: 'appear', hoverFrom: 'card' } );
		const after = writeStyle( shown, { ...readStyle( shown ).look, hover: 'lift' } );

		expect( after[ 'effects.opacity' ] ).toBeUndefined();
	} );

	/*
	 * Opacity is owned only while a reveal is in play. Owning it always would wipe an opacity set
	 * from the full inspector on the first edit here, and leave every such tree reading as stale.
	 */
	it( 'never touches an opacity it did not write', () => {
		const set = { 'effects.opacity': { default: { base: '0.6' } } };
		const tree = writeStyle( set as any, { ...EMPTY_LOOK, hover: 'lift' } );

		expect( at( tree, 'effects.opacity', 'default' ) ).toBe( '0.6' );
		expect( readStyle( tree ).stale ).toBe( false );
	} );

	it( 'a look without a reveal transitions exactly what it did before', () => {
		const tree = writeStyle( {}, { ...EMPTY_LOOK, hover: 'lift' } );

		expect( at( tree, 'effects.transition', 'default' ) ).not.toContain( 'opacity' );
	} );
} );

describe( 'turnsIn3d', () => {
	it( 'is true for a rotation about X or Y in any state, and false for a flat turn', () => {
		expect( turnsIn3d( { 'effects.transform': { group: { base: 'rotateX(90deg) translateZ(20px)' } } } ) ).toBe( true );
		expect( turnsIn3d( { 'effects.transform': { hover: { base: { rotateY: '180deg' } } } } ) ).toBe( true );
		expect( turnsIn3d( { 'effects.transform': { default: { base: { rotate: '12deg' } } } } ) ).toBe( false );
		expect( turnsIn3d( {} ) ).toBe( false );
	} );
} );

describe( 'writeStyle on a tree another tool wrote', () => {
	const foreign: Tree = {
		'effects.transform': { default: { base: 'rotate(-2deg)' }, hover: { base: 'translateY(-4px)' } },
		'effects.boxShadow': { default: { base: [ { x: '0', y: '8px', blur: '24px', color: '#0003' }, { x: '0', y: '1px', color: '#0001' } ] } },
		'effects.transition': { default: { base: 'transform .3s ease' } },
		'spacing.margin': { default: { base: { top: '0', bottom: '24px' } } },
		'colors.background': { hover: { base: '#111' } },
	};

	it( 'keeps every value the edit does not touch', () => {
		const { look } = readStyle( foreign );
		const next = writeStyle( foreign, { ...look, italic: true } );
		for ( const id of Object.keys( foreign ) ) expect( next[ id ] ).toEqual( foreign[ id ] );
		expect( next[ 'typography.fontStyle' ]?.default?.base ).toBe( 'italic' );
	} );

	it( 'still writes the value that changed', () => {
		const { look } = readStyle( foreign );
		const next = writeStyle( foreign, { ...look, fill: 'accent' } );
		expect( next[ 'colors.background' ]?.default?.base ).toBeDefined();
		expect( next[ 'colors.background' ]?.hover ).toEqual( foreign[ 'colors.background' ].hover );
		expect( next[ 'effects.transform' ] ).toEqual( foreign[ 'effects.transform' ] );
	} );
} );
