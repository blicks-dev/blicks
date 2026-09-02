<?php
/**
 * Enqueues the front-end and admin asset bundles.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Providers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use UupCode\Utilities\ServiceProvider;
use UupCode\Utilities\Attributes\Action;
use UupCode\Utilities\Assets\Asset;
use UupCode\Utilities\Plugin as BasePlugin;
use Blicks\DesignSystem\CssVariables;
use Blicks\DesignSystem\Keyframes;

/**
 * Enqueues the front-end and admin scripts and stylesheets.
 */
final class AssetServiceProvider extends ServiceProvider {

	#[Action( 'wp_enqueue_scripts' )]
	public function enqueueFrontend(): void {
		$asset = $this->assetManifest( 'index' );

		Asset::script( 'blicks', BasePlugin::url( 'build/index.js' ) )
			->deps( ...$asset['dependencies'] )
			->version( $asset['version'] )
			->footer()
			->enqueue();

		// Vite only emits a CSS file when the entry actually imports styles.
		if ( file_exists( BasePlugin::path( 'build/index.css' ) ) ) {
			Asset::style( 'blicks', BasePlugin::url( 'build/index.css' ) )
				->version( $asset['version'] )
				->enqueue();
		}
	}

	#[Action( 'admin_enqueue_scripts' )]
	public function enqueueAdmin(): void {
		// Read-only: decides whether to enqueue this screen's assets. Not form processing and
		// it changes no state, so there is nothing for a nonce to protect. Unslashed and
		// sanitized, then matched against a fixed allowlist of our own menu slugs.
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$page = isset( $_GET['page'] ) ? sanitize_key( wp_unslash( $_GET['page'] ) ) : '';
		$slugs = AdminServiceProvider::views();
		if ( ! isset( $slugs[ $page ] ) ) {
			return;
		}

		$asset = $this->assetManifest( 'admin' );
		$blockLibrary = $this->assetManifest( 'block-library' );

		Asset::script( 'blicks-block-library', BasePlugin::url( 'build/block-library.js' ) )
			->deps( ...$blockLibrary['dependencies'] )
			->version( $blockLibrary['version'] )
			->footer()
			->enqueue();

		Asset::script( 'blicks-admin', BasePlugin::url( 'build/admin.js' ) )
			->deps( 'blicks-block-library', ...$asset['dependencies'] )
			->version( $asset['version'] )
			->footer()
			->enqueue();

		wp_add_inline_script(
			'blicks-admin',
			'window.blicksAdminSettings = ' . wp_json_encode(
				[
					'buildBaseUrl' => trailingslashit( BasePlugin::url( 'build' ) ),
					'blockBaseUrl' => trailingslashit( BasePlugin::url( 'build/blocks' ) ),
					'cssVariables' => CssVariables::css(),
					'keyframesCss' => Keyframes::css(),
					'version' => defined( 'BLICKS_VERSION' ) ? BLICKS_VERSION : '',
					'view' => $slugs[ $page ],
					'pageSlugs' => array_flip( $slugs ),
					'adminUrl' => admin_url( 'admin.php' ),
					'docsUrl' => defined( 'BLICKS_DOCS_URI' ) ? BLICKS_DOCS_URI : '',
					'editorUrl' => wp_is_block_theme()
						? admin_url( 'site-editor.php' )
						: admin_url( 'post-new.php?post_type=page' ),
				]
			) . ';',
			'before'
		);

		if ( function_exists( 'wp_set_script_translations' ) ) {
			wp_set_script_translations( 'blicks-admin', 'blicks', BasePlugin::path( 'languages' ) );
			wp_set_script_translations( 'blicks-block-library', 'blicks', BasePlugin::path( 'languages' ) );
		}

		if ( file_exists( BasePlugin::path( 'build/admin.css' ) ) ) {
			// Version the stylesheet by its OWN mtime, not the JS bundle hash — a CSS-only rebuild
			// leaves the JS hash unchanged, so reusing it would keep serving a stale cached file.
			$cssMtime   = filemtime( BasePlugin::path( 'build/admin.css' ) );
			$cssVersion = (string) ( $cssMtime ? $cssMtime : $asset['version'] );

			// theme.json's own variables, first: `--blicks-*` aliases resolve to `--wp--preset--*`,
			// which wp-admin does not define anywhere. Without them every preset-backed token
			// silently falls back to the inherited value — the Design System's type specimens all
			// rendered at the admin's 15px, so eight of the thirteen roles looked identical.
			// Only custom-property declarations, so it cannot restyle admin chrome.
			$themeVariables = function_exists( 'wp_get_global_stylesheet' )
				? wp_get_global_stylesheet( [ 'variables' ] )
				: '';

			Asset::style( 'blicks-admin', BasePlugin::url( 'build/admin.css' ) )
				->version( $cssVersion )
				->addInlineStyle( $themeVariables . "\n" . CssVariables::css() . "\n" . Keyframes::css() )
				->enqueue();
		}
	}

	private function assetManifest( string $entry ): array {
		$file = BasePlugin::path( "build/{$entry}.asset.php" );
		return file_exists( $file ) ? require $file : [
			'dependencies' => [],
			'version' => '1.0.0',
		];
	}
}
