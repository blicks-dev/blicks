<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Core;

use Blicks\Core\BlockSupport;
use PHPUnit\Framework\TestCase;

/**
 * The gate that decides whether a block gets the Blicks engine.
 *
 * Asked as a name prefix until 2026-10-01, which silently excluded every block this plugin does not
 * itself ship: the editor gave them controls (JavaScript reads the manifest) and the front end gave
 * them no scoped CSS and no base stylesheet. These cases are the contract a companion plugin
 * depends on.
 *
 * Stubs rather than real WordPress, following `tests/bootstrap.php` — the logic under test is the
 * decision, and the end-to-end path that scoped CSS really reaches the page is covered by
 * `tests/integration/tests/BlockSupportRenderTest.php` against a real install.
 */
final class BlockSupportTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		BlockSupport::flush();
		\Blicks\Tests\Unit\Core\FakeRegistry::reset();
	}

	public function test_a_blicks_block_passes_without_touching_the_registry(): void {
		// No registration at all: the fast path must not need one.
		self::assertTrue( BlockSupport::usesBlicks( 'blicks/box' ) );
		self::assertSame( 0, FakeRegistry::$lookups );
	}

	public function test_a_foreign_block_declaring_support_passes(): void {
		FakeRegistry::register( 'acme/hero', [ 'blicks' => [ 'controls' => [ 'colors.*' ] ] ] );

		self::assertTrue( BlockSupport::usesBlicks( 'acme/hero' ) );
	}

	public function test_a_foreign_block_without_support_is_ignored(): void {
		FakeRegistry::register( 'acme/plain', [ 'html' => false ] );

		self::assertFalse( BlockSupport::usesBlicks( 'acme/plain' ) );
	}

	public function test_support_can_be_switched_off_explicitly(): void {
		FakeRegistry::register( 'acme/opted-out', [ 'blicks' => false ] );

		self::assertFalse( BlockSupport::usesBlicks( 'acme/opted-out' ) );
	}

	public function test_an_unregistered_block_is_ignored(): void {
		self::assertFalse( BlockSupport::usesBlicks( 'acme/never-registered' ) );
	}

	public function test_an_empty_name_is_ignored(): void {
		self::assertFalse( BlockSupport::usesBlicks( '' ) );
		self::assertSame( 0, FakeRegistry::$lookups );
	}

	public function test_the_answer_is_memoised(): void {
		FakeRegistry::register( 'acme/hero', [ 'blicks' => [] ] );

		BlockSupport::usesBlicks( 'acme/hero' );
		BlockSupport::usesBlicks( 'acme/hero' );
		BlockSupport::usesBlicks( 'acme/hero' );

		// render_block fires once per block per render; the answer cannot change within a request.
		self::assertSame( 1, FakeRegistry::$lookups );
	}

	public function test_a_passed_type_skips_the_registry(): void {
		$type = new \WP_Block_Type( 'acme/hero', [ 'blicks' => [] ] );

		self::assertTrue( BlockSupport::usesBlicks( 'acme/hero', $type ) );
		self::assertSame( 0, FakeRegistry::$lookups );
	}
}

/** Stands in for `WP_Block_Type_Registry`, and counts lookups so memoisation is observable. */
final class FakeRegistry {

	/** @var array<string, \WP_Block_Type> */
	public static array $types = [];

	public static int $lookups = 0;

	public static function reset(): void {
		self::$types   = [];
		self::$lookups = 0;
	}

	/** @param array<string, mixed> $supports */
	public static function register( string $name, array $supports ): void {
		self::$types[ $name ] = new \WP_Block_Type( $name, $supports );
	}
}
