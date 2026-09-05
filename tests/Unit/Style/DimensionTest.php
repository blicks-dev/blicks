<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Style;

use Blicks\Style\Dimension;
use PHPUnit\Framework\TestCase;

final class DimensionTest extends TestCase
{
    public function test_empty_and_non_scalar_values_fall_back(): void
    {
        $this->assertSame('auto', Dimension::clean(null, 'auto'));
        $this->assertSame('auto', Dimension::clean('', 'auto'));
        $this->assertSame('auto', Dimension::clean('   ', 'auto'));
        $this->assertSame('auto', Dimension::clean(['100px'], 'auto'));
        $this->assertSame('auto', Dimension::clean(str_repeat('1', 201) . 'px', 'auto'));
    }

    public function test_keywords_and_lengths_pass_through(): void
    {
        $this->assertSame('auto', Dimension::clean('auto', '100%'));
        $this->assertSame('none', Dimension::clean('none', '100%'));
        $this->assertSame('fit-content', Dimension::clean('fit-content', '100%'));
        $this->assertSame('720px', Dimension::clean('720px', 'auto'));
        $this->assertSame('66.5%', Dimension::clean('66.5%', 'auto'));
        $this->assertSame('-2rem', Dimension::clean('-2rem', 'auto'));
        $this->assertSame('100dvh', Dimension::clean('100dvh', 'auto'));
    }

    public function test_bare_numbers_become_pixels_except_zero(): void
    {
        $this->assertSame('40px', Dimension::clean('40', 'auto'));
        $this->assertSame('0', Dimension::clean('0', 'auto'));
        $this->assertSame('0', Dimension::clean('0.0', 'auto'));
    }

    public function test_accepts_a_single_balanced_css_function(): void
    {
        $this->assertSame('var(--bl-x)', Dimension::clean('var(--bl-x)', 'auto'));
        $this->assertSame(
            'var(--blicks-content-size, var(--wp--style--global--content-size, 1200px))',
            Dimension::clean('var(--blicks-content-size, var(--wp--style--global--content-size, 1200px))', 'auto')
        );
        $this->assertSame('calc(100% - 2rem)', Dimension::clean('calc(100% - 2rem)', 'auto'));
        $this->assertSame('clamp(20rem, 50vw, 60rem)', Dimension::clean('clamp(20rem, 50vw, 60rem)', 'auto'));
        $this->assertSame('min(100%, 60rem)', Dimension::clean('min(100%, 60rem)', 'auto'));
    }

    /**
     * The regression this class exists for: a `var(`/`calc(` prefix check alone let a stored
     * attribute close its declaration and append arbitrary ones to the wrapper's style attribute.
     */
    public function test_rejects_declaration_injection_through_a_css_function(): void
    {
        $this->assertSame('auto', Dimension::clean('var(--a); background: red', 'auto'));
        $this->assertSame('auto', Dimension::clean('calc(1px);position:fixed;top:0', 'auto'));
        $this->assertSame('auto', Dimension::clean('clamp(1px,2px,3px)}body{display:none', 'auto'));
        $this->assertSame('auto', Dimension::clean('var(--a)"><script>alert(1)</script>', 'auto'));
        $this->assertSame('auto', Dimension::clean('var(--a) url(https://evil.test/x.png)', 'auto'));
        $this->assertSame('auto', Dimension::clean('calc(1px) somethingelse(2px)', 'auto'));
        $this->assertSame('auto', Dimension::clean('var(--a', 'auto'));
        $this->assertSame('auto', Dimension::clean('image-set(x)', 'auto'));
        $this->assertSame('auto', Dimension::clean('expression(alert(1))', 'auto'));
    }
}
