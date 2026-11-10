<?php
/**
 * Headers kept as template parts: the page's one header landmark, and Blicks › Headers.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\HeaderStudio\Tests;

use BlicksPro\HeaderStudio\AdminView;
use BlicksPro\HeaderStudio\Render;
use WP_REST_Request;
use WP_UnitTestCase;

require_once dirname( __DIR__ ) . '/support.php';

final class HeadersTest extends WP_UnitTestCase {

	/** The route, on `rest_api_init` as a site that names the module has it. */
	private static function server(): void {
		if ( false === has_action( 'rest_api_init', [ AdminView::class, 'routes' ] ) ) {
			add_action( 'rest_api_init', [ AdminView::class, 'routes' ] );
		}

		$GLOBALS['wp_rest_server'] = null;
		rest_get_server();
	}

	public function test_a_header_part_wrapping_a_header_block_is_a_div(): void {
		$html = Render::part( '<header class="wp-block-template-part"><header class="bl-header bl-1"><nav></nav></header></header>' );

		$this->assertSame( '<div class="wp-block-template-part bl-header-part"><header class="bl-header bl-1"><nav></nav></header></div>', $html );
	}

	public function test_a_wide_header_part_is_a_full_width_div(): void {
		$html = Render::part( '<header class="alignwide wp-block-template-part" data-x="1"><header class="bl-header"></header></header>' );

		$this->assertSame( '<div class="wp-block-template-part bl-header-part alignfull" data-x="1"><header class="bl-header"></header></div>', $html );
	}

	public function test_a_header_with_its_behaviour_written_first_is_still_found(): void {
		$html = Render::part( '<header class="wp-block-template-part"><header data-wp-interactive="blicks/sticky-shrink" class="bl-header bl-header--shrink"></header></header>' );

		$this->assertStringStartsWith( '<div class="wp-block-template-part bl-header-part">', $html );

		$sticky = Render::part( '<header class="wp-block-template-part"><header data-x="1" class="bl-header bl-header--sticky"></header></header>' );
		$this->assertStringStartsWith( '<div class="wp-block-template-part bl-header-part bl-header-part--sticky">', $sticky );
	}

	public function test_any_other_part_keeps_its_element(): void {
		$theirs = '<header class="wp-block-template-part"><div class="wp-block-group">Site</div></header>';

		$this->assertSame( $theirs, Render::part( $theirs ) );
		$this->assertSame( '<footer class="wp-block-template-part"><header class="bl-header"></header></footer>', Render::part( '<footer class="wp-block-template-part"><header class="bl-header"></header></footer>' ) );
	}

	public function test_the_headers_view_is_listed_for_theme_editors(): void {
		$views = AdminView::views( [] );

		$this->assertSame( 'headers', $views[ AdminView::SLUG ]['view'] );
		$this->assertSame( 'edit_theme_options', $views[ AdminView::SLUG ]['capability'] );
	}

	public function test_the_headers_route_needs_edit_theme_options(): void {
		self::server();
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'author' ] ) );

		$response = rest_do_request( new WP_REST_Request( 'GET', '/' . AdminView::NS . '/headers' ) );

		$this->assertSame( rest_authorization_required_code(), $response->get_status() );
	}

	public function test_the_headers_route_lists_header_parts_and_where_they_are_used(): void {
		self::server();
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );

		$response = rest_do_request( new WP_REST_Request( 'GET', '/' . AdminView::NS . '/headers' ) );
		$data = $response->get_data();

		$this->assertSame( 200, $response->get_status() );
		$this->assertSame( wp_is_block_theme(), $data['blockTheme'] );

		foreach ( $data['headers'] as $row ) {
			$this->assertMatchesRegularExpression( '#^[^/]+//[a-z0-9_-]+$#', $row['id'] );
			$this->assertIsBool( $row['studio'] );
			$this->assertIsArray( $row['usedOn'] );
		}
	}

	public function test_text_left_empty_prints_nothing(): void {
		$html = Render::withoutEmpty(
			'<h3 class="bl-heading bl-1"></h3><p class="bl-text bl-2"> </p><h3 class="bl-heading">Kept</h3>'
			. '<a class="bl-menu-link bl-3" href="/x"><span class="bl-menu-link__text"><span class="bl-menu-link__label"></span><span class="bl-menu-link__desc">Only a line</span></span></a>'
			. '<a class="bl-menu-link" href="/y"><span class="bl-menu-link__text"><span class="bl-menu-link__label">Kept</span></span></a>'
			. '<button type="button" class="bl-button bl-button--default"><span class="bl-button__label"></span></button>'
			. '<li class="bl-nav-item bl-4"><a class="bl-nav-item__link"></a></li><li class="bl-nav-item has-panel"><button class="bl-nav-item__toggle"></button></li>'
		);

		$this->assertSame( '<h3 class="bl-heading">Kept</h3><a class="bl-menu-link" href="/y"><span class="bl-menu-link__text"><span class="bl-menu-link__label">Kept</span></span></a><li class="bl-nav-item has-panel"><button class="bl-nav-item__toggle"></button></li>', $html );
	}

	public function test_a_menu_with_no_items_left_is_no_menu(): void {
		$html = Render::nav( '<nav class="bl-nav bl-1" aria-label="Main"><ul class="bl-nav__list"><li class="bl-nav-item"><a class="bl-nav-item__link"></a></li></ul></nav>', [ 'uniqueId' => '1' ] );

		$this->assertSame( '', $html );
	}
}
