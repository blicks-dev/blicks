<?php
/**
 * How the abilities are offered to MCP clients.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Ai\Abilities;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * The description of a Blicks MCP server, as data.
 *
 * The MCP Adapter's own default server is *discovery-based*: it exposes three generic meta-tools —
 * `discover-abilities`, `get-ability-info`, `execute-ability` — through which a client can reach
 * any public ability. That works, and it is why the abilities are usable the moment the adapter is
 * installed with nothing registered here.
 *
 * It is not how a model works best. A client pointed at the default server sees three tools whose
 * names say nothing about this site; choosing `blicks/validate-layout` means first calling
 * `discover-abilities`, reading a list, and then calling `execute-ability` with a name it has to
 * quote correctly. Four named tools with their own schemas remove all of that: the model sees
 * `validate_layout` next to its arguments and calls it directly.
 *
 * So this registers a server of its own, listing the abilities as first-class tools. They are not
 * offered on the default server at all (`meta.mcp.public` is false): one door, behind one gate.
 *
 * As with {@see CoreAbilities}, this is only the description. `McpServiceProvider` is what hands
 * it to the adapter, so this file stays free of WordPress and of the adapter's own classes.
 */
final class McpServer {

	/**
	 * Identifies the server to the adapter. Not `blicks`: older Blicks Pro builds register a
	 * server under that id, and two servers sharing one id is an adapter error, not a coexistence.
	 */
	public const ID = 'blicks-mcp';

	/**
	 * REST namespace and route: `/wp-json/blicks/mcp`.
	 *
	 * Unversioned on purpose. The URL is what a user pastes into a client's configuration, and a
	 * version in it would break every connected agent on the release that bumps it. The protocol
	 * is versioned by MCP's own negotiation, and the tool set by {@see self::VERSION}.
	 */
	public const ROUTE_NAMESPACE = 'blicks';

	public const ROUTE = 'mcp';

	public const NAME = 'Blicks';

	public const DESCRIPTION = 'Inspect Blicks blocks and the design system, validate layouts, and read or '
		. 'change the layout of posts you can edit.';

	/** The tool set's version. Bump the minor for an added tool, the major for a changed one. */
	public const VERSION = '1.1.0';

	/**
	 * The path a client connects to, for the admin screen to show.
	 *
	 * Built from the constants above rather than written twice, so the screen cannot drift from
	 * what was actually registered.
	 */
	public static function restPath(): string {
		return '/' . self::ROUTE_NAMESPACE . '/' . self::ROUTE;
	}

	/**
	 * The ability names this server offers as tools.
	 *
	 * Taken from {@see CoreAbilities::all()} rather than listed again: a server advertising an
	 * ability that was never registered fails at the adapter, and an ability missing from the
	 * server is invisible for no stated reason. One list avoids both.
	 *
	 * A companion plugin adds its own through `blicks_mcp_tools`: an agent's application password
	 * reaches only this server, so an ability not listed here is out of its reach. Only names in
	 * the `namespace/name` form that are registered by then are kept, after the plugin's own, which
	 * a companion cannot remove.
	 *
	 * @return list<string>
	 */
	public static function tools(): array {
		$own = array_keys( CoreAbilities::all() );

		/**
		 * More abilities for the Blicks MCP server to offer as named tools.
		 *
		 * @param list<string> $tools The plugin's own ability names.
		 */
		$filtered = apply_filters( 'blicks_mcp_tools', $own );
		$added = [];

		foreach ( is_array( $filtered ) ? $filtered : [] as $name ) {
			if ( ! is_string( $name ) || in_array( $name, $own, true ) || 1 !== preg_match( '#^[a-z0-9-]+/[a-z0-9-]+$#', $name ) ) {
				continue;
			}

			if ( function_exists( 'wp_has_ability' ) && ! wp_has_ability( $name ) ) {
				continue;
			}

			$added[] = $name;
		}

		return [ ...$own, ...array_values( array_unique( $added ) ) ];
	}
}
