import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

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
		],
	},
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['resources/**/*.{ts,tsx}', 'scripts/**/*.{ts,mjs}'],
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
			// One-shot dev scripts (e.g. specimen-gen.test.ts) may legitimately run in Node
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
