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

    public function test_tabindex_is_allowed_with_an_integer_value(): void
    {
        $this->assertSame('tabindex', Sanitize::attrName('tabindex'));
        $this->assertSame('0', Sanitize::attrValueFor('tabindex', '0'));
        $this->assertSame('-1', Sanitize::attrValueFor('tabindex', '-1'));
        $this->assertSame(
            ['tabindex' => '0'],
            Sanitize::attributes([['name' => 'tabindex', 'value' => '0']])
        );
    }

    public function test_tabindex_is_dropped_when_the_value_is_not_an_integer(): void
    {
        $this->assertNull(Sanitize::attrValueFor('tabindex', 'first'));
        $this->assertNull(Sanitize::attrValueFor('tabindex', '1.5'));
        $this->assertNull(Sanitize::attrValueFor('tabindex', ''));
        $this->assertSame([], Sanitize::attributes([['name' => 'tabindex', 'value' => 'first']]));
    }

    public function test_other_attributes_carry_no_value_rule(): void
    {
        $this->assertSame('anything at all', Sanitize::attrValueFor('title', 'anything at all'));
    }

    public function test_style_tag_content_neutralizes_closing_style_tag(): void
    {
        $this->assertSame('selector{} <\/style> body{}', Sanitize::styleTagContent('selector{} </style> body{}'));
    }
}
