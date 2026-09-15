<?php
/**
 * Registers the plugin's general WordPress hooks.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Providers;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Core\ServiceProvider;
use Blicks\Core\Attributes\Action;

/**
 * Registers the plugin's general-purpose WordPress hooks.
 */
final class HookServiceProvider extends ServiceProvider {

	#[Action( 'init' )]
	public function onInit(): void {
		// Plugin initialisation logic goes here.
	}
}
