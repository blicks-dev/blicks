import { defineConfig } from 'vite';
import { wp_scripts } from '@kucrut/vite-for-wp/plugins';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import wpAssets from './scripts/vite-plugin-wp-assets.mjs';

/**
 * Entry points:
 *  - `index` / `admin`   → resources/index.js, resources/admin.js
 *  - `runtime`           → build/runtime.css (static consumer classes)
 *  - `editor`            → single JS bundle registering all blocks (avoids Rollup chunk splitting)
 *  - `blocks/<name>/index` → CSS-only entries (style.js → build/blocks/<name>/index.css)
 *
 * Output names are stable (no hashes) so the existing PHP `.asset.php` + `register_block_type` contract is intact.
 */
const BLOCKS_DIR = 'resources/blocks';

function discoverBlockStyles() {
    const entries = {};
    if ( !existsSync( BLOCKS_DIR ) ) return entries;
    for ( const dir of readdirSync( BLOCKS_DIR, { withFileTypes: true } ) ) {
        if ( !dir.isDirectory() ) continue;
        const file = resolve( BLOCKS_DIR, dir.name, 'style.js' );
        if ( existsSync( file ) ) entries[ `blocks/${ dir.name }/index` ] = file;
    }
    return entries;
}

const input = {
    index:   resolve('resources/index.js'),
    admin:   resolve('resources/admin.js'),
    runtime: resolve('resources/runtime/runtime.js'),
    editor:  resolve('resources/editor.tsx'),
    ...discoverBlockStyles(),
};

export default defineConfig({
    plugins: [
        wp_scripts(),                       // externalize @wordpress/* + react to wp.* globals
        wpAssets({ blocksDir: BLOCKS_DIR }), // emit .asset.php manifests + copy block.json
        {
            // WP enqueues each block index.js as a CLASSIC script, so their top-level const/let
            // share one global lexical scope and collide ("Identifier 'g' has already been
            // declared"). Each entry is self-contained (wp/* are externalized to globals, no
            // imports/exports), so wrapping the whole thing in an IIFE scopes the declarations.
            // enforce:'post' runs this after Vite's minify so we wrap the final code.
            name: 'blicks-iife-wrap',
            enforce: 'post',
            renderChunk( code, chunk ) {
                if ( ! chunk.isEntry || ! chunk.fileName.endsWith( '.js' ) ) return null;
                return { code: `(function(){\n${ code }\n})();\n`, map: null };
            },
        },
        {
            // Vite can merge entry CSS into hashed asset files. Rename known admin/editor
            // styles to stable paths so PHP can register them without reading a manifest.
            name: 'blicks-editor-css',
            enforce: 'post',
            generateBundle( _opts, bundle ) {
                for ( const [ key, asset ] of Object.entries( bundle ) ) {
                    if ( asset.type === 'asset' && /^assets\/editor-[^/]+\.css$/.test( key ) ) {
                        asset.fileName = 'editor.css';
                        bundle[ 'editor.css' ] = asset;
                        delete bundle[ key ];
                        break;
                    }
                }
                for ( const [ key, asset ] of Object.entries( bundle ) ) {
                    if ( asset.type === 'asset' && /^assets\/admin-[^/]+\.css$/.test( key ) ) {
                        asset.fileName = 'admin.css';
                        bundle[ 'admin.css' ] = asset;
                        delete bundle[ key ];
                        break;
                    }
                }
            },
        },
    ],
    esbuild: { jsx: 'automatic' },          // JSX via esbuild (no Babel); react/jsx-runtime is externalized
    resolve: {
        alias: { '@': resolve('resources') },
    },
    build: {
        outDir: 'build',
        emptyOutDir: true,
        manifest: false,
        cssCodeSplit: true,
        rollupOptions: {
            input,
            // No exported entry signatures — block scripts only run side effects (registerBlockType),
            // so nothing should emit `export`, which would break inside the IIFE wrap above.
            preserveEntrySignatures: false,
            output: {
                entryFileNames: '[name].js',          // build/index.js, build/blocks/<name>/index.js
                // Name CSS from its source so a block's stylesheet lands next to the block
                // (Rolldown forbids renaming in generateBundle, so we do it here).
                assetFileNames: ( info ) => {
                    const srcs = info.originalFileNames?.length ? info.originalFileNames : [];
                    const src = srcs[ 0 ] ?? '';
                    const block = src.match( /resources\/blocks\/([^/]+)\// );
                    if ( block ) return `blocks/${ block[ 1 ] }/index.css`;
                    if ( /resources\/runtime\//.test( src ) ) return 'runtime.css';
                    // Inspector control styles flow through the editor entry — route to build/editor.css.
                    if ( srcs.some( s => /resources\/(controls|framework|theme-settings)\//.test( s ) ) ) return 'editor.css';
                    if ( /(^|\/)admin(\.s?css)?$/.test( src ) ) return 'admin.css';
                    if ( /(^|\/)index(\.s?css)?$/.test( src ) ) return 'index.css';
                    return 'assets/[name]-[hash][extname]';
                },
                chunkFileNames: 'chunks/[name]-[hash].js',
            },
        },
    },
});
