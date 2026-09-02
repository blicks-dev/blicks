<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\DesignSystem;

use Blicks\DesignSystem\Catalogue;
use PHPUnit\Framework\TestCase;

final class CatalogueTest extends TestCase
{
    public function test_snapshot_exposes_tokens_breakpoints_and_counts(): void
    {
        $snapshot = Catalogue::snapshot([
            'tokens' => [
                'color' => [
                    'primary' => '#111111',
                ],
            ],
            'breakpoints' => [
                'tablet' => 900,
            ],
        ]);

        $this->assertSame('readOnly', $snapshot['mode']);
        $this->assertIsArray($snapshot['source']);
        $this->assertFalse($snapshot['source']['themeJson']);
        $this->assertFalse($snapshot['source']['globalStyles']);

        $this->assertIsArray($snapshot['tokens']);
        $this->assertContains('primary', $snapshot['tokens']['color']);
        $this->assertContains('md', $snapshot['tokens']['spacing']);

        $this->assertIsArray($snapshot['breakpoints']);
        $this->assertSame('base', $snapshot['breakpoints'][0]['id']);
        $this->assertNull($snapshot['breakpoints'][0]['max']);
        $this->assertSame(900, $snapshot['breakpoints'][1]['max']);

        $this->assertSame('#18181b', $snapshot['baseValues']['color']['primary']);
        $this->assertSame('#111111', $snapshot['values']['color']['primary']);
        $this->assertSame('#111111', $snapshot['overrides']['tokens']['color']['primary']);
        $this->assertSame(900, $snapshot['overrides']['breakpoints']['tablet']);

        $this->assertSame(count($snapshot['tokens']['color']), $snapshot['counts']['colors']);
        $this->assertSame(
            count($snapshot['tokens']['fontSize']) + count($snapshot['tokens']['fontFamily']),
            $snapshot['counts']['typography']
        );
        $this->assertSame(count($snapshot['breakpoints']), $snapshot['counts']['breakpoints']);
        $this->assertArrayHasKey('fontLibrary', $snapshot);
        $this->assertIsArray($snapshot['fontLibrary']);
        $this->assertSame(count($snapshot['fontLibrary']), $snapshot['counts']['fontFamilies']);
    }

    public function test_color_palette_rows_carry_slug_humanised_name_and_value(): void
    {
        $palette = Catalogue::colorPalette();

        $this->assertNotEmpty($palette);
        foreach ($palette as $row) {
            $this->assertArrayHasKey('slug', $row);
            $this->assertArrayHasKey('name', $row);
            $this->assertArrayHasKey('color', $row);
        }

        $bySlug = array_column($palette, null, 'slug');
        $this->assertArrayHasKey('primary', $bySlug);              // shadcn semantic token present
        $this->assertSame('Primary', $bySlug['primary']['name']);  // humanised
        $this->assertNotSame('', $bySlug['primary']['color']);     // carries a projected value
        $this->assertSame('Muted Foreground', $bySlug['muted-foreground']['name']); // multi-word slug
    }

    public function test_token_catalogue_carries_slug_name_and_live_value_per_category(): void
    {
        $catalogue = Catalogue::tokenCatalogue();

        foreach (['spacing', 'radius', 'shadow', 'borderWidth', 'zIndex', 'transition', 'transform', 'filter', 'fontSize', 'width', 'aspect', 'leading', 'gradient', 'opacity'] as $category) {
            $this->assertArrayHasKey($category, $catalogue);
            $this->assertNotEmpty($catalogue[$category], "category '$category' should carry rows");
        }

        // color/fontFamily have their own dedicated bridges and are not duplicated here.
        $this->assertArrayNotHasKey('color', $catalogue);
        $this->assertArrayNotHasKey('fontFamily', $catalogue);

        $bySlug = array_column($catalogue['spacing'], null, 'slug');
        $this->assertArrayHasKey('md', $bySlug);
        $this->assertSame('Md', $bySlug['md']['name']);
        $this->assertNotSame('', $bySlug['md']['value']);
    }

    public function test_token_catalogue_accepts_a_precomputed_snapshot(): void
    {
        $snapshot = Catalogue::snapshot([
            'tokens' => ['spacing' => ['md' => '99px']],
        ]);

        $catalogue = Catalogue::tokenCatalogue($snapshot);
        $bySlug = array_column($catalogue['spacing'], null, 'slug');
        $this->assertSame('99px', $bySlug['md']['value']);
    }

    public function test_effective_catalogue_merges_theme_palette_and_excludes_wp_defaults(): void
    {
        $settings = [
            'color' => [
                'palette' => [
                    'default' => [
                        ['slug' => 'black', 'color' => '#000000'],
                        ['slug' => 'vivid-red', 'color' => '#ff0000'],
                    ],
                    'theme' => [
                        ['slug' => 'primary', 'color' => '#002bff'],
                        ['slug' => 'navy', 'color' => '#1a194c'],
                    ],
                    'custom' => [
                        ['slug' => 'frost', 'color' => '#b3d5ff'],
                    ],
                ],
            ],
        ];

        $catalogue = Catalogue::effectiveCatalogue($settings);

        // Base catalogue slugs are preserved.
        $this->assertContains('primary', $catalogue['color']);
        $this->assertContains('border', $catalogue['color']);
        // Theme + custom palette slugs are merged in.
        $this->assertContains('navy', $catalogue['color']);
        $this->assertContains('frost', $catalogue['color']);
        // WP's built-in default palette is excluded.
        $this->assertNotContains('black', $catalogue['color']);
        $this->assertNotContains('vivid-red', $catalogue['color']);
        // Non-preset categories are untouched.
        $this->assertSame(\Blicks\Style\Tokens::catalogue()['radius'], $catalogue['radius']);
    }
}
