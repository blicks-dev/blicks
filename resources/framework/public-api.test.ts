/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_VERSION, publicApi, exposePublicApi } from './public-api';

/**
 * The published surface is a contract with plugins this repo does not build.
 *
 * Everything else here is free to be renamed, moved or deleted — a bad rename shows up as a failing
 * import in the same build. These names do not: they are read at runtime, from a bundle compiled
 * somewhere else, and a rename here fails in the companion plugin at a customer's site with no
 * error in this repo at all.
 *
 * So the names are pinned. Adding one is free; changing or removing one must break this test and
 * move `API_VERSION`.
 */

/** The published shape, written out by hand. Deliberately duplicated — the point is to pin it. */
const CONTRACT: Record< string, string[] > = {
	blocks: [ 'defineBlock' ],
	values: [ 'getValue', 'setValue', 'setValues', 'setValueSlots', 'hasOverrides' ],
	data: [ 'blockSelect', 'blockDispatch', 'setBlockRegistry' ],
	inspector: [ 'registerContext', 'unregisterContext', 'hasAncestorOfName' ],
	ui: [ 'SettingsCard', 'OptionCards', 'SegmentedSetting', 'FieldRow', 'HelpTip', 'useBlockHelp', 'v2' ],
	engine: [ 'schema', 'control', 'valueSchema', 'isBlicksBlock', 'blockControls', 'allowsControl', 'problems', 'validateBlocks' ],
	constants: [ 'STATES', 'STATE_LABELS', 'DEFAULT_BREAKPOINTS', 'UI_VARS', 'UI_DARK_VARS' ],
};

describe( 'public API', () => {
	beforeEach( () => {
		delete ( window as unknown as { blicks?: unknown } ).blicks;
	} );

	it( 'publishes exactly the documented namespaces', () => {
		expect( Object.keys( publicApi ).sort() ).toEqual(
			[ 'version', ...Object.keys( CONTRACT ) ].sort()
		);
	} );

	it.each( Object.entries( CONTRACT ) )( 'publishes every %s member', ( namespace, members ) => {
		const actual = publicApi[ namespace as keyof typeof publicApi ] as Record< string, unknown >;

		for ( const member of members ) {
			expect( actual[ member ], `${ namespace }.${ member } is missing` ).toBeDefined();
		}

		// Extra members are fine and do not move the version; a MISSING one is the breakage.
		expect( members.every( ( m ) => m in actual ) ).toBe( true );
	} );

	it( 'publishes the v2 inspector kit under ui.v2, frozen', () => {
		const v2 = ( publicApi.ui as unknown as { v2: Record< string, unknown > } ).v2;
		const members = [ 'Sec', 'Row', 'Steps', 'SegIcons', 'SegText', 'Chips', 'Opts', 'Swatches', 'Switch', 'Field', 'Select', 'Slider', 'SubView', 'Note', 'Sub', 'Icon' ];

		for ( const member of members ) {
			expect( v2[ member ], `ui.v2.${ member } is missing` ).toBeTypeOf( 'function' );
		}
		expect( Object.isFrozen( v2 ) ).toBe( true );
	} );

	it( 'freezes each namespace so a companion cannot mutate ours', () => {
		for ( const namespace of Object.keys( CONTRACT ) ) {
			expect(
				Object.isFrozen( publicApi[ namespace as keyof typeof publicApi ] ),
				`${ namespace } is not frozen`
			).toBe( true );
		}
	} );

	it( 'carries the integer version PHP declares as BLICKS_API_VERSION', () => {
		expect( Number.isInteger( API_VERSION ) ).toBe( true );
		expect( API_VERSION ).toBe( 2 );
		expect( publicApi.version ).toBe( API_VERSION );

		// The two halves of one contract: a companion checks either, and they must not disagree.
		const plugin = readFileSync( resolve( dirname( fileURLToPath( import.meta.url ) ), '../../blicks.php' ), 'utf8' );
		expect( plugin ).toMatch( new RegExp( `define\\(\\s*'BLICKS_API_VERSION',\\s*'${ API_VERSION }'\\s*\\)` ) );
	} );

	it( 'names none of the blocks or controls removed in 2.0', () => {
		// Stack, Grid, Spacer and Divider became Box kinds; these control ids were dropped. Nothing
		// published may hand a companion one of them back.
		const surface = JSON.stringify( publicApi.engine.schema() ) + JSON.stringify( publicApi.constants );
		for ( const gone of [ 'blicks/stack', 'blicks/grid', 'blicks/spacer', 'blicks/divider', 'layout.float', 'layout.clear', 'layout.direction', 'decoration.before', 'decoration.after', 'layout.gridAutoColumns', 'animation.targetAngle' ] ) {
			expect( surface, gone ).not.toContain( `"${ gone }"` );
		}
	} );

	it( 'publishes onto window without clobbering a sibling namespace', () => {
		// `admin/registry.ts` writes `window.blicks.admin` from a different bundle. Whichever loads
		// second must not erase the first — this is the regression that would strand the admin API.
		const scope = window as unknown as { blicks?: Record< string, unknown > };
		scope.blicks = { admin: { registerView: () => true } };

		exposePublicApi();

		expect( scope.blicks?.admin ).toBeDefined();
		expect( ( scope.blicks as any ).blocks.defineBlock ).toBeTypeOf( 'function' );
		expect( ( scope.blicks as any ).version ).toBe( API_VERSION );
	} );

	it( 'is published before any block registers', () => {
		// The ordering a companion depends on: the entry assigns the global at the top, so a script
		// that lists this bundle as a dependency finds it ready.
		const entry = readFileSync(
			resolve( dirname( fileURLToPath( import.meta.url ) ), '../block-library.ts' ),
			'utf8'
		);

		const exposed = entry.indexOf( 'exposePublicApi()' );
		const firstBlock = entry.indexOf( "import './blocks/" );

		expect( exposed ).toBeGreaterThan( -1 );
		expect( firstBlock ).toBeGreaterThan( -1 );
		expect( exposed ).toBeLessThan( firstBlock );
	} );
} );
