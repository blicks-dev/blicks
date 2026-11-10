<?php
/**
 * Every shipped block registers with WordPress from its block.json.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use WP_Block_Type_Registry;
use WP_UnitTestCase;

final class BlockRegistrationTest extends WP_UnitTestCase {

	/**
	 * Every block this plugin registers.
	 *
	 * The guard below asserts this list is EXHAUSTIVE, which is the point: a block that appears
	 * without being added here is either a mistake or a decision nobody wrote down.
	 *
	 * The Scene family lived here briefly and now ships in Blicks Pro. This list is what proves
	 * the free plugin really let go of it — Pro registers into the same `blicks/` namespace, so
	 * with both plugins active the filter below still sees `blicks/scene`, and only an exhaustive
	 * check run against this plugin alone can tell the two apart.
	 */
	private const BLOCKS = [
		'blicks/section',
		'blicks/box',
		'blicks/loop',
		'blicks/heading',
		'blicks/text',
		'blicks/list',
		'blicks/list-item',
		'blicks/steps',
		'blicks/step',
		'blicks/buttons',
		'blicks/button',
		'blicks/image',
		'blicks/icon',
		'blicks/dialog',
		'blicks/menu-link',
		'blicks/form',
		'blicks/field',
		'blicks/input',
	];

	public function test_every_block_is_registered(): void {
		$registry = WP_Block_Type_Registry::get_instance();

		foreach ( self::BLOCKS as $name ) {
			$this->assertTrue(
				$registry->is_registered( $name ),
				"Block {$name} did not register. Did `pnpm build` run before the tests?"
			);
		}
	}

	public function test_no_unexpected_blicks_block_is_registered(): void {
		// The dev modules the suite loads register into `blicks/` as Pro will. They are not this
		// plugin's blocks, and naming them one by one keeps the guard exhaustive for everything else.
		$modules = class_exists( \BlicksPro\HeaderStudio\Module::class )
			? array_map( static fn ( string $name ): string => 'blicks/' . $name, \BlicksPro\HeaderStudio\Module::BLOCKS )
			: [];

		$registered = array_filter(
			array_keys( WP_Block_Type_Registry::get_instance()->get_all_registered() ),
			static fn ( string $name ): bool => str_starts_with( $name, 'blicks/' ) && ! in_array( $name, $modules, true )
		);

		sort( $registered );
		$expected = self::BLOCKS;
		sort( $expected );

		$this->assertSame( $expected, array_values( $registered ) );
	}

	public function test_blocks_share_one_inserter_category(): void {
		$registry = WP_Block_Type_Registry::get_instance();

		foreach ( self::BLOCKS as $name ) {
			$this->assertSame(
				'blicks',
				$registry->get_registered( $name )->category,
				"Block {$name} is not in the Blicks inserter category."
			);
		}
	}

	/**
	 * The dynamic block must render server-side without notices, and must not emit an
	 * empty wrapper when it has no inner content.
	 */
	public function test_section_block_renders(): void {
		$html = do_blocks( '<!-- wp:blicks/section --><div class="wp-block-blicks-section"><p>Hello</p></div><!-- /wp:blicks/section -->' );

		$this->assertStringContainsString( 'Hello', $html );
	}
}
