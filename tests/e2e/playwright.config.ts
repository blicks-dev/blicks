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
	projects: [ { name: 'chromium', use: { ...devices[ 'Desktop Chrome' ] } } ],
	webServer: {
		// Real WordPress on PHP-WASM — no Docker, no MySQL. The mount points WordPress at the
		// working tree, so the suite tests the plugin as it is right now, not a built artifact.
		command: [
			'npx --yes @wp-playground/cli@latest server',
			`--port ${ PORT }`,
			'--blueprint ./blueprint.json',
			`--mount ${ REPO_ROOT }:/wordpress/wp-content/plugins/blicks`,
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
