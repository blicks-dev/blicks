<?php
/**
 * Counts and the Dialogs view against a real WordPress.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\DialogStudio\Tests\Integration;

use BlicksPro\DialogStudio\AdminView;
use BlicksPro\DialogStudio\Library;
use BlicksPro\DialogStudio\PostType;
use BlicksPro\DialogStudio\Stats;
use WP_REST_Request;
use WP_UnitTestCase;

final class StatsTest extends WP_UnitTestCase {

	public static function set_up_before_class(): void {
		parent::set_up_before_class();

		if ( ! class_exists( Stats::class ) ) {
			self::markTestSkipped( 'Dialog Studio is not loaded: define BLICKS_DEV_MODULES as dialog-studio.' );
		}
	}

	public function set_up(): void {
		parent::set_up();
		PostType::register();
		Stats::install();
		$_SERVER['REMOTE_ADDR'] = '203.0.113.' . wp_rand( 1, 250 );
	}

	private function dialog( string $status = 'publish' ): int {
		$id = self::factory()->post->create(
			[
				'post_type' => Library::TYPE,
				'post_status' => $status,
				'post_title' => 'Offer',
				'post_content' => '<!-- wp:blicks/dialog {"anchor":"offer","kind":"drawer"} --><dialog id="dialog-offer"></dialog><!-- /wp:blicks/dialog -->',
			]
		);
		Library::sync( $id );

		return $id;
	}

	private function send( int $id, string $event ): int {
		$request = new WP_REST_Request( 'POST', '/blicks-pro/v1/dialogs/' . $id . '/events' );
		$request->set_body_params( [ 'event' => $event ] );

		return rest_do_request( $request )->get_status();
	}

	public function test_anyone_may_count_a_published_dialog_and_today_adds_up(): void {
		$id = $this->dialog();
		wp_set_current_user( 0 );

		$this->assertSame( 204, $this->send( $id, 'shown' ) );
		$this->assertSame( 204, $this->send( $id, 'shown' ) );
		$this->assertSame( 204, $this->send( $id, 'converted' ) );
		$this->assertSame( 400, $this->send( $id, 'clicked' ) );

		$stats = Stats::read( $id, 7 );
		$this->assertCount( 7, $stats['days'] );
		$this->assertSame( 2, $stats['shown'] );
		$this->assertSame( 1, $stats['converted'] );
		$this->assertSame( wp_date( 'Y-m-d' ), end( $stats['days'] )['day'] );
	}

	public function test_a_draft_or_another_post_is_not_counted(): void {
		$this->assertSame( 404, $this->send( $this->dialog( 'draft' ), 'shown' ) );
		$this->assertSame( 404, $this->send( self::factory()->post->create(), 'shown' ) );
	}

	public function test_one_address_is_rate_limited(): void {
		$id = $this->dialog();

		for ( $i = 0; $i < Stats::LIMIT; $i++ ) {
			$this->assertSame( 204, $this->send( $id, 'shown' ) );
		}

		$this->assertSame( 429, $this->send( $id, 'shown' ) );
		$this->assertSame( Stats::LIMIT, Stats::read( $id, 1 )['shown'] );

		$_SERVER['REMOTE_ADDR'] = '198.51.100.7';
		$this->assertSame( 204, $this->send( $id, 'shown' ), 'another address is not held up' );
	}

	public function test_the_table_holds_no_visitor_data(): void {
		global $wpdb;

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared -- reading the shape of our own table.
		$columns = $wpdb->get_col( 'DESCRIBE ' . Stats::table() );
		$this->assertSame( [ 'dialog_id', 'day', 'shown', 'converted' ], $columns );
	}

	public function test_reading_the_counts_and_the_list_needs_edit_theme_options(): void {
		$id = $this->dialog();
		Stats::record( $id, 'shown' );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$this->assertSame( 403, rest_do_request( new WP_REST_Request( 'GET', '/blicks-pro/v1/dialogs/' . $id . '/stats' ) )->get_status() );
		$this->assertSame( 403, rest_do_request( new WP_REST_Request( 'GET', '/blicks-pro/v1/dialogs' ) )->get_status() );

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		$this->assertSame( 1, rest_do_request( new WP_REST_Request( 'GET', '/blicks-pro/v1/dialogs/' . $id . '/stats' ) )->get_data()['shown'] );

		$rows = rest_do_request( new WP_REST_Request( 'GET', '/blicks-pro/v1/dialogs' ) )->get_data()['dialogs'];
		$row = current( array_filter( $rows, static fn ( array $r ): bool => $id === $r['id'] ) );
		$this->assertSame( 'drawer', $row['kind'] );
		$this->assertSame( 'dialog-offer', $row['domId'] );
		$this->assertSame( 1, $row['shown'] );
		$this->assertTrue( $row['on'] );
	}

	public function test_the_view_is_added_to_the_blicks_admin(): void {
		$views = AdminView::views( [] );

		$this->assertSame( 'dialogs', $views[ AdminView::SLUG ]['view'] );
		$this->assertSame( 'edit_theme_options', $views[ AdminView::SLUG ]['capability'] );
		$this->assertArrayHasKey( AdminView::SLUG, apply_filters( 'blicks_admin_views', [] ) );
	}
}
