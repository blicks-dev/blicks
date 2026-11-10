<?php
/**
 * What a Field writes on the page: the markup the form behaviour and the server read.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Tests\Integration;

use Blicks\Forms\FieldRenderer;
use WP_UnitTestCase;

final class FieldRendererTest extends WP_UnitTestCase {

	/** @param array<string, mixed> $attrs */
	private function field( array $attrs ): string {
		return FieldRenderer::render( $attrs + [ 'uniqueId' => 'ab12cd34' ] );
	}

	public function test_a_short_text_field(): void {
		$html = $this->field(
			[
				'label' => 'Your name',
				'name' => 'name',
				'placeholder' => 'Jane',
				'help' => 'As on your card',
				'width' => 'half',
			]
		);

		$this->assertStringStartsWith( '<div class="bl-field bl-ab12cd34 bl-field--text bl-field--w-half"', $html );
		$this->assertStringContainsString( 'data-bl-field="name"', $html );
		$this->assertStringContainsString( 'data-bl-error="Fill in your name."', $html );
		$this->assertStringContainsString( '<label class="bl-field__label" for="blf-ab12cd34">Your name<span class="bl-field__opt"> (optional)</span></label>', $html );
		$this->assertStringContainsString( '<input class="bl-field__control" id="blf-ab12cd34" name="name" type="text" placeholder="Jane" autocomplete="name" aria-describedby="blf-ab12cd34-help">', $html );
		$this->assertStringContainsString( '<p class="bl-field__help" id="blf-ab12cd34-help">As on your card</p>', $html );
		$this->assertStringEndsWith( '<p class="bl-field__error" id="blf-ab12cd34-err" hidden></p></div>', $html );
	}

	public function test_a_required_field_has_no_optional_tag_and_no_help_reference_without_help(): void {
		$html = $this->field(
			[
				'type' => 'email',
				'label' => 'Email',
				'name' => 'email',
				'required' => true,
				'errorMessage' => 'We need it',
			]
		);

		$this->assertStringContainsString( 'bl-field--email bl-field--w-full is-required', $html );
		$this->assertStringContainsString( 'data-bl-error="We need it"', $html );
		$this->assertStringNotContainsString( 'bl-field__opt', $html );
		$this->assertStringNotContainsString( 'aria-describedby', $html );
		$this->assertStringNotContainsString( 'bl-field__help', $html );
		$this->assertStringContainsString( 'type="email" required autocomplete="email">', $html );
	}

	public function test_phone_and_number_hints(): void {
		$tel = $this->field(
			[
				'type' => 'tel',
				'label' => 'Phone',
				'name' => 'phone',
			]
		);
		$number = $this->field(
			[
				'type' => 'number',
				'label' => 'Guests',
				'name' => 'guests',
				'min' => '1',
				'max' => '12',
				'step' => 'nope',
			]
		);

		$this->assertStringContainsString( 'type="tel" autocomplete="tel" inputmode="tel">', $tel );
		$this->assertStringContainsString( 'type="number" inputmode="decimal" min="1" max="12">', $number );
	}

	public function test_a_date_bound_of_today_is_todays_date(): void {
		$html = $this->field(
			[
				'type' => 'date',
				'label' => 'Day',
				'name' => 'day',
				'min' => 'today',
				'max' => '2030-01-31',
			]
		);

		$this->assertStringContainsString( 'type="date" min="' . wp_date( 'Y-m-d' ) . '" max="2030-01-31">', $html );
	}

	public function test_a_textarea(): void {
		$html = $this->field(
			[
				'type' => 'textarea',
				'label' => 'Message',
				'name' => 'message',
				'required' => true,
			]
		);

		$this->assertStringContainsString( '<textarea class="bl-field__control" id="blf-ab12cd34" name="message" required rows="5"></textarea>', $html );
	}

	public function test_a_select_has_an_empty_first_option(): void {
		$html = $this->field(
			[
				'type' => 'select',
				'label' => 'Topic',
				'name' => 'topic',
				'options' => [ 'Sales', 'Support', 'Sales', '' ],
			]
		);
		$placeholder = $this->field(
			[
				'type' => 'select',
				'label' => 'Topic',
				'name' => 'topic',
				'placeholder' => 'Pick one',
				'options' => [ 'Sales' ],
			]
		);

		$this->assertStringContainsString( '<select class="bl-field__control" id="blf-ab12cd34" name="topic"><option value="">Choose one</option><option value="Sales">Sales</option><option value="Support">Support</option></select>', $html );
		$this->assertStringContainsString( '<option value="">Pick one</option>', $placeholder );
		$this->assertStringNotContainsString( 'placeholder=', $placeholder );
	}

	public function test_choices_are_a_fieldset_of_radios(): void {
		$html = $this->field(
			[
				'type' => 'choice',
				'label' => 'When',
				'name' => 'when',
				'required' => true,
				'help' => 'Your time',
				'options' => [ 'Morning', 'Evening' ],
			]
		);

		$this->assertStringStartsWith( '<fieldset class="bl-field bl-ab12cd34 bl-field--choice bl-field--w-full is-required"', $html );
		$this->assertStringContainsString( 'aria-describedby="blf-ab12cd34-help">', $html );
		$this->assertStringContainsString( '<legend class="bl-field__label">When</legend><div class="bl-field__choices">', $html );
		$this->assertStringContainsString( '<label class="bl-field__choice"><input type="radio" name="when" value="Morning" required><span class="bl-field__choice-text"><span class="bl-field__choice-label">Morning</span></span></label>', $html );
		$this->assertStringNotContainsString( 'bl-field--a-', $html );
		$this->assertStringEndsWith( '</fieldset>', $html );
	}

	public function test_several_answers_are_checkboxes_named_as_a_list(): void {
		$html = $this->field(
			[
				'type' => 'choice',
				'label' => 'Extras',
				'name' => 'extras',
				'multiple' => true,
				'required' => true,
				'options' => [ 'Tea' ],
			]
		);

		$this->assertStringContainsString( 'is-required is-multiple', $html );
		$this->assertStringContainsString( '<input type="checkbox" name="extras[]" value="Tea">', $html );
	}

	public function test_consent_is_a_box_with_its_sentence(): void {
		$html = $this->field(
			[
				'type' => 'consent',
				'label' => 'I agree',
				'name' => 'consent',
				'required' => true,
				'width' => 'half',
			]
		);

		$this->assertStringStartsWith( '<div class="bl-field bl-ab12cd34 bl-field--consent bl-field--w-full is-required"', $html );
		$this->assertStringContainsString( '<label class="bl-field__choice" for="blf-ab12cd34"><input type="checkbox" id="blf-ab12cd34" name="consent" value="yes" required> <span>I agree</span></label>', $html );
		$this->assertStringNotContainsString( 'bl-field__opt', $html );
	}

	public function test_hidden_fields_resolve_page_facts_and_leave_browser_facts_to_the_page(): void {
		$post = self::factory()->post->create( [ 'post_title' => 'Spring offer' ] );
		$GLOBALS['post'] = get_post( $post );
		setup_postdata( $GLOBALS['post'] );

		$title = $this->field(
			[
				'type' => 'hidden',
				'name' => 'page_title',
				'defaultValue' => '{title}',
				'required' => true,
			]
		);
		$page = $this->field(
			[
				'type' => 'hidden',
				'name' => 'page_id',
				'defaultValue' => '{page}',
			]
		);
		$url = $this->field(
			[
				'type' => 'hidden',
				'name' => 'source',
				'defaultValue' => '{url}',
			]
		);
		$utm = $this->field(
			[
				'type' => 'hidden',
				'name' => 'campaign',
				'defaultValue' => '{utm_campaign}',
			]
		);
		$literal = $this->field(
			[
				'type' => 'hidden',
				'name' => 'list',
				'defaultValue' => 'spring',
			]
		);

		wp_reset_postdata();

		$this->assertSame( '<input type="hidden" class="bl-field bl-field--hidden" name="page_title" value="Spring offer" data-bl-field="page_title">', $title );
		$this->assertStringContainsString( 'value="' . esc_attr( (string) wp_parse_url( get_permalink( $post ), PHP_URL_PATH ) ) . '"', $page );
		$this->assertStringContainsString( 'value="' . esc_attr( (string) get_permalink( $post ) ) . '"', $url );
		$this->assertSame( '<input type="hidden" class="bl-field bl-field--hidden" name="campaign" value="" data-bl-field="campaign" data-bl-fill="utm_campaign">', $utm );
		$this->assertStringContainsString( 'value="spring"', $literal );
	}

	public function test_hostile_text_is_escaped(): void {
		$html = $this->field(
			[
				'type' => 'select',
				'label' => 'Pick "this" <b>now</b> & then',
				'name' => 'pick',
				'help' => '<script>alert(1)</script>',
				'errorMessage' => '" onmouseover="x',
				'options' => [ '"><img src=x onerror=alert(1)>', 'A & B' ],
			]
		);

		$this->assertStringNotContainsString( '<script', $html );
		$this->assertStringNotContainsString( '<img', $html );
		$this->assertStringNotContainsString( '<b>', $html );
		$this->assertStringNotContainsString( '" onmouseover', $html );
		$this->assertStringContainsString( '<option value="A &amp; B">A &amp; B</option>', $html );
	}

	public function test_a_field_without_a_usable_name_writes_nothing(): void {
		$this->assertSame( '', $this->field( [ 'label' => 'Name' ] ) );
		$this->assertSame( '', $this->field( [ 'label' => 'Name', 'name' => 'Bad Name' ] ) );
		$this->assertSame( '', $this->field( [ 'label' => 'Post', 'name' => 'post' ] ) );
		$this->assertSame( '', $this->field( [ 'type' => 'hidden', 'name' => '' ] ) );
	}

	public function test_a_field_without_a_uid_still_pairs_its_label_and_control(): void {
		$html = FieldRenderer::render(
			[
				'label' => 'City',
				'name' => 'city',
			]
		);

		$this->assertSame( 1, preg_match( '/for="(blf-[a-z0-9]+)"/', $html, $m ) );
		$this->assertStringContainsString( 'id="' . $m[1] . '"', $html );
		$this->assertStringContainsString( 'id="' . $m[1] . '-err"', $html );
	}

	public function test_rendered_as_a_block_it_writes_the_same_field(): void {
		if ( ! \WP_Block_Type_Registry::get_instance()->is_registered( 'blicks/field' ) ) {
			$this->markTestSkipped( 'blicks/field is not registered (no build).' );
		}

		$html = render_block(
			[
				'blockName' => 'blicks/field',
				'attrs' => [
					'uniqueId' => 'ff00aa11',
					'label' => 'Email',
					'name' => 'email',
					'type' => 'email',
				],
				'innerBlocks' => [],
				'innerHTML' => '',
				'innerContent' => [],
			]
		);

		$this->assertMatchesRegularExpression( '/^<div class="bl-field bl-ff00aa11 bl-field--email bl-field--w-full[^"]*" data-bl-field="email"/', $html );
		$this->assertStringContainsString( '<input class="bl-field__control" id="blf-ff00aa11" name="email" type="email" autocomplete="email">', $html );
	}

	/* ------------------------------------------------------------------------------------------ */
	/* A Field made of blocks: label and help Texts, an Input                                       */
	/* ------------------------------------------------------------------------------------------ */

	/** @param array<string, mixed> $attrs */
	private static function comment( string $name, array $attrs, ?string $inner = null ): string {
		$open = '<!-- wp:' . $name . ' ' . wp_json_encode( $attrs, JSON_UNESCAPED_SLASHES );

		return null === $inner ? $open . ' /-->' : $open . ' -->' . $inner . '<!-- /wp:' . $name . ' -->';
	}

	private static function labelText( string $text, string $uid = 't1', string $class = '' ): string {
		return self::comment(
			'blicks/text',
			[ 'uniqueId' => $uid, 'content' => $text, 'metadata' => [ 'name' => 'Label', 'blicksRole' => 'label' ] ],
			'<p class="bl-text bl-' . $uid . ( '' !== $class ? ' ' . $class : '' ) . '">' . $text . '</p>'
		);
	}

	private static function helpText( string $text ): string {
		return self::comment(
			'blicks/text',
			[ 'uniqueId' => 'h1', 'content' => $text, 'metadata' => [ 'name' => 'Help', 'blicksRole' => 'help' ] ],
			'<p class="bl-text bl-h1">' . $text . '</p>'
		);
	}

	/** @param array<string, mixed> $attrs */
	private static function input( array $attrs = [] ): string {
		return self::comment( 'blicks/input', $attrs + [ 'uniqueId' => 'i1', 'lock' => [ 'remove' => true ] ] );
	}

	/** @param array<string, mixed> $attrs */
	private function composed( array $attrs, string $inner ): string {
		if ( ! \WP_Block_Type_Registry::get_instance()->is_registered( 'blicks/input' ) ) {
			$this->markTestSkipped( 'blicks/input is not registered (no build).' );
		}

		return trim( do_blocks( self::comment( 'blicks/field', $attrs + [ 'uniqueId' => 'ab12cd34' ], $inner ) ) );
	}

	public function test_a_label_text_becomes_the_label_of_the_input(): void {
		$html = $this->composed(
			[ 'label' => 'Your name', 'name' => 'name', 'placeholder' => 'Jane', 'width' => 'half' ],
			self::labelText( 'Your name', 't1', 'bl-text--lead' ) . self::input()
		);

		$this->assertStringStartsWith( '<div class="bl-field bl-ab12cd34 bl-field--text bl-field--w-half bl-field--blocks"', $html );
		$this->assertStringContainsString( 'data-bl-field="name"', $html );
		// The Text's own classes stay, and the element is now a label for the control.
		$this->assertStringContainsString( '<label for="blf-ab12cd34" class="bl-text bl-t1 bl-text--lead bl-field__label">Your name<span class="bl-field__opt"> (optional)</span></label>', $html );
		$this->assertStringContainsString( '<input class="bl-input bl-i1 bl-field__control" id="blf-ab12cd34" name="name" type="text" placeholder="Jane" autocomplete="name">', $html );
		$this->assertStringNotContainsString( '<p class="bl-text', $html );
		$this->assertStringNotContainsString( 'aria-label', $html );
		$this->assertStringEndsWith( '<p class="bl-field__error" id="blf-ab12cd34-err" hidden></p></div>', $html );
	}

	public function test_a_help_text_is_the_description_of_the_control(): void {
		$html = $this->composed(
			[ 'type' => 'email', 'label' => 'Email', 'name' => 'email', 'required' => true ],
			self::labelText( 'Email' ) . self::input() . self::helpText( 'We reply in a day' )
		);

		$this->assertStringContainsString( '<label for="blf-ab12cd34" class="bl-text bl-t1 bl-field__label">Email</label>', $html );
		$this->assertStringContainsString( '<input aria-describedby="blf-ab12cd34-help" class="bl-input bl-i1 bl-field__control" id="blf-ab12cd34" name="email" type="email" required autocomplete="email">', $html );
		$this->assertStringContainsString( '<p id="blf-ab12cd34-help" class="bl-text bl-h1 bl-field__help">We reply in a day</p>', $html );
		$this->assertLessThan( strpos( $html, 'bl-field__help' ), strpos( $html, '<input' ) );
	}

	public function test_without_a_label_text_the_control_is_named_by_aria_label(): void {
		$html = $this->composed( [ 'label' => 'Your town', 'name' => 'town' ], self::input() );

		$this->assertStringNotContainsString( '<label', $html );
		$this->assertStringContainsString( '<input aria-label="Your town" class="bl-input bl-i1 bl-field__control" id="blf-ab12cd34" name="town" type="text">', $html );
	}

	public function test_an_empty_label_text_is_dropped_for_aria_label(): void {
		$html = $this->composed( [ 'label' => 'Town', 'name' => 'town' ], self::labelText( '' ) . self::input() );

		$this->assertStringNotContainsString( 'bl-field__label', $html );
		$this->assertStringContainsString( 'aria-label="Town"', $html );
	}

	public function test_choices_take_the_label_text_as_the_first_legend(): void {
		$html = $this->composed(
			[ 'type' => 'choice', 'label' => 'When', 'name' => 'when', 'required' => true, 'options' => [ 'Morning', 'Evening' ] ],
			// The author put the label after the choices; a legend is still the fieldset's first child.
			self::input() . self::labelText( 'When' ) . self::helpText( 'Your time' )
		);

		$this->assertMatchesRegularExpression( '/^<fieldset class="bl-field bl-ab12cd34 bl-field--choice bl-field--w-full is-required bl-field--blocks"[^>]*><legend class="bl-text bl-t1 bl-field__label">When<\/legend><div class="bl-field__choices">/', $html );
		$this->assertStringContainsString( 'aria-describedby="blf-ab12cd34-help"', $html );
		// The Input's style tree styles each option, not the row.
		$this->assertStringContainsString( '<label class="bl-input bl-i1 bl-field__choice"><input type="radio" name="when" value="Morning" required><span class="bl-field__choice-text"><span class="bl-field__choice-label">Morning</span></span></label>', $html );
		$this->assertStringNotContainsString( ' for=', $html );
		$this->assertStringNotContainsString( 'aria-label', $html );
	}

	public function test_choices_without_a_label_text_name_the_group(): void {
		$html = $this->composed(
			[ 'type' => 'choice', 'label' => 'When', 'name' => 'when', 'options' => [ 'Morning' ] ],
			self::input()
		);

		$this->assertStringNotContainsString( '<legend', $html );
		$this->assertMatchesRegularExpression( '/^<fieldset [^>]*aria-label="When"/', $html );
	}

	public function test_consent_is_its_box_then_its_sentence(): void {
		$html = $this->composed(
			[ 'type' => 'consent', 'label' => 'I agree', 'name' => 'consent', 'required' => true ],
			self::input() . self::labelText( 'I agree' )
		);

		$this->assertStringContainsString( '<input class="bl-input bl-i1 bl-field__check" type="checkbox" id="blf-ab12cd34" name="consent" value="yes" required><label for="blf-ab12cd34" class="bl-text bl-t1 bl-field__label">I agree</label>', $html );
		$this->assertStringNotContainsString( 'bl-field__opt', $html );
	}

	public function test_the_input_carries_its_own_style_classes_on_the_control(): void {
		$blicks = [ 'colors.background' => [ 'default' => [ 'base' => 'primary' ] ] ];
		$props = \Blicks\Style\ElementStyle::blockProps( $blicks, 'i9', 'input' );
		$html = $this->composed(
			[ 'type' => 'textarea', 'label' => 'Message', 'name' => 'message' ],
			self::labelText( 'Message' ) . self::input( [ 'uniqueId' => 'i9', 'blicks' => $blicks ] )
		);

		$this->assertNotSame( 'bl-input bl-i9', $props['class'] );
		$this->assertStringContainsString( '<textarea class="' . $props['class'] . ' bl-field__control"', $html );
		$this->assertMatchesRegularExpression( '/<textarea class="[^"]+"( style="[^"]*")? id="blf-ab12cd34" name="message" rows="5"><\/textarea>/', $html );
	}

	public function test_hostile_text_in_a_composed_field_stays_escaped(): void {
		$html = $this->composed(
			[ 'label' => '"><b>x', 'name' => 'x', 'placeholder' => '"><script>alert(1)</script>' ],
			self::input()
		);

		$this->assertStringNotContainsString( '<script>', $html );
		$this->assertStringContainsString( 'placeholder="&quot;&gt;"', $html );
		$this->assertStringContainsString( 'aria-label="&quot;&gt;x"', $html );
	}

	public function test_an_input_reads_its_field_from_context(): void {
		$html = $this->composed(
			[ 'type' => 'select', 'label' => 'Topic', 'name' => 'topic', 'options' => [ 'Sales' ], 'placeholder' => 'Pick one' ],
			self::labelText( 'Topic' ) . self::input()
		);

		$this->assertStringContainsString( '<select class="bl-input bl-i1 bl-field__control" id="blf-ab12cd34" name="topic"><option value="">Pick one</option><option value="Sales">Sales</option></select>', $html );
	}

	/* ------------------------------------------------------------------------------------------ */
	/* Round 3: time, range, length, appearances, icons, markers                                  */
	/* ------------------------------------------------------------------------------------------ */

	/** @param array<string, mixed> $attrs */
	private static function form( array $attrs, string $inner ): string {
		return self::comment( 'blicks/form', $attrs + [ 'uniqueId' => 'ff00ff00' ], $inner );
	}

	public function test_a_time_field_takes_hh_mm_bounds(): void {
		$html = $this->field( [ 'type' => 'time', 'label' => 'At', 'name' => 'at', 'min' => '09:00', 'max' => '25:00', 'step' => '900', 'placeholder' => 'x' ] );

		$this->assertStringContainsString( '<input class="bl-field__control" id="blf-ab12cd34" name="at" type="time" min="09:00" step="900">', $html );
		$this->assertStringContainsString( 'bl-field--time', $html );
	}

	public function test_a_range_starts_in_the_middle_and_writes_its_value_and_bounds(): void {
		$html = $this->field( [ 'type' => 'range', 'label' => 'Budget', 'name' => 'budget', 'min' => '150', 'max' => '1500', 'step' => '50', 'prefix' => '£', 'suffix' => '+' ] );

		$this->assertStringContainsString( '<div class="bl-range"><input class="bl-field__control" id="blf-ab12cd34" name="budget" type="range" min="150" max="1500" step="50" value="850" aria-valuetext="£850+">', $html );
		$this->assertStringContainsString( '<output class="bl-range__value" for="blf-ab12cd34" data-bl-prefix="£" data-bl-suffix="+">£850+</output><span class="bl-range__min">£150+</span><span class="bl-range__max">£1,500+</span></div>', $html );
	}

	public function test_a_range_without_bounds_runs_0_to_100_and_takes_its_default(): void {
		$plain = $this->field( [ 'type' => 'range', 'label' => 'Score', 'name' => 'score' ] );
		$set = $this->field( [ 'type' => 'range', 'label' => 'Score', 'name' => 'score', 'defaultValue' => '400' ] );

		$this->assertStringContainsString( 'type="range" min="0" max="100" value="50" aria-valuetext="50">', $plain );
		$this->assertStringContainsString( '<output class="bl-range__value" for="blf-ab12cd34">50</output>', $plain );
		// A start value past the top is held at the top.
		$this->assertStringContainsString( 'value="100" aria-valuetext="100"', $set );
	}

	public function test_a_range_prefix_and_suffix_are_escaped(): void {
		$html = $this->field( [ 'type' => 'range', 'label' => 'B', 'name' => 'b', 'prefix' => '"><script>x</script>', 'suffix' => '<b>' ] );

		$this->assertStringNotContainsString( '<script>', $html );
		$this->assertStringNotContainsString( '<b>', $html );
		$this->assertStringContainsString( 'data-bl-prefix="&quot;&gt;"', $html );
	}

	public function test_a_max_length_is_written_and_a_textarea_counts_it(): void {
		$text = $this->field( [ 'label' => 'Name', 'name' => 'n', 'maxLength' => '40' ] );
		$area = $this->field( [ 'type' => 'textarea', 'label' => 'Message', 'name' => 'm', 'maxLength' => '400', 'help' => 'Keep it short' ] );
		$number = $this->field( [ 'type' => 'number', 'label' => 'N', 'name' => 'k', 'maxLength' => '4' ] );

		$this->assertStringContainsString( 'type="text" maxlength="40">', $text );
		$this->assertStringNotContainsString( 'bl-field__count', $text );
		$this->assertStringContainsString( '<textarea class="bl-field__control" id="blf-ab12cd34" name="m" maxlength="400" aria-describedby="blf-ab12cd34-help blf-ab12cd34-count" rows="5"></textarea><p class="bl-field__count" id="blf-ab12cd34-count"><span class="bl-field__count-n">0</span> / 400</p><p class="bl-field__help"', $area );
		$this->assertStringNotContainsString( 'maxlength', $number );
	}

	public function test_a_number_stepper_has_two_buttons_around_the_control(): void {
		$html = $this->field( [ 'type' => 'number', 'label' => 'Guests', 'name' => 'guests', 'appearance' => 'stepper', 'min' => '1' ] );

		$this->assertStringContainsString( 'bl-field--number bl-field--w-full bl-field--a-stepper', $html );
		$this->assertStringContainsString( '<span class="bl-stepper"><button type="button" class="bl-stepper__btn" data-bl-step="-1" aria-label="Decrease" aria-controls="blf-ab12cd34">&minus;</button><input class="bl-field__control" id="blf-ab12cd34" name="guests" type="number" inputmode="decimal" min="1"><button type="button" class="bl-stepper__btn" data-bl-step="1" aria-label="Increase" aria-controls="blf-ab12cd34">+</button></span>', $html );
	}

	public function test_choice_appearance_and_option_notes(): void {
		$html = $this->field(
			[
				'type' => 'choice',
				'label' => 'Session',
				'name' => 'session',
				'appearance' => 'cards',
				'options' => [ 'Portrait', 'Family' ],
				'optionNotes' => [ 'Headshots <b>£90</b>', '' ],
			]
		);

		$this->assertStringStartsWith( '<fieldset class="bl-field bl-ab12cd34 bl-field--choice bl-field--w-full bl-field--a-cards"', $html );
		$this->assertStringContainsString( '<span class="bl-field__choice-label">Portrait</span><span class="bl-field__choice-note">Headshots £90</span></span></label>', $html );
		$this->assertStringContainsString( '<span class="bl-field__choice-label">Family</span></span></label>', $html );
		$this->assertSame( 1, substr_count( $html, 'bl-field__choice-note' ) );
	}

	public function test_a_note_is_escaped(): void {
		$html = $this->field( [ 'type' => 'choice', 'label' => 'S', 'name' => 's', 'options' => [ 'A' ], 'optionNotes' => [ '"> & <' ] ] );

		$this->assertStringContainsString( '<span class="bl-field__choice-note">&quot;&gt; &amp; &lt;</span>', $html );
	}

	public function test_a_consent_switch_is_a_switch(): void {
		$html = $this->field( [ 'type' => 'consent', 'label' => 'Send me news', 'name' => 'news', 'appearance' => 'switch' ] );

		$this->assertStringContainsString( 'bl-field--consent bl-field--w-full bl-field--a-switch', $html );
		$this->assertStringContainsString( 'value="yes" role="switch">', $html );
	}

	public function test_the_composed_input_styles_each_option_and_writes_notes(): void {
		$html = $this->composed(
			[ 'type' => 'choice', 'label' => 'Size', 'name' => 'size', 'appearance' => 'chips', 'options' => [ 'S', 'M' ], 'optionNotes' => [ 'Small', 'Medium' ] ],
			self::labelText( 'Size' ) . self::input()
		);

		$this->assertStringContainsString( 'bl-field--a-chips', $html );
		$this->assertStringContainsString( '<div class="bl-field__choices"><label class="bl-input bl-i1 bl-field__choice"><input type="radio" name="size" value="S"><span class="bl-field__choice-text"><span class="bl-field__choice-label">S</span><span class="bl-field__choice-note">Small</span></span></label>', $html );
		$this->assertSame( 2, substr_count( $html, 'class="bl-input bl-i1 bl-field__choice"' ) );
	}

	public function test_an_input_icon_wraps_the_control(): void {
		$html = $this->composed( [ 'type' => 'email', 'label' => 'Email', 'name' => 'email' ], self::labelText( 'Email' ) . self::input( [ 'icon' => 'mail' ] ) );

		$this->assertMatchesRegularExpression( '/<span class="bl-input-wrap has-icon"><svg [^>]*class="bl-input__icon"[^>]*>.*<\/svg><input [^>]*id="blf-ab12cd34"[^>]*type="email"[^>]*><\/span>/s', $html );
		$this->assertMatchesRegularExpression( '/<svg [^>]*aria-hidden="true"/', $html );
	}

	public function test_an_unknown_icon_or_a_textarea_draws_no_icon(): void {
		$unknown = $this->composed( [ 'label' => 'Name', 'name' => 'n' ], self::input( [ 'icon' => 'no-such-icon-x' ] ) );
		$area = $this->composed( [ 'type' => 'textarea', 'label' => 'M', 'name' => 'm' ], self::input( [ 'icon' => 'mail' ] ) );

		$this->assertStringNotContainsString( 'bl-input-wrap', $unknown );
		$this->assertStringNotContainsString( '<svg', $unknown );
		$this->assertStringNotContainsString( 'bl-input-wrap', $area );
	}

	public function test_a_composed_textarea_points_to_its_help_and_counter(): void {
		$html = $this->composed(
			[ 'type' => 'textarea', 'label' => 'Message', 'name' => 'm', 'maxLength' => '300' ],
			self::labelText( 'Message' ) . self::input() . self::helpText( 'Short' )
		);

		$this->assertStringContainsString( 'aria-describedby="blf-ab12cd34-help blf-ab12cd34-count"', $html );
		$this->assertStringContainsString( '<p class="bl-field__count" id="blf-ab12cd34-count"><span class="bl-field__count-n">0</span> / 300</p>', $html );
	}

	public function test_a_composed_range_reads_prefix_and_suffix_from_context(): void {
		$html = $this->composed( [ 'type' => 'range', 'label' => 'B', 'name' => 'b', 'min' => '0', 'max' => '10', 'defaultValue' => '4', 'prefix' => '$' ], self::labelText( 'B' ) . self::input() );

		$this->assertStringContainsString( 'type="range" min="0" max="10" value="4" aria-valuetext="$4">', $html );
		$this->assertStringContainsString( 'data-bl-prefix="$">$4</output>', $html );
		$this->assertStringNotContainsString( 'data-bl-suffix', $html );
	}

	public function test_the_default_marker_is_todays_markup(): void {
		$html = trim( do_blocks( self::form( [], self::comment( 'blicks/field', [ 'uniqueId' => 'ab12cd34', 'label' => 'Name', 'name' => 'name' ] ) ) ) );

		$this->assertStringContainsString( 'Name<span class="bl-field__opt"> (optional)</span></label>', $html );
		$this->assertStringNotContainsString( 'bl-field--marker-', $html );
	}

	public function test_the_required_marker_stars_required_labels_only(): void {
		$fields = self::comment( 'blicks/field', [ 'uniqueId' => 'a1', 'label' => 'Name', 'name' => 'name', 'required' => true ] )
			. self::comment( 'blicks/field', [ 'uniqueId' => 'a2', 'label' => 'Town', 'name' => 'town' ] )
			. self::comment( 'blicks/field', [ 'uniqueId' => 'a3', 'type' => 'consent', 'label' => 'I agree', 'name' => 'ok', 'required' => true ] );
		$html = do_blocks( self::form( [ 'marker' => 'required' ], $fields ) );

		$this->assertStringContainsString( 'bl-field--marker-required', $html );
		$this->assertStringContainsString( 'Name<span class="bl-field__req" aria-hidden="true">*</span></label>', $html );
		$this->assertStringContainsString( '>Town</label>', $html );
		$this->assertStringContainsString( '<span>I agree</span></label>', $html );
		$this->assertStringNotContainsString( 'bl-field__opt', $html );
	}

	public function test_both_markers_and_none(): void {
		$fields = self::comment( 'blicks/field', [ 'uniqueId' => 'a1', 'label' => 'Name', 'name' => 'name', 'required' => true ] )
			. self::comment( 'blicks/field', [ 'uniqueId' => 'a2', 'type' => 'choice', 'label' => 'When', 'name' => 'when', 'options' => [ 'Now' ] ] );
		$both = do_blocks( self::form( [ 'marker' => 'both' ], $fields ) );
		$none = do_blocks( self::form( [ 'marker' => 'none' ], $fields ) );

		$this->assertStringContainsString( 'Name<span class="bl-field__req" aria-hidden="true">*</span></label>', $both );
		$this->assertStringContainsString( 'When<span class="bl-field__opt">Optional</span></legend>', $both );
		$this->assertStringContainsString( 'bl-field--marker-none', $none );
		$this->assertStringNotContainsString( 'bl-field__req', $none );
		$this->assertStringNotContainsString( 'bl-field__opt', $none );
	}

	public function test_a_composed_field_takes_the_form_marker(): void {
		$field = self::comment( 'blicks/field', [ 'uniqueId' => 'ab12cd34', 'label' => 'Email', 'name' => 'email', 'required' => true ], self::labelText( 'Email' ) . self::input() );
		$html = do_blocks( self::form( [ 'marker' => 'required' ], $field ) );

		$this->assertStringContainsString( 'bl-field--blocks bl-field--marker-required', $html );
		$this->assertStringContainsString( 'class="bl-text bl-t1 bl-field__label">Email<span class="bl-field__req" aria-hidden="true">*</span></label>', $html );
	}
}
