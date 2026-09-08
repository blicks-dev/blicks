<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\DesignSystem;

use Blicks\DesignSystem\CssVariables;
use PHPUnit\Framework\TestCase;

final class CssVariablesTest extends TestCase
{
    public function test_css_outputs_blicks_custom_properties_from_snapshot_values(): void
    {
        $css = CssVariables::css([
            'values' => [
                'color' => [
                    'primary' => '#18181b',
                    'bad;name' => 'red; color: blue',
                ],
                'spacing' => [
                    'md' => '1rem',
                ],
            ],
        ]);

        $this->assertStringContainsString(':root {', $css);
        $this->assertStringContainsString('--blicks-color-primary: #18181b;', $css);
        $this->assertStringContainsString('--blicks-spacing-md: 1rem;', $css);
        $this->assertStringContainsString('--blicks-color-badname: red color: blue;', $css);
    }

    public function test_css_floors_catalogue_slugs_the_theme_scale_drops(): void
    {
        // A theme whose spacing scale is numeric replaces the plugin's named scale wholesale
        // (Catalogue::effectiveCatalogue), so the snapshot carries no `md`. Block markup still
        // emits `var(--blicks-spacing-md)` — an undefined property there makes the whole
        // declaration invalid at computed-value time, so gap/padding silently collapses.
        $css = CssVariables::css([
            'values' => [
                'spacing' => [
                    '20' => '0.44rem',
                    '30' => '0.67rem',
                ],
            ],
        ]);

        $this->assertStringContainsString('--blicks-spacing-20: 0.44rem;', $css);
        $this->assertStringContainsString('--blicks-spacing-md: 1rem;', $css);
        $this->assertStringContainsString('--blicks-spacing-sm: 0.75rem;', $css);
    }

    public function test_css_floor_never_overrides_a_projected_value(): void
    {
        $css = CssVariables::css([
            'values' => [
                'spacing' => [
                    'md' => '2rem',
                ],
            ],
        ]);

        // The theme's own `md` must win: the floor is written first, so the projected value
        // lands later in the same `:root` block and takes precedence on source order.
        $this->assertStringContainsString('--blicks-spacing-md: 2rem;', $css);
        $this->assertLessThan(
            strpos($css, '--blicks-spacing-md: 2rem;'),
            strpos($css, '--blicks-spacing-sm: 0.75rem;'),
            'floor must be emitted before the projected values it defers to'
        );
    }

    public function test_css_emits_type_role_aliases_for_all_roles_and_preserves_clamp(): void
    {
        $css = CssVariables::css([
            'values' => [],
            'typeRoles' => [
                'slots' => [
                    'h1' => ['kind' => 'native'],
                    'lead' => ['kind' => 'custom'],
                    'code' => ['kind' => 'custom'],
                ],
                'values' => [
                    'h1' => ['fontSize' => '2.25rem'],
                    'lead' => ['fontSize' => 'clamp(1.25rem, 2vw, 1.5rem)', 'fontWeight' => '400'],
                    'code' => ['fontFamily' => 'Fira Code, monospace', 'letterSpacing' => '0'],
                ],
            ],
        ]);

        // Custom roles emit kebab-cased aliases; clamp() survives sanitization.
        $this->assertStringContainsString('--blicks-type-lead-font-size: clamp(1.25rem, 2vw, 1.5rem);', $css);
        $this->assertStringContainsString('--blicks-type-lead-font-weight: 400;', $css);
        $this->assertStringContainsString('--blicks-type-code-font-family: Fira Code, monospace;', $css);

        // Native roles now emit their aliases too — additive to the element CSS — so the opt-in
        // `.bl-type--{role}` library class can re-apply any role's look on any tag.
        $this->assertStringContainsString('--blicks-type-h1-font-size: 2.25rem;', $css);
    }
}
