<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Style;

use Blicks\Providers\StyleServiceProvider;
use Blicks\Style\ElementStyle;
use Blicks\Style\ScopedCss;
use PHPUnit\Framework\TestCase;

final class ScopedCssTest extends TestCase
{
    protected function tearDown(): void
    {
        ScopedCss::reset();
        ElementStyle::clearDynamicRules();
    }

    public function test_collector_dedupes_identical_rules(): void
    {
        ScopedCss::add('.bl-card::after{content:"New"}');
        ScopedCss::add('.bl-card::after{content:"New"}');
        ScopedCss::add('.bl-card::before{content:""}');

        $this->assertSame(
            '.bl-card::after{content:"New"}.bl-card::before{content:""}',
            ScopedCss::css()
        );
    }

    public function test_block_props_queues_scoped_css_for_dynamic_render_paths(): void
    {
        ElementStyle::blockProps(
            null,
            'card123',
            'box',
            ['.bl-card123::after{content:"New"}', '.bl-card123::after{content:"New"}']
        );

        $this->assertSame('.bl-card123::after{content:"New"}', ScopedCss::css());
    }

    /**
     * End-to-end frontend wiring: the render_block filter extracts a block's attrs, runs the
     * engine, and queues the emitted scoped CSS for the footer — covering STATIC blocks, whose
     * saved markup carries classes+vars but not scoped rules.
     */
    public function test_render_block_filter_collects_engine_scoped_css(): void
    {
        ElementStyle::registerRule([
            'attr' => 'anim.spin', 'cls' => 'spin', 'kind' => 'single', 'v' => '--bl-spin',
            'prop' => 'animation-name', 'keyframes' => 'bl-spin',
        ]);

        $provider = new StyleServiceProvider();
        $block    = [
            'blockName' => 'blicks/box',
            'attrs'     => [
                'uniqueId' => 'box42',
                'blicks'   => ['anim.spin' => ['default' => ['base' => 'on']]],
                'customCSS' => 'selector{outline:1px solid red}',
            ],
        ];

        $out = $provider->collectScopedCss('<div>kept</div>', $block);

        $this->assertSame('<div>kept</div>', $out, 'block content passes through unchanged');
        $this->assertSame(
            '@media (prefers-reduced-motion: no-preference){.bl-box42{animation-name:bl-spin}}'
                . '.bl-box42{outline:1px solid red}',
            ScopedCss::css()
        );
    }

    public function test_render_block_filter_ignores_non_blicks_blocks(): void
    {
        $provider = new StyleServiceProvider();
        $provider->collectScopedCss('x', ['blockName' => 'core/paragraph', 'attrs' => []]);

        $this->assertSame('', ScopedCss::css());
    }
}
