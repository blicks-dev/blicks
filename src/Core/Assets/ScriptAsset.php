<?php
/**
 * Fluent builder for a script enqueue.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Core\Assets;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Collects the arguments for `wp_enqueue_script()`. Created by {@see Asset::script()}.
 */
final class ScriptAsset {

	/** @var list<string> */
	private array $deps = [];

	private ?string $version = null;

	private bool $inFooter = false;

	public function __construct(
		private readonly string $handle,
		private readonly string $src
	) {
	}

	/** @param string ...$handles Handles this script depends on. */
	public function deps( string ...$handles ): self {
		$this->deps = array_values( $handles );

		return $this;
	}

	public function version( string $version ): self {
		$this->version = $version;

		return $this;
	}

	/** Print the script in the footer rather than the head. */
	public function footer(): self {
		$this->inFooter = true;

		return $this;
	}

	public function enqueue(): void {
		wp_enqueue_script( $this->handle, $this->src, $this->deps, $this->version, $this->inFooter );
	}
}
