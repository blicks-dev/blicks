<?php
/**
 * Registers the block library and its editor and base styles.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Providers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\DesignSystem\Catalogue;
use Blicks\DesignSystem\ThemeProjection;
use Blicks\DesignSystem\Animations;
use Blicks\Settings\AdminSettings;
use UupCode\Utilities\ServiceProvider;
use UupCode\Utilities\Attributes\Action;
use UupCode\Utilities\Plugin as BasePlugin;

/**
 * Registers every Blicks block and enqueues its editor and base styles.
 */
final class BlockServiceProvider extends ServiceProvider {

	#[Action( 'init' )]
	public function registerBlocks(): void {
		$blocksDir = BasePlugin::path( 'build/blocks' );

		if ( ! is_dir( $blocksDir ) ) {
			return;
		}

		// Register the shared editor bundle first so block.json's
		// "editorScript": "blicks-editor" resolves when register_block_type reads it.
		$asset = BasePlugin::path( 'build/editor.asset.php' );
		$manifest = file_exists( $asset ) ? require $asset : [
			'dependencies' => [],
			'version' => '1.0.0',
		];

		wp_register_script(
			'blicks-editor',
			BasePlugin::url( 'build/editor.js' ),
			$manifest['dependencies'],
			$manifest['version'],
			[ 'in_footer' => true ]
		);

		wp_register_style(
			'blicks-editor',
			BasePlugin::url( 'build/editor.css' ),
			[],
			$manifest['version']
		);

		// The editor bundle holds the overwhelming majority of this plugin's translatable
		// strings (block titles, inspector labels, control help). Without this call none of
		// them can be translated, no matter what is in the .po file.
		if ( function_exists( 'wp_set_script_translations' ) ) {
			wp_set_script_translations( 'blicks-editor', 'blicks', BasePlugin::path( 'languages' ) );
		}

		// Computed once and reused by both colorPalette() and tokenCatalogue() below — both derive
		// from the same Catalogue::snapshot(), so this avoids running the theme projection twice.
		$catalogueSnapshot = Catalogue::snapshot();

		wp_add_inline_script(
			'blicks-editor',
			'window.blicksEditorSettings = ' . wp_json_encode(
				[
					'helpBaseUrl' => trailingslashit( BasePlugin::url( 'build/blocks' ) ),
					// Live font families registered with the active theme (theme.json + WP Font Library
					// installs). The typography selector reads this synchronously at editor load — see
					// `resources/controls/typography/font-library.ts`.
					'fontLibrary' => ThemeProjection::fontFamilies(),
					// Design-system colour presets (shadcn semantic set ∪ theme palette accents, with
					// the active design theme's values) so the colour picker inherits the real presets
					// rather than a fixed list — see palette.ts + Catalogue::colorPalette().
					'colorPalette' => Catalogue::colorPalette( $catalogueSnapshot ),
					// Live theme/admin-projected token catalogue for every other TokenLibrary category
					// (spacing/radius/shadow/borderWidth/zIndex/transition/transform/filter/fontSize/
					// width/aspect/leading/gradient/opacity) — see token-utils.ts + Catalogue::tokenCatalogue().
					'tokenCatalogue' => Catalogue::tokenCatalogue( $catalogueSnapshot ),
					// The whole animation library — predefined (declared in runtime.scss) plus the
					// user's own from Blicks → Design System → Animation. The Motion control renders
					// this list and holds no hardcoded set of its own.
					'animations' => Animations::library(),
					'adminSettings' => AdminSettings::snapshot(),
				]
			) . ';',
			'before'
		);

		foreach ( new \DirectoryIterator( $blocksDir ) as $item ) {
			if ( $item->isDir() && ! $item->isDot() ) {
				register_block_type( $item->getPathname() );
			}
		}
	}

	#[Action( 'enqueue_block_editor_assets' )]
	public function enqueueEditorAssets(): void {
		wp_enqueue_style( 'blicks-editor' );
	}

	/**
	 * Enqueue every Blicks block's base stylesheet on BOTH the front end and the editor.
	 *
	 * When `wp_should_load_separate_core_block_assets()` is true (the modern default), core's
	 * `wp_enqueue_registered_block_scripts_and_styles()` no-ops and a block's `style` handle only
	 * enqueues when the block renders **server-side**. Blicks' layout primitives (grid/box/stack/
	 * heading/…) are STATIC blocks — they never server-render — so their base CSS
	 * (`.bl-grid { display:grid }`, `.bl-stack { display:flex }`, the var initializers) never loaded
	 * on the front end, and `grid-template-columns`/spans/flex silently did nothing. (Only dynamic
	 * blocks — section, marquee — happened to enqueue.) The editor was masked by force-enqueuing too,
	 * which hid the front-end breakage.
	 *
	 * `enqueue_block_assets` fires on the front end AND inside the iframed editor canvas, so one
	 * registration covers both. This loads the (small, cached) block base CSS on every page; gating
	 * on actual block presence is a deferred optimization, same tradeoff as `runtime.css`.
	 */
	#[Action( 'enqueue_block_assets' )]
	public function enqueueBlockBaseStyles(): void {
		foreach ( \WP_Block_Type_Registry::get_instance()->get_all_registered() as $name => $type ) {
			if ( ! str_starts_with( $name, 'blicks/' ) ) {
				continue;
			}
			foreach ( $type->style_handles as $handle ) {
				wp_enqueue_style( $handle );
			}
		}
	}
}
