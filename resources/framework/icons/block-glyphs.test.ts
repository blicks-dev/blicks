import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
// The generator itself, so the test measures what `pnpm gen:block-icons` would actually write.
import { buildIcon } from '../../../scripts/gen-block-icons.mjs';
import GLYPHS from './block-glyphs.json';

const ROOT       = resolve( __dirname, '../../..' );
const BLOCKS_DIR = resolve( ROOT, 'resources/blocks' );

const blockSlugs = readdirSync( BLOCKS_DIR, { withFileTypes: true } )
	.filter( ( entry ) => entry.isDirectory() && existsSync( resolve( BLOCKS_DIR, entry.name, 'block.json' ) ) )
	.map( ( entry ) => entry.name );

const metadata = ( slug: string ) =>
	JSON.parse( readFileSync( resolve( BLOCKS_DIR, slug, 'block.json' ), 'utf8' ) );

// wordpress.org runs a block.json icon containing `<svg` through wp_kses with this allow-list
// (wporg-plugins-2024, template-parts/section-blocks.php). Anything outside it is silently
// dropped — a stroke attribute included, which is why these icons are outlined rather than stroked.
const ALLOWED: Record< string, string[] > = {
	svg:   [ 'class', 'aria-hidden', 'aria-labelledby', 'role', 'xmlns', 'width', 'height', 'viewbox' ],
	g:     [ 'fill' ],
	title: [ 'title' ],
	path:  [ 'd', 'fill', 'transform' ],
};

describe( 'block glyphs', () => {
	it( 'covers every registered block, and no others', () => {
		expect( Object.keys( GLYPHS.glyphs ).sort() ).toEqual(
			blockSlugs.map( ( slug ) => `blicks/${ slug }` ).sort()
		);
	} );

	it.each( blockSlugs )( '%s block.json carries the generated icon', ( slug ) => {
		const icon = metadata( slug ).icon;

		expect( typeof icon ).toBe( 'string' );
		// Regenerating must be a no-op — otherwise the committed icon has drifted from the glyph.
		expect( icon ).toBe( buildIcon( ( GLYPHS.glyphs as any )[ `blicks/${ slug }` ] ) );
	} );

	it.each( blockSlugs )( '%s icon survives the wordpress.org kses filter', ( slug ) => {
		const icon: string = metadata( slug ).icon;

		for ( const [ , tag ] of icon.matchAll( /<([a-zA-Z]+)/g ) ) {
			expect( ALLOWED, `<${ tag }> is stripped by wp_kses` ).toHaveProperty( tag.toLowerCase() );
		}

		for ( const [ , tag, attrs ] of icon.matchAll( /<([a-zA-Z]+)((?:\s+[a-zA-Z:-]+="[^"]*")*)/g ) ) {
			for ( const [ , attr ] of attrs.matchAll( /([a-zA-Z:-]+)="/g ) ) {
				expect(
					ALLOWED[ tag.toLowerCase() ],
					`<${ tag } ${ attr }> is stripped by wp_kses`
				).toContain( attr.toLowerCase() );
			}
		}

		// A stroke that reached the markup would be filtered away and leave the glyph invisible.
		expect( icon ).not.toMatch( /stroke/i );
	} );
} );
