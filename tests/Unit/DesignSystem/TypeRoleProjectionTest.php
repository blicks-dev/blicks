<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\DesignSystem;

use Blicks\DesignSystem\TypeRoleProjection;
use Blicks\DesignSystem\TypeRoles;
use PHPUnit\Framework\TestCase;

final class TypeRoleProjectionTest extends TestCase
{
    public function test_native_roles_read_from_styles_tree(): void
    {
        $values = TypeRoleProjection::fromStylesAndSettings([
            'typography' => ['fontSize' => '17px', 'lineHeight' => '1.7'],
            'elements' => [
                'h1' => ['typography' => ['fontSize' => '3rem', 'fontWeight' => '800']],
                'caption' => ['typography' => ['fontSize' => '0.8rem']],
            ],
        ], []);

        // h1: user value wins where set, default fills the rest.
        $this->assertSame('3rem', $values['h1']['fontSize']);
        $this->assertSame('800', $values['h1']['fontWeight']);
        $this->assertSame(TypeRoles::DEFAULTS['h1']['lineHeight'], $values['h1']['lineHeight']);

        // body reads the root typography.
        $this->assertSame('17px', $values['body']['fontSize']);
        $this->assertSame('1.7', $values['body']['lineHeight']);

        $this->assertSame('0.8rem', $values['caption']['fontSize']);
    }

    public function test_heading_group_fallback_applies_before_default(): void
    {
        $values = TypeRoleProjection::fromStylesAndSettings([
            'elements' => [
                'heading' => ['typography' => ['letterSpacing' => '-0.05em', 'fontWeight' => '900']],
                'h2' => ['typography' => ['fontSize' => '2rem']],
            ],
        ], []);

        // h2 has no own letterSpacing/fontWeight → inherits the shared heading look.
        $this->assertSame('2rem', $values['h2']['fontSize']);
        $this->assertSame('-0.05em', $values['h2']['letterSpacing']);
        $this->assertSame('900', $values['h2']['fontWeight']);
    }

    public function test_custom_roles_read_from_settings_custom_blicks(): void
    {
        $values = TypeRoleProjection::fromStylesAndSettings([], [
            'custom' => [
                'blicks' => [
                    'typeRoles' => [
                        'lead' => ['font-size' => '1.4rem', 'line-height' => '1.7'],
                        'code' => ['font-family' => 'Fira Code, monospace'],
                    ],
                ],
            ],
        ]);

        $this->assertSame('1.4rem', $values['lead']['fontSize']);
        $this->assertSame('1.7', $values['lead']['lineHeight']);
        $this->assertSame('Fira Code, monospace', $values['code']['fontFamily']);
        // Unset custom prop → default.
        $this->assertSame(TypeRoles::DEFAULTS['code']['fontWeight'], $values['code']['fontWeight']);
    }

    public function test_empty_trees_fall_back_to_defaults_for_every_role_and_prop(): void
    {
        $values = TypeRoleProjection::fromStylesAndSettings([], []);

        foreach (TypeRoles::ROLES as $role) {
            foreach (TypeRoles::PROPS as $prop) {
                $this->assertSame(
                    TypeRoles::DEFAULTS[$role][$prop],
                    $values[$role][$prop],
                    "role={$role} prop={$prop}"
                );
            }
        }
    }

    public function test_apply_overrides_overlays_sparse_role_props(): void
    {
        $base = TypeRoleProjection::fromStylesAndSettings([], []);
        $merged = TypeRoleProjection::applyOverrides($base, [
            'h1' => ['fontWeight' => '900'],
            'unknown' => ['fontSize' => '5rem'],
            'h2' => ['bogusProp' => 'x'],
        ]);

        $this->assertSame('900', $merged['h1']['fontWeight']);
        // Untouched props stay at base.
        $this->assertSame(TypeRoles::DEFAULTS['h1']['fontSize'], $merged['h1']['fontSize']);
        // Unknown role ignored, no crash.
        $this->assertArrayNotHasKey('unknown', $merged);
        // Unknown prop on a known role ignored.
        $this->assertArrayNotHasKey('bogusProp', $merged['h2']);
    }
}
