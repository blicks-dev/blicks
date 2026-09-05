/**
 * Log in once, and hand every worker the resulting session.
 *
 * The blueprint's `login` step authenticates Playground's own browser session, which a fresh
 * Playwright context does not share — without this, every spec lands on wp-login.php instead of
 * the editor. Logging in per test would work too, but it pays for a full WordPress round trip on
 * every single one.
 */

import { chromium, expect, type FullConfig } from '@playwright/test';

export default async function globalSetup( config: FullConfig ): Promise< void > {
	const { baseURL, storageState } = config.projects[ 0 ].use;

	const browser = await chromium.launch();
	const page = await browser.newPage( { baseURL } );

	await page.goto( '/wp-login.php' );

	// Playground may already have authenticated this context, in which case wp-login.php
	// redirects straight through and there is no form to fill.
	if ( await page.locator( '#user_login' ).count() ) {
		await page.fill( '#user_login', 'admin' );
		await page.fill( '#user_pass', 'password' );
		await page.click( '#wp-submit' );
	}

	// Assert an admin-only element rather than matching the URL: a failed login re-renders the
	// form at a URL that still looks plausible, and WordPress on WASM is slow enough in CI that
	// this needs real headroom.
	await page.goto( '/wp-admin/' );
	await expect( page.locator( '#wpadminbar' ) ).toBeVisible( { timeout: 120_000 } );

	// Turn off the two modals WordPress opens over a new page. The "Choose a pattern" modal is
	// the important one: it appears asynchronously once patterns load, so a test that checks for
	// it on arrival finds nothing, skips it, and then has every later click swallowed by its
	// overlay. These are user preferences, so setting them once persists for the whole run.
	await page.goto( '/wp-admin/post-new.php?post_type=page' );

	// Waiting for the dispatcher to merely EXIST is not enough. Preferences hydrate from user
	// meta asynchronously, and a value written before that arrives is overwritten by the server's
	// copy moments later — which is how `enableChoosePatternModal` came to be set on every run
	// and still false in none of them. Wait for the store to hold real persisted data first.
	await page.waitForFunction( () => {
		const select = ( window as any ).wp?.data?.select( 'core/preferences' );
		return !! select && select.get( 'core', 'editorMode' ) !== undefined;
	}, undefined, { timeout: 120_000 } );

	const setPreferences = () =>
		page.evaluate( () => {
			const preferences = ( window as any ).wp.data.dispatch( 'core/preferences' );
			preferences.set( 'core', 'enableChoosePatternModal', false );
			preferences.set( 'core', 'welcomeGuide', false );
			preferences.set( 'core/edit-post', 'welcomeGuide', false );
		} );

	const readsDisabled = () =>
		page.evaluate(
			() =>
				( window as any ).wp.data.select( 'core/preferences' ).get(
					'core',
					'enableChoosePatternModal'
				) === false
		);

	await setPreferences();
	await expect.poll( readsDisabled, { timeout: 30_000 } ).toBe( true );

	// Reloading is the only honest proof that the value reached user meta rather than sitting in
	// a store that is about to be thrown away. If hydration lost it, set it once more and let the
	// suite continue — openEditor dismisses the modal regardless.
	await page.reload();
	await page.waitForFunction( () => {
		const select = ( window as any ).wp?.data?.select( 'core/preferences' );
		return !! select && select.get( 'core', 'editorMode' ) !== undefined;
	}, undefined, { timeout: 120_000 } );
	if ( ! ( await readsDisabled() ) ) {
		await setPreferences();
		await expect.poll( readsDisabled, { timeout: 30_000 } ).toBe( true );
	}

	await page.context().storageState( { path: storageState as string } );
	await browser.close();
}
