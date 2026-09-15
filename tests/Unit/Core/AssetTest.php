<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Core;

use Blicks\Core\Assets\Asset;
use PHPUnit\Framework\TestCase;

final class AssetTest extends TestCase
{
    protected function setUp(): void
    {
        blicks_test_reset_calls();
    }

    public function test_script_passes_handle_src_deps_version_and_footer_through(): void
    {
        Asset::script('blicks', 'https://example.test/build/index.js')
            ->deps('wp-element', 'wp-i18n')
            ->version('1.2.3')
            ->footer()
            ->enqueue();

        $call = blicks_test_calls('wp_enqueue_script')[0]['args'];

        $this->assertSame('blicks', $call['handle']);
        $this->assertSame('https://example.test/build/index.js', $call['src']);
        $this->assertSame(['wp-element', 'wp-i18n'], $call['deps']);
        $this->assertSame('1.2.3', $call['ver']);
        $this->assertTrue($call['inFooter']);
    }

    public function test_a_script_defaults_to_the_head_with_no_deps_or_version(): void
    {
        Asset::script('blicks', 'https://example.test/a.js')->enqueue();

        $call = blicks_test_calls('wp_enqueue_script')[0]['args'];

        $this->assertSame([], $call['deps']);
        $this->assertNull($call['ver']);
        $this->assertFalse($call['inFooter']);
    }

    public function test_style_enqueues_then_attaches_each_inline_block_in_order(): void
    {
        Asset::style('blicks-admin', 'https://example.test/build/admin.css')
            ->version('9')
            ->addInlineStyle(':root{--a:1}')
            ->addInlineStyle('.b{color:red}')
            ->enqueue();

        $calls = blicks_test_calls();
        $this->assertSame('wp_enqueue_style', $calls[0]['fn'], 'the handle must exist before inline CSS attaches');
        $this->assertSame('9', $calls[0]['args']['ver']);

        $inline = array_map(static fn (array $c): string => $c['args']['css'], blicks_test_calls('wp_add_inline_style'));
        $this->assertSame([':root{--a:1}', '.b{color:red}'], $inline);

        foreach (blicks_test_calls('wp_add_inline_style') as $call) {
            $this->assertSame('blicks-admin', $call['args']['handle']);
        }
    }

    public function test_inline_css_is_not_attached_when_the_style_is_never_enqueued(): void
    {
        Asset::style('blicks-admin', 'https://example.test/a.css')->addInlineStyle('.a{}');

        $this->assertSame([], blicks_test_calls());
    }
}
