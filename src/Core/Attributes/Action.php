<?php
/**
 * Marks a provider method as a WordPress action callback.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Core\Attributes;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Declares the action a provider method listens to.
 *
 * {@see \Blicks\Core\ServiceProvider::register()} reads these and calls `add_action()`. Repeatable,
 * so one method can serve several hooks.
 */
#[\Attribute( \Attribute::TARGET_METHOD | \Attribute::IS_REPEATABLE )]
final class Action {

	public function __construct(
		public readonly string $hook,
		public readonly int $priority = 10,
		public readonly int $args = 1
	) {
	}
}
