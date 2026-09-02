<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\DesignSystem;

use Blicks\DesignSystem\Catalogue;
use Blicks\DesignSystem\DesignThemes;
use Blicks\DesignSystem\Overrides;
use Blicks\DesignSystem\Store;
use PHPUnit\Framework\TestCase;

final class CustomSlugsTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wp_options'] = [];
    }

    public function test_sanitize_slug_normalizes_and_rejects(): void
    {
        $this->assertSame('brand-soft', Overrides::sanitizeSlug('  Brand Soft  '));
        $this->assertSame('x-2', Overrides::sanitizeSlug('x_2!!'));
        $this->assertNull(Overrides::sanitizeSlug(''));
        $this->assertNull(Overrides::sanitizeSlug('---'));
        $this->assertNull(Overrides::sanitizeSlug(str_repeat('a', 41)));
        $this->assertNull(Overrides::sanitizeSlug(42));
    }

    public function test_register_adds_new_slug_skips_base_and_invalid(): void
    {
        $registry = Store::registerCustomSlugs([
            'color' => ['Brand Soft', 'primary'], // 'primary' is a base slug → skipped
            'ring' => ['tertiary'],
            'bogus' => ['nope'],                   // unknown category → skipped
        ]);

        $this->assertSame(['brand-soft'], $registry['color']);
        $this->assertSame(['tertiary'], $registry['ring']);
        $this->assertArrayNotHasKey('bogus', $registry);

        // Persisted + de-duplicated on re-read.
        $this->assertSame(['brand-soft'], Store::getCustomSlugs()['color']);
        Store::registerCustomSlugs(['color' => ['brand-soft']]);
        $this->assertSame(['brand-soft'], Store::getCustomSlugs()['color']);
    }

    public function test_custom_slug_unions_into_catalogue(): void
    {
        Store::registerCustomSlugs([ 'ring' => ['tertiary'] ]);

        $catalogue = Catalogue::effectiveCatalogue([]);
        $this->assertContains('tertiary', $catalogue['ring']);
        // Base slugs still present.
        $this->assertContains('brand', $catalogue['ring']);
    }

    public function test_reset_category_clears_overrides_and_custom_slugs(): void
    {
        Store::registerCustomSlugs([ 'ring' => ['tertiary'] ]);
        // Overrides live on the active theme now, not a standalone option.
        DesignThemes::saveActiveOverrides([
            'tokens' => [ 'ring' => [ 'brand' => '0 0 0 3px red' ], 'color' => [ 'primary' => '#111' ] ],
            'breakpoints' => [],
            'typeRoles' => [],
        ]);

        Store::resetCategory('ring');

        $overrides = Store::getOverrides();
        $this->assertArrayNotHasKey('ring', $overrides['tokens']);
        $this->assertArrayHasKey('color', $overrides['tokens']); // untouched category survives
        $this->assertArrayNotHasKey('ring', Store::getCustomSlugs());
    }
}
