<?php
/**
 * Registers the hooks behind Loop data sources.
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
use Blicks\Data\EndpointSource;
use Blicks\Data\EndpointUsage;

/**
 * Background work for Loops: refreshing an endpoint's cached answer off the page load that found
 * it out of date ({@see EndpointSource::read()}), and dropping the cached "used on N pages" counts
 * whenever a post changes ({@see EndpointUsage}).
 */
final class DataServiceProvider extends ServiceProvider {

	#[Action( EndpointSource::REFRESH_HOOK )]
	public function refreshEndpoint( string $id ): void {
		EndpointSource::refresh( $id );
	}

	#[Action( 'save_post' )]
	#[Action( 'deleted_post' )]
	public function forgetUsage(): void {
		EndpointUsage::forget();
	}
}
