<?php
/**
 * A Loop that uses the page's own query, rendered where that query never ran.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Data\QuerySource;
use WP_Query;
use WP_UnitTestCase;

final class LoopInheritTest extends WP_UnitTestCase {

	public function tear_down(): void {
		$GLOBALS['wp_query'] = $GLOBALS['wp_the_query'];
		parent::tear_down();
	}

	/** E.g. GET /wp/v2/pages/<id>?context=edit renders content with an unrun main query. */
	public function test_an_inheriting_loop_has_no_items_when_the_main_query_never_ran(): void {
		$GLOBALS['wp_query'] = new WP_Query();

		$this->assertSame( [], QuerySource::items( [ 'inherit' => true ], 6, 0, 0 ) );
		$this->assertSame( [], QuerySource::inherited( 1, 1 )['items'] );

		$markup = '<!-- wp:blicks/loop {"source":"query","query":{"inherit":true}} --><!-- wp:blicks/heading {"content":"Title"} --><h3 class="bl-heading">Title</h3><!-- /wp:blicks/heading --><!-- /wp:blicks/loop -->';
		$this->assertIsString( do_blocks( $markup ) );
	}
}
