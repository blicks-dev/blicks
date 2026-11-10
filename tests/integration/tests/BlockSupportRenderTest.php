<?php
/**
 * A block this plugin does not ship gets the engine when it declares `supports.blicks`.
 *
 * This is the contract a companion plugin — Blicks Pro, or anyone else — depends on, and it is the
 * half that cannot be checked in the editor. The JavaScript side has always worked by manifest, so
 * a foreign block got the inspector and looked completely fine while authoring. The PHP side asked
 * whether the block was called `blicks/…`, so on the front end its scoped CSS silently vanished:
 * pseudo-elements, container queries, `@property` and keyframes all gone, with no error anywhere.
 *
 * Registering a real foreign block and reading what `render_block` emits is the only way to catch a
 * regression to a name check.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Core\BlockSupport;
use Blicks\Providers\StyleServiceProvider;
use Blicks\Style\ScopedCss;
use WP_UnitTestCase;

final class BlockSupportRenderTest extends WP_UnitTestCase {

	private const FOREIGN = 'acme/hero';

	public function set_up(): void {
		parent::set_up();
		BlockSupport::flush();
		ScopedCss::reset();
	}

	public function tear_down(): void {
		if ( \WP_Block_Type_Registry::get_instance()->is_registered( self::FOREIGN ) ) {
			unregister_block_type( self::FOREIGN );
		}
		BlockSupport::flush();
		parent::tear_down();
	}

	/**
	 * Run OUR collector, not the whole `render_block` chain.
	 *
	 * Going through `apply_filters` fires every other callback core has hooked there — the first
	 * version of this test did, and died inside `WP_Duotone::render_duotone_support()`, which
	 * declares three arguments while the test passed two. That failure says nothing about the gate
	 * under test. `BlockRegistrationTest` already proves the filter is registered.
	 *
	 * @param array<string, mixed> $block
	 */
	private function collect( string $content, array $block ): string {
		return ( new StyleServiceProvider() )->collectScopedCss( $content, $block );
	}

	/**
	 * A `blicks` tree that really produces a tier-3 scoped rule.
	 *
	 * `columns.breakInside` is the cheapest real one: it emits `.bl-{id} > *{break-inside:…}` and
	 * nothing else — no class, no custom property — so an empty `ScopedCss` means the collector
	 * did not run, with no other explanation. Picked after a first attempt used a control that
	 * emits only a class, where the shipped-block case failed too and said nothing about the gate.
	 *
	 * @return array<string, mixed>
	 */
	private function scopedAttributes(): array {
		return [
			'uniqueId' => 'acme1234',
			'blicks'   => [
				'columns.breakInside' => [ 'default' => [ 'base' => 'avoid' ] ],
			],
		];
	}

	public function test_a_foreign_block_declaring_support_emits_scoped_css(): void {
		register_block_type(
			self::FOREIGN,
			[ 'supports' => [ 'blicks' => [ 'controls' => [ 'columns.*' ] ] ] ]
		);

		$this->collect(
			'<div class="wp-block-acme-hero bl-acme1234"></div>',
			[ 'blockName' => self::FOREIGN, 'attrs' => $this->scopedAttributes() ]
		);

		self::assertStringContainsString(
			'bl-acme1234',
			ScopedCss::css(),
			'a foreign block that declares supports.blicks must get its scoped CSS'
		);
	}

	public function test_a_foreign_block_without_support_emits_nothing(): void {
		register_block_type( self::FOREIGN, [ 'supports' => [ 'html' => false ] ] );

		$this->collect(
			'<div class="wp-block-acme-hero bl-acme1234"></div>',
			[ 'blockName' => self::FOREIGN, 'attrs' => $this->scopedAttributes() ]
		);

		self::assertStringNotContainsString(
			'bl-acme1234',
			ScopedCss::css(),
			'a block that never opted in must not be styled by this plugin'
		);
	}

	public function test_a_shipped_block_still_emits_scoped_css(): void {
		$this->collect(
			'<div class="wp-block-blicks-box bl-acme1234"></div>',
			[ 'blockName' => 'blicks/box', 'attrs' => $this->scopedAttributes() ]
		);

		self::assertStringContainsString(
			'bl-acme1234',
			ScopedCss::css(),
			'the fast path for this plugin\'s own blocks must survive the change'
		);
	}

	public function test_a_foreign_blocks_base_stylesheet_enqueues(): void {
		register_block_type(
			self::FOREIGN,
			[
				'supports' => [ 'blicks' => [] ],
				'style'    => 'acme-hero-style',
			]
		);

		wp_register_style( 'acme-hero-style', 'https://example.test/hero.css', [], '1' );

		do_action( 'enqueue_block_assets' );

		self::assertTrue(
			wp_style_is( 'acme-hero-style', 'enqueued' ),
			'a static foreign block never server-renders, so its base CSS only loads from this hook'
		);
	}
}
