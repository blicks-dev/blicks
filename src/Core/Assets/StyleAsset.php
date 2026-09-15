<?php
/**
 * Fluent builder for a stylesheet enqueue.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Core\Assets;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Collects the arguments for `wp_enqueue_style()`, plus any inline CSS to attach to the handle.
 * Created by {@see Asset::style()}.
 */
final class StyleAsset {

	/** @var list<string> */
	private array $deps = [];

	private ?string $version = null;

	/** @var list<string> */
	private array $inlineStyles = [];

	public function __construct(
		private readonly string $handle,
		private readonly string $src
	) {
	}

	/** @param string ...$handles Handles this stylesheet depends on. */
	public function deps( string ...$handles ): self {
		$this->deps = array_values( $handles );

		return $this;
	}

	public function version( string $version ): self {
		$this->version = $version;

		return $this;
	}

	/** Queue CSS to attach to this handle once it is enqueued. */
	public function addInlineStyle( string $css ): self {
		$this->inlineStyles[] = $css;

		return $this;
	}

	public function enqueue(): void {
		wp_enqueue_style( $this->handle, $this->src, $this->deps, $this->version );

		foreach ( $this->inlineStyles as $css ) {
			wp_add_inline_style( $this->handle, $css );
		}
	}
}
