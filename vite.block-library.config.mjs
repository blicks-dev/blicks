import { defineConfig } from 'vite';
import { wp_scripts } from '@kucrut/vite-for-wp/plugins';
import { resolve } from 'node:path';
import wpAssets from './scripts/vite-plugin-wp-assets.mjs';

/**
 * Standalone classic-IIFE build for Blicks block registration.
 *
 * The admin Pattern Library needs block types registered so `BlockPreview` can render serialized
 * pattern markup, but loading the full editor bundle also registers editor-only sidebars/showroom.
 * This single-entry pass inlines the shared block modules into `build/block-library.js`, avoiding
 * Rollup shared chunks that cannot be loaded by WordPress classic scripts.
 */
export default defineConfig( {
	plugins: [
		wp_scripts(),
		wpAssets(),
		{
			name: 'blicks-block-library-iife-wrap',
			enforce: 'post',
			renderChunk( code, chunk ) {
				if ( ! chunk.isEntry || chunk.fileName !== 'block-library.js' ) return null;
				return { code: `(function(){\n${ code }\n})();\n`, map: null };
			},
		},
	],
	esbuild: { jsx: 'automatic' },
	resolve: {
		alias: { '@': resolve( 'resources' ) },
	},
	build: {
		outDir: 'build',
		emptyOutDir: false,
		manifest: false,
		cssCodeSplit: false,
		rollupOptions: {
			input: resolve( 'resources/block-library.ts' ),
			preserveEntrySignatures: false,
			output: {
				entryFileNames: 'block-library.js',
				assetFileNames: 'block-library.css',
				inlineDynamicImports: true,
			},
		},
	},
} );
