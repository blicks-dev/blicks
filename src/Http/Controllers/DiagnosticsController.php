<?php
/**
 * REST controller for the admin diagnostics run.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Http\Controllers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use UupCode\Utilities\Plugin as BasePlugin;
use Blicks\Settings\AdminSettings;
use WP_Block_Type_Registry;
use WP_REST_Response;

/**
 * The "Run diagnostics" action on the admin Overview. Every check is a real measurement of
 * this install — nothing here is decorative, and a check that cannot be measured is reported
 * as such rather than passed.
 */
final class DiagnosticsController {

	private const MIN_PHP = '8.1';
	private const MIN_WP = '6.5';

	public static function run(): WP_REST_Response {
		$checks = [
			self::buildAssets(),
			self::blockRegistration(),
			self::themeJson(),
			self::globalStyles(),
			self::interactivity(),
			self::phpVersion(),
			self::wpVersion(),
		];

		return new WP_REST_Response(
			[
				'ranAt' => gmdate( DATE_ATOM ),
				'checks' => $checks,
				'summary' => [
					'pass' => self::countBy( $checks, 'pass' ),
					'warn' => self::countBy( $checks, 'warn' ),
					'fail' => self::countBy( $checks, 'fail' ),
				],
			],
			200
		);
	}

	/** @return array{id:string,label:string,detail:string,status:string} */
	private static function buildAssets(): array {
		$required = [ 'build/admin.js', 'build/index.js', 'build/blocks' ];
		$missing = array_values(
			array_filter(
				$required,
				static fn ( string $rel ): bool => ! file_exists( BasePlugin::path( $rel ) )
			)
		);

		return self::check(
			'build-assets',
			__( 'Build assets', 'blicks' ),
			[] === $missing
				? __( 'Editor, front-end, and block bundles are present.', 'blicks' )
				: sprintf(
					/* translators: %s: comma-separated list of missing build paths. */
					__( 'Missing: %s. Run the plugin build.', 'blicks' ),
					implode( ', ', $missing )
				),
			[] === $missing ? 'pass' : 'fail'
		);
	}

	/** @return array{id:string,label:string,detail:string,status:string} */
	private static function blockRegistration(): array {
		$built = self::builtBlockCount();
		$registered = self::registeredBlockCount();

		if ( 0 === $built ) {
			return self::check(
				'blocks',
				__( 'Block registration', 'blicks' ),
				__( 'No built blocks found in build/blocks.', 'blicks' ),
				'fail'
			);
		}

		return self::check(
			'blocks',
			__( 'Block registration', 'blicks' ),
			sprintf(
				/* translators: 1: registered block count, 2: built block count. */
				__( '%1$d of %2$d built blocks are registered.', 'blicks' ),
				$registered,
				$built
			),
			$registered >= $built ? 'pass' : 'warn'
		);
	}

	/** @return array{id:string,label:string,detail:string,status:string} */
	private static function themeJson(): array {
		$hasThemeJson = AdminSettings::themeJsonSupported();
		$isBlockTheme = function_exists( 'wp_is_block_theme' ) && wp_is_block_theme();

		if ( ! $hasThemeJson ) {
			return self::check(
				'theme-json',
				'theme.json',
				__( 'The active theme has no theme.json — Blicks falls back to its own token defaults.', 'blicks' ),
				'warn'
			);
		}

		return self::check(
			'theme-json',
			'theme.json',
			$isBlockTheme
				? __( 'Block theme with theme.json — tokens project from the theme.', 'blicks' )
				: __( 'theme.json found in a classic theme — tokens project, site editing does not.', 'blicks' ),
			$isBlockTheme ? 'pass' : 'warn'
		);
	}

	/** @return array{id:string,label:string,detail:string,status:string} */
	private static function globalStyles(): array {
		if ( ! class_exists( 'WP_Theme_JSON_Resolver' )
			|| ! method_exists( 'WP_Theme_JSON_Resolver', 'get_user_global_styles_post_id' ) ) {
			return self::check(
				'global-styles',
				__( 'Global Styles', 'blicks' ),
				__( 'This WordPress version exposes no user Global Styles record.', 'blicks' ),
				'warn'
			);
		}

		$postId = (int) \WP_Theme_JSON_Resolver::get_user_global_styles_post_id();
		if ( $postId <= 0 ) {
			return self::check(
				'global-styles',
				__( 'Global Styles', 'blicks' ),
				__( 'No user Global Styles record yet — one is created on the first token save.', 'blicks' ),
				'warn'
			);
		}

		$canEdit = current_user_can( 'edit_theme_options' );

		return self::check(
			'global-styles',
			__( 'Global Styles', 'blicks' ),
			$canEdit
				? __( 'User Global Styles record is present and writable.', 'blicks' )
				: __( 'User Global Styles record is present but this account cannot edit it.', 'blicks' ),
			$canEdit ? 'pass' : 'warn'
		);
	}

	/** @return array{id:string,label:string,detail:string,status:string} */
	private static function interactivity(): array {
		$available = function_exists( 'wp_interactivity' );

		return self::check(
			'interactivity',
			__( 'Interactivity API', 'blicks' ),
			$available
				? __( 'Available — interactive blocks can run.', 'blicks' )
				: __( 'Unavailable — the interactive blocks will render but not respond.', 'blicks' ),
			$available ? 'pass' : 'fail'
		);
	}

	/** @return array{id:string,label:string,detail:string,status:string} */
	private static function phpVersion(): array {
		$ok = version_compare( PHP_VERSION, self::MIN_PHP, '>=' );

		return self::check(
			'php',
			__( 'PHP version', 'blicks' ),
			sprintf(
				/* translators: 1: running PHP version, 2: minimum required PHP version. */
				__( 'Running %1$s (minimum %2$s).', 'blicks' ),
				PHP_VERSION,
				self::MIN_PHP
			),
			$ok ? 'pass' : 'fail'
		);
	}

	/** @return array{id:string,label:string,detail:string,status:string} */
	private static function wpVersion(): array {
		$version = (string) get_bloginfo( 'version' );
		$ok = version_compare( $version, self::MIN_WP, '>=' );

		return self::check(
			'wordpress', // phpcs:ignore WordPress.WP.CapitalPDangit.MisspelledInText -- machine-readable check id, not prose; renaming it changes the REST payload.
			__( 'WordPress version', 'blicks' ),
			sprintf(
				/* translators: 1: running WordPress version, 2: minimum required version. */
				__( 'Running %1$s (minimum %2$s).', 'blicks' ),
				$version,
				self::MIN_WP
			),
			$ok ? 'pass' : 'fail'
		);
	}

	private static function builtBlockCount(): int {
		$dir = BasePlugin::path( 'build/blocks' );
		if ( ! is_dir( $dir ) ) {
			return 0;
		}

		$count = 0;
		foreach ( new \DirectoryIterator( $dir ) as $item ) {
			if ( $item->isDir() && ! $item->isDot() && is_file( $item->getPathname() . '/block.json' ) ) {
				++$count;
			}
		}

		return $count;
	}

	private static function registeredBlockCount(): int {
		if ( ! class_exists( 'WP_Block_Type_Registry' ) ) {
			return 0;
		}

		$names = array_keys( WP_Block_Type_Registry::get_instance()->get_all_registered() );

		return count( array_filter( $names, static fn ( string $name ): bool => str_starts_with( $name, 'blicks/' ) ) );
	}

	/** @return array{id:string,label:string,detail:string,status:string} */
	private static function check( string $id, string $label, string $detail, string $status ): array {
		return [
			'id' => $id,
			'label' => $label,
			'detail' => $detail,
			'status' => $status,
		];
	}

	/** @param list<array{status:string}> $checks */
	private static function countBy( array $checks, string $status ): int {
		return count( array_filter( $checks, static fn ( array $check ): bool => $check['status'] === $status ) );
	}
}
