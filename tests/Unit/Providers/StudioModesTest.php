<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Providers;

use Blicks\Providers\StudioServiceProvider;
use PHPUnit\Framework\TestCase;

/**
 * `blicks_studio_modes`: a companion's mode scripts, loaded only where the Studio is.
 */
final class StudioModesTest extends TestCase
{
    protected function setUp(): void
    {
        blicks_test_reset_filters();
        $GLOBALS['blicks_test_scripts'] = ['acme-board-mode', 'acme-header-mode', 'blicks-studio'];
    }

    protected function tearDown(): void
    {
        blicks_test_reset_filters();
        $GLOBALS['blicks_test_scripts'] = [];
    }

    public function test_none_by_default(): void
    {
        $this->assertSame([], StudioServiceProvider::modeHandles());
    }

    public function test_keeps_registered_handles_once_and_in_order(): void
    {
        blicks_test_add_filter('blicks_studio_modes', static fn (array $h): array => [...$h, 'acme-header-mode', 'acme-board-mode', 'acme-header-mode']);

        $this->assertSame(['acme-header-mode', 'acme-board-mode'], StudioServiceProvider::modeHandles());
    }

    public function test_drops_what_would_enqueue_nothing_or_the_studio_itself(): void
    {
        blicks_test_add_filter('blicks_studio_modes', static fn (): array => ['', 'not-registered', 'blicks-studio', 7, ['x'], 'acme-board-mode']);

        $this->assertSame(['acme-board-mode'], StudioServiceProvider::modeHandles());
    }

    public function test_survives_a_filter_that_returns_nonsense(): void
    {
        blicks_test_add_filter('blicks_studio_modes', static fn (): string => 'acme-board-mode');

        $this->assertSame([], StudioServiceProvider::modeHandles());
    }
}
