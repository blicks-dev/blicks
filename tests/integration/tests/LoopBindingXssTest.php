<?php
/**
 * A Contributor's Loop, saved through kses and rendered, carries no event handler.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use WP_HTML_Tag_Processor;
use WP_UnitTestCase;

/**
 * Finding #1 of the 2026-11-11 Loop audit, end to end. The card templates are ordinary markup
 * kses lets through (`class="pic alt z"`), and the item values contain no `<`, so nothing on save
 * objects. The attack lived entirely in the render: a bound value written into the attribute
 * whose name appeared inside `class` closed that value early and became `onerror`.
 */
final class LoopBindingXssTest extends WP_UnitTestCase {

	private const ALT = 'x onerror=alert(document.domain) y';
	private const HREF = 'https://x.example/onmouseover=alert(document.domain)//';

	public function tear_down(): void {
		wp_set_current_user( 0 );
		kses_remove_filters();
		parent::tear_down();
	}

	private static function bind( string $attr, string $key ): string {
		return '"metadata":{"bindings":{"' . $attr . '":{"source":"blicks/item","args":{"key":"' . $key . '"}}}}';
	}

	/** The card: an image whose alt is bound, and a button whose link is. */
	private static function card(): string {
		return '<!-- wp:blicks/image {' . self::bind( 'alt', 'a' ) . '} -->'
			. '<figure class="bl-image"><img class="pic alt z" src="https://ok.example/a.png" alt=""/></figure>'
			. '<!-- /wp:blicks/image -->'
			. '<!-- wp:blicks/button {' . self::bind( 'url', 'u' ) . '} -->'
			. '<a class="bl-button href z" href="https://ok.example/"><span class="bl-button__label">Go</span></a>'
			. '<!-- /wp:blicks/button -->';
	}

	private static function loop( bool $withDialog ): string {
		$data = wp_json_encode( [ [ 'a' => self::ALT, 'u' => self::HREF ] ] );
		$dialog = ! $withDialog ? '' :
			'<!-- wp:blicks/dialog {"uniqueId":"ed223496","anchor":"pic"} -->'
			. '<dialog class="bl-dialog bl-ed223496" id="dialog-pic">' . self::card() . '</dialog>'
			. '<!-- /wp:blicks/dialog -->';

		return '<!-- wp:blicks/loop ' . wp_json_encode( [ 'source' => 'json', 'data' => $data ] ) . ' -->'
			. self::card() . $dialog
			. '<!-- /wp:blicks/loop -->';
	}

	/** Saved as a Contributor would save it: kses on, no unfiltered_html. */
	private function saveAsContributor( string $content ): string {
		$user = self::factory()->user->create( [ 'role' => 'contributor' ] );
		wp_set_current_user( $user );
		$this->assertFalse( current_user_can( 'unfiltered_html' ) );
		kses_init_filters();

		$id = wp_insert_post(
			[
				'post_author' => $user,
				'post_status' => 'pending',
				// Slashed, as a form or REST request delivers it: wp_insert_post() unslashes.
				'post_content' => wp_slash( $content ),
			]
		);
		$this->assertIsInt( $id );

		$saved = (string) get_post( $id )->post_content;
		$this->assertStringContainsString( 'x onerror=alert(document.domain) y', $saved, 'kses keeps the data' );
		$this->assertStringContainsString( 'class="pic alt z"', $saved, 'kses keeps the template' );
		$this->assertStringContainsString( 'class="bl-button href z"', $saved, 'kses keeps the template' );

		return $saved;
	}

	/** Every attribute name in the output, as the HTML5 tokenizer reads it, `<template>` included. */
	private static function attributeNames( string $html ): array {
		$names = [];
		$tags = new WP_HTML_Tag_Processor( $html );

		while ( $tags->next_tag() ) {
			$names[] = '<' . strtolower( (string) $tags->get_tag() );
			foreach ( $tags->get_attribute_names_with_prefix( '' ) ?? [] as $name ) {
				$names[] = $name;
			}
		}

		return $names;
	}

	private function assertNoEventHandler( string $html ): void {
		$names = self::attributeNames( $html );
		$this->assertNotEmpty( $names );

		foreach ( $names as $name ) {
			$this->assertStringStartsNotWith( 'on', $name, "event handler in: $html" );
		}
	}

	/** The bound values landed where they were meant to, as values. */
	private function assertBound( string $html, int $times ): void {
		$alts = 0;
		$hrefs = 0;
		$tags = new WP_HTML_Tag_Processor( $html );

		while ( $tags->next_tag() ) {
			if ( 'IMG' === $tags->get_tag() && $tags->has_class( 'pic' ) ) {
				$this->assertSame( 'pic alt z', $tags->get_attribute( 'class' ) );
				$this->assertSame( self::ALT, $tags->get_attribute( 'alt' ) );
				++$alts;
			}
			if ( 'A' === $tags->get_tag() && $tags->has_class( 'bl-button' ) ) {
				$this->assertSame( 'bl-button href z', $tags->get_attribute( 'class' ) );
				$this->assertSame( self::HREF, $tags->get_attribute( 'href' ) );
				++$hrefs;
			}
		}

		$this->assertSame( $times, $alts, "alt bindings in: $html" );
		$this->assertSame( $times, $hrefs, "href bindings in: $html" );
	}

	public function test_a_card_binding_cannot_become_an_event_handler(): void {
		$html = do_blocks( $this->saveAsContributor( self::loop( false ) ) );

		$this->assertNoEventHandler( $html );
		$this->assertBound( $html, 1 );
	}

	public function test_a_dialog_template_binding_cannot_become_an_event_handler(): void {
		$html = do_blocks( $this->saveAsContributor( self::loop( true ) ) );

		$this->assertStringContainsString( '<template class="bl-loop__dialog"', $html );
		$this->assertNoEventHandler( $html );
		$this->assertBound( $html, 2 ); // The card, and the same blocks in its dialog.
	}
}
