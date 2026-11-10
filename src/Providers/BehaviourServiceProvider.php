<?php
/**
 * Wires the front-end behaviour registry.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Providers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Behaviours\Behaviours;
use Blicks\Core\ServiceProvider;
use Blicks\Core\Attributes\Action;
use Blicks\Core\Attributes\Filter;

/**
 * Registers each behaviour as a script module, and enqueues it on pages whose rendered blocks use
 * it ({@see Behaviours}).
 */
final class BehaviourServiceProvider extends ServiceProvider {

	#[Action( 'init' )]
	public function registerModules(): void {
		Behaviours::register();
	}

	/**
	 * Late, so it sees directives other render filters wrote (a Dialog's are written at 20).
	 *
	 * @param array<string, mixed> $block
	 */
	#[Filter( 'render_block', priority: 100, args: 2 )]
	public function collect( string $block_content, array $block ): string {
		unset( $block );
		Behaviours::collect( $block_content );

		return $block_content;
	}
}
