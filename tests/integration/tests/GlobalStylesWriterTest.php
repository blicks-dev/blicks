<?php
/**
 * GlobalStylesWriter against a real WP_Theme_JSON_Resolver.
 *
 * This is the class with the most to lose: it writes into the user's own Global Styles post,
 * which holds design work the plugin did not create. The unit suite exercises it against a
 * stub, so this is the only place its real behaviour is checked.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\DesignSystem\GlobalStylesWriter;
use WP_Theme_JSON_Resolver;
use WP_UnitTestCase;

final class GlobalStylesWriterTest extends WP_UnitTestCase {

	/** A block theme, so there is a real theme.json to merge into. */
	private const BLOCK_THEME = 'twentytwentyfive';

	public function set_up(): void {
		parent::set_up();

		if ( ! wp_get_theme( self::BLOCK_THEME )->exists() ) {
			$this->markTestSkipped( 'No block theme is installed to test Global Styles against.' );
		}

		// Writing Global Styles is a capability-gated operation; as an anonymous user the write
		// is silently discarded.
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );

		// The test suite's default theme is a classic stub with no theme.json, which would make
		// GlobalStylesWriter::isAvailable() false.
		switch_theme( self::BLOCK_THEME );
		WP_Theme_JSON_Resolver::clean_cached_data();

		$this->assertTrue(
			GlobalStylesWriter::isAvailable(),
			'Switched to a block theme but Global Styles are still reported unavailable.'
		);
	}

	/**
	 * Read back what WordPress itself would serve.
	 *
	 * Deliberately not a raw post row: WordPress normalises what is written, and the post id
	 * the resolver hands out is not stable across a write. get_user_data() is the same view
	 * the editor and the front end use.
	 */
	private function userSettings(): array {
		WP_Theme_JSON_Resolver::clean_cached_data();

		$raw = WP_Theme_JSON_Resolver::get_user_data()->get_raw_data();

		return $raw['settings'] ?? [];
	}

	/** User-origin presets live under the `custom` key, not as a bare list. */
	private function palette(): array {
		return $this->userSettings()['color']['palette']['custom'] ?? [];
	}

	public function test_a_color_token_lands_in_the_user_palette(): void {
		$this->assertTrue(
			GlobalStylesWriter::persistAll( [ 'color' => [ 'brand' => '#ff0000' ] ], [], [] )
		);

		$palette = $this->palette();

		$this->assertContains( 'brand', array_column( $palette, 'slug' ) );

		foreach ( $palette as $entry ) {
			if ( 'brand' === ( $entry['slug'] ?? null ) ) {
				$this->assertSame( '#ff0000', $entry['color'] );
			}
		}
	}

	/**
	 * The plugin must merge, never replace. A token written earlier has to survive a later
	 * write — dropping it would silently destroy a user's design work.
	 */
	public function test_writing_preserves_tokens_from_earlier_writes(): void {
		GlobalStylesWriter::persistAll( [ 'color' => [ 'mine' => '#123456' ] ], [], [] );
		GlobalStylesWriter::persistAll( [ 'color' => [ 'other' => '#abcdef' ] ], [], [] );

		$slugs = array_column( $this->palette(), 'slug' );

		$this->assertContains( 'mine', $slugs, 'An earlier token was dropped by a later write.' );
		$this->assertContains( 'other', $slugs );
	}

	public function test_rewriting_a_token_updates_it_in_place(): void {
		GlobalStylesWriter::persistAll( [ 'color' => [ 'brand' => '#111111' ] ], [], [] );
		GlobalStylesWriter::persistAll( [ 'color' => [ 'brand' => '#222222' ] ], [], [] );

		$brand = array_values(
			array_filter( $this->palette(), static fn ( $e ) => 'brand' === ( $e['slug'] ?? null ) )
		);

		$this->assertCount( 1, $brand, 'Rewriting a token duplicated its palette entry.' );
		$this->assertSame( '#222222', $brand[0]['color'] );
	}

	public function test_a_breakpoint_is_written_as_a_custom_setting(): void {
		$this->assertTrue( GlobalStylesWriter::persistAll( [], [ 'md' => 768 ], [] ) );

		$custom = $this->userSettings()['custom'] ?? [];

		$this->assertNotEmpty( $custom, 'Breakpoints did not reach settings.custom.' );
	}

	public function test_the_written_document_stays_valid_theme_json(): void {
		GlobalStylesWriter::persistAll( [ 'color' => [ 'brand' => '#333333' ] ], [], [] );

		// WP_Theme_JSON rejects malformed input, so a non-empty round trip through the
		// resolver is the check that the document is still valid.
		$this->assertNotEmpty( WP_Theme_JSON_Resolver::get_user_data()->get_raw_data() );
	}

	public function test_an_empty_write_is_a_no_op(): void {
		$this->assertFalse( GlobalStylesWriter::persistAll( [], [], [] ) );
	}
}
