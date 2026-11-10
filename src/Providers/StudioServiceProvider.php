<?php
/**
 * Loads the Studio in the post editor.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Providers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Core\ServiceProvider;
use Blicks\Core\Attributes\Action;
use Blicks\Core\Plugin as BasePlugin;
use Blicks\DesignSystem\Animations;
use Blicks\DesignSystem\Catalogue;
use Blicks\DesignSystem\CssVariables;
use Blicks\DesignSystem\DesignLanguages;
use Blicks\Settings\AdminSettings;

/**
 * Loads the Studio: the full-screen surface that mounts a Blicks tree, builds it, and leaves by
 * Insert, Save as pattern or Copy JSON.
 *
 * **It runs after the editor bundle, by handle.** The Studio mounts Blicks blocks and renders their
 * inspectors, so the block types must be registered before it runs; listing `blicks-editor` as a
 * dependency is what makes WordPress order the two. It is also what puts `window.blicks` in place
 * before this bundle adds its `studio` namespace beside the rest.
 *
 * `blicks-studio` is a handle other plugins may depend on. A companion that registers a mode, a
 * "+ New" item, patterns or a rail panel through `window.blicks.studio` declares it, and so runs
 * after the registries exist and before the Studio is first opened. Its own stylesheet and block
 * styles are its to enqueue. A mode's script can instead be named in `blicks_studio_modes`
 * ({@see self::modeHandles()}), so it loads only where the Studio does.
 *
 * Gated on `edit_posts`: the Studio writes blocks into a post, so a user who cannot edit one has no
 * use for it and should not be shipped the bundle.
 */
final class StudioServiceProvider extends ServiceProvider {

	/** The Studio's script and style handle, and a contract with companion plugins. */
	public const HANDLE = 'blicks-studio';

	/** The `wp_block` meta key holding the custom keyframes a pattern carries. */
	public const KEYFRAMES_META = 'blicks_keyframes';

	/** The editor bundle: the block library, and `window.blicks`. */
	private const EDITOR_HANDLE = 'blicks-editor';

	#[Action( 'enqueue_block_editor_assets' )]
	public function enqueueEditorAssets(): void {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return;
		}

		// The block library failed to register (no build). A Studio with nothing to mount is worse
		// than no Studio, and a hard dependency on a missing handle drops the script silently.
		if ( ! wp_script_is( self::EDITOR_HANDLE, 'registered' ) ) {
			return;
		}

		$asset = BasePlugin::path( 'build/studio.asset.php' );
		if ( ! file_exists( $asset ) ) {
			return;
		}

		$manifest = require $asset;
		$deps = array_values( array_unique( array_merge( [ self::EDITOR_HANDLE ], (array) ( $manifest['dependencies'] ?? [] ) ) ) );

		wp_enqueue_script(
			self::HANDLE,
			BasePlugin::url( 'build/studio.js' ),
			$deps,
			$manifest['version'] ?? false,
			[ 'in_footer' => true ]
		);

		/*
		 * **No `.wp-block*` selector in this stylesheet.** The editor copies any admin stylesheet
		 * whose selector text mentions `wp-block` or `editor-styles-wrapper` into the canvas iframe —
		 * a substring test — so one rule naming a core block class would put the whole Studio
		 * stylesheet in an iframe where none of it applies.
		 */
		wp_enqueue_style(
			self::HANDLE,
			BasePlugin::url( 'build/studio.css' ),
			[],
			$manifest['version'] ?? false
		);

		wp_add_inline_script(
			self::HANDLE,
			'window.blicksStudioSettings = ' . wp_json_encode( self::settings() ) . ';',
			'before'
		);

		wp_set_script_translations( self::HANDLE, 'blicks', BasePlugin::path( 'languages' ) );

		// A companion's modes, only where the Studio itself loads.
		foreach ( self::modeHandles() as $handle ) {
			wp_enqueue_script( $handle );
		}
	}

	/**
	 * The script handles companion modes need on the Studio screen, from `blicks_studio_modes`.
	 *
	 * A mode's script registers itself through `window.blicks.studio` and so must load after this
	 * bundle and only where it loads. A companion registers its script (depending on
	 * `blicks-studio`) and names the handle here, rather than enqueueing it on every editor screen:
	 *
	 *     add_filter( 'blicks_studio_modes', fn ( $handles ) => [ ...$handles, 'acme-board-mode' ] );
	 *
	 * Kept: non-empty strings naming a registered script, the Studio's own handle excepted. A
	 * handle that is not registered would be enqueued as nothing, silently, so it is dropped here
	 * instead, where a test can see it.
	 *
	 * @return list<string>
	 */
	public static function modeHandles(): array {
		/**
		 * Script handles for Studio modes, enqueued with the Studio.
		 *
		 * @param list<string> $handles
		 */
		$filtered = apply_filters( 'blicks_studio_modes', [] );
		$handles = [];

		foreach ( is_array( $filtered ) ? $filtered : [] as $handle ) {
			if ( is_string( $handle ) && '' !== $handle && self::HANDLE !== $handle && wp_script_is( $handle, 'registered' ) ) {
				$handles[] = $handle;
			}
		}

		return array_values( array_unique( $handles ) );
	}

	/**
	 * What the library needs to show a pattern in any design language: the site's own, and every
	 * language's custom properties computed against this site's palette and values. A preview is
	 * the site in another language, not a stock sample.
	 *
	 * @return array{site: string, languages: list<array{id: string, name: string, description: string, css: string}>, motion: array{properties: list<string>, canEdit: bool}, marketplace: array{enabled: bool, settingsUrl: string}}
	 */
	private static function settings(): array {
		$languages = [];
		foreach ( DesignLanguages::builtins() as $language ) {
			$languages[] = [
				'id' => (string) $language['id'],
				'name' => (string) $language['name'],
				'description' => (string) $language['description'],
				'css' => CssVariables::css( Catalogue::snapshot( null, (string) $language['id'] ) ),
			];
		}

		return [
			'site' => DesignLanguages::activeId(),
			'languages' => $languages,
			'motion' => [
				// What a keyframe step may set: the library's own allow-list, not a copy of it.
				'properties' => Animations::allowedProperties(),
				// Only someone who may edit the library can add to it, so only they get the editor.
				'canEdit' => current_user_can( 'manage_options' ),
			],
			// The Marketplace shelf is off until an administrator turns it on. While it is off the
			// shelf asks nothing of the marketplace and says where the switch is — the link only for
			// someone who can flip it.
			'marketplace' => [
				'enabled' => AdminSettings::marketplaceEnabled(),
				'settingsUrl' => current_user_can( 'manage_options' ) ? admin_url( 'admin.php?page=blicks-settings' ) : '',
			],
		];
	}

	/**
	 * The keyframes a saved pattern carries, so a pattern taken to another site arrives with the
	 * custom animations its blocks name. Kept on the `wp_block` post rather than in its markup —
	 * the markup stays plain blocks, and the copy is cleaned exactly as the library cleans a record.
	 */
	#[Action( 'init' )]
	public function registerPatternKeyframes(): void {
		register_post_meta(
			'wp_block',
			self::KEYFRAMES_META,
			[
				'single' => true,
				'type' => 'array',
				'default' => [],
				'sanitize_callback' => [ Animations::class, 'sanitizeList' ],
				'auth_callback' => static fn (): bool => current_user_can( 'edit_posts' ),
				'show_in_rest' => [
					'schema' => [
						'type' => 'array',
						'items' => [
							'type' => 'object',
							'additionalProperties' => true,
						],
					],
				],
			]
		);
	}
}
