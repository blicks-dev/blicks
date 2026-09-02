/**
 * Log in once, and hand every worker the resulting session.
 *
 * The blueprint's `login` step authenticates Playground's own browser session, which a fresh
 * Playwright context does not share — without this, every spec lands on wp-login.php instead of
 * the editor. Logging in per test would work too, but it pays for a full WordPress round trip on
 * every single one.
 */

import { chromium, type FullConfig } from '@playwright/test';

export default async function globalSetup( config: FullConfig ): Promise< void > {
	const { baseURL, storageState } = config.projects[ 0 ].use;

	const browser = await chromium.launch();
	const page = await browser.newPage( { baseURL } );

	await page.goto( '/wp-login.php' );
	await page.fill( '#user_login', 'admin' );
	await page.fill( '#user_pass', 'password' );
	await page.click( '#wp-submit' );

	// Landing on wp-admin is the proof the credentials took; a failed login re-renders the form.
	await page.waitForURL( '**/wp-admin/**', { timeout: 60_000 } );

	// Turn off the two modals WordPress opens over a new page. The "Choose a pattern" modal is
	// the important one: it appears asynchronously once patterns load, so a test that checks for
	// it on arrival finds nothing, skips it, and then has every later click swallowed by its
	// overlay. These are user preferences, so setting them once persists for the whole run.
	await page.goto( '/wp-admin/post-new.php?post_type=page' );
	await page.waitForFunction( () => ( window as any ).wp?.data?.dispatch( 'core/preferences' ) );
	await page.evaluate( () => {
		const preferences = ( window as any ).wp.data.dispatch( 'core/preferences' );
		preferences.set( 'core', 'enableChoosePatternModal', false );
		preferences.set( 'core', 'welcomeGuide', false );
		preferences.set( 'core/edit-post', 'welcomeGuide', false );
	} );
	// Preferences persist to user meta over REST; give that request time to land.
	await page.waitForTimeout( 2_000 );

	await page.context().storageState( { path: storageState as string } );
	await browser.close();
}
