import { describe, expect, it, vi } from 'vitest';

// The real panels need the editor's window; what matters here is which ones a block gets.
vi.mock( './StylePanel', () => ( { StylePanel: () => null } ) );
vi.mock( './MotionPanel', () => ( { MotionPanel: () => null } ) );

const { withSharedPanels } = await import( './shared-panels' );

const Settings = () => null;
const OwnStyle = () => null;

describe( 'shared Style and Motion panels', () => {
	it( 'gives a companion block with style controls both tabs', () => {
		const panels = withSharedPanels( { Settings }, 'blicks-kits/trip-cards', true );

		expect( panels.Settings ).toBe( Settings );
		expect( panels.Style ).toBeTypeOf( 'function' );
		expect( panels.Motion ).toBeTypeOf( 'function' );
	} );

	it( 'keeps a companion block’s own panels and its tab filter', () => {
		const tabsFor = () => [ 'settings' ] as const;
		const panels = withSharedPanels( { Settings, Style: OwnStyle, tabsFor }, 'acme/thing', true );

		expect( panels.Style ).toBe( OwnStyle );
		expect( panels.Motion ).toBeTypeOf( 'function' );
		expect( panels.tabsFor ).toBe( tabsFor );
	} );

	it( 'leaves Blicks’ own blocks and blocks without style controls alone', () => {
		expect( withSharedPanels( { Settings }, 'blicks/loop', true ) ).toEqual( { Settings } );
		expect( withSharedPanels( { Settings }, 'acme/plain', false ) ).toEqual( { Settings } );
	} );
} );
