<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Ai;

use Blicks\Style\ElementStyle;
use Blicks\Ai\Catalog\ControlCatalog;
use PHPUnit\Framework\TestCase;

/**
 * The control catalogue.
 *
 * The matching rule itself is the free plugin's — `ElementStyle::allowsControl()`, covered there
 * against a fixture its JavaScript twin runs too. What is tested here is the aggregation on top:
 * keying by id, and resolving an allow-list into ids the engine can actually emit.
 */
final class ControlCatalogTest extends TestCase
{
    protected function tearDown(): void
    {
        ElementStyle::clearDynamicRules();
    }

    public function test_it_keys_the_engines_controls_by_id(): void
    {
        $ids = ControlCatalog::ids();

        $this->assertContains('spacing.padding', $ids);
        $this->assertContains('layout.gapRow', $ids);
        $this->assertSame($ids, array_unique($ids), 'a duplicated id would make lookups ambiguous');
    }

    public function test_it_passes_through_the_shape_and_category(): void
    {
        $this->assertSame('sides', ControlCatalog::get('spacing.padding')['valueShape']);
        $this->assertSame('corners', ControlCatalog::get('border.radius')['valueShape']);
        $this->assertSame('spacing', ControlCatalog::get('layout.gapRow')['category']);
    }

    public function test_unknown_controls_are_absent_rather_than_empty(): void
    {
        $this->assertNull(ControlCatalog::get('spacing.gap'));
        $this->assertFalse(ControlCatalog::has('spacing.gap'));
    }

    /**
     * Pro registers its own rules at runtime, so a catalogue cached at boot would report Pro's
     * controls as unknown and the validator would reject styling that works.
     */
    public function test_it_reflects_rules_registered_after_boot(): void
    {
        $this->assertFalse(ControlCatalog::has('custom.glow'));

        ElementStyle::registerRule([
            'attr' => 'custom.glow',
            'cls' => 'glow',
            'kind' => 'single',
            'v' => '--bl-glow',
            'category' => 'color',
        ]);

        $this->assertTrue(ControlCatalog::has('custom.glow'));
        $this->assertSame('color', ControlCatalog::get('custom.glow')['category']);
    }

    public function test_expand_resolves_globs_to_ids_the_engine_can_emit(): void
    {
        $expanded = ControlCatalog::expand(['spacing.*']);

        $this->assertContains('spacing.padding', $expanded);
        $this->assertContains('spacing.margin', $expanded);
        $this->assertNotContains('border.width', $expanded);
    }

    public function test_expand_drops_entries_no_rule_backs(): void
    {
        $this->assertSame([], ControlCatalog::expand(['nonsense.*', 'also.made.up']));
    }

    /** An expanded list is what a block advertises, so it must never leak a glob back out. */
    public function test_expand_never_returns_a_glob(): void
    {
        foreach (ControlCatalog::expand(['spacing.*', 'layout.*']) as $id) {
            $this->assertStringNotContainsString('*', $id);
        }
    }
}
