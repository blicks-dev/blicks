<?php
/**
 * The Locator finds a saved form only where the public can read it.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Forms\Locator;
use WP_UnitTestCase;

final class FormsLocatorTest extends WP_UnitTestCase {

	private function form( string $uid ): string {
		return '<!-- wp:blicks/form {"uniqueId":"' . $uid . '"} -->'
			. '<!-- wp:blicks/field {"uniqueId":"aa11","type":"email","name":"email","label":"Email","required":true} /-->'
			. '<!-- /wp:blicks/form -->';
	}

	public function test_finds_a_form_in_the_post(): void {
		$id = self::factory()->post->create( [ 'post_content' => $this->form( 'f0000001' ), 'post_title' => 'Contact' ] );

		$found = Locator::find( 'f0000001', $id );

		$this->assertNotNull( $found );
		$this->assertSame( $id, $found['post'] );
		$this->assertSame( 'Contact', $found['title'] );
		$this->assertSame( 'email', $found['fields'][0]['name'] );
		$this->assertSame( 'f0000001', $found['settings']['uid'] );
	}

	public function test_the_form_name_names_it_over_the_post_title(): void {
		$content = '<!-- wp:blicks/form {"uniqueId":"f0000009","name":"  Contact, home page "} --><!-- /wp:blicks/form -->';
		$id = self::factory()->post->create( [ 'post_content' => $content, 'post_title' => 'Home' ] );

		$found = Locator::find( 'f0000009', $id );

		$this->assertNotNull( $found );
		$this->assertSame( 'Contact, home page', $found['title'] );
	}

	public function test_finds_a_form_in_a_synced_pattern_the_post_uses(): void {
		$pattern = self::factory()->post->create(
			[
				'post_type' => 'wp_block',
				'post_title' => 'Footer form',
				'post_content' => $this->form( 'f0000002' ),
			]
		);
		$page = self::factory()->post->create( [ 'post_type' => 'page', 'post_content' => '<!-- wp:block {"ref":' . $pattern . '} /-->' ] );

		// Not through the index: only the reference leads there.
		delete_post_meta( $pattern, Locator::META );
		Locator::flush();

		$found = Locator::find( 'f0000002', $page );

		$this->assertNotNull( $found );
		$this->assertSame( $pattern, $found['post'] );
		$this->assertSame( 'Footer form', $found['title'] );
	}

	public function test_the_index_finds_a_form_living_elsewhere(): void {
		$home = self::factory()->post->create( [ 'post_content' => $this->form( 'f0000003' ) ] );
		$other = self::factory()->post->create( [ 'post_content' => '<!-- wp:paragraph --><p>Hi</p><!-- /wp:paragraph -->' ] );

		$this->assertSame( [ 'f0000003' ], get_post_meta( $home, Locator::META, false ) );
		$this->assertSame( [], get_post_meta( $other, Locator::META, false ) );

		$found = Locator::find( 'f0000003', $other );

		$this->assertNotNull( $found );
		$this->assertSame( $home, $found['post'] );
	}

	public function test_index_rewrites_its_rows_and_skips_revisions(): void {
		$id = self::factory()->post->create( [ 'post_content' => $this->form( 'f0000004' ) . $this->form( 'f0000005' ) ] );
		$this->assertSame( [ 'f0000004', 'f0000005' ], get_post_meta( $id, Locator::META, false ) );

		wp_update_post(
			[
				'ID' => $id,
				'post_content' => $this->form( 'f0000005' ),
			]
		);

		$this->assertSame( [ 'f0000005' ], get_post_meta( $id, Locator::META, false ) );

		foreach ( wp_get_post_revisions( $id ) as $revision ) {
			$this->assertSame( [], get_post_meta( $revision->ID, Locator::META, false ) );
		}
	}

	public function test_a_draft_form_cannot_be_found(): void {
		$draft = self::factory()->post->create(
			[
				'post_status' => 'draft',
				'post_content' => $this->form( 'f0000006' ),
			]
		);

		$this->assertNull( Locator::find( 'f0000006', $draft ) );
		$this->assertNull( Locator::find( 'f0000006', 0 ) );
	}

	public function test_a_password_protected_form_needs_the_password(): void {
		$id = self::factory()->post->create(
			[
				'post_password' => 'secret',
				'post_content' => $this->form( 'f0000007' ),
			]
		);

		$this->assertNull( Locator::find( 'f0000007', $id ) );
	}

	public function test_a_cached_miss_is_forgotten_when_the_form_is_saved(): void {
		$id = self::factory()->post->create( [ 'post_content' => '' ] );

		$this->assertNull( Locator::find( 'f0000008', $id ) );

		wp_update_post(
			[
				'ID' => $id,
				'post_content' => $this->form( 'f0000008' ),
			]
		);

		$this->assertNotNull( Locator::find( 'f0000008', $id ) );
	}

	public function test_finds_a_form_in_a_template_part(): void {
		$part = self::factory()->post->create(
			[
				'post_type' => 'wp_template_part',
				'post_name' => 'blicks-test-footer',
				'post_title' => 'Footer',
				'post_content' => $this->form( 'f0000009' ),
			]
		);
		wp_set_object_terms( $part, get_stylesheet(), 'wp_theme' );
		$page = self::factory()->post->create( [ 'post_type' => 'page' ] );

		// Templates are the last step: take the index out of the way.
		global $wpdb;
		$wpdb->delete( $wpdb->postmeta, [ 'meta_key' => Locator::META ] ); // phpcs:ignore WordPress.DB
		Locator::flush();

		$found = Locator::find( 'f0000009', $page );

		$this->assertNotNull( $found );
		$this->assertSame( 'Footer', $found['title'] );
	}

	public function test_a_bad_id_finds_nothing(): void {
		$this->assertNull( Locator::find( '', 1 ) );
		$this->assertNull( Locator::find( 'NOT-AN-ID', 1 ) );
	}
}
