import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STYLE_MAP } from '@/framework/css/vars';

/**
 * The Studio's own chrome must not reuse a class the blocks put on content.
 *
 * Studio draws blocks in the admin page, where its stylesheet also applies — so a chrome rule on
 * `.bl-ai` (the assistant rail) turned every block with an align-items value into a flex column,
 * and a rule on `.bl-box` (Blicks Pro's scene panel) restyled every Box. Engine classes are
 * `bl-{cls}` with optional `--{state}` suffixes; block classes are `bl-{slug}` and `bl-{slug}__*`.
 */
const engine = new Set( STYLE_MAP.map( ( rule ) => `bl-${ rule.cls }` ) );
const blocks = new Set( readdirSync( resolve( __dirname, '../blocks' ), { withFileTypes: true } ).filter( ( d ) => d.isDirectory() && ! d.name.startsWith( '_' ) && d.name !== 'shared' ).map( ( d ) => `bl-${ d.name }` ) );

const owns = ( cls: string ): string | null => {
	const root = cls.replace( /(--|__).*$/, '' );
	if ( engine.has( root ) ) return 'an engine class';
	if ( blocks.has( root ) ) return 'a block class';
	return null;
};

describe( 'studio.css class names', () => {
	const css = readFileSync( resolve( __dirname, 'studio.css' ), 'utf8' );
	const used = [ ...new Set( [ ...css.matchAll( /\.(bl-[a-z0-9_-]+)/g ) ].map( ( m ) => m[ 1 ]! ) ) ];

	it( 'uses no class the engine or a block puts on content', () => {
		const clashes = used.map( ( cls ) => [ cls, owns( cls ) ] ).filter( ( [ , why ] ) => why );
		expect( clashes ).toEqual( [] );
	} );
} );
