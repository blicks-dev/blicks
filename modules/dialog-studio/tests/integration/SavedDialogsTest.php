<?php
/**
 * Saved dialogs against a real WordPress: the post type, the Studio's entity route, and a saved
 * dialog printed where a Button opens it.
 *
 * Runs in wp-env's tests container with `BLICKS_DEV_MODULES` naming `dialog-studio`:
 *
 *     wp-env run tests-cli --env-cwd=wp-content/plugins/blicks/tests/integration \
 *         vendor/bin/phpunit ../../modules/dialog-studio/tests/integration
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\DialogStudio\Tests\Integration;

use Blicks\Blocks\Dialogs;
use BlicksPro\DialogStudio\Library;
use BlicksPro\DialogStudio\Openers;
use BlicksPro\DialogStudio\PostType;
use BlicksPro\DialogStudio\Printer;
use BlicksPro\DialogStudio\Settings;
use WP_REST_Request;
use WP_UnitTestCase;

final class SavedDialogsTest extends WP_UnitTestCase {

	private const CONTENT = '<!-- wp:blicks/dialog {"title":"Newsletter","anchor":"newsletter","uniqueId":"d1a1b2c3"} --><dialog class="wp-block-blicks-dialog bl-dialog bl-dialog--modal is-modal bl-dialog--bd-dark bl-dialog--m-rise bl-d1a1b2c3" id="dialog-newsletter" closedby="any"><button type="button" class="bl-dialog__close" commandfor="dialog-newsletter" command="close" aria-label="Close"></button><!-- wp:blicks/heading {"content":"Join","uniqueId":"h1a1b2c3"} --><h2 class="wp-block-blicks-heading bl-heading bl-h1a1b2c3">Join</h2><!-- /wp:blicks/heading --></dialog><!-- /wp:blicks/dialog -->';

	public static function set_up_before_class(): void {
		parent::set_up_before_class();

		if ( ! class_exists( Library::class ) ) {
			self::markTestSkipped( 'Dialog Studio is not loaded: define BLICKS_DEV_MODULES as dialog-studio.' );
		}
	}

	public function set_up(): void {
		parent::set_up();

		// The suite unregisters every non-core post type between tests; `init` registered it once.
		PostType::register();

		Dialogs::reset();
		Library::reset();
		Printer::shared()->reset();
	}

	private function dialog( string $status = 'publish', array $triggers = [] ): int {
		$id = self::factory()->post->create(
			[
				'post_type' => Library::TYPE,
				'post_status' => $status,
				'post_title' => 'Newsletter',
				'post_content' => self::CONTENT,
			]
		);
		update_post_meta( $id, Settings::TRIGGERS, $triggers );
		Library::sync( $id );

		return $id;
	}

	/** What the free plugin's footer step prints for the dialogs the page named and does not hold. */
	private function footer(): string {
		ob_start();
		do_action( 'blicks_dialog_missing', Dialogs::missing() );

		return (string) ob_get_clean();
	}

	public function test_the_type_is_private_and_needs_edit_theme_options(): void {
		$type = get_post_type_object( Library::TYPE );

		$this->assertFalse( $type->public );
		$this->assertTrue( $type->show_in_rest );
		$this->assertSame( 'edit_theme_options', $type->cap->edit_posts );

		$id = $this->dialog();
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'editor' ] ) );
		$this->assertFalse( current_user_can( 'edit_post', $id ) );
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		$this->assertTrue( current_user_can( 'edit_post', $id ) );
	}

	public function test_saving_keeps_the_lookup_meta_in_step(): void {
		$id = $this->dialog( 'publish', [ 'load' => [ 'on' => true ] ] );

		$this->assertSame( 'dialog-newsletter', get_post_meta( $id, Library::DOM_ID, true ) );
		$this->assertSame( '1', get_post_meta( $id, Library::AUTO, true ) );
		$this->assertSame( $id, Library::byDomId( 'dialog-newsletter' )?->ID );
	}

	public function test_meta_is_cleaned_on_write_and_has_defaults_on_read(): void {
		$id = $this->dialog();
		update_post_meta( $id, Settings::RULES, [ 'visitors' => 'robots', 'days' => 999 ] );

		$rules = get_post_meta( $id, Settings::RULES, true );
		$this->assertSame( 'all', $rules['visitors'] );
		$this->assertSame( 365, $rules['days'] );

		$fresh = self::factory()->post->create( [ 'post_type' => Library::TYPE ] );
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );
		$response = rest_do_request( new WP_REST_Request( 'GET', '/wp/v2/blicks-dialogs/' . $fresh ) );
		$this->assertSame( 200, $response->get_status() );
		$this->assertEquals( Settings::triggerDefaults(), $response->get_data()['meta'][ Settings::TRIGGERS ] );
	}

	public function test_the_studio_entity_route_opens_and_saves_a_saved_dialog(): void {
		$id = $this->dialog();
		wp_set_current_user( self::factory()->user->create( [ 'role' => 'administrator' ] ) );

		$get = new WP_REST_Request( 'GET', '/blicks/v1/studio/entity' );
		$get->set_query_params( [ 'kind' => 'post', 'type' => Library::TYPE, 'id' => $id ] );
		$read = rest_do_request( $get );
		$this->assertSame( 200, $read->get_status() );
		$this->assertSame( 'Newsletter', $read->get_data()['title'] );

		$post = new WP_REST_Request( 'POST', '/blicks/v1/studio/entity' );
		$post->set_query_params( [ 'kind' => 'post', 'type' => Library::TYPE, 'id' => $id ] );
		$post->set_body_params( [ 'content' => str_replace( 'newsletter', 'offer', self::CONTENT ) ] );
		$this->assertSame( 200, rest_do_request( $post )->get_status() );
		$this->assertSame( 'dialog-offer', get_post_meta( $id, Library::DOM_ID, true ), 'the anchor follows the saved content' );
	}

	public function test_used_on_counts_the_buttons_and_links_that_open_it(): void {
		$id = $this->dialog();
		self::factory()->post->create(
			[
				'post_title' => 'Home',
				'post_type' => 'page',
				'post_content' => '<button commandfor="dialog-newsletter" command="show-modal">Join</button> <a href="#dialog-newsletter">join</a> <a href="#dialog-newsletter-2">other</a>',
			]
		);

		$used = Openers::usedOn( [], [ 'kind' => 'post', 'type' => Library::TYPE, 'id' => $id ] );

		$this->assertCount( 1, $used );
		$this->assertSame( 'Home', $used[0]['title'] );
		$this->assertSame( 2, $used[0]['count'] );
	}

	public function test_a_saved_dialog_is_printed_where_a_button_opens_it(): void {
		$id = $this->dialog();

		$page = do_blocks( '<!-- wp:html --><button type="button" commandfor="dialog-newsletter" command="show-modal">Join</button><!-- /wp:html -->' );
		$this->assertStringContainsString( 'commandfor="dialog-newsletter"', $page );

		$footer = $this->footer();

		$this->assertSame( 1, substr_count( $footer, 'id="dialog-newsletter"' ), 'printed once' );
		$this->assertMatchesRegularExpression( '/<dialog[^>]*data-bl-saved="' . $id . '"/', $footer );
		$this->assertMatchesRegularExpression( '/<dialog[^>]*data-wp-interactive="blicks\/dialog"/', $footer );
		$this->assertStringContainsString( 'aria-labelledby="dialog-newsletter-title"', $footer, 'named like any dialog' );
	}

	public function test_a_draft_is_never_printed(): void {
		$this->dialog( 'draft' );

		do_blocks( '<!-- wp:html --><a href="#dialog-newsletter">Join</a><!-- /wp:html -->' );

		$this->assertStringNotContainsString( 'id="dialog-newsletter"', $this->footer() );
	}

	/** The automatic dialogs printed on the page the main query is on, as the footer prints them. */
	private function automaticFooter(): string {
		$printer = Printer::shared();
		$printer->reset();
		Library::reset();
		ob_start();
		$printer->footer();

		return (string) ob_get_clean();
	}

	public function test_an_automatic_dialog_is_printed_with_its_triggers_where_its_rules_allow(): void {
		$page = self::factory()->post->create( [ 'post_type' => 'page' ] );
		$id = $this->dialog( 'publish', [ 'load' => [ 'on' => true, 'delay' => 4 ] ] );
		update_post_meta( $id, Settings::RULES, [ 'visitors' => 'out', 'exclude' => [ 'post:' . $page ] ] );

		$this->go_to( get_permalink( self::factory()->post->create() ) );
		$html = $this->automaticFooter();
		$this->assertMatchesRegularExpression( '/<dialog[^>]*data-bl-auto="[^"]*&quot;delay&quot;:4/', $html );
		$this->assertStringContainsString( '&quot;visitors&quot;:&quot;out&quot;', $html );

		$this->go_to( get_permalink( $page ) );
		$this->assertStringNotContainsString( 'id="dialog-newsletter"', $this->automaticFooter(), 'excluded here, so not printed' );
	}

	public function test_a_dialog_out_of_its_schedule_is_not_printed(): void {
		$id = $this->dialog( 'publish', [ 'load' => [ 'on' => true ] ] );
		update_post_meta( $id, Settings::RULES, [ 'schedule' => [ 'on' => true, 'from' => '2000-01-01', 'to' => '2000-01-02' ] ] );

		$this->go_to( home_url( '/' ) );
		$this->assertSame( '', trim( $this->automaticFooter() ) );
	}

	public function test_two_visitors_are_served_the_same_html(): void {
		$id = $this->dialog( 'publish', [ 'exit' => [ 'on' => true ] ] );
		update_post_meta( $id, Settings::RULES, [ 'visitors' => 'out', 'frequency' => 'once' ] );
		$post = self::factory()->post->create();

		wp_set_current_user( 0 );
		$this->go_to( get_permalink( $post ) );
		$guest = $this->automaticFooter();

		wp_set_current_user( self::factory()->user->create( [ 'role' => 'subscriber' ] ) );
		$this->go_to( get_permalink( $post ) );
		$member = $this->automaticFooter();

		$this->assertStringContainsString( 'data-bl-auto=', $guest );
		$this->assertSame( $guest, $member, 'nothing about the visitor is decided on the server' );
	}
}
