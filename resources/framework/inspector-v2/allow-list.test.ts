import { describe, expect, it } from 'vitest';
import { includesControl } from '@/framework/inspector/control-allow';
import { EMPTY_LOOK, META, writeStyle, type Look, type Tree } from './style-model';
import { withEntrance } from './motion-model';
import { PRESETS, writeDecoration } from './decor-model';
import { setButtonsOrientation, withButtonsGrid, withStackPhone } from '@/blocks/buttons/controls';
import box from '@/blocks/box/block.json';
import button from '@/blocks/button/block.json';
import buttons from '@/blocks/buttons/block.json';
import icon from '@/blocks/icon/block.json';
import image from '@/blocks/image/block.json';
import text from '@/blocks/text/block.json';
import heading from '@/blocks/heading/block.json';

/**
 * Every control a v2 panel can write must be in its block's `supports.blicks.controls`.
 *
 * The editor emits whatever is in the tree, so a missing id still works by hand — but the server
 * refuses it (`ElementStyle::allowsControl`), and so does every tool or agent that writes layouts
 * through it. The looks below are what each block's Style tab can reach, section by section; add
 * to them when a panel gains a section.
 */
const look = ( patch: Partial< Look > ): Look => ( { ...EMPTY_LOOK, ...patch } );
const ids = ( tree: Tree ) => Object.keys( tree ).filter( ( id ) => id !== META );
const styleIds = ( kind: string, linked: boolean, looks: Array< Partial< Look > > ) =>
	looks.flatMap( ( l ) => ids( writeStyle( {}, look( l ), { kind, linked } ) ) );
const motionIds = ids( withEntrance( {}, 'rise' ) );

const COLOURS: Array< Partial< Look > > = [ { fill: 'primary', text: 'background' }, { fill: { k: 'grad', preset: 'brand' } } ];
const FRAME: Array< Partial< Look > > = [ { border: 'thin', bcol: 'border', radius: 'lg', shadow: 'md' }, { out: [ 16, 0, 16, 0 ] } ];
const MOTION: Array< Partial< Look > > = [ { hover: 'lift', press: 'press', focus: 'ring' }, { focus: 'outline', focusOl: { line: 'dotted', w: 3 } }, { hover: 'glow' }, { hover: 'darken' }, { hover: 'grow' } ];
const TEXT: Array< Partial< Look > > = [ { font: 'serif', fsize: 20, weight: '700', italic: true, track: 0.05, tcase: 'uppercase', deco: 'underline', tsh: 'soft' } ];

const TYPE: Array< Partial< Look > > = [
	{ font: 'serif', fsize: 20, lh: '1.4', weight: '600', italic: true, track: 0.05, tcase: 'uppercase', deco: 'underline', tsh: 'soft', text: 'primary' },
	{ fill: { k: 'grad', preset: 'sunset' } as any, clip: true },
	{ fill: 'accent', pad: [ 4, 8, 4, 8 ], radius: 'sm', border: { w: 3, style: 'solid', sides: 'left' }, bcol: 'primary', out: [ 24, 0, 24, 0 ] },
];
/** What Text and Heading Settings write straight into the tree. */
const TEXT_SETTINGS = [ 'typography.textWrap', 'typography.role', 'typography.textAlign', 'layout.maxWidth', 'columns.columnCount', 'columns.columnGap', 'columns.columnWidth', 'layout.lineClamp', 'typography.fontSize' ];
const HEADING_SETTINGS = [ 'typography.textWrap', 'typography.role', 'typography.textAlign', 'typography.fontSize' ];

const BLOCKS: Array< [ string, string[], string[] ] > = [
	[ 'box', box.supports.blicks.controls, [
		...styleIds( 'box', true, [ ...COLOURS, ...FRAME, ...MOTION, ...TEXT, { img: 'https://example.com/a.jpg', dim: 'medium', finish: 'glass' }, { pad: [ 8, 8, 8, 8 ], depth: 'edge', tilt: 2 } ] ),
		...motionIds,
	] ],
	[ 'button', button.supports.blicks.controls, [
		...styleIds( 'button', true, [ ...COLOURS, ...FRAME, ...MOTION, ...TEXT, { finish: 'gloss', fill: 'primary' }, { pad: [ 10, 20, 10, 20 ], depth: 'edge' } ] ),
		'typography.whiteSpace',
		...motionIds,
	] ],
	[ 'buttons', buttons.supports.blicks.controls, ( () => {
		let tree: Tree = {};
		setButtonsOrientation( {}, ( a ) => { tree = a.blicks; }, 'vertical' );
		return [ ...ids( tree ), ...ids( withStackPhone( {}, true ) ), ...ids( withButtonsGrid( {}, 4 ) ), ...styleIds( 'box', false, [ { out: [ 16, 0, 16, 0 ] } ] ), ...motionIds ];
	} )() ],
	[ 'image', image.supports.blicks.controls, [ ...styleIds( 'image', false, [ ...FRAME, { pad: [ 8, 8, 8, 8 ] } ] ), ...motionIds ] ],
	[ 'text', text.supports.blicks.controls, [ ...styleIds( 'text', false, TYPE ), ...TEXT_SETTINGS, ...motionIds ] ],
	[ 'heading', heading.supports.blicks.controls, [ ...styleIds( 'heading', false, TYPE ), ...HEADING_SETTINGS, ...motionIds ] ],
	[ 'icon', icon.supports.blicks.controls, styleIds( 'icon', true, [ ...COLOURS, ...FRAME, ...MOTION, { pad: [ 12, 12, 12, 12 ], radius: 'full' } ] ) ],
];

describe( 'v2 panels write only what their block allows', () => {
	it.each( BLOCKS )( '%s', ( _name, controls, written ) => {
		const refused = [ ...new Set( written ) ].filter( ( id ) => ! includesControl( controls, id ) ).sort();
		expect( refused ).toEqual( [] );
	} );
} );

describe( 'decorations (Studio)', () => {
	// A decoration writes its part freely (a part is not bound by the block's list), but it also
	// positions and isolates the block itself — those two must be allowed on every block that has it.
	const element = ids( writeDecoration( {}, 'before', PRESETS.glow.deco ) ).filter( ( id ) => ! id.startsWith( 'decoration.' ) );
	const hostIds = [ ...new Set( element.filter( ( id ) => [ 'position.type', 'layout.isolation' ].includes( id ) ) ) ];

	it.each( [ box, button, icon, image, text, heading ].map( ( b ) => [ b.name, b ] as const ) )( '%s allows what a decoration sets on the block', ( _name, b ) => {
		expect( hostIds ).toEqual( [ 'position.type', 'layout.isolation' ] );
		for ( const id of hostIds ) expect( includesControl( ( b as any ).supports.blicks.controls, id ), id ).toBe( true );
	} );
} );
