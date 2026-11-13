<?php
/**
 * A Loop inside another Loop's card repeats over that card's item's list.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use WP_UnitTestCase;

/**
 * The outer card's bindings stop at the inner Loop: both levels bind `title` here, and each must
 * show its own. The inner Loop gets the card's item through block context.
 */
final class LoopNestedTest extends WP_UnitTestCase {

	private const TRIPS = [
		[
			'title' => 'Everest',
			'days' => [
				[ 'title' => 'Fly to Lukla' ],
				[ 'title' => 'Trek to Namche' ],
			],
			'includes' => [ 'Guide', 'Permits' ],
		],
		[
			'title' => 'Bhutan',
			'days' => [ [ 'title' => 'Arrive in Paro' ] ],
			'includes' => [ 'Visa' ],
		],
	];

	private static function bound( string $block, string $key, string $tag = 'p', string $class = 'bl-text' ): string {
		$attrs = '{"content":"x","metadata":{"bindings":{"content":{"source":"blicks/item","args":{"key":"' . $key . '"}}}}}';

		return "<!-- wp:blicks/{$block} {$attrs} --><{$tag} class=\"{$class}\">x</{$tag}><!-- /wp:blicks/{$block} -->";
	}

	/** An outer Loop over `$items`, its card a Heading bound to `title` and `$inner`. */
	private static function outer( array $items, string $inner ): string {
		return '<!-- wp:blicks/loop ' . wp_json_encode(
			[
				'source' => 'json',
				'data' => wp_json_encode( $items ),
			]
		) . ' -->'
			. self::bound( 'heading', 'title', 'h3', 'bl-heading' )
			. $inner
			. '<!-- /wp:blicks/loop -->';
	}

	/** A Loop over the card item's list at `$path`, its card one block bound to `$key`. */
	private static function inner( string $path, string $key, string $uniqueId = '' ): string {
		$attrs = [
			'source' => 'item',
			'path' => $path,
		];
		if ( '' !== $uniqueId ) {
			$attrs['uniqueId'] = $uniqueId;
		}

		return '<!-- wp:blicks/loop ' . wp_json_encode( $attrs ) . ' -->' . self::bound( 'text', $key ) . '<!-- /wp:blicks/loop -->';
	}

	/** Each outer card: its heading and the texts of its inner Loops, in order. */
	private static function cards( string $html ): array {
		$doc = new \DOMDocument();
		libxml_use_internal_errors( true );
		$doc->loadHTML( '<?xml encoding="utf-8"?><body>' . $html . '</body>' );
		libxml_clear_errors();
		$xpath = new \DOMXPath( $doc );

		$out = [];
		$outer = $xpath->query( '/html/body/div/ul/li' );
		foreach ( $outer as $li ) {
			$out[] = [
				'heading' => trim( (string) $xpath->query( './/h3', $li )->item( 0 )?->textContent ),
				'texts' => array_map( static fn ( \DOMNode $n ): string => trim( $n->textContent ), iterator_to_array( $xpath->query( './/ul/li//p', $li ) ) ),
			];
		}

		return $out;
	}

	public function test_each_card_shows_its_own_items_list(): void {
		$html = do_blocks( self::outer( self::TRIPS, self::inner( 'days', 'title' ) ) );

		$this->assertSame(
			[
				[
					'heading' => 'Everest',
					'texts' => [ 'Fly to Lukla', 'Trek to Namche' ],
				],
				[
					'heading' => 'Bhutan',
					'texts' => [ 'Arrive in Paro' ],
				],
			],
			self::cards( $html )
		);
	}

	public function test_a_list_of_plain_values_binds_value(): void {
		$html = do_blocks( self::outer( self::TRIPS, self::inner( 'includes', 'value' ) ) );

		$this->assertSame( [ 'Guide', 'Permits' ], self::cards( $html )[0]['texts'] );
		$this->assertSame( [ 'Visa' ], self::cards( $html )[1]['texts'] );
	}

	public function test_a_card_with_no_list_shows_the_inner_loops_empty_state(): void {
		$items = [
			[ 'title' => 'Mustang' ],
			self::TRIPS[0],
		];
		$cards = self::cards( do_blocks( self::outer( $items, self::inner( 'days', 'title' ) ) ) );

		$this->assertSame( [], $cards[0]['texts'] );
		$this->assertSame( [ 'Fly to Lukla', 'Trek to Namche' ], $cards[1]['texts'] );
	}

	public function test_on_its_own_the_source_has_nothing_to_show(): void {
		$this->assertStringNotContainsString( 'bl-loop__items', do_blocks( self::inner( 'days', 'title' ) ) );
	}

	public function test_the_editor_gets_a_cards_list_by_sending_its_item(): void {
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$ask = static function ( array $body ): array {
			$request = new \WP_REST_Request( 'POST', '/blicks/v1/loop/items' );
			$request->set_body_params( $body );
			$response = rest_do_request( $request );

			return [ $response->get_status(), $response->get_data() ];
		};

		[ $status, $data ] = $ask(
			[
				'attributes' => [
					'source' => 'item',
					'path' => 'days',
				],
				'parent' => self::TRIPS[0],
			]
		);
		$this->assertSame( 200, $status );
		$this->assertSame( [ 'Fly to Lukla', 'Trek to Namche' ], array_column( $data['items'], 'title' ) );
		$this->assertSame( [ 'days', 'includes' ], array_column( $data['lists'], 'path' ) );

		[ $status, $data ] = $ask( [ 'attributes' => [ 'source' => 'item' ] ] );
		$this->assertSame( 200, $status );
		$this->assertSame( [], $data['items'], 'no card item: nothing to repeat over' );

		[ $status ] = $ask(
			[
				'attributes' => [ 'source' => 'item' ],
				'parent' => [ 'big' => str_repeat( 'x', 262145 ) ],
			]
		);
		$this->assertSame( 400, $status, 'a parent over the pasted-JSON cap is refused' );
	}

	public function test_loops_stop_three_deep(): void {
		$level = [
			'name' => 'L4',
			'kids' => [],
		];
		foreach ( [ 'L3', 'L2', 'L1' ] as $name ) {
			$level = [
				'name' => $name,
				'kids' => [ $level ],
			];
		}

		$loop = static fn ( string $inner ): string => '<!-- wp:blicks/loop {"source":"item","path":"kids"} -->' . self::bound( 'text', 'name' ) . $inner . '<!-- /wp:blicks/loop -->';
		$markup = '<!-- wp:blicks/loop ' . wp_json_encode(
			[
				'source' => 'json',
				'data' => wp_json_encode( [ $level ] ),
			]
		) . ' -->' . self::bound( 'text', 'name' ) . $loop( $loop( $loop( '' ) ) ) . '<!-- /wp:blicks/loop -->';

		$html = do_blocks( $markup );

		$this->assertStringContainsString( '>L1<', $html );
		$this->assertStringContainsString( '>L2<', $html );
		$this->assertStringContainsString( '>L3<', $html );
		$this->assertStringNotContainsString( '>L4<', $html, 'a fourth Loop is past the cap' );
	}
}
