<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Ai;

use Blicks\Core\Plugin as BlicksPlugin;
use Blicks\Ai\Catalog\BlockCatalog;
use Blicks\Ai\Spec\BlockSpec;
use Blicks\Ai\Spec\SpecValidator;
use PHPUnit\Framework\TestCase;

/**
 * The validator. Most of these assert on the *message*, not just the failure: a caller that
 * cannot tell from the error what to write instead will guess, and guessing is what this whole
 * layer exists to stop.
 */
final class SpecValidatorTest extends TestCase
{
    protected function setUp(): void
    {
        BlicksPlugin::boot(dirname(__DIR__, 3) . '/blicks.php');
        BlockCatalog::reset();
    }

    /** @param array<string, mixed> $data */
    private function errors(array $data): array
    {
        return SpecValidator::validate(BlockSpec::fromArray($data));
    }

    /** @param array<string, mixed> $data */
    private function messages(array $data): string
    {
        return implode("\n", array_column($this->errors($data), 'message'));
    }

    // ── the happy path ──────────────────────────────────────────────────────────

    public function test_a_valid_spec_produces_no_errors(): void
    {
        $this->assertSame([], $this->errors([
            'name' => 'blicks/box',
            'attributes' => ['kind' => 'card'],
            'blicks' => [
                'spacing.padding' => ['default' => ['base' => ['top' => 'md', 'bottom' => 'md']]],
                'layout.gapRow' => ['default' => ['base' => 'lg', 'mobile' => 'sm']],
            ],
            'innerBlocks' => [
                ['name' => 'blicks/heading', 'attributes' => ['level' => 2]],
            ],
        ]));
    }

    public function test_a_literal_css_length_is_as_valid_as_a_token(): void
    {
        $this->assertSame([], $this->errors([
            'name' => 'blicks/box',
            'blicks' => ['layout.gapRow' => ['default' => ['base' => '12px']]],
        ]));
    }

    public function test_a_bare_string_still_means_the_same_on_every_side(): void
    {
        $this->assertSame([], $this->errors([
            'name' => 'blicks/box',
            'blicks' => ['spacing.padding' => ['default' => ['base' => 'md']]],
        ]));
    }

    // ── the block ───────────────────────────────────────────────────────────────

    public function test_an_unknown_block_is_reported_with_the_ones_that_exist(): void
    {
        $messages = $this->messages(['name' => 'blicks/carousel']);

        $this->assertStringContainsString('"blicks/carousel" is not a Blicks block', $messages);
        $this->assertStringContainsString('blicks/box', $messages, 'the caller is shown what it can use');
    }

    public function test_a_missing_name_says_what_a_name_looks_like(): void
    {
        $this->assertStringContainsString('e.g. "blicks/box"', $this->messages([]));
    }

    public function test_an_unknown_block_stops_further_checking(): void
    {
        // Nothing can be said about attributes on a block that does not exist, and saying it
        // anyway buries the one error that matters.
        $this->assertCount(1, $this->errors([
            'name' => 'blicks/carousel',
            'attributes' => ['nonsense' => true],
            'blicks' => ['made.up' => []],
        ]));
    }

    // ── attributes ──────────────────────────────────────────────────────────────

    public function test_an_undeclared_attribute_is_reported_with_the_declared_ones(): void
    {
        $messages = $this->messages([
            'name' => 'blicks/box',
            'attributes' => ['columns' => 3],
        ]);

        $this->assertStringContainsString('has no attribute "columns"', $messages);
        $this->assertStringContainsString('kind', $messages);
    }

    public function test_an_option_outside_its_list_is_refused_rather_than_saved_as_the_fallback(): void
    {
        $messages = $this->messages([
            'name' => 'blicks/box',
            'attributes' => ['tag' => 'a'],
        ]);

        $this->assertStringContainsString('"a" is not a tag for blicks/box', $messages);
        $this->assertStringContainsString('span', $messages);
    }

    public function test_an_unknown_icon_is_refused_rather_than_drawn_as_the_fallback_star(): void
    {
        if (! \Blicks\Ai\Spec\Icons::available()) {
            $this->markTestSkipped('icon artifact not generated');
        }

        $this->assertStringContainsString(
            '"no-such-icon" is not an icon',
            $this->messages(['name' => 'blicks/icon', 'attributes' => ['icon' => 'no-such-icon']])
        );
        $this->assertSame([], $this->errors(['name' => 'blicks/icon', 'attributes' => ['icon' => 'star']]));
        $this->assertSame([], $this->errors(['name' => 'blicks/button', 'attributes' => ['text' => 'Go', 'icon' => '']]), 'no icon is fine');
    }

    public function test_a_button_holds_blocks_only_in_blocks_mode_and_only_inline_ones(): void
    {
        $this->assertStringContainsString('"content": "blocks"', $this->messages([
            'name' => 'blicks/button',
            'innerBlocks' => [['name' => 'blicks/text', 'attributes' => ['tag' => 'span']]],
        ]));

        $messages = $this->messages([
            'name' => 'blicks/button',
            'attributes' => ['content' => 'blocks', 'url' => '/x'],
            'innerBlocks' => [
                ['name' => 'blicks/heading'],
                ['name' => 'blicks/text', 'attributes' => ['tag' => 'p']],
                ['name' => 'blicks/box', 'attributes' => ['tag' => 'span', 'href' => '/y'], 'innerBlocks' => [['name' => 'blicks/text']]],
                ['name' => 'blicks/image', 'attributes' => ['url' => 'https://example.test/a.jpg']],
            ],
        ]);

        $this->assertStringContainsString('blicks/heading cannot go inside a Button', $messages);
        $this->assertStringContainsString('blicks/text needs "tag": "span"', $messages);
        $this->assertStringContainsString('cannot have its own link', $messages);
        $this->assertSame(2, substr_count($messages, 'needs "tag": "span"'), 'nested text is checked too');
        $this->assertStringContainsString('"inline": true', $messages);

        $this->assertSame([], $this->errors([
            'name' => 'blicks/button',
            'attributes' => ['content' => 'blocks'],
            'innerBlocks' => [
                ['name' => 'blicks/icon', 'attributes' => ['icon' => 'star']],
                ['name' => 'blicks/text', 'attributes' => ['tag' => 'span', 'content' => 'Go']],
            ],
        ]));
    }

    // ── control ids ─────────────────────────────────────────────────────────────

    public function test_an_invented_control_is_reported_with_its_real_siblings(): void
    {
        $messages = $this->messages([
            'name' => 'blicks/box',
            'blicks' => ['spacing.gap' => ['default' => ['base' => 'md']]],
        ]);

        $this->assertStringContainsString('"spacing.gap" is not a style control', $messages);
        $this->assertStringContainsString('spacing.padding', $messages);
    }

    /**
     * The failure this layer was built for: an id the engine knows but the block never allowed.
     * It emits nothing and reports nothing, so it reads as a control that does not work.
     */
    public function test_a_control_the_block_does_not_allow_names_the_blocks_that_do(): void
    {
        $messages = $this->messages([
            'name' => 'blicks/icon',
            'blicks' => ['typography.role' => ['default' => ['base' => 'lead']]],
        ]);

        $this->assertStringContainsString('does not support "typography.role"', $messages);
        $this->assertStringContainsString('blicks/heading', $messages);
    }

    // ── states and breakpoints ──────────────────────────────────────────────────

    public function test_an_unknown_state_lists_the_real_ones(): void
    {
        $messages = $this->messages([
            'name' => 'blicks/box',
            'blicks' => ['layout.gapRow' => ['pressed' => ['base' => 'md']]],
        ]);

        $this->assertStringContainsString('"pressed" is not a state', $messages);
        $this->assertStringContainsString('hover', $messages);
    }

    public function test_an_unknown_breakpoint_lists_the_real_ones(): void
    {
        $messages = $this->messages([
            'name' => 'blicks/box',
            'blicks' => ['layout.gapRow' => ['default' => ['desktop' => 'md']]],
        ]);

        $this->assertStringContainsString('"desktop" is not a breakpoint', $messages);
        $this->assertStringContainsString('base', $messages);
    }

    public function test_a_flat_value_is_rejected_with_the_shape_it_should_have(): void
    {
        $this->assertStringContainsString(
            'state → breakpoint → value',
            $this->messages([
                'name' => 'blicks/box',
                'blicks' => ['layout.gapRow' => 'md'],
            ])
        );
    }

    // ── values ──────────────────────────────────────────────────────────────────

    /**
     * A mistyped slug is indistinguishable from a keyword — `enormous` is as valid an identifier
     * as `normal` or `inherit`, and nothing here knows gap's value grammar. Rejecting it would
     * mean rejecting every legitimate keyword too. Documented as behaviour so the next person to
     * read the gap in coverage finds the reason rather than a hole.
     */
    public function test_a_mistyped_slug_is_not_caught_because_it_is_valid_css(): void
    {
        $this->assertSame([], $this->errors([
            'name' => 'blicks/box',
            'blicks' => ['layout.gapRow' => ['default' => ['base' => 'enormous']]],
        ]));
    }

    public function test_malformed_css_is_rejected_by_naming_the_scale_that_would_have_worked(): void
    {
        $messages = $this->messages([
            'name' => 'blicks/box',
            'blicks' => ['layout.gapRow' => ['default' => ['base' => '1px; background:url(https://evil.test/a.png)']]],
        ]);

        $this->assertStringContainsString('neither a spacing token nor valid CSS', $messages);
    }

    public function test_an_unknown_side_is_rejected_with_the_real_sides(): void
    {
        $messages = $this->messages([
            'name' => 'blicks/box',
            'blicks' => ['spacing.padding' => ['default' => ['base' => ['start' => 'md']]]],
        ]);

        $this->assertStringContainsString('top, right, bottom, left', $messages);
    }

    public function test_corners_are_checked_against_corner_names(): void
    {
        $messages = $this->messages([
            'name' => 'blicks/box',
            'blicks' => ['border.radius' => ['default' => ['base' => ['top' => 'md']]]],
        ]);

        $this->assertStringContainsString('topLeft', $messages);
    }

    public function test_css_text_for_a_structured_control_asks_for_its_shape_not_its_syntax(): void
    {
        $messages = $this->messages([
            'name' => 'blicks/text',
            // Shadow CSS is read into layers (ShadowText); text that is not a shadow is not.
            'blicks' => ['effects.textShadow' => ['default' => ['base' => 'url(x) 1px']]],
        ]);

        $this->assertStringContainsString('does not take a CSS string', $messages);
        $this->assertStringNotContainsString('valid CSS', $messages);
    }

    public function test_a_gradient_in_the_image_control_points_at_the_gradient_control(): void
    {
        $this->assertStringContainsString(
            'put this value in "background.gradient"',
            $this->messages([
                'name' => 'blicks/box',
                'blicks' => ['background.image' => ['default' => ['base' => 'radial-gradient(#fff, #000)']]],
            ])
        );
    }

    public function test_a_limited_state_names_what_it_styles(): void
    {
        $messages = $this->messages([
            'name' => 'blicks/box',
            'blicks' => [
                'spacing.padding' => ['groupActive' => ['base' => '8px']],
                'effects.opacity' => ['reduced' => ['base' => '0.5'], 'after:reduced' => ['base' => '0.25']],
            ],
        ]);

        $this->assertStringContainsString('The "groupActive" state does not style "spacing.padding"', $messages);
        $this->assertStringContainsString('effects.*', $messages);
        $this->assertStringNotContainsString('effects.opacity', $messages, 'an allowed control passes, on the element and on a part');
    }

    public function test_an_empty_value_is_not_an_error(): void
    {
        // Clearing a control is how the inspector unsets it; a spec may legitimately carry that.
        $this->assertSame([], $this->errors([
            'name' => 'blicks/box',
            'blicks' => ['layout.gapRow' => ['default' => ['base' => '']]],
        ]));
    }

    // ── nesting ─────────────────────────────────────────────────────────────────

    public function test_errors_in_children_are_reported_with_their_path(): void
    {
        $errors = $this->errors([
            'name' => 'blicks/box',
            'innerBlocks' => [
                ['name' => 'blicks/heading'],
                ['name' => 'blicks/carousel'],
            ],
        ]);

        $this->assertCount(1, $errors);
        $this->assertSame('root.innerBlocks[1]', $errors[0]['path']);
    }

    public function test_blicks_is_accepted_among_the_attributes_too(): void
    {
        // WordPress stores it as an attribute, so a caller echoing back what it parsed should not
        // be told the style tree is an undeclared attribute.
        $this->assertSame([], $this->errors([
            'name' => 'blicks/box',
            'attributes' => [
                'blicks' => ['layout.gapRow' => ['default' => ['base' => 'md']]],
            ],
        ]));
    }

    // ── links ───────────────────────────────────────────────────────────────────

    /** @return array<string, array{string}> */
    public static function unsafeLinks(): array
    {
        return [
            'javascript' => ['javascript:alert(1)'],
            'spaced' => [" java\tscript:alert(1)"],
            'data' => ['data:text/html,<b>x</b>'],
            'vbscript' => ['VBScript:msgbox'],
            'encoded javascript' => ['java&#115;cript:alert(1)'],
            'encoded colon' => ['javascript&colon;alert(1)'],
            'encoded first letter' => ['&#106;avascript:alert(1)'],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('unsafeLinks')]
    public function test_a_link_with_an_unsafe_scheme_is_refused_for_every_account(string $url): void
    {
        $errors = $this->errors(['name' => 'blicks/button', 'attributes' => ['text' => 'Go', 'url' => $url]]);

        $this->assertSame('unsafe-url', $errors[0]['reason'] ?? null);
    }

    public function test_relative_and_web_links_are_fine(): void
    {
        foreach (['/about', '#top', 'https://example.test', 'mailto:a@example.test', 'tel:+1555', '?q=1'] as $url) {
            $this->assertSame([], $this->errors(['name' => 'blicks/button', 'attributes' => ['url' => $url]]), $url);
        }
    }

    public function test_a_wrongly_typed_attribute_is_refused_because_wordpress_would_drop_it(): void
    {
        $errors = $this->errors(['name' => 'blicks/heading', 'attributes' => ['level' => '2']]);

        $this->assertSame('wrong-type', $errors[0]['reason']);
    }

    public function test_a_blicks_block_may_not_be_smuggled_in_as_markup(): void
    {
        $errors = $this->errors(['name' => 'blicks/text', 'markup' => '<!-- wp:blicks/text --><p onclick="x()">hi</p><!-- /wp:blicks/text -->']);

        $this->assertSame('invalid-markup', $errors[0]['reason']);
    }

    public function test_a_part_slot_reaches_the_engine_rather_than_being_called_a_bad_state(): void
    {
        $this->assertSame([], $this->errors([
            'name' => 'blicks/box',
            'blicks' => ['spacing.padding' => ['before' => ['base' => '4px']]],
        ]));
    }
}
