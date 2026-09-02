<?php
/**
 * Plugin bootstrap: requirements, lifecycle and service registration.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use UupCode\Utilities\Plugin as BasePlugin;
use Blicks\DesignSystem\Store;
use Blicks\Providers\HookServiceProvider;
use Blicks\Providers\RestServiceProvider;
use Blicks\Providers\AssetServiceProvider;
use Blicks\Providers\AdminServiceProvider;
use Blicks\Providers\BlockServiceProvider;
use Blicks\Providers\StyleServiceProvider;
use Blicks\Models\SettingModel;
use Blicks\Settings\AdminSettings;

/**
 * Boots the plugin: requirement checks, lifecycle hooks and service providers.
 */
final class Plugin {

	private const MIN_PHP = '8.1';
	private const MIN_WP  = '6.5';

	/**
	 * Plugins that must be active before this plugin loads.
	 * Check by class or function existence — independent of install path.
	 *
	 * Example:
	 *   'WooCommerce'            => ['class'    => 'WooCommerce'],
	 *   'Advanced Custom Fields' => ['function' => 'acf'],
	 *
	 * @var array<string, array{class?: string, function?: string}>
	 */
	private static array $requires = [];

	private function __construct() {}

	public static function boot( string $file ): void {
		BasePlugin::boot( $file );

		if ( ! self::requirementsMet() ) {
			add_action( 'admin_notices', [ self::class, 'requirementsNotice' ] );
			return;
		}

		// Activation/deactivation/uninstall hooks must be registered immediately —
		// they fire before plugins_loaded during activation requests.
		BasePlugin::onActivate( [ self::class, 'activate' ] );
		BasePlugin::onDeactivate( [ self::class, 'deactivate' ] );
		BasePlugin::onUninstall( [ self::class, 'uninstall' ] );

		// Defer everything else to plugins_loaded so all plugin classes
		// and functions are available for dependency checks.
		add_action( 'plugins_loaded', [ self::class, 'init' ] );
	}

	public static function init(): void {
		// WordPress.org auto-loads translations for hosted plugins since 4.6 — a manual
		// load_plugin_textdomain() call is unnecessary and actively discouraged there.
		if ( ! self::dependenciesMet() ) {
			add_action( 'admin_notices', [ self::class, 'missingDependenciesNotice' ] );
			return;
		}

		SettingModel::maybeInstall();

		( new HookServiceProvider() )->register();
		( new RestServiceProvider() )->register();
		( new AssetServiceProvider() )->register();
		( new AdminServiceProvider() )->register();
		( new BlockServiceProvider() )->register();
		( new StyleServiceProvider() )->register();
	}

	public static function activate(): void {
		SettingModel::install();
		// Design-system overrides are now owned per-theme; discard the legacy global override set.
		Store::purgeLegacyOption();
		flush_rewrite_rules();
	}

	public static function deactivate(): void {
		flush_rewrite_rules();
	}

	/**
	 * Options this plugin owns. Kept in one place so uninstall cannot drift from what the
	 * plugin actually writes. The `blicks_hub*` entries are legacy: Blicks Hub was removed
	 * before 1.0, but an install that ran a pre-release build may still carry them.
	 *
	 * @var list<string>
	 */
	private const OWNED_OPTIONS = [
		'blicks_design_system',
		'blicks_design_custom_slugs',
		'blicks_design_animations',
		'blicks_design_themes',
		'blicks_settings_schema_version',
		'blicks_hub',
		'blicks_hub_items_schema_version',
		'blicks_hub_library_last_good',
		'blicks_hub_library_last_sync',
	];

	/**
	 * Runs when the plugin is deleted from wp-admin.
	 *
	 * Destructive, so it is opt-in: nothing is removed unless the site has explicitly enabled
	 * "Remove all data on uninstall" in Blicks → Settings. A user who deletes the plugin to
	 * troubleshoot, or who reinstalls later, keeps their design tokens by default.
	 */
	public static function uninstall(): void {
		if ( ! AdminSettings::deleteDataOnUninstallEnabled() ) {
			return;
		}

		global $wpdb;

		if ( is_object( $wpdb ) ) {
			// Table names are class constants joined to $wpdb->prefix — no user input reaches
			// this identifier, and identifiers cannot be bound with prepare().
			foreach ( [ SettingModel::table(), $wpdb->prefix . 'blicks_hub_items' ] as $table ) {
                // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared, WordPress.DB.DirectDatabaseQuery, PluginCheck.Security.DirectDB.UnescapedDBParameter -- Static identifier; DROP TABLE cannot be prepared.
				$wpdb->query( "DROP TABLE IF EXISTS {$table}" );
			}
		}

		foreach ( self::OWNED_OPTIONS as $option ) {
			delete_option( $option );
		}
	}

	public static function requirementsNotice(): void {
		global $wp_version;

		if ( version_compare( PHP_VERSION, self::MIN_PHP, '<' ) ) {
			printf(
				'<div class="notice notice-error"><p>%s</p></div>',
				esc_html(
					sprintf(
					/* translators: 1: minimum required PHP version, 2: PHP version currently running. */
						__( 'Blicks requires PHP %1$s or higher. You are running PHP %2$s.', 'blicks' ),
						self::MIN_PHP,
						PHP_VERSION
					)
				)
			);
		}

		if ( version_compare( $wp_version, self::MIN_WP, '<' ) ) {
			printf(
				'<div class="notice notice-error"><p>%s</p></div>',
				esc_html(
					sprintf(
					/* translators: 1: minimum required WordPress version, 2: WordPress version currently running. */
						__( 'Blicks requires WordPress %1$s or higher. You are running WordPress %2$s.', 'blicks' ),
						self::MIN_WP,
						$wp_version
					)
				)
			);
		}
	}

	public static function missingDependenciesNotice(): void {
		$missing = array_filter( self::$requires, fn( $check ) => ! self::isAvailable( $check ) );

		foreach ( $missing as $name => $check ) {
			printf(
				'<div class="notice notice-error"><p>%s</p></div>',
				esc_html(
					sprintf(
					/* translators: %s: name of the required plugin. */
						__( 'Blicks requires %s to be installed and active.', 'blicks' ),
						$name
					)
				)
			);
		}
	}

	private static function requirementsMet(): bool {
		global $wp_version;

		return version_compare( PHP_VERSION, self::MIN_PHP, '>=' )
			&& version_compare( $wp_version, self::MIN_WP, '>=' );
	}

	private static function dependenciesMet(): bool {
		foreach ( self::$requires as $check ) {
			if ( ! self::isAvailable( $check ) ) {
				return false;
			}
		}
		return true;
	}

	private static function isAvailable( array $check ): bool {
		if ( isset( $check['class'] ) ) {
			return class_exists( $check['class'] );
		}
		if ( isset( $check['function'] ) ) {
			return function_exists( $check['function'] );
		}
		return true;
	}
}
