/**
 * The import boundary on Pro modules (`modules/<name>/`, eslint.config.mjs): a module reaches
 * Blicks only through `@wordpress/*` and `window.blicks.*`. Run through ESLint itself, so the test
 * fails if the rule is ever dropped from the config, not only if its logic breaks.
 */
import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import { resolve } from 'node:path';

const eslint = new ESLint( { cwd: resolve( __dirname, '../..' ) } );

async function problems( code: string, file = 'modules/demo/resources/index.ts' ): Promise< string[] > {
	const [ result ] = await eslint.lintText( code, { filePath: resolve( __dirname, '../..', file ) } );

	return ( result?.messages ?? [] ).filter( ( m ) => 2 === m.severity ).map( ( m ) => m.ruleId ?? '' );
}

describe( 'the module import boundary', () => {
	it( 'allows @wordpress/* and the module’s own files', async () => {
		expect( await problems( "import { __ } from '@wordpress/i18n';\nimport { a } from './a';\nimport { b } from '../src/b';\nexport { __, a, b };\n" ) ).toEqual( [] );
	} );

	it( 'refuses the plugin’s own code, by alias or by path, and any other package', async () => {
		expect( await problems( "import { a } from '@/studio/registry';\nexport { a };\n" ) ).toEqual( [ 'no-restricted-imports' ] );
		expect( await problems( "import { a } from '../../../resources/studio/registry';\nexport { a };\n" ) ).toEqual( [ 'blicks/module-boundary' ] );
		expect( await problems( "import { a } from '../../other/resources/a';\nexport { a };\n" ) ).toEqual( [ 'blicks/module-boundary' ] );
		expect( await problems( "import a from 'lodash';\nexport { a };\n" ) ).toEqual( [ 'no-restricted-imports' ] );
	} );

	it( 'lets a module’s tests use Vitest and Node, and nothing else more', async () => {
		const test = 'modules/demo/resources/a.test.ts';
		expect( await problems( "import { it } from 'vitest';\nimport { readFileSync } from 'node:fs';\nexport { it, readFileSync };\n", test ) ).toEqual( [] );
		expect( await problems( "import { it } from 'vitest';\nexport { it };\n" ) ).toEqual( [ 'no-restricted-imports' ] );
		expect( await problems( "import a from 'lodash';\nexport { a };\n", test ) ).toEqual( [ 'no-restricted-imports' ] );
		expect( await problems( "import { a } from '../../../resources/studio/registry';\nexport { a };\n", test ) ).toEqual( [ 'blicks/module-boundary' ] );
	} );

	it( 'lets a module’s tests, and only its tests, load the free plugin by its one name', async () => {
		const code = "import '@blicks/test-runtime';\n";
		expect( await problems( code, 'modules/demo/tests/blocks.test.ts' ) ).toEqual( [] );
		expect( await problems( code ) ).toEqual( [ 'no-restricted-imports' ] );
		expect( await problems( "import { a } from '@/studio/registry';\nexport { a };\n", 'modules/demo/tests/blocks.test.ts' ) ).toEqual( [ 'no-restricted-imports' ] );
	} );

	it( 'leaves the plugin’s own code alone', async () => {
		expect( await problems( "import { a } from '@/studio/registry';\nexport { a };\n", 'resources/studio/x.ts' ) ).toEqual( [] );
	} );
} );
