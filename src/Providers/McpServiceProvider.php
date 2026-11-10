<?php
/**
 * Registers the Blicks MCP server and the screen that turns it on.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Providers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Ai\Abilities\CoreAbilities;
use Blicks\Ai\Abilities\McpServer;
use Blicks\Core\Attributes\Action;
use Blicks\Core\Attributes\Filter;
use Blicks\Core\Http\Rest;
use Blicks\Core\ServiceProvider;
use Blicks\Http\Controllers\McpAccessController;
use Blicks\Http\RestArgs;
use Blicks\Mcp\Access;
use Blicks\Mcp\AdapterBoot;
use Blicks\Mcp\Posts;

/**
 * The one place the MCP layer touches WordPress.
 *
 * `src/Ai/` defines what the abilities are, as data; this registers them, builds their permission
 * callbacks, hands them to the adapter as a server, and declares the routes the admin screen uses.
 *
 * **Everything here is behind {@see Access::enabled()}.** Off — the default — registers nothing:
 * no ability, no server, no `/wp-json/blicks/mcp`. The admin routes stay, because they are how the
 * switch is turned on, and they require `manage_options`.
 */
final class McpServiceProvider extends ServiceProvider {

	#[Action( 'wp_abilities_api_categories_init' )]
	public function registerCategory(): void {
		if ( ! Access::enabled() ) {
			return;
		}

		$category = CoreAbilities::category();

		if ( wp_has_ability_category( $category['slug'] ) ) {
			return;
		}

		wp_register_ability_category(
			$category['slug'],
			[
				'label' => $category['label'],
				'description' => $category['description'],
			]
		);
	}

	/**
	 * Register every ability.
	 *
	 * An ability some other plugin already registered under the same name — an older Blicks Pro —
	 * is left alone rather than registered twice, which core reports as an error.
	 */
	#[Action( 'wp_abilities_api_init' )]
	public function registerAbilities(): void {
		if ( ! Access::enabled() || ! AdapterBoot::available() ) {
			return;
		}

		foreach ( self::registrations() as $name => $args ) {
			if ( wp_has_ability( $name ) ) {
				continue;
			}

			wp_register_ability( $name, $args );
		}
	}

	/**
	 * Every ability as `wp_register_ability()` takes it, with its permission declaration turned
	 * into a callback. One declared with no permission is dropped: core's default for a missing
	 * callback is any logged-in user, and an ability that forgot to say who may call it should
	 * reach nobody rather than everybody.
	 *
	 * @return array<string, array<string, mixed>>
	 */
	public static function registrations(): array {
		$out = [];

		foreach ( CoreAbilities::all() as $name => $args ) {
			$permission = $args['permission'] ?? null;
			unset( $args['permission'] );

			if ( null === $permission ) {
				continue;
			}

			$args['permission_callback'] = self::permissionCallback( $permission );
			$out[ $name ] = $args;
		}

		return $out;
	}

	/**
	 * Build the callback for a declared permission. Every failure path denies: this is the only
	 * gate between a connected client and someone's content.
	 *
	 * Per-post checks also require the post's type to be one an agent may touch
	 * ({@see Posts::types()}) — `edit_post` alone would admit a template or a navigation menu.
	 */
	public static function permissionCallback( mixed $permission ): callable {
		if ( is_string( $permission ) && '' !== $permission ) {
			return static fn (): bool => Access::enabled() && current_user_can( $permission );
		}

		if ( is_array( $permission ) && is_string( $permission['cap'] ?? null ) && is_string( $permission['arg'] ?? null ) ) {
			$cap = $permission['cap'];
			$arg = $permission['arg'];
			$publishArg = is_string( $permission['publishArg'] ?? null ) ? $permission['publishArg'] : null;

			return static function ( mixed $input = null ) use ( $cap, $arg, $publishArg ): bool {
				$id = is_array( $input ) ? ( $input[ $arg ] ?? null ) : null;
				$id = is_int( $id ) || ( is_string( $id ) && ctype_digit( $id ) ) ? (int) $id : 0;

				if ( ! Access::enabled() || $id <= 0 ) {
					return false;
				}

				$post = get_post( $id );

				if ( null === $post || ! Posts::isAllowedType( $post->post_type ) || ! current_user_can( $cap, $id ) ) {
					return false;
				}

				// WordPress answers `edit_post` for a trashed post from the status it had before,
				// so without this a status change would restore it from the trash without the
				// `delete_post` check, the untrash hooks or the trash metadata being cleared.
				// Restoring belongs to the Trash screen.
				if ( 'trash' === $post->post_status ) {
					return false;
				}

				if ( null !== $publishArg && in_array( $input[ $publishArg ] ?? null, Posts::PUBLIC_STATUSES, true ) ) {
					return current_user_can( 'publish_post', $id );
				}

				return true;
			};
		}

		if ( is_array( $permission ) && is_string( $permission['typeCap'] ?? null ) && is_string( $permission['typeArg'] ?? null ) ) {
			$typeCap = $permission['typeCap'];
			$typeArg = $permission['typeArg'];

			return static function ( mixed $input = null ) use ( $typeCap, $typeArg ): bool {
				$type = is_array( $input ) && is_string( $input[ $typeArg ] ?? null ) ? $input[ $typeArg ] : 'page';
				$object = get_post_type_object( $type );

				if ( ! Access::enabled() || null === $object || ! Posts::isAllowedType( $type ) ) {
					return false;
				}

				$cap = $object->cap->{$typeCap} ?? null;

				return is_string( $cap ) && current_user_can( $cap );
			};
		}

		return '__return_false';
	}

	/**
	 * Offer the abilities as named tools on `/wp-json/blicks/mcp`.
	 *
	 * The transport is gated as well as each tool. Without it an account that may call none of
	 * them — a subscriber — could still complete the handshake and read every tool's name and
	 * schema. Same capability as the read tools, so the outer gate is never looser than the inner.
	 */
	#[Action( 'mcp_adapter_init' )]
	public function registerServer( $adapter ): void {
		if ( ! Access::enabled() || ! AdapterBoot::available() || ! is_object( $adapter ) || ! method_exists( $adapter, 'create_server' ) ) {
			return;
		}

		$adapter->create_server(
			McpServer::ID,
			McpServer::ROUTE_NAMESPACE,
			McpServer::ROUTE,
			McpServer::NAME,
			McpServer::DESCRIPTION,
			McpServer::VERSION,
			[ \WP\MCP\Transport\HttpTransport::class ],
			\WP\MCP\Infrastructure\ErrorHandling\ErrorLogMcpErrorHandler::class,
			\WP\MCP\Infrastructure\Observability\NullMcpObservabilityHandler::class,
			McpServer::tools(),
			[],
			[],
			static fn (): bool => Access::enabled() && is_user_logged_in() && current_user_can( CoreAbilities::READ )
		);
	}

	/**
	 * An agent password signs in nowhere but the MCP server, and nowhere at all while access is off.
	 *
	 * An agent password is an ordinary WordPress application password, and WordPress accepts one on
	 * every REST route and on XML-RPC. Left at that, an administrator's agent could skip every check
	 * the MCP tools make by posting raw HTML through `/wp/v2/posts`, would keep working after "Turn
	 * off MCP access", and could mint itself a fresh password through the admin routes before the
	 * old one was revoked. Two gates close that: this one refuses the sign-in itself when access is
	 * off or the request is XML-RPC, and {@see self::limitAgentRoutes()} refuses any REST route but
	 * the MCP server's.
	 *
	 * Other application passwords on the account are untouched — only Blicks' own, by `app_id`.
	 *
	 * An action, not a filter: WordPress hands over its error collector and fails the sign-in if
	 * anything was added to it.
	 *
	 * @param mixed $error WordPress's error collector for this sign-in.
	 * @param mixed $user
	 * @param mixed $item  The application password record being used.
	 */
	#[Action( 'wp_authenticate_application_password_errors', 10, 4 )]
	public function limitAgentSignIn( mixed $error, mixed $user, mixed $item, mixed $password ): void {
		if ( ! $error instanceof \WP_Error || ! is_array( $item ) || ! Access::isAgentItem( $item ) ) {
			return;
		}

		if ( ! Access::enabled() ) {
			$error->add( 'blicks_mcp_off', __( 'MCP access is turned off for this site.', 'blicks' ), [ 'status' => 401 ] );
		} elseif ( ! self::isMcpRequest() ) {
			// Allowed in, not blocked out: any API another plugin opens to application passwords
			// (a GraphQL endpoint, say) never passes through `rest_pre_dispatch`, so it must be
			// refused here, at sign-in, along with XML-RPC.
			$error->add( 'blicks_mcp_only', __( 'This password works only for the Blicks MCP server.', 'blicks' ), [ 'status' => 401 ] );
		}
	}

	/** Is this a REST request for the Blicks MCP server? Decided from the route WordPress parsed. */
	private static function isMcpRequest(): bool {
		if ( ! defined( 'REST_REQUEST' ) || ! REST_REQUEST || ( defined( 'XMLRPC_REQUEST' ) && XMLRPC_REQUEST ) ) {
			return false;
		}

		$wp = $GLOBALS['wp'] ?? null;
		$route = is_object( $wp ) && isset( $wp->query_vars['rest_route'] ) ? (string) $wp->query_vars['rest_route'] : '';

		return self::isMcpRoute( '/' . trim( $route, '/' ) );
	}

	private static function isMcpRoute( string $route ): bool {
		$path = McpServer::restPath();

		return $path === $route || str_starts_with( $route, $path . '/' );
	}

	/**
	 * Refuse every REST route but `/wp-json/blicks/mcp` to a request signed in with an agent
	 * password. See {@see self::limitAgentSignIn()}.
	 *
	 * @param mixed $result
	 * @param mixed $server
	 * @param mixed $request
	 * @return mixed
	 */
	#[Filter( 'rest_pre_dispatch', PHP_INT_MAX, 3 )]
	public function limitAgentRoutes( mixed $result, mixed $server, mixed $request ): mixed {
		// Last, and whatever `$result` already holds: an earlier filter — a REST cache, say — may
		// have answered the request already, and that answer must not reach an agent either.
		if ( ! $request instanceof \WP_REST_Request || ! function_exists( 'rest_get_authenticated_app_password' ) ) {
			return $result;
		}

		$uuid = rest_get_authenticated_app_password();

		if ( ! is_string( $uuid ) || '' === $uuid || ! Access::isAgentPassword( get_current_user_id(), $uuid ) ) {
			return $result;
		}

		if ( Access::enabled() && self::isMcpRoute( (string) $request->get_route() ) ) {
			return $result;
		}

		return new \WP_Error( 'blicks_mcp_only', __( 'This password works only for the Blicks MCP server.', 'blicks' ), [ 'status' => 403 ] );
	}

	/**
	 * The admin screen's routes. All `manage_options`, all on the signed-in account — and only from
	 * a signed-in browser. A request authenticated with any application password is refused, so no
	 * agent, Blicks' or otherwise, can turn access on or mint itself a password.
	 */
	#[Action( 'init' )]
	public function registerRoutes(): void {
		$admin = static fn (): bool => current_user_can( 'manage_options' )
			&& ( ! function_exists( 'rest_get_authenticated_app_password' ) || null === rest_get_authenticated_app_password() );

		Rest::get( 'blicks/v1', 'mcp-access', [ McpAccessController::class, 'show' ] )
			->permission( $admin );

		Rest::patch( 'blicks/v1', 'mcp-access', [ McpAccessController::class, 'update' ] )
			->permission( $admin )
			->schema( [ 'enabled' => RestArgs::boolean() + [ 'required' => true ] ] );

		Rest::post( 'blicks/v1', 'mcp-access/agents', [ McpAccessController::class, 'createAgent' ] )
			->permission( $admin )
			->schema( [ 'client' => RestArgs::enum( array_keys( Access::CLIENTS ) ) + [ 'required' => true ] ] );

		Rest::patch( 'blicks/v1', 'mcp-access/agents/(?P<uuid>[a-f0-9-]{36})', [ McpAccessController::class, 'renameAgent' ] )
			->permission( $admin )
			->schema(
				[
					'uuid' => RestArgs::identifier( true ),
					'name' => RestArgs::text( true ),
				]
			);

		Rest::delete( 'blicks/v1', 'mcp-access/agents/(?P<uuid>[a-f0-9-]{36})', [ McpAccessController::class, 'revokeAgent' ] )
			->permission( $admin )
			->schema( [ 'uuid' => RestArgs::identifier( true ) ] );
	}
}
