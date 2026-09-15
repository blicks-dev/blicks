<?php
/**
 * Entry point for enqueuing a script or a stylesheet.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Core\Assets;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Starts a fluent enqueue:
 *
 *     Asset::script( 'blicks', Plugin::url( 'build/index.js' ) )->deps( 'wp-element' )->footer()->enqueue();
 *     Asset::style( 'blicks', Plugin::url( 'build/index.css' ) )->version( $v )->enqueue();
 *
 * The builders carry only the steps this plugin uses; add a step when a caller needs it, not before.
 */
final class Asset {

	public static function script( string $handle, string $src ): ScriptAsset {
		return new ScriptAsset( $handle, $src );
	}

	public static function style( string $handle, string $src ): StyleAsset {
		return new StyleAsset( $handle, $src );
	}
}
