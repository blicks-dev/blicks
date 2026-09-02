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
