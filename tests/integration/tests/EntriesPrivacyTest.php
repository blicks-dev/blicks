<?php
/**
 * Personal data export and erase for entries.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Forms\Entries;
use Blicks\Forms\Privacy;
use WP_UnitTestCase;

final class EntriesPrivacyTest extends WP_UnitTestCase {

	private function entry( string $email, string $message = 'Hello' ): int {
		return Entries::create(
			[
				'form' => 'abc',
				'formTitle' => 'Contact',
				'page' => '/contact',
				'fields' => [ 'email' => $email, 'message' => $message ],
				'labels' => [ 'email' => 'Email', 'message' => 'Message' ],
				'userAgent' => 'TestAgent/1.0',
				'ipHash' => 'secret-hash-value',
			]
		);
	}

	public function test_registers_an_exporter_and_an_eraser(): void {
		$this->assertArrayHasKey( 'blicks-entries', apply_filters( 'wp_privacy_personal_data_exporters', [] ) );
		$this->assertArrayHasKey( 'blicks-entries', apply_filters( 'wp_privacy_personal_data_erasers', [] ) );
	}

	public function test_export_matches_the_address_exactly(): void {
		$mine = $this->entry( 'ann@example.com', 'Mine' );
		$this->entry( 'joann@example.com', 'Not mine' );

		$result = Privacy::export( 'ann@example.com', 1 );

		$this->assertTrue( $result['done'] );
		$this->assertCount( 1, $result['data'] );
		$this->assertSame( 'blicks-entry-' . $mine, $result['data'][0]['item_id'] );

		$pairs = array_column( $result['data'][0]['data'], 'value', 'name' );
		$this->assertSame( 'ann@example.com', $pairs['Email'] );
		$this->assertSame( 'Mine', $pairs['Message'] );
		$this->assertSame( 'Contact', $pairs['Form'] );
		$this->assertNotContains( 'secret-hash-value', $pairs );

		$this->assertSame( [], Privacy::export( 'nobody@example.com', 1 )['data'] );
	}

	public function test_erase_deletes_only_that_addresses_entries(): void {
		$mine = $this->entry( 'ann@example.com' );
		$mineToo = $this->entry( 'ANN@example.com' );
		$theirs = $this->entry( 'joann@example.com' );

		$result = Privacy::erase( 'ann@example.com', 1 );

		$this->assertTrue( $result['items_removed'] );
		$this->assertTrue( $result['done'] );
		$this->assertNull( get_post( $mine ) );
		$this->assertNull( get_post( $mineToo ) );
		$this->assertNotNull( Entries::get( $theirs ) );

		$again = Privacy::erase( 'ann@example.com', 1 );
		$this->assertFalse( $again['items_removed'] );
		$this->assertTrue( $again['done'] );
	}
}
