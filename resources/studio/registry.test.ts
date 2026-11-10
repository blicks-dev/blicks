import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusScope, modeFor, modeTree, modes, newItems, panelShows, panels, patternSets, registeredPatterns, studioApi, treeLabels, INSPECTOR_TAB } from './registry';

const Canvas = () => null;
// The built-in Section's shape, without loading its canvas (the block editor needs a browser).
const SECTION_MODE = { id: 'section', label: 'Section', priority: 0, matches: () => true, Canvas };
const board = { id: 'board', label: 'Board', priority: 10, matches: ( b: { name: string }[] ) => 1 === b.length && 'blicks/scene' === b[ 0 ]?.name, Canvas };

afterEach( () => {
	for ( const reg of [ modes, newItems, patternSets, panels ] ) {
		for ( const item of reg.list() ) reg.unregister( item.id );
	}
	vi.restoreAllMocks();
} );

describe( 'modes', () => {
	it( 'falls back to the Section for any tree', () => {
		modes.register( SECTION_MODE );
		expect( modeFor( [ { name: 'blicks/section' } ] )?.id ).toBe( 'section' );
		expect( modeFor( [] )?.id ).toBe( 'section' );
	} );

	it( 'lets a higher-priority mode claim the trees it matches, and only those', () => {
		modes.register( SECTION_MODE );
		modes.register( board );
		expect( modeFor( [ { name: 'blicks/scene' } ] )?.id ).toBe( 'board' );
		expect( modeFor( [ { name: 'blicks/scene' }, { name: 'blicks/text' } ] )?.id ).toBe( 'section' );
	} );

	it( 'treats a matches() that throws as no match, so a companion cannot break mounting', () => {
		modes.register( SECTION_MODE );
		modes.register( { ...board, matches: () => { throw new Error( 'boom' ); } } );
		expect( modeFor( [ { name: 'blicks/scene' } ] )?.id ).toBe( 'section' );
	} );

	it( 'refuses a mode without a canvas, and says what is missing', () => {
		const error = vi.spyOn( console, 'error' ).mockImplementation( () => {} );
		expect( modes.register( { id: 'x', label: 'X', matches: () => true } ) ).toBe( false );
		expect( String( error.mock.calls[ 0 ]?.[ 0 ] ) ).toContain( 'a Canvas component' );
		expect( modes.list() ).toHaveLength( 0 );
	} );

	it( 'replaces a mode registered again under the same id', () => {
		modes.register( board );
		modes.register( { ...board, label: 'Board 2' } );
		expect( modes.list().map( ( m ) => m.label ) ).toEqual( [ 'Board 2' ] );
	} );
} );

describe( 'new items', () => {
	it( 'needs either start() or a Picker', () => {
		vi.spyOn( console, 'error' ).mockImplementation( () => {} );
		expect( newItems.register( { id: 'a', label: 'A', description: 'd' } ) ).toBe( false );
		expect( newItems.register( { id: 'a', label: 'A', description: 'd', start: () => null } ) ).toBe( true );
		expect( newItems.register( { id: 'b', label: 'B', description: 'd', Picker: Canvas } ) ).toBe( true );
	} );
} );

describe( 'patterns', () => {
	it( 'shelves a companion set as built-ins, keeping its own kind', () => {
		patternSets.register( { id: 'pro', entries: [ { id: 'p1', title: 'Launch board', kind: 'Boards', blocks: [], source: 'site' } ] } );
		const shelf = registeredPatterns( patternSets.list() );
		expect( shelf ).toEqual( [ expect.objectContaining( { id: 'p1', kind: 'Boards', source: 'builtin' } ) ] );
	} );

	it( 'refuses entries without blocks', () => {
		vi.spyOn( console, 'error' ).mockImplementation( () => {} );
		expect( patternSets.register( { id: 'pro', entries: [ { id: 'p1', title: 'T' } ] } ) ).toBe( false );
	} );
} );

describe( 'panels', () => {
	it( 'may not take the inspector tab', () => {
		vi.spyOn( console, 'error' ).mockImplementation( () => {} );
		expect( panels.register( { id: INSPECTOR_TAB, label: 'X', render: () => null } ) ).toBe( false );
		expect( panels.register( { id: 'assistant', label: 'Assistant', render: () => null } ) ).toBe( true );
	} );

	it( 'shows in every mode unless it names its modes (API 3)', () => {
		vi.spyOn( console, 'error' ).mockImplementation( () => {} );
		expect( panels.register( { id: 'triggers', label: 'Triggers', render: () => null, modes: 'dialog' } ) ).toBe( false );
		expect( panels.register( { id: 'triggers', label: 'Triggers', render: () => null, modes: [ '' ] } ) ).toBe( false );
		expect( panels.register( { id: 'triggers', label: 'Triggers', render: () => null, modes: [ 'dialog' ] } ) ).toBe( true );

		const triggers = panels.list().find( ( p ) => 'triggers' === p.id )!;
		const assistant = { id: 'assistant', label: 'Assistant', render: () => null };
		expect( panelShows( triggers, 'dialog' ) ).toBe( true );
		expect( panelShows( triggers, 'section' ) ).toBe( false );
		expect( panelShows( assistant, 'section' ) ).toBe( true );
	} );
} );

describe( 'the published surface', () => {
	it( 'is frozen and versioned', () => {
		expect( Object.isFrozen( studioApi ) ).toBe( true );
		expect( studioApi.version ).toBe( 3 );
		expect( Object.keys( studioApi ).sort() ).toEqual( [
			'registerMode', 'registerNewItem', 'registerPanel', 'registerPatterns', 'registerSource',
			'unregisterMode', 'unregisterNewItem', 'unregisterPanel', 'unregisterPatterns', 'unregisterSource', 'version',
		] );
	} );
} );

describe( 'API 3: persist', () => {
	const persist = { label: 'Save header', load: async () => ( { blocks: [] } ), save: async () => undefined };

	it( 'takes a mode with a complete persist, and one without any', () => {
		expect( modes.register( { ...board, id: 'header', persist } ) ).toBe( true );
		expect( modes.register( board ) ).toBe( true );
	} );

	it( 'refuses a persist missing its door label, load or save, and names which', () => {
		const error = vi.spyOn( console, 'error' ).mockImplementation( () => {} );

		expect( modes.register( { ...board, persist: { ...persist, label: '' } } ) ).toBe( false );
		expect( modes.register( { ...board, persist: { ...persist, load: undefined } } ) ).toBe( false );
		expect( modes.register( { ...board, persist: { ...persist, save: 'no' } } ) ).toBe( false );
		expect( error.mock.calls.map( ( call ) => String( call[ 0 ] ) ) ).toEqual( [
			expect.stringContaining( 'a persist.label' ),
			expect.stringContaining( 'a persist.load( ref ) function' ),
			expect.stringContaining( 'a persist.save( blocks, ref ) function' ),
		] );
	} );
} );

describe( 'API 3: tree', () => {
	it( 'refuses a tree that is not a function', () => {
		vi.spyOn( console, 'error' ).mockImplementation( () => {} );
		expect( modes.register( { ...board, tree: [] } ) ).toBe( false );
	} );

	it( 'reads a mode tree as labels by client id, at any depth, skipping malformed nodes', () => {
		const labels = treeLabels( [
			{ clientId: 'h', label: 'Main header', children: [ { clientId: 'r', label: 'Top bar', note: '3 areas' }, { clientId: 'x' }, null ] },
			{ label: 'no id' },
		] );

		expect( [ ...labels ] ).toEqual( [
			[ 'h', { label: 'Main header', note: '' } ],
			[ 'r', { label: 'Top bar', note: '3 areas' } ],
		] );
		expect( treeLabels( 'nonsense' ).size ).toBe( 0 );
	} );

	it( 'treats a tree() that throws as no names, so a mode cannot break Layers', () => {
		vi.spyOn( console, 'error' ).mockImplementation( () => {} );
		const mode = { ...board, tree: () => { throw new Error( 'boom' ); } };

		expect( modeTree( mode, [] ).size ).toBe( 0 );
		expect( modeTree( board, [] ).size ).toBe( 0 );
	} );
} );

describe( 'API 3: focus scopes', () => {
	it( 'takes a client id and a label, and falls back for the exit label', () => {
		expect( focusScope( 'abc', { label: ' Products panel ', exitLabel: 'Back to the header' }, 'Back' ) ).toEqual( {
			clientId: 'abc',
			label: 'Products panel',
			exitLabel: 'Back to the header',
		} );
		expect( focusScope( 'abc', { label: 'Card' }, 'Back' )?.exitLabel ).toBe( 'Back' );
	} );

	it( 'refuses a request without a block or a label, never throwing', () => {
		const error = vi.spyOn( console, 'error' ).mockImplementation( () => {} );

		expect( focusScope( '', { label: 'x' }, 'Back' ) ).toBeNull();
		expect( focusScope( 'abc', undefined, 'Back' ) ).toBeNull();
		expect( String( error.mock.calls[ 1 ]?.[ 0 ] ) ).toContain( 'a label' );
	} );

	it( 'lets a mode hide a rail tab that means nothing there', () => {
		const Canvas = () => null;
		expect( modes.register( { id: 'hides', label: 'Hides', matches: () => false, Canvas, hidePanels: [ 'motion' ] } ) ).toBe( true );
		expect( modes.register( { id: 'bad-hides', label: 'Bad', matches: () => false, Canvas, hidePanels: 'motion' } ) ).toBe( false );
		const motion = { id: 'motion', label: 'Motion', render: () => null };
		expect( panelShows( motion, 'hides' ) ).toBe( false );
		expect( panelShows( motion, 'other' ) ).toBe( true );
		modes.unregister( 'hides' );
	} );
} );
