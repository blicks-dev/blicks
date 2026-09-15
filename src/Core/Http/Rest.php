<?php
/**
 * REST route registration.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Core\Http;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Collects routes as they are declared and registers them on `rest_api_init`.
 *
 *     Rest::get( 'blicks/v1', 'settings', [ SettingsController::class, 'show' ] )
 *         ->permission( fn () => current_user_can( 'manage_options' ) );
 *
 * Routes are declared from a provider on `init`, which runs before `rest_api_init`; the listener is
 * attached the first time a route is added, so declaration order does not matter.
 */
final class Rest {

	/** @var list<RestRoute> */
	private static array $routes = [];

	private static bool $hooked = false;

	/** @param callable|array<int, mixed> $callback */
	public static function get( string $namespace, string $route, callable|array $callback ): RestRoute {
		return self::add( $namespace, $route, 'GET', $callback );
	}

	/** @param callable|array<int, mixed> $callback */
	public static function post( string $namespace, string $route, callable|array $callback ): RestRoute {
		return self::add( $namespace, $route, 'POST', $callback );
	}

	/** @param callable|array<int, mixed> $callback */
	public static function patch( string $namespace, string $route, callable|array $callback ): RestRoute {
		return self::add( $namespace, $route, 'PATCH', $callback );
	}

	/** @param callable|array<int, mixed> $callback */
	public static function delete( string $namespace, string $route, callable|array $callback ): RestRoute {
		return self::add( $namespace, $route, 'DELETE', $callback );
	}

	/**
	 * Every route declared so far. For tests.
	 *
	 * @return list<RestRoute>
	 */
	public static function routes(): array {
		return self::$routes;
	}

	/** Forget every declared route. For tests. */
	public static function reset(): void {
		self::$routes = [];
		self::$hooked = false;
	}

	/** @param callable|array<int, mixed> $callback */
	private static function add( string $namespace, string $route, string $method, callable|array $callback ): RestRoute {
		$restRoute = new RestRoute( $namespace, $route, $method, $callback );

		self::$routes[] = $restRoute;
		self::ensureHook();

		return $restRoute;
	}

	private static function ensureHook(): void {
		if ( self::$hooked ) {
			return;
		}

		self::$hooked = true;

		add_action(
			'rest_api_init',
			static function (): void {
				foreach ( self::$routes as $route ) {
					register_rest_route(
						$route->getNamespace(),
						'/' . ltrim( $route->getRoute(), '/' ),
						$route->toArgs()
					);
				}
			}
		);
	}
}
