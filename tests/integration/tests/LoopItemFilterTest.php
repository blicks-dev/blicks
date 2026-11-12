<?php
/**
 * The `blicks_loop_item` filter: a companion adds fields to a post's Loop item.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Data\ItemPipeline;
use Blicks\Data\PostFields;
use WP_Post;
use WP_UnitTestCase;

final class LoopItemFilterTest extends WP_UnitTestCase {

	public function tear_down(): void {
		remove_all_filters( 'blicks_loop_item' );
		parent::tear_down();
	}

	public function test_added_fields_reach_the_item_and_the_field_list(): void {
		$post = self::factory()->post->create_and_get( [ 'post_title' => 'Annapurna Circuit' ] );

		add_filter(
			'blicks_loop_item',
			static fn ( array $fields, WP_Post $p ): array => $fields + [
				'duration' => 14,
				'destination' => 'Nepal',
				'on_sale' => true,
				'gallery' => [ 'https://example.com/a.jpg' ],
			],
			10,
			2
		);

		$item = PostFields::item( $post );

		$this->assertSame( 14, $item['duration'] );
		$this->assertSame( 'Nepal', $item['destination'] );
		$this->assertTrue( $item['on_sale'] );
		$this->assertSame( [ 'https://example.com/a.jpg' ], $item['gallery'] );

		$types = array_column( ItemPipeline::fields( [ $item ] ), 'type', 'key' );
		$this->assertSame( 'number', $types['duration'] );
		$this->assertSame( 'yes/no', $types['on_sale'] );
		$this->assertSame( 'list', $types['gallery'] );
	}

	public function test_built_in_fields_cannot_be_replaced(): void {
		$post = self::factory()->post->create_and_get( [ 'post_title' => 'Real title' ] );

		add_filter( 'blicks_loop_item', static fn (): array => [ 'title' => 'Hijacked', 'url' => 'javascript:alert(1)' ] );

		$item = PostFields::item( $post );

		$this->assertSame( 'Real title', $item['title'] );
		$this->assertSame( get_permalink( $post ), $item['url'] );
	}

	public function test_bad_keys_values_and_returns_are_dropped(): void {
		$post = self::factory()->post->create_and_get();

		add_filter( 'blicks_loop_item', static fn (): array => [ 0 => 'numeric key', '' => 'empty key', 'object' => new \stdClass(), 'ok' => 'kept' ] );
		$item = PostFields::item( $post );
		$this->assertSame( 'kept', $item['ok'] );
		$this->assertArrayNotHasKey( 'object', $item );
		$this->assertArrayNotHasKey( 0, $item );
		$this->assertArrayNotHasKey( '', $item );

		remove_all_filters( 'blicks_loop_item' );
		add_filter( 'blicks_loop_item', static fn () => 'not an array' );
		$this->assertSame( get_the_title( $post ), PostFields::item( $post )['title'] );
	}

	public function test_the_filter_sees_the_post_and_the_item_so_far(): void {
		$post = self::factory()->post->create_and_get( [ 'post_type' => 'page', 'post_title' => 'About' ] );
		$seen = [];

		add_filter(
			'blicks_loop_item',
			static function ( array $fields, WP_Post $p, array $item ) use ( &$seen ): array {
				$seen = [ $p->ID, $p->post_type, $item['title'] ];
				return $fields;
			},
			10,
			3
		);

		PostFields::item( $post );

		$this->assertSame( [ $post->ID, 'page', 'About' ], $seen );
	}
}
