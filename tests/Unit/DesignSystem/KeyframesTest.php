<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\DesignSystem;

use Blicks\DesignSystem\Keyframes;
use PHPUnit\Framework\TestCase;

/** Emission is a separate concern: the stored library rendered to CSS. */
final class KeyframesTest extends TestCase
{
    public function testRendersInsideTheReducedMotionGuard(): void
    {
        $css = Keyframes::css([[
            'slug' => 'drift',
            'label' => 'Drift',
            'defaults' => [],
            'steps' => [
                ['offset' => 0, 'declarations' => ['opacity' => '0']],
                ['offset' => 100, 'declarations' => ['opacity' => '1']],
            ],
        ]]);

        // The media query IS the reduced-motion guard — under `reduce` the keyframes do not
        // exist, so animation-name resolves to nothing. Custom animations must inherit that.
        $this->assertStringContainsString('@media (prefers-reduced-motion: no-preference)', $css);
        $this->assertStringContainsString('@keyframes bl-anim-drift', $css);
        $this->assertStringContainsString('0% { opacity: 0; }', $css);
        $this->assertStringContainsString('100% { opacity: 1; }', $css);
    }

    public function testEmptyLibraryEmitsNothing(): void
    {
        $this->assertSame('', Keyframes::css([]));
    }

    public function testSkipsEntriesWithNoRenderableStep(): void
    {
        $css = Keyframes::css([
            ['slug' => 'ghost', 'label' => 'Ghost', 'defaults' => [], 'steps' => []],
        ]);

        $this->assertSame('', $css);
    }

    public function testNamespacesTheAnimationName(): void
    {
        $this->assertSame('bl-anim-drift', Keyframes::name('drift'));
    }
}
