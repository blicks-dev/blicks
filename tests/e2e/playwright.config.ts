import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath( new URL( '.', import.meta.url ) );
const REPO_ROOT = resolve( HERE, '../..' );

// The suite mounts the plugin as source, so Playground runs whatever is on disk — it does not
// run Vite or Composer for you. Without these the plugin fatals or registers zero blocks, and
// every spec fails for a reason that has nothing to do with the blocks.
for ( const required of [ 'build/block-library.js', 'vendor/autoload.php' ] ) {
	if ( ! existsSync( resolve( REPO_ROOT, required ) ) ) {
		throw new Error(
			`Missing ${ required }.\nRun \`pnpm build\` and \`composer install\` in the plugin root first.`
		);
	}
}

// A dedicated port so a hand-started Playground instance cannot silently serve the suite.
const PORT = 9401;

// Specs that run on their own, after the parallel ones (see the projects below).
const SERIAL = /(form|loop|loop-sources)\.spec\.ts$/;

export default defineConfig( {
	testDir: './specs',
	globalSetup: './global-setup.ts',
	// WordPress boots from WASM and the editor is heavy; the assertions themselves are quick.
	timeout: 120_000,
	expect: { timeout: 15_000 },
	fullyParallel: true,
	forbidOnly: !! process.env.CI,
	retries: process.env.CI ? 2 : 0,
	// One WordPress instance backs every worker, so keep concurrency modest: the specs write
	// real posts to a single SQLite database.
	workers: 2,
	reporter: process.env.CI ? [ [ 'github' ], [ 'html', { open: 'never' } ] ] : [ [ 'list' ] ],
	use: {
		baseURL: `http://127.0.0.1:${ PORT }`,
		// Written by global-setup.ts; every worker starts already logged in as admin.
		storageState: './.auth/admin.json',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	projects: [
		{ name: 'chromium', testIgnore: SERIAL, use: { ...devices[ 'Desktop Chrome' ] } },
		// Safari has neither invoker commands nor `closedby` yet, so the dialog specs there run the
		// dialog behaviour's polyfills. The form specs run here too (below): the form plan ships the
		// front end only once validation, the error summary's focus and the send work in WebKit as
		// well. Desktop WebKit, not iOS: no real touch scrolling or notch.
		{
			name: 'webkit',
			testMatch: /dialog\.spec\.ts$/,
			use: { ...devices[ 'Desktop Safari' ] },
		},
		/*
		 * The form and Loop specs, one at a time, after everything else. They publish pages, send
		 * forms and wait on real timers against the one WordPress the suite shares; next to another
		 * worker they ran past their timeouts, and alone they pass.
		 */
		{
			name: 'chromium-serial',
			testMatch: SERIAL,
			workers: 1,
			dependencies: [ 'chromium', 'webkit' ],
			use: { ...devices[ 'Desktop Chrome' ] },
		},
		{
			name: 'webkit-serial',
			testMatch: /form\.spec\.ts$/,
			workers: 1,
			dependencies: [ 'chromium-serial' ],
			use: { ...devices[ 'Desktop Safari' ] },
		},
	],
	webServer: {
		// Real WordPress on PHP-WASM — no Docker, no MySQL. The mount points WordPress at the
		// working tree, so the suite tests the plugin as it is right now, not a built artifact.
		command: [
			'npx --yes @wp-playground/cli@latest server',
			`--port ${ PORT }`,
			'--blueprint ./blueprint.json',
			`--mount ${ REPO_ROOT }:/wordpress/wp-content/plugins/blicks`,
			// Test-only must-use plugins, e.g. the Loop specs' fake data endpoint.
			`--mount ${ resolve( HERE, 'mu-plugins' ) }:/wordpress/wp-content/mu-plugins`,
		].join( ' ' ),
		// Readiness is probed against a STATIC file on purpose. Every PHP route — `/`,
		// `/wp-login.php`, `/wp-admin/` — answers a cookie-less client with a 302 to itself, so a
		// plain HTTP probe follows that loop until Playwright's timeout and the suite never starts.
		// Browsers are unaffected; only the probe needs a route that resolves without a session.
		url: `http://127.0.0.1:${ PORT }/wp-includes/js/wp-embed.min.js`,
		reuseExistingServer: ! process.env.CI,
		// First boot downloads WordPress and the PHP WASM binary.
		timeout: 300_000,
		stdout: 'ignore',
		stderr: 'pipe',
	},
} );
