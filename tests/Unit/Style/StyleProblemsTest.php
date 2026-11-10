<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Style;

use Blicks\Style\ElementStyle;
use PHPUnit\Framework\TestCase;

/** Mirror of resources/framework/css/problems.test.ts: the same trees, the same findings. */
final class StyleProblemsTest extends TestCase
{
    private static function at(mixed $value, string $slot = 'default', string $bp = 'base'): array
    {
        return [$slot => [$bp => $value]];
    }

    public function test_a_clean_tree_has_no_problems(): void
    {
        $this->assertSame([], ElementStyle::problems([
            'spacing.padding' => self::at(['top' => '16px', 'left' => 'md']),
            'effects.boxShadow' => self::at([['token' => 'sm'], ['x' => '0px', 'y' => '2px', 'blur' => '4px', 'spread' => '0px', 'color' => 'primary']]),
            'colors.text' => self::at('primary', 'hover'),
            'meta.look' => ['anything' => true],
        ], ['spacing.*', 'effects.*', 'colors.text']));
    }

    public function test_it_reports_disallowed_and_unknown_controls(): void
    {
        $this->assertSame([
            ['id' => 'layout.display', 'reason' => 'not-allowed'],
            ['id' => 'made.up', 'reason' => 'unknown-control'],
        ], ElementStyle::problems(['layout.display' => self::at('grid'), 'made.up' => self::at('x')], ['spacing.*']));
    }

    public function test_one_bad_shadow_layer_is_reported(): void
    {
        $shadow = [['token' => 'sm'], ['x' => '0px', 'y' => '2px', 'blur' => 'oops;', 'color' => 'red']];
        $this->assertSame(
            [['id' => 'effects.boxShadow', 'slot' => 'default', 'breakpoint' => 'base', 'reason' => 'invalid-value', 'value' => $shadow]],
            ElementStyle::problems(['effects.boxShadow' => self::at($shadow)])
        );
    }

    public function test_bad_sides_slots_breakpoints_and_parts_are_reported(): void
    {
        $found = ElementStyle::problems([
            'spacing.margin' => self::at(['top' => 'calc(1px; 2px)']),
            'spacing.padding' => ['wobble' => ['base' => '1px'], 'default' => ['desktop' => '1px']],
            'columns.breakInside' => self::at('avoid', 'before'),
        ]);
        $this->assertSame([
            ['spacing.margin', 'invalid-value'],
            ['spacing.padding', 'unknown-slot'],
            ['spacing.padding', 'unknown-breakpoint'],
            ['columns.breakInside', 'not-on-part'],
        ], array_map(static fn($p) => [$p['id'], $p['reason']], $found));
    }
}
