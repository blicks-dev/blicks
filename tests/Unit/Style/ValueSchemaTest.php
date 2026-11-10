<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Style;

use Blicks\Style\ElementStyle;
use Blicks\Style\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Each control's value schema is what layout tools and agents write from, so every example it offers
 * has to build to CSS here, as it does in vars.ts (value-schema.test.ts).
 */
final class ValueSchemaTest extends TestCase
{
    public function test_every_control_has_a_schema(): void
    {
        foreach (Schema::RULES as $rule) {
            $this->assertNotNull(ElementStyle::valueSchema($rule['attr']), $rule['attr']);
        }
        $this->assertNull(ElementStyle::valueSchema('nope.nothing'));
    }

    public function test_controls_carry_their_schema(): void
    {
        $padding = array_values(array_filter(ElementStyle::controls(), static fn($c) => 'spacing.padding' === $c['id']))[0];
        $this->assertSame('spacing', $padding['valueSchema']['x-tokens']);
        $this->assertArrayHasKey('examples', $padding['valueSchema']);
    }

    /** @return iterable<string, array{string, mixed}> */
    public static function examples(): iterable
    {
        foreach (Schema::RULES as $rule) {
            $schema = ElementStyle::valueSchema($rule['attr']);
            $values = isset($schema['enum']) ? array_slice($schema['enum'], 0, 2) : ($schema['examples'] ?? []);
            foreach ($values as $i => $value) {
                yield $rule['attr'] . ' #' . $i => [$rule['attr'], $value];
            }
        }
    }

    #[DataProvider('examples')]
    public function test_every_example_builds(string $id, mixed $value): void
    {
        $rule = array_values(array_filter(Schema::RULES, static fn($r) => $r['attr'] === $id))[0];
        $slot = ! empty($rule['partOnly']) ? 'before' : 'default';
        $out = ElementStyle::build([$id => [$slot => ['base' => $value]]], 'abc123');
        $emitted = ! empty($out['classes']) || ! empty($out['vars']) || ! empty($out['scopedCss']);
        $this->assertTrue($emitted, $id . ' did not build from ' . json_encode($value));
    }
}
