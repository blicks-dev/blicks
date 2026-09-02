<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Style;

use Blicks\Style\Sanitize;
use PHPUnit\Framework\TestCase;

/**
 * Parity mirror of resources/framework/sanitize.ts — keep both in sync.
 */
final class SanitizeTest extends TestCase
{
    public function test_attr_name_allow_list(): void
    {
        $this->assertSame('data-x', Sanitize::attrName('data-x'));
        $this->assertSame('data-foo-1', Sanitize::attrName('DATA-Foo-1'));
        $this->assertSame('aria-label', Sanitize::attrName('aria-label'));
        $this->assertSame('role', Sanitize::attrName(' role '));
        $this->assertSame('id', Sanitize::attrName('id'));

        $this->assertNull(Sanitize::attrName('onclick'));
        $this->assertNull(Sanitize::attrName('style'));
        $this->assertNull(Sanitize::attrName('class'));
        $this->assertNull(Sanitize::attrName('href'));
        $this->assertNull(Sanitize::attrName('data-'));
        $this->assertNull(Sanitize::attrName(''));
    }

    public function test_attr_value_strips_and_caps(): void
    {
        $this->assertSame('hello', Sanitize::attrValue('  hello  '));
        $this->assertSame('abc', Sanitize::attrValue("a\tb\nc"));
        $this->assertSame('alert(1)', Sanitize::attrValue('javascript:alert(1)'));
        $this->assertSame('x', Sanitize::attrValue('VBScript:x'));
        $this->assertSame(500, mb_strlen(Sanitize::attrValue(str_repeat('a', 600))));
    }

    public function test_attributes_keeps_valid_last_write_wins(): void
    {
        $this->assertSame(
            ['data-x' => '2', 'aria-hidden' => 'true'],
            Sanitize::attributes([
                ['name' => 'data-x', 'value' => '1'],
                ['name' => 'onclick', 'value' => 'evil'],
                ['name' => 'data-x', 'value' => '2'],
                ['name' => 'aria-hidden', 'value' => 'true'],
            ])
        );

        $this->assertSame([], Sanitize::attributes('x'));
        $this->assertSame([], Sanitize::attributes(null));
    }

    public function test_css_strips_dangerous_constructs(): void
    {
        $r = Sanitize::css('selector { color: red } </style><script>x</script>');
        $this->assertStringNotContainsString('<', $r);

        $this->assertStringNotContainsString('@import', Sanitize::css('@import url(evil.css); selector{}'));
        $this->assertStringNotContainsString('@charset', Sanitize::css('@charset "UTF-8"; selector{}'));
        $this->assertStringNotContainsString('expression(', Sanitize::css('selector{width:expression(alert(1))}'));
        $this->assertStringNotContainsString('javascript:', Sanitize::css('selector{background:url(javascript:x)}'));
        $this->assertStringNotContainsString('url(', Sanitize::css('selector{background:url(image.jpg)}'));
        $this->assertStringNotContainsString('behavior:', Sanitize::css('selector{behavior:url(x.htc)}'));
    }

    public function test_css_leaves_safe_css_intact(): void
    {
        $this->assertSame('selector > * { gap: 8px }', Sanitize::css('selector > * { gap: 8px }'));
    }

    public function test_scope_css(): void
    {
        $this->assertSame('.bl-abc { color: red }', Sanitize::scopeCss('selector { color: red }', 'abc'));
        $this->assertSame('.bl-abc:hover { color: red }', Sanitize::scopeCss('selector:hover { color: red }', 'abc'));
        $this->assertSame('', Sanitize::scopeCss('selector{}', ''));
        $this->assertSame('', Sanitize::scopeCss('', 'abc'));
    }

    public function test_style_tag_content_neutralizes_closing_style_tag(): void
    {
        $this->assertSame('selector{} <\/style> body{}', Sanitize::styleTagContent('selector{} </style> body{}'));
    }
}
