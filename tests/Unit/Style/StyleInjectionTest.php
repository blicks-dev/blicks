<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Style;

use Blicks\Style\ElementStyle;
use Blicks\Style\ScopedCss;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Regression tests for CSS injection through block attributes.
 *
 * `blicks` attributes travel in the block-delimiter HTML comment, which `wp_kses_post()` does not
 * filter — so a Contributor without `unfiltered_html` controls every value exercised here. Each
 * payload below escaped its context before the values were validated as a whole.
 */
final class StyleInjectionTest extends TestCase
{
    protected function tearDown(): void
    {
        ScopedCss::reset();
        ElementStyle::clearDynamicRules();
    }

    /** @param array<string,mixed> $blicks */
    private function style(array $blicks): string
    {
        return ElementStyle::blockProps($blicks, 'abc12345', 'box')['style'];
    }

    /** @param array<string,mixed> $blicks */
    private function scoped(array $blicks): string
    {
        ElementStyle::blockProps($blicks, 'abc12345', 'box');
        return ScopedCss::css();
    }

    /** @return array<string, array{string, string}> attribute => [hostile value, benign value] */
    public static function styleAttributeSinks(): array
    {
        return [
            'letterSpacing' => [
                'typography.letterSpacing',
                '1px; background:url(https://attacker.example/ls.png)',
            ],
            'gradient' => [
                'background.gradient',
                'red; background-image:url(https://attacker.example/g.png)',
            ],
            'mask' => [
                'effects.mask',
                'none; background-image:url(https://attacker.example/m.png)',
            ],
            'transform' => [
                'effects.transform',
                'rotate(45deg); background:url(https://attacker.example/t.png)',
            ],
            'transition' => [
                'effects.transition',
                'all 1s; background:url(https://attacker.example/tr.png)',
            ],
            'filter' => [
                'effects.filter',
                'blur(2px); background:url(https://attacker.example/f.png)',
            ],
        ];
    }

    /**
     * A `;` in a value opened a second declaration on the wrapper element: `blockProps()` joins
     * the vars with `;` and `esc_attr()` does not touch it.
     *
     */
    #[DataProvider('styleAttributeSinks')]
    public function test_semicolon_cannot_open_a_second_declaration(string $attr, string $payload): void
    {
        $style = $this->style([$attr => ['default' => ['base' => $payload]]]);

        $this->assertStringNotContainsString('attacker.example', $style);
        $this->assertStringNotContainsString('background', $style);
    }

    /** `effects.clipPath` reaches the same sink through its own builder's `custom` branch. */
    public function test_clip_path_custom_branch_cannot_inject(): void
    {
        $style = $this->style([
            'effects.clipPath' => ['default' => ['base' => [
                'shape' => 'custom',
                'custom' => 'circle(50%); background-image:url(https://attacker.example/pixel.png)',
            ]]],
        ]);

        $this->assertStringNotContainsString('attacker.example', $style);
    }

    /** Legitimate values must still reach the style attribute unchanged. */
    public function test_benign_values_still_emit(): void
    {
        $style = $this->style([
            'typography.letterSpacing' => ['default' => ['base' => '0.05em']],
            'effects.transform' => ['default' => ['base' => 'rotate(45deg)']],
        ]);

        $this->assertStringContainsString('--bl-ls:0.05em', $style);
        $this->assertStringContainsString('--bl-tfm:rotate(45deg)', $style);
    }

    /**
     * The decoration builder writes a whole `.bl-{id}::before{…}` rule, so a `}` in any value
     * closed the rule and started a new one with an arbitrary selector.
     */
    public function test_decoration_value_cannot_escape_its_rule(): void
    {
        $css = $this->scoped([
            'decoration.before' => ['default' => ['base' => [
                'enabled' => true,
                'content' => 'x',
                'background' => 'red} body{background-image:url(https://attacker.example/exfil.png)',
            ]]],
        ]);

        $this->assertStringNotContainsString('attacker.example', $css);
        $this->assertStringNotContainsString('body{', $css);
        $this->assertSame(1, substr_count($css, '{'), 'exactly one rule block');
        $this->assertSame(1, substr_count($css, '}'), 'exactly one rule block');
    }

    /** The `$extra` pass-through table reached the same sink for ~30 more properties. */
    public function test_decoration_extra_passthrough_cannot_escape_its_rule(): void
    {
        $css = $this->scoped([
            'decoration.after' => ['default' => ['base' => [
                'enabled' => true,
                'content' => 'y',
                'animation' => 'x 1s} .wp-block{display:none',
            ]]],
        ]);

        $this->assertStringNotContainsString('.wp-block', $css);
        $this->assertStringNotContainsString('display:none', $css);
        $this->assertSame(1, substr_count($css, '}'), 'exactly one rule block');
    }

    /**
     * `normalizeContent()` returned the value unchanged the moment it *started* with `var(` —
     * the same prefix-test defect the dimension validator was hardened against.
     */
    public function test_content_var_prefix_cannot_inject(): void
    {
        $css = $this->scoped([
            'decoration.before' => ['default' => ['base' => [
                'enabled' => true,
                'content' => 'var(--a); background-image:url(https://attacker.example/c.png)',
            ]]],
        ]);

        $this->assertStringNotContainsString('attacker.example', $css);
        $this->assertStringContainsString('content:""', $css);
    }

    /** A whole, balanced `var()` in content is legitimate and must survive. */
    public function test_content_accepts_a_whole_var_function(): void
    {
        $css = $this->scoped([
            'decoration.before' => ['default' => ['base' => [
                'enabled' => true,
                'content' => 'var(--bl-label)',
            ]]],
        ]);

        $this->assertStringContainsString('content:var(--bl-label)', $css);
    }

    /** Decoration values that do validate must still be emitted. */
    public function test_decoration_benign_values_still_emit(): void
    {
        $css = $this->scoped([
            'decoration.before' => ['default' => ['base' => [
                'enabled' => true,
                'content' => 'New',
                'background' => '#ff0000',
                'width' => '8px',
            ]]],
        ]);

        $this->assertStringContainsString('content:"New"', $css);
        $this->assertStringContainsString('background:#ff0000', $css);
        $this->assertStringContainsString('width:8px', $css);
    }

    /** Background images may only be http(s) or site-relative, and cannot break out of url(). */
    public function test_background_image_rejects_dangerous_urls(): void
    {
        foreach ([
            'javascript:alert(1)',
            'data:text/html;base64,PHN2Zz4=',
            'https://example.com/a.png") ; background:url("https://attacker.example/b.png',
        ] as $payload) {
            $style = $this->style(['background.image' => ['default' => ['base' => $payload]]]);
            $this->assertStringNotContainsString('attacker.example', $style);
            $this->assertStringNotContainsString('javascript:', $style);
            $this->assertStringNotContainsString('data:text/html', $style);
        }

        $ok = $this->style(['background.image' => ['default' => ['base' => 'https://example.com/a.png']]]);
        $this->assertStringContainsString('--bl-bg-img:url("https://example.com/a.png")', $ok);
    }
}
