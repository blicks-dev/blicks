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

	/** The 12 primitives the plugin ships. */
	private const BLOCKS = [
		'blicks/section',
		'blicks/box',
		'blicks/stack',
		'blicks/grid',
		'blicks/heading',
		'blicks/text',
		'blicks/buttons',
		'blicks/button',
		'blicks/image',
		'blicks/icon',
		'blicks/spacer',
		'blicks/divider',
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
		$registered = array_filter(
			array_keys( WP_Block_Type_Registry::get_instance()->get_all_registered() ),
			static fn ( string $name ): bool => str_starts_with( $name, 'blicks/' )
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
