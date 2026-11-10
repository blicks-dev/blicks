<?php
/**
 * CSV export of entries.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Forms\Entries;
use Blicks\Forms\EntriesCsv;
use WP_UnitTestCase;

final class EntriesCsvTest extends WP_UnitTestCase {

	public function test_columns_follow_first_appearance_and_use_labels(): void {
		$rows = EntriesCsv::rows(
			[
				[
					'received' => '2026-11-05T10:42:00+00:00',
					'status' => 'new',
					'page' => '/contact',
					'fields' => [ 'email' => 'a@example.com', 'topics' => [ 'One', 'Two' ] ],
					'labels' => [ 'email' => 'Email' ],
				],
				[
					'received' => '2026-11-04T09:00:00+00:00',
					'status' => 'handled',
					'page' => '/about',
					'fields' => [ 'phone' => '123', 'email' => 'b@example.com' ],
					'labels' => [ 'phone' => 'Phone', 'topics' => 'Topics' ],
				],
			]
		);

		$this->assertSame( [ 'Received', 'Status', 'Page', 'Email', 'topics', 'Phone' ], $rows[0] );
		$this->assertSame( [ '2026-11-05T10:42:00+00:00', 'new', '/contact', 'a@example.com', 'One, Two', '' ], $rows[1] );
		$this->assertSame( [ '2026-11-04T09:00:00+00:00', 'handled', '/about', 'b@example.com', '', '123' ], $rows[2] );
	}

	public function test_formula_cells_are_guarded(): void {
		foreach ( [ '=SUM(A1)', '+1', '-1', '@cmd', "\tx", "\rx" ] as $value ) {
			$this->assertSame( "'" . $value, EntriesCsv::cell( $value ) );
		}

		$this->assertSame( 'plain', EntriesCsv::cell( 'plain' ) );
		$this->assertSame( '', EntriesCsv::cell( '' ) );

		$rows = EntriesCsv::rows(
			[
				[
					'received' => 'r',
					'status' => 'new',
					'page' => '=page',
					'fields' => [ 'x' => '=HYPERLINK("http://evil")' ],
					'labels' => [ 'x' => '@label' ],
				],
			]
		);
		$this->assertSame( "'@label", $rows[0][3] );
		$this->assertSame( "'=page", $rows[1][2] );
		$this->assertSame( "'=HYPERLINK(\"http://evil\")", $rows[1][3] );
	}

	public function test_entries_are_read_per_form(): void {
		Entries::create( [ 'form' => 'abc', 'fields' => [ 'email' => 'a@example.com' ] ] );
		Entries::create( [ 'form' => 'abc', 'fields' => [ 'email' => 'b@example.com' ] ] );
		Entries::create( [ 'form' => 'xyz', 'fields' => [ 'email' => 'c@example.com' ] ] );

		$this->assertCount( 2, EntriesCsv::entries( 'abc' ) );
		$this->assertCount( 3, EntriesCsv::entries( '' ) );
		$this->assertCount( 3, EntriesCsv::rows( EntriesCsv::entries( 'abc' ) ) );
	}
}
