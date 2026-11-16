<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\DesignSystem;

use Blicks\DesignSystem\Contrast;
use PHPUnit\Framework\TestCase;

final class ContrastTest extends TestCase
{
    public function test_black_on_white_is_twenty_one_to_one(): void
    {
        $this->assertEqualsWithDelta(21.0, Contrast::ratio((float) Contrast::luminance('#fff'), (float) Contrast::luminance('#000000')), 0.001);
    }

    public function test_reads_the_notations_a_palette_uses(): void
    {
        $expected = Contrast::luminance('#545473');

        $this->assertNotNull($expected);
        $this->assertSame($expected, Contrast::luminance('#545473ff'));
        $this->assertSame($expected, Contrast::luminance('rgb(84, 84, 115)'));
        $this->assertSame($expected, Contrast::luminance('rgb(84 84 115 / 0.5)'));
        $this->assertSame($expected, Contrast::luminance('RGBA(84,84,115,1)'));
        $this->assertSame(Contrast::luminance('#aabbcc'), Contrast::luminance('#abc'));
    }

    public function test_anything_else_is_unknown(): void
    {
        foreach (['var(--x)', 'color-mix(in srgb, red, blue)', 'hsl(0 0% 0%)', 'red', '#12345', 'rgb(300, 0, 0)', ''] as $color) {
            $this->assertNull(Contrast::luminance($color), $color);
        }
    }
}
