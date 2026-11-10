import { describe, it, expect } from 'vitest';
import type { BlockNode } from '../mount';
import {
	REST_POSE,
	countUses,
	freeSlug,
	keyframesCss,
	readPose,
	reconcile,
	renameIn,
	sameSteps,
	slugOf,
	slugsIn,
	splitAfter,
	usedBy,
	writePose,
	type Keyframes,
} from './keyframes';

const ALLOWED = [ 'opacity', 'transform', 'filter', 'box-shadow' ];

const jelly: Keyframes = {
	slug: 'jelly',
	label: 'Jelly',
	steps: [
		{ offset: 0, declarations: { transform: 'scale(1, 1)' } },
		{ offset: 100, declarations: { transform: 'scale(1.2, 0.8)' } },
	],
};

/** A block naming an animation on the slot and breakpoint given. */
const animated = ( name: string, slot = 'default', bp = 'base', inner: BlockNode[] = [] ): BlockNode => ( {
	name: 'blicks/box',
	clientId: `id-${ name }-${ slot }`,
	attributes: { blicks: { 'animation.name': { [ slot ]: { [ bp ]: name } } } },
	innerBlocks: inner,
} );

describe( 'drawing keyframes', () => {
	it( 'writes a record under its real name, steps in order', () => {
		const css = keyframesCss( [ { ...jelly, steps: [ ...jelly.steps ].reverse() } ], ALLOWED );

		expect( css ).toBe( '@keyframes bl-anim-jelly { 0% { transform: scale(1, 1); } 100% { transform: scale(1.2, 0.8); } }' );
	} );

	it( 'drops properties the library does not allow, and values that could escape the rule', () => {
		const css = keyframesCss(
			[
				{
					slug: 'x',
					label: 'X',
					steps: [ { offset: 0, declarations: { opacity: '0', background: 'red', filter: 'blur(1px)} body { color: red' } } ],
				},
			],
			ALLOWED
		);

		expect( css ).toBe( '@keyframes bl-anim-x { 0% { opacity: 0; } }' );
	} );

	it( 'refuses a slug that is not an identifier, and a record with nothing left to draw', () => {
		expect( keyframesCss( [ { ...jelly, slug: 'a b{' } ], ALLOWED ) ).toBe( '' );
		expect( keyframesCss( [ { slug: 'empty', label: 'E', steps: [ { offset: 0, declarations: { color: 'red' } } ] } ], ALLOWED ) ).toBe( '' );
	} );
} );

describe( 'names and slugs', () => {
	it( 'reads a slug only from the custom namespace', () => {
		expect( slugOf( 'bl-anim-jelly' ) ).toBe( 'jelly' );
		expect( slugOf( 'bl-float' ) ).toBeNull();
		expect( slugOf( 'bl-anim-' ) ).toBeNull();
	} );

	it( 'finds the first free slug, never a built-in name', () => {
		expect( freeSlug( 'Jelly Press', [] ) ).toBe( 'jelly-press' );
		expect( freeSlug( 'jelly', [ 'jelly', 'jelly-2' ] ) ).toBe( 'jelly-3' );
		expect( freeSlug( 'Float', [] ) ).toBe( 'float-2' );
		expect( freeSlug( '!!!', [] ) ).toBe( 'animation' );
	} );

	it( 'compares steps whatever order they were written in', () => {
		const shuffled = { ...jelly, steps: [ jelly.steps[ 1 ]!, jelly.steps[ 0 ]! ] };

		expect( sameSteps( jelly.steps, shuffled.steps ) ).toBe( true );
		expect( sameSteps( jelly.steps, [ jelly.steps[ 0 ]! ] ) ).toBe( false );
	} );
} );

describe( 'poses', () => {
	it( 'round-trips what the sliders write', () => {
		const pose = { x: 12, y: -4, scale: 1.1, turn: -3, show: 0.5, blur: 2 };
		const declarations = writePose( pose );

		expect( declarations ).toEqual( {
			transform: 'translate(12px, -4px) scale(1.1) rotate(-3deg)',
			opacity: '0.5',
			filter: 'blur(2px)',
		} );
		expect( readPose( declarations ).pose ).toEqual( pose );
	} );

	it( 'writes nothing for a part at rest', () => {
		expect( writePose( REST_POSE ) ).toEqual( {} );
	} );

	it( 'keeps what the sliders cannot read, untouched', () => {
		const { pose, extra } = readPose( { transform: 'scale(1.2, 0.8)', 'box-shadow': '0 0 4px red' } );

		expect( pose ).toEqual( REST_POSE );
		expect( extra ).toEqual( { transform: 'scale(1.2, 0.8)', 'box-shadow': '0 0 4px red' } );
		expect( writePose( pose, extra ) ).toEqual( { transform: 'scale(1.2, 0.8)', 'box-shadow': '0 0 4px red' } );
	} );

	it( 'replaces a hand-written transform once a slider moves', () => {
		const { extra } = readPose( { transform: 'scale(1.2, 0.8)' } );

		expect( writePose( { ...REST_POSE, x: 5 }, extra ).transform ).toBe( 'translate(5px, 0px) scale(1) rotate(0deg)' );
	} );
} );

describe( 'adding a keyframe', () => {
	it( 'splits halfway to the next one, posed like the one it came from', () => {
		const { record, offset } = splitAfter( jelly, 0 );

		expect( offset ).toBe( 50 );
		expect( record.steps.map( ( s ) => s.offset ) ).toEqual( [ 0, 50, 100 ] );
		expect( record.steps[ 1 ]!.declarations ).toEqual( jelly.steps[ 0 ]!.declarations );
	} );

	it( 'does nothing where there is no room', () => {
		const tight: Keyframes = { ...jelly, steps: [ { offset: 0, declarations: {} }, { offset: 1, declarations: {} } ] };

		expect( splitAfter( tight, 0 ).record ).toBe( tight );
		expect( splitAfter( jelly, 100 ).record ).toBe( jelly );
	} );
} );

describe( 'trees', () => {
	const tree = [
		animated( 'bl-anim-jelly', 'default', 'base', [ animated( 'bl-anim-glow', 'hover', 'mobile' ), animated( 'bl-float' ) ] ),
		animated( 'bl-anim-jelly' ),
	];

	it( 'finds every custom slug, on any slot and breakpoint, once', () => {
		expect( slugsIn( tree ) ).toEqual( [ 'jelly', 'glow' ] );
		expect( countUses( tree, 'jelly' ) ).toBe( 2 );
	} );

	it( 'renames every use and leaves the input alone', () => {
		const renamed = renameIn( tree, 'jelly', 'jelly-2' );

		expect( slugsIn( renamed ) ).toEqual( [ 'jelly-2', 'glow' ] );
		expect( slugsIn( tree ) ).toEqual( [ 'jelly', 'glow' ] );
		expect( renamed[ 0 ]!.clientId ).toBe( tree[ 0 ]!.clientId );
	} );

	it( 'carries only the records the tree names', () => {
		const glow: Keyframes = { slug: 'glow', label: 'Glow', steps: [ { offset: 0, declarations: { opacity: '0' } } ] };
		const unused: Keyframes = { ...glow, slug: 'unused' };

		expect( usedBy( tree, [ jelly, glow, unused ] ).map( ( k ) => k.slug ) ).toEqual( [ 'jelly', 'glow' ] );
	} );
} );

describe( 'arriving on another site', () => {
	const tree = [ animated( 'bl-anim-jelly' ), animated( 'bl-anim-aurora' ), animated( 'bl-anim-same' ) ];
	const aurora: Keyframes = { slug: 'aurora', label: 'Aurora', steps: [ { offset: 0, declarations: { filter: 'hue-rotate(0deg)' } } ] };
	const same: Keyframes = { slug: 'same', label: 'Same', steps: [ { offset: 0, declarations: { opacity: '0' } } ] };
	const mineJelly: Keyframes = { ...jelly, steps: [ { offset: 0, declarations: { opacity: '0.5' } } ] };

	it( 'adds what is new, reuses what matches, and renames what clashes', () => {
		const { blocks, arrivals } = reconcile( tree, [ jelly, aurora, same ], [ mineJelly, same ] );

		expect( arrivals.map( ( a ) => [ a.kind, a.keyframes.slug, a.from ] ) ).toEqual( [
			[ 'renamed', 'jelly-2', 'jelly' ],
			[ 'new', 'aurora', undefined ],
			[ 'same', 'same', undefined ],
		] );
		expect( slugsIn( blocks ) ).toEqual( [ 'jelly-2', 'aurora', 'same' ] );
	} );

	it( 'ignores records the tree does not name', () => {
		const { arrivals } = reconcile( [ animated( 'bl-anim-aurora' ) ], [ jelly, aurora ], [] );

		expect( arrivals.map( ( a ) => a.keyframes.slug ) ).toEqual( [ 'aurora' ] );
	} );
} );
