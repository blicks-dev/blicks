<?php
/**
 * Base class for the plugin's service providers.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Core;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Core\Attributes\Action;
use Blicks\Core\Attributes\Filter;

/**
 * Wires a provider's methods to WordPress by reading their attributes.
 *
 * A provider declares its hooks where the method is, not in a list that can drift from it:
 *
 *     #[Action( 'wp_footer', priority: 5 )]
 *     public function printInlineCss(): void { … }
 *
 * `#[Action]` goes through `add_action()` and `#[Filter]` through `add_filter()`, which is the same
 * function underneath — so a method hooked with `#[Action]` may still return a value, as
 * `StyleServiceProvider::collectScopedCss()` does on `render_block`.
 */
abstract class ServiceProvider {

	/** Attach every attributed method on this provider to its hook. */
	public function register(): void {
		$reflection = new \ReflectionClass( $this );

		foreach ( $reflection->getMethods( \ReflectionMethod::IS_PUBLIC ) as $method ) {
			foreach ( $method->getAttributes( Action::class ) as $attribute ) {
				$action = $attribute->newInstance();
				add_action( $action->hook, [ $this, $method->getName() ], $action->priority, $action->args );
			}

			foreach ( $method->getAttributes( Filter::class ) as $attribute ) {
				$filter = $attribute->newInstance();
				add_filter( $filter->hook, [ $this, $method->getName() ], $filter->priority, $filter->args );
			}
		}
	}
}
