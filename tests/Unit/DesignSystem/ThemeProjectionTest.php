<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\DesignSystem;

use Blicks\DesignSystem\ThemeProjection;
use PHPUnit\Framework\TestCase;

final class ThemeProjectionTest extends TestCase
{
    public function test_from_settings_projects_wordpress_presets_and_blicks_custom_values(): void
    {
        $catalogue = [
            'color' => ['primary', 'background'],
            'spacing' => ['md'],
            'fontSize' => ['base'],
            'fontFamily' => ['sans'],
            'radius' => ['md'],
            'shadow' => ['md'],
            'transition' => ['fast'],
            'content' => ['size'],
        ];

        $values = ThemeProjection::fromSettings([
            'color' => [
                'palette' => [
                    ['slug' => 'primary', 'color' => '#123456'],
                ],
            ],
            'spacing' => [
                'spacingSizes' => [
                    ['slug' => 'md', 'size' => '1.25rem'],
                ],
            ],
            'typography' => [
                'fontSizes' => [
                    ['slug' => 'base', 'size' => '17px'],
                ],
                'fontFamilies' => [
                    ['slug' => 'sans', 'fontFamily' => 'Inter, sans-serif'],
                ],
            ],
            'border' => [
                'radiusSizes' => [
                    ['slug' => 'md', 'size' => '10px'],
                ],
            ],
            'shadow' => [
                'presets' => [
                    ['slug' => 'md', 'shadow' => '0 2px 8px rgb(0 0 0 / 0.2)'],
                ],
            ],
            'layout' => [
                'contentSize' => '1180px',
            ],
            'custom' => [
                'blicks' => [
                    'transition' => ['fast' => 'opacity 120ms ease'],
                ],
            ],
        ], $catalogue);

        $this->assertSame('#123456', $values['color']['primary']);
        $this->assertSame('#ffffff', $values['color']['background']);
        $this->assertSame('1.25rem', $values['spacing']['md']);
        $this->assertSame('17px', $values['fontSize']['base']);
        $this->assertSame('Inter, sans-serif', $values['fontFamily']['sans']);
        $this->assertSame('10px', $values['radius']['md']);
        $this->assertSame('0 2px 8px rgb(0 0 0 / 0.2)', $values['shadow']['md']);
        $this->assertSame('opacity 120ms ease', $values['transition']['fast']);
        $this->assertSame('1180px', $values['content']['size']);
    }

    public function test_breakpoints_project_from_blicks_custom_settings(): void
    {
        $breakpoints = ThemeProjection::breakpointsFromSettings([
            'custom' => [
                'blicks' => [
                    'breakpoints' => [
                        'tablet' => 900,
                        'mobile' => '640',
                    ],
                ],
            ],
        ], [
            ['id' => 'base', 'label' => 'Desktop', 'max' => null],
            ['id' => 'tablet', 'label' => 'Tablet', 'max' => 782],
            ['id' => 'mobile', 'label' => 'Mobile', 'max' => 600],
        ]);

        $this->assertSame(null, $breakpoints[0]['max']);
        $this->assertSame(900, $breakpoints[1]['max']);
        $this->assertSame(640, $breakpoints[2]['max']);
    }

    public function test_from_settings_reads_origin_grouped_presets_with_user_precedence(): void
    {
        // `wp_get_global_settings()` returns presets grouped by origin; a value synced into the
        // user Global Styles post lands in `custom` and must win over theme/default.
        $values = ThemeProjection::fromSettings([
            'color' => [
                'palette' => [
                    'default' => [['slug' => 'primary', 'color' => '#000000']],
                    'theme'   => [['slug' => 'primary', 'color' => '#111111']],
                    'custom'  => [['slug' => 'primary', 'color' => '#abcdef']],
                ],
            ],
            'spacing' => [
                'spacingSizes' => [
                    'theme'  => [['slug' => 'md', 'size' => '1rem']],
                    'custom' => [['slug' => 'md', 'size' => '2rem']],
                ],
            ],
        ], [
            'color' => ['primary'],
            'spacing' => ['md'],
        ]);

        $this->assertSame('#abcdef', $values['color']['primary']);
        $this->assertSame('2rem', $values['spacing']['md']);
    }

    public function test_apply_overrides_updates_known_projected_values_only(): void
    {
        $values = [
            'color' => ['primary' => '#123456'],
        ];

        $merged = ThemeProjection::applyOverrides($values, [
            'tokens' => [
                'color' => [
                    'primary' => '#abcdef',
                    'unknown' => '#000000',
                ],
                'spacing' => [
                    'md' => '2rem',
                ],
            ],
            'breakpoints' => [],
        ]);

        $this->assertSame(['color' => ['primary' => '#abcdef']], $merged);
    }

    public function test_font_families_extracts_theme_and_user_origins(): void
    {
        $families = ThemeProjection::fontFamilies([
            'typography' => [
                'fontFamilies' => [
                    [
                        'slug'       => 'sans',
                        'name'       => 'Sans',
                        'fontFamily' => 'system-ui, sans-serif',
                        'origin'     => 'theme',
                    ],
                    [
                        'slug'       => 'inter',
                        'name'       => 'Inter',
                        'fontFamily' => '"Inter", sans-serif',
                        'origin'     => 'user',
                    ],
                    // Malformed entry — missing fontFamily, must be dropped.
                    ['slug' => 'broken', 'name' => 'Broken'],
                    // Non-array junk — must not crash.
                    'oops',
                ],
            ],
        ]);

        $this->assertCount(2, $families);
        $this->assertSame('sans', $families[0]['slug']);
        $this->assertSame('theme', $families[0]['source']);
        $this->assertSame('Inter', $families[1]['name']);
        $this->assertSame('user', $families[1]['source']);
    }

    public function test_font_families_falls_back_to_humanised_slug_when_name_missing(): void
    {
        $families = ThemeProjection::fontFamilies([
            'typography' => [
                'fontFamilies' => [
                    ['slug' => 'inter-display', 'fontFamily' => 'Inter Display, sans-serif'],
                ],
            ],
        ]);

        $this->assertSame('Inter Display', $families[0]['name']);
        $this->assertSame('theme', $families[0]['source']);
    }

    public function test_font_families_handles_empty_settings(): void
    {
        $this->assertSame([], ThemeProjection::fontFamilies([]));
        $this->assertSame([], ThemeProjection::fontFamilies(['typography' => []]));
    }

    public function test_font_families_flattens_origin_grouped_shape(): void
    {
        // WP 6.1+ groups merged settings under `default` / `theme` / `custom` keys.
        // Font Library installs land in `custom`; theme.json families in `theme`.
        $families = ThemeProjection::fontFamilies([
            'typography' => [
                'fontFamilies' => [
                    'theme' => [
                        ['slug' => 'manrope', 'name' => 'Manrope', 'fontFamily' => 'Manrope, sans-serif'],
                    ],
                    'custom' => [
                        ['slug' => 'inter', 'name' => 'Inter', 'fontFamily' => '"Inter", sans-serif'],
                        ['slug' => 'roboto', 'name' => 'Roboto', 'fontFamily' => 'Roboto, sans-serif'],
                    ],
                ],
            ],
        ]);

        $this->assertCount(3, $families);
        $this->assertSame('manrope', $families[0]['slug']);
        $this->assertSame('theme', $families[0]['source']);
        $this->assertSame('inter', $families[1]['slug']);
        $this->assertSame('custom', $families[1]['source']);
        $this->assertSame('custom', $families[2]['source']);
    }
}
