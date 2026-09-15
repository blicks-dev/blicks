<?php
/**
 * Marks a provider method as a WordPress filter callback.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Core\Attributes;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Declares the filter a provider method hooks into.
 *
 * {@see \Blicks\Core\ServiceProvider::register()} reads these and calls `add_filter()`. Repeatable,
 * so one method can serve several hooks.
 */
#[\Attribute( \Attribute::TARGET_METHOD | \Attribute::IS_REPEATABLE )]
final class Filter {

	public function __construct(
		public readonly string $hook,
		public readonly int $priority = 10,
		public readonly int $args = 1
	) {
	}
}
