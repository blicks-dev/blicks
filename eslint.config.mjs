import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import { dirname, resolve, sep } from 'node:path';

/**
 * A Pro module (`modules/<name>/`) reaches the free plugin only through what it publishes:
 * `@wordpress/*` packages and `window.blicks.*` at runtime. A relative import is fine while it
 * stays inside the module's own folder; one that climbs out of it (into `resources/`, or another
 * module) is the shortcut that would make the move to Pro expensive. `no-restricted-imports`
 * catches the bare specifiers; this rule catches the relative ones, which a pattern cannot.
 */
const moduleBoundary = {
	meta: {
		type: 'problem',
		schema: [],
		messages: {
			escape: 'A module may not import from outside its own folder ({{source}}). Use window.blicks.* or add a public extension point.',
		},
	},
	create( context ) {
		const file = context.filename;
		const at = file.split( sep ).lastIndexOf( 'modules' );

		if ( at < 0 ) {
			return {};
		}

		const root = file.split( sep ).slice( 0, at + 2 ).join( sep );
		const check = ( source ) => {
			if ( ! source || 'string' !== typeof source.value || ! source.value.startsWith( '.' ) ) {
				return;
			}

			const target = resolve( dirname( file ), source.value );

			if ( target !== root && ! target.startsWith( root + sep ) ) {
				context.report( { node: source, messageId: 'escape', data: { source: source.value } } );
			}
		};

		return {
			ImportDeclaration: ( node ) => check( node.source ),
			ExportNamedDeclaration: ( node ) => check( node.source ),
			ExportAllDeclaration: ( node ) => check( node.source ),
			ImportExpression: ( node ) => ( 'Literal' === node.source.type ? check( node.source ) : undefined ),
		};
	},
};

/**
 * Flat ESLint config for the Blicks TypeScript/TSX framework + block sources.
 *
 * Scope is the authored source under `resources/` and `scripts/`; build output,
 * vendored deps, and generated files are ignored. Rules lean on
 * typescript-eslint's non-type-checked recommended set so `pnpm lint` stays fast
 * and editor-friendly; a few project-specific relaxations below match the
 * conventions in docs/conventions.md (intentional `any` at WP API boundaries that
 * ship no types, leading-underscore unused args).
 */
export default tseslint.config(
	{
		ignores: [
			'build/**',
			// A Pro module's own build output (scripts/build-modules.mjs).
			'modules/*/build/**',
			'dist/**',
			'**/vendor/**',
			// Both recursive: docs/, tests/e2e/ and tests/integration/ install their own
			// dependencies, and a bare `vendor/**` or `node_modules/**` only matches the root.
			'**/node_modules/**',
			'languages/**',
			'**/*.gen.ts',
			'**/*.d.ts',
			// Both install and lint separately: they are their own packages with their own
			// toolchains (Mintlify, Playwright), and their code targets Node and the browser
			// rather than the editor bundle this config is written for.
			'docs/**',
			'tests/e2e/**',
			// Git worktrees checked out inside the repo: other branches, each linted from its own folder.
			'.claude/**',
			'.worktrees/**',
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['resources/**/*.{ts,tsx}', 'modules/**/*.{ts,tsx}', 'scripts/**/*.{ts,mjs}'],
		languageOptions: {
			ecmaVersion: 2023,
			sourceType: 'module',
		},
		plugins: { 'react-hooks': reactHooks },
		rules: {
			// The editor is React, so the hook rules apply. `exhaustive-deps` stays a warning:
			// several of its hits here are deliberate (a mount-only effect, a memo keyed on a
			// value rather than on the closure that reads it), and silently "fixing" a dep array
			// changes behaviour.
			'react-hooks/exhaustive-deps': 'warn',
			'react-hooks/rules-of-hooks': 'error',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
			// WP editor packages ship no TS types; boundary casts are unavoidable.
			'@typescript-eslint/no-explicit-any': 'off',
			'no-empty': ['warn', { allowEmptyCatch: true }],
			// One-shot dev scripts may legitimately run in Node
			// without @types/node in the tsconfig; require a descriptive justification.
			'@typescript-eslint/ban-ts-comment': [
				'error',
				{
					'ts-expect-error': 'allow-with-description',
					'ts-ignore': true,
					'ts-nocheck': 'allow-with-description',
					'ts-check': false,
					minimumDescriptionLength: 10,
				},
			],
		},
	},
	{
		// `rules-of-hooks` identifies components by name, and the block factory's are named by
		// WordPress's registerBlockType contract: `edit` IS a component (WP renders it as one)
		// and `buildProps` is only ever called from inside it. The rule cannot see either, so it
		// reports every hook in the file. Off here only — it still guards every block and control.
		files: ['resources/framework/define-block.tsx'],
		rules: { 'react-hooks/rules-of-hooks': 'off' },
	},
	{
		// Pro modules: see `moduleBoundary` above and modules/README.md.
		files: ['modules/**/*.{ts,tsx}'],
		plugins: { blicks: { rules: { 'module-boundary': moduleBoundary } } },
		rules: {
			'blicks/module-boundary': 'error',
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							regex: '^(?!@wordpress/|\\.)',
							message: 'A module imports only @wordpress/* and its own files; the rest of Blicks is on window.blicks.*.',
						},
					],
				},
			],
		},
	},
	{
		// A module's own tests run under Vitest in Node, and never ship: they may also import
		// `vitest`, `node:*`, and the free plugin as a page loads it before the module's script
		// (`@blicks/test-runtime`, resources/test/blicks-runtime.ts). Nothing else.
		files: ['modules/**/*.test.{ts,tsx}'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							regex: '^(?!@wordpress/|@blicks/test-runtime$|vitest$|node:|\\.)',
							message: 'A module test imports only @wordpress/*, @blicks/test-runtime, vitest, node:* and its own files.',
						},
					],
				},
			],
		},
	},
	{
		// Vitest/spec files use console + dynamic shapes freely.
		files: ['**/*.test.{ts,tsx}'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'no-console': 'off',
		},
	},
	{
		// Node build scripts (ESM + CommonJS): Node globals, console allowed.
		files: ['scripts/**/*.{js,cjs,mjs}'],
		languageOptions: {
			globals: {
				require: 'readonly',
				module: 'writable',
				process: 'readonly',
				console: 'readonly',
				__dirname: 'readonly',
				__filename: 'readonly',
				fetch: 'readonly',
			},
		},
		rules: {
			'@typescript-eslint/no-require-imports': 'off',
			'@typescript-eslint/no-unused-expressions': 'off',
			'no-console': 'off',
		},
	},
	{
		// CommonJS build scripts use require()/module.exports.
		files: ['scripts/**/*.{js,cjs}'],
		languageOptions: { sourceType: 'commonjs' },
	},
);
