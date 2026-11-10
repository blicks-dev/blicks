/**
 * The release-zip check (`scripts/check-release-zip.js`, run by `pnpm bundle`): no Pro module code
 * reaches the free zip, by path or by namespace.
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const { problems } = createRequire( import.meta.url )( '../../scripts/check-release-zip.js' ) as {
	problems: ( names: string[], read: ( name: string ) => string ) => string[];
};

const files: Record< string, string > = {
	'blicks/blicks.php': '<?php // Blicks',
	'blicks/build/studio.js': 'window.blicks.studio',
	'blicks/src/Core/DevModules.php': '<?php // loads modules/<name>/module.php',
	'blicks/readme.txt': 'BlicksPro is mentioned in prose only',
};
const read = ( name: string ): string => files[ name ] ?? '';

describe( 'the release zip check', () => {
	it( 'passes the free plugin, which names modules/ only in prose', () => {
		expect( problems( Object.keys( files ), read ) ).toEqual( [] );
	} );

	it( 'fails on a modules/ path or a BlicksPro path', () => {
		expect( problems( [ 'blicks/modules/header-studio/module.php', 'blicks/src/BlicksPro/X.php' ], read ) ).toEqual( [
			'blicks/modules/header-studio/module.php: a Pro module path',
			'blicks/src/BlicksPro/X.php: a Pro module path',
		] );
	} );

	it( 'fails on code that names the Pro namespace', () => {
		expect( problems( [ 'blicks/vendor/composer/autoload_psr4.php' ], () => "'BlicksPro\\\\Header\\\\' => modules" ) ).toEqual( [
			'blicks/vendor/composer/autoload_psr4.php: names BlicksPro',
		] );
	} );
} );
