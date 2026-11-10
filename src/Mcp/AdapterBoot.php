<?php
/**
 * Starts the bundled MCP Adapter when MCP access is on.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Mcp;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Starts the bundled WordPress MCP Adapter — only when MCP access is on.
 *
 * Starting the adapter is not free of side effects: it creates REST routes, and by default a
 * *default server* that offers every public ability on the site through generic tools, to any
 * logged-in account. A site that never turned MCP on should get none of that from Blicks, so
 * nothing starts while the switch is off.
 *
 * And when it is on, Blicks does not create that default server on the site's behalf. Blicks'
 * own abilities are not on it (`meta.mcp.public` is false), so all it would add is a second door
 * to other plugins' abilities that their owners did not open. A site running the standalone MCP
 * Adapter plugin keeps its default server — that plugin's owner did ask for it.
 */
final class AdapterBoot {

	/** Are the adapter's classes and the Abilities API both present? */
	public static function available(): bool {
		return class_exists( 'WP_Ability' )
			&& function_exists( 'wp_register_ability' )
			&& class_exists( '\WP\MCP\Core\McpAdapter' )
			&& class_exists( '\WP\MCP\Transport\HttpTransport' );
	}

	/**
	 * Start it, if access is on and there is something to start. Safe to call twice and safe
	 * beside another plugin bundling the adapter: the adapter is a singleton.
	 *
	 * Hooked early on `plugins_loaded` rather than at file scope: the bundled classes resolve
	 * through the Jetpack autoloader, which settles which copy of a package wins once every plugin
	 * has loaded. The adapter itself does nothing until `rest_api_init`.
	 */
	public static function boot(): void {
		if ( ! self::available() || ! Access::enabled() ) {
			return;
		}

		if ( ! defined( 'WP_MCP_DIR' ) ) {
			add_filter( 'mcp_adapter_create_default_server', '__return_false', 5 );
		}

		\WP\MCP\Core\McpAdapter::instance();
	}
}
