/**
 * The JS half of the control allow-list parity suite.
 *
 * The PHP half is `tests/Unit/Ai/ControlCatalogTest::test_allow_list_matching`, and both run the
 * same table. The rule decides which style controls a block accepts; it lived only here until the
 * REST surface gained the ability to write the style tree, and an editor and a server that
 * disagree about it would let a caller set a control the inspector would then refuse to show.
 */
import { describe, expect, it } from 'vitest';
import { includesControl } from './control-allow';
import fixture from '../../../tests/fixtures/control-glob-cases.json';

describe( 'control allow-list matching', () => {
	it.each( fixture.cases )( '$why', ( { allow, id, allowed } ) => {
		expect( includesControl( allow, id ) ).toBe( allowed );
	} );
} );
