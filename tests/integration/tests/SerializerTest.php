<?php
/**
 * The server writes the same block markup the editor does.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Ai\Spec\BlockSpec;
use Blicks\Ai\Spec\SpecParser;
use Blicks\Ai\Spec\SpecSerializer;
use Blicks\Ai\Spec\UnsupportedBlock;
use WP_UnitTestCase;

/**
 * `SpecSerializer` is a second implementation of every block's `save()`. Two sources of truth for
 * one output are only defensible while a test holds them to the same bytes: anything short of an
 * exact match is a post the editor opens as "This block contains unexpected or invalid content".
 *
 * Two references, both written by the real JavaScript: the goldens (one default instance per
 * block, parsed and written back) and `tests/fixtures/serializer-cases.json` (the variants an
 * agent actually sends, from `resources/blocks/serializer-cases.test.tsx`).
 */
final class SerializerTest extends WP_UnitTestCase {

	/** @return array<string, array{string}> */
	public static function goldens(): array {
		$cases = [];

		foreach ( glob( dirname( __DIR__, 3 ) . '/resources/blocks/__golden__/*.html' ) as $file ) {
			$cases[ basename( $file, '.html' ) ] = [ $file ];
		}

		return $cases;
	}

	/** @dataProvider goldens */
	public function test_a_golden_round_trips_byte_for_byte( string $file ): void {
		$golden = rtrim( (string) file_get_contents( $file ), "\n" );
		$specs = SpecParser::fromMarkup( $golden );

		// A block whose saved markup embeds what only the editor generates (icon paths, an SVG
		// filter) has no server shape on purpose. Its promise is a refusal by name, never markup
		// that is almost right.
		if ( [] !== SpecSerializer::unsupported( $specs ) ) {
			$this->expectException( UnsupportedBlock::class );
		}

		$this->assertSame( $golden, SpecSerializer::toMarkup( $specs ) );
	}

	/** @return array<string, array{array<string, mixed>, string}> */
	public static function recorded(): array {
		$cases = [];
		$json = json_decode( (string) file_get_contents( dirname( __DIR__, 3 ) . '/tests/fixtures/serializer-cases.json' ), true );

		foreach ( $json as $case ) {
			$cases[ $case['title'] ] = [ $case['block'], $case['markup'] ];
		}

		return $cases;
	}

	/**
	 * @dataProvider recorded
	 * @param array<string, mixed> $block
	 */
	public function test_a_spec_is_written_as_the_editor_writes_it( array $block, string $markup ): void {
		$this->assertSame( [], SpecSerializer::unsupported( [ BlockSpec::fromArray( $block ) ] ) );
		$this->assertSame( $markup, SpecSerializer::toMarkup( [ BlockSpec::fromArray( $block ) ] ) );
	}

	public function test_a_duotone_image_is_refused_by_name(): void {
		$spec = BlockSpec::fromArray(
			[
				'name' => 'blicks/image',
				'attributes' => [
					'url' => 'https://example.test/a.jpg',
					'duotone' => [
						'shadows' => '#000000',
						'highlights' => '#ffffff',
					],
				],
			]
		);

		$this->assertSame( [ 'blicks/image (with a duotone filter)' ], SpecSerializer::unsupported( [ $spec ] ) );
	}

	public function test_a_block_from_another_plugin_is_written_back_verbatim(): void {
		$markup = "<!-- wp:paragraph -->\n<p>Kept <em>as is</em>.</p>\n<!-- /wp:paragraph -->";
		$specs = SpecParser::fromMarkup( $markup );

		$this->assertTrue( $specs[0]->isOpaque() );
		$this->assertSame( $markup, SpecSerializer::toMarkup( $specs ) );
	}
}
