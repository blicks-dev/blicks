<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Core;

use Blicks\Core\BoxLink;
use PHPUnit\Framework\TestCase;

/** A linked Box's overlay link gets a name a screen reader can announce. */
final class BoxLinkTest extends TestCase
{
    public function test_names_the_overlay_from_the_first_heading(): void
    {
        $html = '<div class="bl-box bl-box--linked"><a class="bl-box__link" href="/studio/"></a><h3 class="bl-heading">Edit in <em>Studio</em></h3><p>Layers &amp; groups</p></div>';
        $this->assertSame(
            '<div class="bl-box bl-box--linked"><a class="bl-box__link" href="/studio/" aria-label="Edit in Studio"></a><h3 class="bl-heading">Edit in <em>Studio</em></h3><p>Layers &amp; groups</p></div>',
            BoxLink::withName($html)
        );
    }

    public function test_falls_back_to_the_text_and_escapes_it(): void
    {
        $out = BoxLink::withName("<article class=\"bl-box\">\n<a class=\"bl-box__link\" href=\"#motion\" aria-label=\"\"></a><p>Say \"hi\"</p><span>to motion</span></article>");
        $this->assertStringContainsString('<a class="bl-box__link" href="#motion" aria-label="Say &quot;hi&quot; to motion"></a>', $out);
    }

    public function test_a_label_the_author_set_wins(): void
    {
        $html = '<div class="bl-box"><a class="bl-box__link" href="/x" aria-label="Read the guide"></a><h2>Other</h2></div>';
        $this->assertSame($html, BoxLink::withName($html));
    }

    public function test_leaves_unlinked_boxes_and_nested_overlays_alone(): void
    {
        $plain = '<div class="bl-box"><h2>Title</h2></div>';
        $this->assertSame($plain, BoxLink::withName($plain));
        // The outer box is not linked; the inner card's overlay is handled when that block renders.
        $nested = '<div class="bl-box"><div class="bl-box bl-box--linked"><a class="bl-box__link" href="/x"></a><h2>Inner</h2></div></div>';
        $this->assertSame($nested, BoxLink::withName($nested));
    }

    public function test_an_empty_card_stays_unnamed(): void
    {
        $html = '<div class="bl-box"><a class="bl-box__link" href="/x"></a><img src="a.png" alt=""></div>';
        $this->assertSame($html, BoxLink::withName($html));
    }

    public function test_cuts_long_text_at_a_word(): void
    {
        $name = BoxLink::nameFrom('<p>' . str_repeat('word ', 40) . '</p>');
        $this->assertLessThanOrEqual(101, mb_strlen($name));
        $this->assertStringEndsWith('word…', $name);
    }
}
