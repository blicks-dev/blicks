import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

// Isolated from vite.config.mjs (the build config) so the WP-asset plugins don't
// run during tests. The `@/` alias mirrors tsconfig + the build config.
export default defineConfig( {
	resolve: {
		alias: { '@': resolve( 'resources' ) },
		// The plugin build externalizes React and @wordpress/* to globals, so nothing here
		// pins them — under test they resolve transitively and the monorepo can hand back two
		// copies of React (and of @emotion/react with it). Two Reacts make `isValidElement`
		// false for the other copy's elements, which blows up inside @wordpress/block-editor.
		dedupe: [
			'react',
			'react-dom',
			'@emotion/react',
			'@wordpress/block-editor',
			'@wordpress/blocks',
			'@wordpress/components',
			'@wordpress/data',
			'@wordpress/element',
			'@wordpress/rich-text',
			'@wordpress/compose',
			'@wordpress/i18n',
			'@wordpress/hooks',
			'@wordpress/private-apis',
		],
	},
	test: {
		// Most suites are pure logic and run in `node`. Block tests that import
		// @wordpress/block-editor opt into jsdom per-file with a
		// `// @vitest-environment jsdom` docblock, and get the shims below.
		environment: 'node',
		include: [ 'resources/**/*.test.ts', 'resources/**/*.test.tsx' ],
		setupFiles: [ resolve( 'resources/test/jsdom-setup.ts' ) ],
		server: {
			deps: {
				// @wordpress/* ship ESM that imports .json without an import attribute, which
				// native node ESM rejects. Inlining routes them through Vite's transform, which
				// handles JSON imports — and keeps every WP package on one module instance.
				inline: [ /@wordpress\// ],
			},
		},
	},
} );
