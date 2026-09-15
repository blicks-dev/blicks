<?php
/**
 * One REST route, built fluently.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Core\Http;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Holds a route until {@see Rest} registers it on `rest_api_init`.
 */
final class RestRoute {

	/** @var callable|null */
	private $permissionCallback = null;

	/** @var array<string, mixed> */
	private array $schema = [];

	/**
	 * @param callable|array<int, mixed> $callback Route handler.
	 */
	public function __construct(
		private readonly string $namespace,
		private readonly string $route,
		private readonly string $method,
		private readonly mixed $callback
	) {
	}

	/** Who may call this route. Required — see {@see self::toArgs()}. */
	public function permission( callable $callback ): self {
		$this->permissionCallback = $callback;

		return $this;
	}

	/**
	 * Argument schema for the request, each entry carrying its own sanitize callback.
	 *
	 * @param array<string, mixed> $schema
	 */
	public function schema( array $schema ): self {
		$this->schema = $schema;

		return $this;
	}

	/**
	 * The `register_rest_route()` argument array.
	 *
	 * A route that never called {@see self::permission()} is registered as **denied**, not as
	 * "any logged-in user": every route in this plugin states its own capability, so a missing one
	 * is a mistake, and failing closed keeps that mistake from exposing the route to subscribers.
	 *
	 * @return array<string, mixed>
	 */
	public function toArgs(): array {
		$permission = $this->permissionCallback;

		if ( null === $permission ) {
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				_doing_it_wrong(
					__METHOD__,
					esc_html( sprintf( 'The REST route %s has no permission callback and was registered as denied.', $this->route ) ),
					'1.0.0'
				);
			}

			$permission = '__return_false';
		}

		$args = [
			'methods' => $this->method,
			'callback' => $this->callback,
			'permission_callback' => $permission,
		];

		if ( [] !== $this->schema ) {
			$args['args'] = $this->schema;
		}

		return $args;
	}

	public function getNamespace(): string {
		return $this->namespace;
	}

	public function getRoute(): string {
		return $this->route;
	}
}
