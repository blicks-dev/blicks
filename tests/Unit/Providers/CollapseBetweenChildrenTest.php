<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Providers;

use Blicks\Providers\StyleServiceProvider;
use PHPUnit\Framework\TestCase;

/** The blank lines saved between sibling blocks must not become spaces between inline runs. */
final class CollapseBetweenChildrenTest extends TestCase
{
    public function test_whitespace_between_two_children_goes_and_the_blocks_own_markup_stays(): void
    {
        $this->assertSame(
            ['<span class="bl-box">', null, '', null, '', null, '</span>'],
            StyleServiceProvider::withoutGaps(["\n<span class=\"bl-box\">", null, "\n\n", null, "\n\n", null, "</span>\n"])
        );
    }

    public function test_text_between_children_is_kept(): void
    {
        $this->assertSame(
            ['<p>', null, ' and ', null, '</p>'],
            StyleServiceProvider::withoutGaps(['<p>', null, ' and ', null, '</p>'])
        );
    }

    public function test_a_leaf_block_loses_the_newlines_around_its_element_only(): void
    {
        $this->assertSame(['<span>a <b>b</b> c</span>'], StyleServiceProvider::withoutGaps(["\n<span>a <b>b</b> c</span>\n"]));
    }
}
