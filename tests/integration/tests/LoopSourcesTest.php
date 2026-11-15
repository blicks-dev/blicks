<?php
/**
 * Loop sources other plugins add through `blicks_loop_sources`.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Data\Loop;
use Blicks\Data\LoopAttributes;
use Blicks\Data\LoopSources;
use WP_UnitTestCase;

final class LoopSourcesTest extends WP_UnitTestCase {

	/** @var list<array<string, mixed>> */
	private const TRIPS = [
		[ 'title' => 'Bhutan', 'price' => 2390 ],
		[ 'title' => 'Annapurna', 'price' => 1180 ],
		[ 'title' => 'Everest', 'price' => 1290 ],
		[ 'title' => 'Chitwan', 'price' => 360 ],
	];

	/** @var array<string, mixed> */
	private static array $seen = [];

	public function set_up(): void {
		parent::set_up();
		self::$seen = [];

		add_filter(
			'blicks_loop_sources',
			static fn ( array $sources ): array => $sources + [
				'acme/trips' => [
					'label' => 'Trips',
					'items' => static function ( array $args, array $context ): array {
						self::$seen = compact( 'args', 'context' );
						$trips = self::TRIPS;
						if ( ! empty( $args['cheapFirst'] ) ) {
							usort( $trips, static fn ( $a, $b ) => $a['price'] <=> $b['price'] );
						}
						return array_merge( $trips, [ 'junk', 42 ] );
					},
					'sanitize' => static fn ( mixed $args ): array => [ 'cheapFirst' => ! empty( $args['cheapFirst'] ) ],
					'sort' => false,
				],
				'acme/broken' => [
					'items' => static function (): array {
						throw new \RuntimeException( 'down' );
					},
				],
				'acme/many' => [
					'label' => 'Many',
					'items' => static function ( array $args, array $context ): array {
						self::$seen = compact( 'args', 'context' );
						$all = array_map( static fn ( int $n ): array => [ 'n' => $n ], range( 1, 120 ) );
						if ( ! isset( $context['limit'] ) ) {
							return $all;
						}
						if ( ! empty( $args['flat'] ) ) {
							return array_slice( $all, 0, 5 );
						}
						return [
							'items' => array_slice( $all, $context['offset'], $context['limit'] ),
							'total' => count( $all ),
						];
					},
					'sanitize' => static fn ( mixed $args ): array => [ 'flat' => ! empty( $args['flat'] ) ],
					'sort' => false,
					'paged' => true,
				],
				'NotAnId' => [ 'items' => static fn (): array => self::TRIPS ],
				'acme/no-callback' => [ 'label' => 'Nothing' ],
			]
		);
		LoopSources::reset();
	}

	public function tear_down(): void {
		LoopSources::reset();
		parent::tear_down();
	}

	public function test_only_well_formed_sources_register(): void {
		$this->assertSame(
			[
				[
					'id' => 'acme/trips',
					'label' => 'Trips',
				],
				[
					'id' => 'acme/broken',
					'label' => 'acme/broken',
				],
				[
					'id' => 'acme/many',
					'label' => 'Many',
				],
			],
			LoopSources::describe()
		);
	}

	public function test_a_source_feeds_the_loop_in_its_own_order(): void {
		$result = Loop::items(
			[
				'source' => 'acme/trips',
				'sourceArgs' => [
					'cheapFirst' => '1',
					'extra' => 'dropped',
				],
				'limit' => 3,
				'sort' => [
					'field' => 'title',
					'dir' => 'asc',
				],
			],
			17
		);

		$this->assertSame( [ 'Chitwan', 'Annapurna', 'Everest' ], array_column( $result['items'], 'title' ) );
		$this->assertSame( [ 'cheapFirst' => true ], self::$seen['args'] );
		$this->assertSame( 17, self::$seen['context']['current'] );
		$this->assertNull( self::$seen['context']['parent'], 'not in a card' );
		$this->assertSame( [ 'title', 'price' ], array_column( $result['fields'], 'key' ) );
		$this->assertSame(
			[
				'id' => 'acme/trips',
				'active' => true,
			],
			$result['source']
		);
	}

	public function test_the_loops_rules_and_pages_still_apply(): void {
		$result = Loop::items(
			[
				'source' => 'acme/trips',
				'filter' => [
					'field' => 'price',
					'op' => 'gt',
					'value' => '1000',
				],
				'limit' => 1,
				'pagination' => [ 'mode' => 'pages' ],
			],
			0,
			false,
			2
		);

		$this->assertSame( [ 'Annapurna' ], array_column( $result['items'], 'title' ) );
		$this->assertSame( 3, $result['pages'] );
	}

	public function test_an_inactive_source_keeps_its_id_and_renders_empty(): void {
		$attrs = LoopAttributes::sanitize(
			[
				'source' => 'gone/plugin',
				'sourceArgs' => [ 'x' => 1 ],
			]
		);
		$this->assertSame( 'gone/plugin', $attrs['source'] );
		$this->assertSame( [], $attrs['sourceArgs'] );

		$result = Loop::items( [ 'source' => 'gone/plugin' ] );
		$this->assertSame( [], $result['items'] );
		$this->assertFalse( $result['source']['active'] );
	}

	public function test_a_source_that_throws_reads_as_empty(): void {
		$this->assertSame( [], Loop::items( [ 'source' => 'acme/broken' ] )['items'] );
	}

	public function test_a_malformed_source_falls_back_to_pasted_data(): void {
		$this->assertSame( 'json', LoopAttributes::sanitize( [ 'source' => 'NotAnId' ] )['source'] );
		$this->assertSame( 'json', LoopAttributes::sanitize( [ 'source' => '../etc' ] )['source'] );
	}

	public function test_the_card_renders_the_sources_fields(): void {
		$html = do_blocks(
			'<!-- wp:blicks/loop {"source":"acme/trips","sourceArgs":{"cheapFirst":true},"limit":2} -->'
			. '<!-- wp:blicks/heading {"content":"Trip","metadata":{"bindings":{"content":{"source":"blicks/item","args":{"key":"title"}}}}} --><h3 class="bl-heading">Trip</h3><!-- /wp:blicks/heading -->'
			. '<!-- /wp:blicks/loop -->'
		);

		$this->assertStringContainsString( 'Chitwan', $html );
		$this->assertStringContainsString( 'Annapurna', $html );
		$this->assertStringNotContainsString( 'Bhutan', $html );
	}

	public function test_a_source_in_a_card_is_told_the_cards_item(): void {
		$seen = [];
		$record = static function ( array $sources ) use ( &$seen ): array {
			$sources['acme/departures'] = [
				'items' => static function ( array $args, array $context ) use ( &$seen ): array {
					$seen[] = $context['parent']['title'] ?? null;
					return [ [ 'date' => 'for ' . ( $context['parent']['title'] ?? 'none' ) ] ];
				},
			];
			return $sources;
		};
		add_filter( 'blicks_loop_sources', $record, 20 );
		LoopSources::reset();

		$html = do_blocks(
			'<!-- wp:blicks/loop ' . wp_json_encode(
				[
					'source' => 'json',
					'data' => wp_json_encode( [ [ 'title' => 'Everest' ], [ 'title' => 'Bhutan' ] ] ),
				]
			) . ' -->'
			. '<!-- wp:blicks/loop {"source":"acme/departures"} -->'
			. '<!-- wp:blicks/text {"content":"x","metadata":{"bindings":{"content":{"source":"blicks/item","args":{"key":"date"}}}}} --><p class="bl-text">x</p><!-- /wp:blicks/text -->'
			. '<!-- /wp:blicks/loop -->'
			. '<!-- /wp:blicks/loop -->'
		);
		remove_filter( 'blicks_loop_sources', $record, 20 );

		// WordPress renders a block's inner blocks before its own callback, so the inner Loop also
		// runs once outside any card (no parent) before each card renders it with its own.
		$this->assertSame( [ 'Everest', 'Bhutan' ], array_values( array_filter( $seen ) ), 'each card\'s own item' );
		$this->assertStringContainsString( '>for Everest<', $html );
		$this->assertStringContainsString( '>for Bhutan<', $html );
	}

	public function test_every_item_names_itself_for_scripts(): void {
		$html = do_blocks(
			'<!-- wp:blicks/loop ' . wp_json_encode(
				[
					'source' => 'json',
					'data' => wp_json_encode( [ [ 'slug' => 'everest-base-camp', 'id' => 101 ], [ 'id' => '2027-03-10' ], [ 'title' => 'No key' ] ] ),
				]
			) . ' -->'
			. '<!-- wp:blicks/text {"content":"x"} --><p class="bl-text">x</p><!-- /wp:blicks/text -->'
			. '<!-- /wp:blicks/loop -->'
		);

		preg_match_all( '/<li[^>]* data-bl-key="([^"]*)"/', $html, $keys );
		$this->assertSame( [ 'everest-base-camp', '2027-03-10', '3' ], $keys[1], 'slug, else id, else place' );
	}

	public function test_a_source_that_pages_itself_is_asked_for_one_page(): void {
		$result = Loop::items(
			[
				'source' => 'acme/many',
				'limit' => 12,
				'offset' => 2,
				'pagination' => [ 'mode' => 'pages' ],
				'sort' => [
					'field' => 'n',
					'dir' => 'desc',
				],
			],
			0,
			false,
			3
		);

		$this->assertSame( 26, self::$seen['context']['offset'], 'the Loop\'s offset plus two pages' );
		$this->assertSame( 12, self::$seen['context']['limit'] );
		$this->assertSame( range( 27, 38 ), array_column( $result['items'], 'n' ), 'in the source\'s order: Order by never reorders a page' );
		$this->assertSame( 118, $result['found'], 'every item after the offset, past the 50 a flat list holds' );
		$this->assertSame( 10, $result['pages'] );
		$this->assertSame( 120, $result['total'] );
	}

	public function test_load_more_asks_for_every_page_so_far(): void {
		$result = Loop::items(
			[
				'source' => 'acme/many',
				'limit' => 20,
				'pagination' => [ 'mode' => 'more' ],
			],
			0,
			false,
			3
		);

		$this->assertSame( 0, self::$seen['context']['offset'] );
		$this->assertSame( 60, self::$seen['context']['limit'] );
		$this->assertCount( 60, $result['items'] );
		$this->assertSame( 6, $result['pages'] );
	}

	public function test_an_unpaged_loop_asks_for_its_limit(): void {
		$result = Loop::items(
			[
				'source' => 'acme/many',
				'limit' => 0,
			]
		);

		$this->assertSame( 50, self::$seen['context']['limit'], 'no limit: the most a Loop shows' );
		$this->assertCount( 50, $result['items'] );
	}

	public function test_an_only_show_rule_reads_a_flat_list(): void {
		$result = Loop::items(
			[
				'source' => 'acme/many',
				'filter' => [
					'field' => 'n',
					'op' => 'gt',
					'value' => '45',
				],
				'limit' => 10,
				'pagination' => [ 'mode' => 'pages' ],
			]
		);

		$this->assertArrayNotHasKey( 'limit', self::$seen['context'], 'a rule changes the count, so the source does not page' );
		$this->assertSame( range( 46, 50 ), array_column( $result['items'], 'n' ), 'the first 50, then the rule' );
	}

	public function test_a_flat_list_answer_to_a_paged_call_is_read_as_a_list(): void {
		$result = Loop::items(
			[
				'source' => 'acme/many',
				'sourceArgs' => [ 'flat' => true ],
				'limit' => 2,
				'pagination' => [ 'mode' => 'pages' ],
			],
			0,
			false,
			2
		);

		$this->assertSame( [ 3, 4 ], array_column( $result['items'], 'n' ) );
		$this->assertSame( 3, $result['pages'] );
	}
}
