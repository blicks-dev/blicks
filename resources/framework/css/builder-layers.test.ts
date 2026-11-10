/**
 * Layered values — stacked box-shadows, layered backgrounds, two-value corners. Every case lives in
 * tests/fixtures/builder-layer-cases.json, which BuilderLayersTest.php runs against the PHP engine.
 */

import { describe, expect, it } from 'vitest';
import { buildElementStyle } from './vars';
import fixture from '../../../tests/fixtures/builder-layer-cases.json';

describe( 'layered builders', () => {
	for ( const c of fixture.cases as any[] ) {
		it( c.name, () => {
			const out = buildElementStyle( c.blicks );
			if ( c.vars ) expect( out.vars ).toEqual( c.vars );
			if ( c.classes ) expect( out.classes ).toEqual( c.classes );
		} );
	}
} );
