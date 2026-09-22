<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Style;

use Blicks\Style\ElementStyle;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The two methods that describe the style engine to anything outside it: the list of controls it
 * can emit, and the rule deciding which of them a given block accepts.
 *
 * Both are consumed by Blicks Pro, so they are on the extension API — see ExtensionApiTest.
 */
final class ElementStyleControlsTest extends TestCase
{
    protected function tearDown(): void
    {
        ElementStyle::clearDynamicRules();
    }

    // ── controls() ──────────────────────────────────────────────────────────────

    public function test_it_lists_the_controls_the_engine_can_emit(): void
    {
        $ids = array_column(ElementStyle::controls(), 'id');

        $this->assertContains('spacing.padding', $ids);
        $this->assertContains('layout.gapRow', $ids);
        $this->assertContains('typography.role', $ids);
        $this->assertNotContains('', $ids, 'an empty id would match nothing and confuse every error message');
    }

    /** @return array<string, array{string, string}> */
    public static function valueShapes(): array
    {
        return [
            'sides expand to four edges' => ['spacing.padding', 'sides'],
            'inset expands to four edges too' => ['position.inset', 'sides'],
            'corners expand to four corners' => ['border.radius', 'corners'],
            'a single-value control is one value' => ['layout.gapRow', 'scalar'],
            'an enum is one slug' => ['typography.role', 'scalar'],
        ];
    }

    #[DataProvider('valueShapes')]
    public function test_value_shape_follows_the_emission_kind(string $id, string $shape): void
    {
        $this->assertSame($shape, self::control($id)['valueShape']);
    }

    public function test_it_carries_the_token_category_that_resolves_slugs(): void
    {
        $this->assertSame('spacing', self::control('spacing.padding')['category']);
        $this->assertSame('radius', self::control('border.radius')['category']);
        $this->assertNull(self::control('layout.flexDirection')['category'], 'a keyword control resolves no tokens');
    }

    public function test_it_marks_the_tier_three_controls_as_scoped(): void
    {
        $this->assertTrue(self::control('decoration.before')['scoped'], '::before needs a real selector');
        $this->assertFalse(self::control('spacing.padding')['scoped']);
    }

    /**
     * A companion plugin can add rules at runtime, so anything caching this at boot would report
     * Pro's own controls as unknown — and a validator built on it would reject styling that works.
     */
    public function test_it_reflects_rules_registered_after_boot(): void
    {
        $this->assertNull(self::control('custom.glow'));

        ElementStyle::registerRule([
            'attr' => 'custom.glow',
            'cls' => 'glow',
            'kind' => 'single',
            'v' => '--bl-glow',
            'category' => 'color',
        ]);

        $this->assertSame('color', self::control('custom.glow')['category']);
    }

    /**
     * The projection is narrower than the rule table on purpose: `cls`, `v` and the scoped
     * descriptors are emission details that must stay free to change without breaking Pro.
     */
    public function test_it_exposes_only_the_four_documented_keys(): void
    {
        foreach (ElementStyle::controls() as $control) {
            $this->assertSame(['id', 'valueShape', 'category', 'scoped'], array_keys($control));
        }
    }

    // ── allowsControl() ─────────────────────────────────────────────────────────

    /**
     * The parity table the JavaScript half runs too — see
     * `resources/framework/inspector/control-glob.test.ts`. A case added on one side and not the
     * other is exactly the drift this fixture exists to catch, and it caught one on its first run.
     *
     * @return iterable<string, array{list<string>, string, bool}>
     */
    public static function globCases(): iterable
    {
        $fixture = json_decode(
            (string) file_get_contents(__DIR__ . '/../../fixtures/control-glob-cases.json'),
            true
        );

        foreach ($fixture['cases'] as $case) {
            yield $case['why'] => [$case['allow'], $case['id'], $case['allowed']];
        }
    }

    /** @param list<string> $allow */
    #[DataProvider('globCases')]
    public function test_allow_list_matching(array $allow, string $id, bool $expected): void
    {
        $this->assertSame($expected, ElementStyle::allowsControl($id, $allow));
    }

    /**
     * @return array{id: string, valueShape: string, category: string|null, scoped: bool}|null
     */
    private static function control(string $id): ?array
    {
        foreach (ElementStyle::controls() as $control) {
            if ($control['id'] === $id) {
                return $control;
            }
        }

        return null;
    }
}
