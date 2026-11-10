<?php
/**
 * What a Dialog gets from the page at render: its name, its Close buttons' target, and the list of
 * dialogs the page opens but does not hold.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Behaviours\Behaviours;
use Blicks\Blocks\Dialogs;
use WP_HTML_Tag_Processor;
use WP_UnitTestCase;

final class DialogsTest extends WP_UnitTestCase {

	public function set_up(): void {
		parent::set_up();
		Dialogs::reset();
	}

	public function test_a_dialog_is_named_by_its_first_heading(): void {
		$html = Dialogs::dialog( '<dialog class="bl-dialog" id="dialog-guide"><h2 class="bl-heading">Size guide</h2><h3>Other</h3></dialog>' );

		$this->assertStringContainsString( 'aria-labelledby="dialog-guide-title"', $html );
		$this->assertStringContainsString( '<h2 id="dialog-guide-title" class="bl-heading">', $html );
		$this->assertStringNotContainsString( '<h3 id=', $html );
	}

	public function test_a_heading_keeps_its_own_id(): void {
		$html = Dialogs::dialog( '<dialog class="bl-dialog" id="dialog-guide"><h2 id="sizes">Size guide</h2></dialog>' );

		$this->assertStringContainsString( 'aria-labelledby="sizes"', $html );
	}

	public function test_a_dialog_with_a_name_is_left_as_named(): void {
		$html = Dialogs::dialog( '<dialog class="bl-dialog" id="dialog-guide" aria-label="Sizes"><h2>Size guide</h2></dialog>' );

		$this->assertStringNotContainsString( 'aria-labelledby', $html );
		$this->assertStringNotContainsString( 'id="dialog-guide-title"', $html );
	}

	public function test_a_close_button_inside_is_aimed_at_its_dialog(): void {
		$html = Dialogs::dialog( '<dialog class="bl-dialog" id="dialog-offer"><button type="button" command="close">No thanks</button><button type="button" command="close" commandfor="dialog-other">Other</button></dialog>' );

		$this->assertMatchesRegularExpression( '/<button(?=[^>]*commandfor="dialog-offer")[^>]*>No thanks/', $html );
		$this->assertMatchesRegularExpression( '/<button(?=[^>]*commandfor="dialog-other")[^>]*>Other/', $html );
	}

	public function test_the_page_reports_dialogs_it_opens_but_does_not_hold(): void {
		$this->assertTrue( Dialogs::openers( '<button type="button" commandfor="dialog-newsletter" command="show-modal">Join</button>' ) );
		$this->assertTrue( Dialogs::openers( '<p><a href="#dialog-guide">Sizes</a></p>' ) );
		$this->assertFalse( Dialogs::openers( '<p><a href="#top">Top</a> <button commandfor="x" command="close">x</button></p>' ) );
		Dialogs::dialog( '<dialog class="bl-dialog" id="dialog-guide"></dialog>' );

		$this->assertSame( [ 'dialog-newsletter' ], Dialogs::missing() );
	}

	public function test_a_dialog_is_given_the_dialog_behaviour(): void {
		$html = Dialogs::dialog( '<dialog class="bl-dialog" id="dialog-guide"></dialog>' );

		$this->assertStringContainsString( 'data-wp-interactive="blicks/dialog"', $html );
		$this->assertStringContainsString( 'data-wp-on-document--click="actions.click"', $html );
		$this->assertSame( [ 'dialog' ], Behaviours::used( $html ) );
	}

	public function test_saved_dialog_markup_survives_kses_and_renders_as_a_region(): void {
		$markup = '<!-- wp:blicks/dialog {"anchor":"guide"} --><dialog class="bl-dialog bl-dialog--modal is-modal" id="dialog-guide" closedby="any"><button type="button" class="bl-dialog__close" commandfor="dialog-guide" command="close" aria-label="Close" autofocus></button></dialog><!-- /wp:blicks/dialog -->';

		// Compared as tokens, not as a string: newer cores re-serialize attributes in their own
		// order (WordPress 7.2 sorts them), which is harmless. What must survive is every tag and
		// every attribute with its value, commandfor, command and closedby included.
		$expected = self::tokens( $markup );

		$this->assertCount( 6, $expected, 'Both block comments, both tags and both closers.' );
		$this->assertSame( $expected, self::tokens( wp_kses_post( $markup ) ) );

		$html = do_blocks( $markup );

		$this->assertStringContainsString( 'closedby="any"', $html );
		$this->assertStringContainsString( 'data-wp-interactive="blicks/dialog"', $html );
	}

	public function test_a_loop_with_a_dialog_gives_each_card_its_item_and_prints_the_dialog_once(): void {
		$bind = '"metadata":{"bindings":{"content":{"source":"blicks/item","args":{"key":"title"}}}}';
		$markup = '<!-- wp:blicks/loop {"source":"json","data":"[{\\"title\\":\\"Alpha\\"},{\\"title\\":\\"Beta\\"}]"} -->'
			. '<!-- wp:blicks/heading {"content":"Title",' . $bind . '} --><h3 class="bl-heading">Title</h3><!-- /wp:blicks/heading -->'
			. '<!-- wp:blicks/dialog {"anchor":"item-preview"} --><dialog class="bl-dialog bl-dialog--modal is-modal" id="dialog-item-preview" closedby="any">'
			. '<!-- wp:blicks/heading {"content":"Title","level":2,' . $bind . '} --><h2 class="bl-heading">Title</h2><!-- /wp:blicks/heading -->'
			. '</dialog><!-- /wp:blicks/dialog -->'
			. '<!-- /wp:blicks/loop -->';

		$html = do_blocks( $markup );

		$this->assertSame( 2, substr_count( $html, 'data-bl-dialog="dialog-item-preview"' ) );
		$this->assertSame( 1, substr_count( $html, '<dialog' ), 'one dialog for the whole Loop' );
		$this->assertMatchesRegularExpression( '#<template class="bl-loop__dialog">.*Alpha.*</template>#s', $html );
		$this->assertMatchesRegularExpression( '#<template class="bl-loop__dialog">.*Beta.*</template>#s', $html );
		$this->assertStringContainsString( 'data-wp-interactive="blicks/dialog"', $html );
		$this->assertDoesNotMatchRegularExpression( '#<dialog[^>]*>.*Alpha.*</dialog>#s', $html, 'the dialog itself holds no item' );
	}

	public function test_a_loop_that_puts_the_item_in_the_address_names_each_card(): void {
		$markup = '<!-- wp:blicks/loop {"source":"json","itemInUrl":true,"data":"[{\\"title\\":\\"Alpha\\",\\"slug\\":\\"alpha-lamp\\"},{\\"title\\":\\"Beta\\",\\"id\\":42},{\\"title\\":\\"Gamma\\"}]"} -->'
			. '<!-- wp:blicks/heading {"content":"Title"} --><h3 class="bl-heading">Title</h3><!-- /wp:blicks/heading -->'
			. '<!-- wp:blicks/dialog {"anchor":"item-preview"} --><dialog class="bl-dialog bl-dialog--modal is-modal" id="dialog-item-preview" closedby="any"></dialog><!-- /wp:blicks/dialog -->'
			. '<!-- /wp:blicks/loop -->';

		$html = do_blocks( $markup );

		$this->assertStringContainsString( 'data-bl-item="alpha-lamp"', $html, 'by its slug' );
		$this->assertStringContainsString( 'data-bl-item="42"', $html, 'else by its id' );
		$this->assertStringContainsString( 'data-bl-item="3"', $html, 'else by its place' );
		$this->assertStringContainsString( 'data-wp-on-window--popstate="callbacks.moved"', $html );
	}

	public function test_card_rules_reach_the_item_dialog_and_its_links_are_the_items_url(): void {
		$rules = '[{"when":{"field":"title","op":"is","value":"Alpha"},"then":[{"badge":"brand"},{"hide":"pill"}]}]';
		$markup = '<!-- wp:blicks/loop {"source":"json","rules":' . $rules . ',"data":"[{\\"title\\":\\"Alpha\\",\\"url\\":\\"https://example.org/alpha/?a=1&b=2\\"},{\\"title\\":\\"Beta\\"}]"} -->'
			. '<!-- wp:blicks/heading {"content":"Title"} --><h3 class="bl-heading">Title</h3><!-- /wp:blicks/heading -->'
			. '<!-- wp:blicks/dialog {"anchor":"item-preview"} --><dialog class="bl-dialog bl-dialog--modal is-modal" id="dialog-item-preview" closedby="any">'
			. '<!-- wp:blicks/heading {"content":"Pill","uniqueId":"pill"} --><h3 class="bl-heading">Pill</h3><!-- /wp:blicks/heading -->'
			. '</dialog><!-- /wp:blicks/dialog -->'
			. '<!-- /wp:blicks/loop -->';

		$html = do_blocks( $markup );
		preg_match_all( '#<template class="bl-loop__dialog"([^>]*)>(.*?)</template>#s', $html, $templates );

		$this->assertCount( 2, $templates[0] );
		$this->assertSame( ' data-rules="is-badge-brand"', $templates[1][0], 'the badge colour carries over' );
		$this->assertStringNotContainsString( 'Pill', $templates[2][0], 'a block the rule hides is hidden in the dialog too' );
		$this->assertSame( '', $templates[1][1] );
		$this->assertStringContainsString( 'Pill', $templates[2][1] );
		$this->assertStringContainsString( 'data-bl-url="https://example.org/alpha/?a=1&#038;b=2"', $html );
		$this->assertSame( 1, substr_count( $html, 'data-bl-url=' ), 'an item without a url names none' );
	}

	public function test_a_loop_keeps_items_out_of_the_address_unless_asked(): void {
		$markup = '<!-- wp:blicks/loop {"source":"json","data":"[{\\"title\\":\\"Alpha\\"}]"} -->'
			. '<!-- wp:blicks/heading {"content":"Title"} --><h3 class="bl-heading">Title</h3><!-- /wp:blicks/heading -->'
			. '<!-- wp:blicks/dialog {"anchor":"item-preview"} --><dialog class="bl-dialog bl-dialog--modal is-modal" id="dialog-item-preview" closedby="any"></dialog><!-- /wp:blicks/dialog -->'
			. '<!-- /wp:blicks/loop -->';

		$this->assertStringNotContainsString( 'data-bl-item', do_blocks( $markup ) );
	}

	public function test_a_dialog_that_does_not_block_the_page_is_a_popover_clicks_on_the_page_leave_open(): void {
		$notice = Dialogs::dialog( '<dialog class="bl-dialog bl-dialog--modal" id="dialog-notice" closedby="any"></dialog>' );
		$this->assertStringContainsString( 'popover="manual"', $notice );
		$this->assertStringContainsString( 'closedby="closerequest"', $notice, 'a click on the page does not close it' );
		$guide = Dialogs::dialog( '<dialog class="bl-dialog bl-dialog--modal is-modal" id="dialog-guide" closedby="any"></dialog>' );
		$this->assertStringNotContainsString( 'popover', $guide );
		$this->assertStringContainsString( 'closedby="any"', $guide );
	}

	/**
	 * The markup as a list of tokens, each tag with its attributes sorted by name, so two
	 * serializations of the same markup compare equal whatever order they write attributes in.
	 *
	 * @return list<array<string, mixed>>
	 */
	private static function tokens( string $html ): array {
		$processor = new WP_HTML_Tag_Processor( $html );
		$tokens    = [];

		while ( $processor->next_token() ) {
			$type = $processor->get_token_type();

			if ( '#tag' !== $type ) {
				$tokens[] = [ $type, $processor->get_modifiable_text() ];
				continue;
			}

			$attributes = [];

			foreach ( $processor->get_attribute_names_with_prefix( '' ) ?? [] as $name ) {
				$attributes[ $name ] = $processor->get_attribute( $name );
			}

			ksort( $attributes );
			$tokens[] = [ $processor->get_tag(), $processor->is_tag_closer(), $attributes ];
		}

		return $tokens;
	}
}
