<?php
/**
 * The header blocks, rendered by a real WordPress: the drawer, the disclosure wiring and the
 * behaviours each page loads.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\HeaderStudio\Tests;

use Blicks\Behaviours\Behaviours;
use BlicksPro\HeaderStudio\LinkList;
use BlicksPro\HeaderStudio\Module;
use BlicksPro\HeaderStudio\Render;
use WP_Block_Type_Registry;
use WP_UnitTestCase;

require_once dirname( __DIR__ ) . '/support.php';

final class RenderTest extends WP_UnitTestCase {

	/** Whether this test loaded the module, and so must unload it for the plugin's own tests. */
	private static bool $loaded = false;

	public static function set_up_before_class(): void {
		parent::set_up_before_class();

		// Loaded as BLICKS_DEV_MODULES would, if the site running the suite does not name it.
		if ( ! WP_Block_Type_Registry::get_instance()->is_registered( 'blicks/header' ) ) {
			( new Module( dirname( __DIR__, 2 ) ) )->registerBlocks();
			self::$loaded = true;
		}
	}

	/**
	 * The render filter goes on per test, not once per class: WP_UnitTestCase puts every hook
	 * back as it found it after each test, so a filter added before the class lasts one test,
	 * and every later one renders the bare saved markup.
	 */
	public function set_up(): void {
		parent::set_up();

		if ( self::$loaded ) {
			add_filter( 'render_block', [ Render::class, 'block' ], 30, 2 );
		}
	}

	public static function tear_down_after_class(): void {
		if ( self::$loaded ) {
			foreach ( Module::BLOCKS as $name ) {
				unregister_block_type( 'blicks/' . $name );
			}
			self::$loaded = false;
		}

		parent::tear_down_after_class();
	}

	private static function golden( string $name ): string {
		return (string) file_get_contents( dirname( __DIR__ ) . '/__golden__/' . $name . '.html' );
	}

	/** The behaviours a rendered page asked for, by module id. */
	private static function queued(): array {
		$modules = wp_script_modules();
		$queue = ( fn () => $this->queue )->call( $modules );

		return array_values( array_filter( $queue, static fn ( string $id ): bool => str_starts_with( $id, '@blicks/' ) ) );
	}

	public function test_the_menu_is_a_list_beside_a_drawer_it_moves_into(): void {
		$html = do_blocks( self::golden( 'nav' ) );

		$this->assertMatchesRegularExpression( '#<nav class="bl-nav bl-4712cecf" aria-label="Primary"><button type="button" class="bl-nav__toggle" commandfor="dialog-nav-4712cecf" command="show-modal" aria-haspopup="dialog" aria-label="Menu">#', $html );
		// The list is in the nav, outside the dialog, and follows it while it is open.
		$this->assertMatchesRegularExpression( '#</button><ul (?=[^>]*data-wp-interactive="blicks/portal")(?=[^>]*data-wp-init="callbacks.init")(?=[^>]*data-bl-portal="dialog-nav-4712cecf")[^>]*class="bl-nav__list"#', $html );
		$this->assertMatchesRegularExpression( '#</ul><dialog [^>]*class="bl-dialog bl-dialog--drawer bl-dialog--from-end is-modal bl-nav__drawer"[^>]*id="dialog-nav-4712cecf"#', $html );
		$this->assertStringContainsString( 'data-wp-interactive="blicks/dialog"', $html, 'the free plugin made it a dialog' );
		$this->assertMatchesRegularExpression( '#<button type="button" class="bl-dialog__close" commandfor="dialog-nav-4712cecf" command="close" aria-label="Close"></button></dialog></nav>#', trim( $html ) );

		$queued = self::queued();
		$this->assertContains( '@blicks/dialog', $queued );
		$this->assertContains( '@blicks/portal', $queued );
	}

	public function test_a_mega_menu_item_is_a_wired_disclosure(): void {
		$html = do_blocks( self::golden( 'nav-item' ) );

		$this->assertStringContainsString( 'data-wp-interactive="blicks/disclosure"', $html );
		$this->assertMatchesRegularExpression( '#<button (?=[^>]*aria-controls="bl-panel-f7d9d655")(?=[^>]*data-wp-on--click="actions.toggle")(?=[^>]*aria-expanded="false")[^>]*class="bl-nav-item__toggle"[^>]*>Products</button>#', $html );
		$this->assertMatchesRegularExpression( '#<div (?=[^>]*id="bl-panel-f7d9d655")[^>]*class="bl-mega-panel bl-afc28c41"[^>]*><button type="button" class="bl-mega-panel__back" data-bl-focus data-wp-on--click="actions.close">Back</button><p class="bl-mega-panel__title" aria-hidden="true">Products</p>#', $html );
		// Opens on hover by default: hover intent, with its delay.
		$this->assertStringContainsString( 'data-wp-on--pointerenter="blicks/hover-intent::actions.enter"', $html );
		$this->assertStringContainsString( 'data-bl-delay="150"', $html );
		$this->assertStringNotContainsString( 'role="menu', $html );

		$queued = self::queued();
		$this->assertContains( '@blicks/disclosure', $queued );
		$this->assertContains( '@blicks/hover-intent', $queued );
	}

	public function test_a_click_only_panel_has_no_hover_and_may_close_on_scroll(): void {
		$markup = str_replace( '<!-- wp:blicks/mega-panel {"uniqueId":"afc28c41"} -->', '<!-- wp:blicks/mega-panel {"uniqueId":"afc28c41","openOn":"click","closeOnScroll":true} -->', self::golden( 'nav-item' ) );
		$markup = str_replace( '<div class="bl-mega-panel bl-afc28c41">', '<div class="bl-mega-panel bl-afc28c41 bl-mega-panel--on-click bl-mega-panel--scroll-closes">', $markup );
		$html = do_blocks( $markup );

		$this->assertStringNotContainsString( 'hover-intent', $html );
		$this->assertStringContainsString( 'data-wp-on-window--scroll="actions.scroll"', $html );
		$this->assertStringContainsString( 'data-bl-close-on-scroll', $html );
	}

	public function test_a_plain_link_item_is_left_alone(): void {
		$html = Render::navItem( '<li class="bl-nav-item bl-1"><a class="bl-nav-item__link" href="/">Home</a></li>', [ 'attrs' => [] ] );

		$this->assertSame( '<li class="bl-nav-item bl-1"><a class="bl-nav-item__link" href="/">Home</a></li>', $html );
	}

	public function test_only_a_shrinking_or_see_through_header_watches_the_scroll(): void {
		$this->assertStringNotContainsString( 'sticky-shrink', Render::header( '<header class="bl-header bl-header--sticky"></header>' ) );
		$this->assertStringContainsString( 'data-wp-interactive="blicks/sticky-shrink"', Render::header( '<header class="bl-header bl-header--sticky bl-header--shrink"></header>' ) );
		$this->assertStringContainsString( 'data-wp-on-window--scroll="callbacks.scroll"', Render::header( '<header class="bl-header bl-header--over"></header>' ) );
		$this->assertStringNotContainsString( 'data-bl-hide', Render::header( '<header class="bl-header bl-header--sticky bl-header--shrink"></header>' ) );
	}

	public function test_a_hiding_header_opts_in_to_hiding_and_to_focus(): void {
		$html = Render::header( '<header class="bl-header bl-header--sticky bl-header--hide"></header>' );

		$this->assertStringContainsString( 'data-wp-interactive="blicks/sticky-shrink"', $html );
		$this->assertStringContainsString( 'data-bl-hide', $html );
		$this->assertStringContainsString( 'data-wp-on--focusin="callbacks.focus"', $html );
	}

	public function test_the_whole_header_renders_and_loads_only_what_it_uses(): void {
		$html = do_blocks( self::golden( 'header' ) );

		$this->assertStringStartsWith( '<header class="bl-header bl-391e6f7f bl-header--sticky">', trim( $html ) );
		$this->assertStringContainsString( 'bl-nav__drawer', $html );
		$this->assertNotContains( '@blicks/sticky-shrink', self::queued() );
		$this->assertSame( [], array_diff( Behaviours::used( $html ), [ 'dialog', 'portal' ] ), 'a header of plain links needs only the drawer' );
	}

	public function test_a_link_list_reads_chosen_pages_and_menus(): void {
		$page = self::factory()->post->create( [ 'post_type' => 'page', 'post_title' => 'About & us', 'post_status' => 'publish' ] );
		$draft = self::factory()->post->create( [ 'post_type' => 'page', 'post_title' => 'Draft', 'post_status' => 'draft' ] );

		$html = LinkList::render( [ 'source' => 'pages', 'pages' => [ $page, $draft ], 'uniqueId' => 'ab12cd34' ] );

		$this->assertStringStartsWith( '<ul class="bl-link-list bl-ab12cd34"><li><a class="bl-menu-link" href="', $html );
		$this->assertStringContainsString( 'About &amp; us', $html );
		$this->assertStringNotContainsString( 'Draft', $html );

		$menu = wp_create_nav_menu( 'Primary' );
		$parent = wp_update_nav_menu_item( $menu, 0, [ 'menu-item-title' => 'Products', 'menu-item-url' => 'https://example.test/p', 'menu-item-status' => 'publish' ] );
		wp_update_nav_menu_item( $menu, 0, [ 'menu-item-title' => 'Analytics', 'menu-item-url' => 'https://example.test/a', 'menu-item-parent-id' => $parent, 'menu-item-status' => 'publish' ] );

		$this->assertSame( [ 'Products' ], array_column( LinkList::menu( "classic:{$menu}" ), 'label' ) );
		$this->assertSame( [ 'Analytics' ], array_column( LinkList::menu( "classic:{$menu}:{$parent}" ), 'label' ) );

		$nav = self::factory()->post->create(
			[
				'post_type' => 'wp_navigation',
				'post_status' => 'publish',
				'post_content' => '<!-- wp:navigation-link {"label":"Home","url":"/"} /--><!-- wp:navigation-submenu {"label":"More","url":"/more"} --><!-- wp:navigation-link {"label":"Team","url":"/team"} /--><!-- /wp:navigation-submenu -->',
			]
		);

		$this->assertSame( [ 'Home', 'More' ], array_column( LinkList::menu( "nav:{$nav}" ), 'label' ) );
		$this->assertSame( [ 'Team' ], array_column( LinkList::menu( "nav:{$nav}:0" ), 'label' ) );
		$this->assertSame( '', LinkList::render( [ 'menu' => 'nonsense' ] ) );
	}
}
