<?php
/**
 * An Image bound to an item's picture renders it, though the card was saved without an address.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use WP_HTML_Tag_Processor;
use WP_UnitTestCase;

/**
 * A starter card (a Loop source's `cards`) has no picture of its own: the Image's `url` is bound
 * to the item, so it saves `<img>` with no `src`, and `Bindings::write()` fills it per item.
 */
final class LoopBoundImageTest extends WP_UnitTestCase {

	public function test_a_bound_image_saved_without_an_address_gets_the_items_picture(): void {
		$data = wp_json_encode(
			[
				[
					'pic' => 'https://img.example/one.jpg',
					'name' => 'One',
				],
				[
					'pic' => 'https://img.example/two.jpg',
					'name' => 'Two',
				],
			]
		);
		$bindings = '"metadata":{"bindings":{"url":{"source":"blicks/item","args":{"key":"pic"}},"alt":{"source":"blicks/item","args":{"key":"name"}}}}';

		$html = do_blocks(
			'<!-- wp:blicks/loop ' . wp_json_encode(
				[
					'source' => 'json',
					'data' => $data,
				]
			) . ' -->'
			. '<!-- wp:blicks/image {"aspectRatio":"4/3",' . $bindings . '} -->'
			. '<figure class="bl-image has-aspect-ratio"><img alt="" style="aspect-ratio:4/3"/></figure>'
			. '<!-- /wp:blicks/image -->'
			. '<!-- /wp:blicks/loop -->'
		);

		$tags = new WP_HTML_Tag_Processor( $html );
		$found = [];
		while ( $tags->next_tag( 'img' ) ) {
			$found[] = [ $tags->get_attribute( 'src' ), $tags->get_attribute( 'alt' ) ];
		}

		$this->assertSame(
			[
				[ 'https://img.example/one.jpg', 'One' ],
				[ 'https://img.example/two.jpg', 'Two' ],
			],
			$found
		);
	}
}
