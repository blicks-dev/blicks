<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Style;

use Blicks\Style\EngineSchema;
use PHPUnit\Framework\TestCase;

/**
 * The read-only engine description Pro, Studio and the AI validator consume.
 *
 * Pinned against `resources/engine/schema.json` rather than against the generated tables, so the
 * test says what the description promises (every control the schema declares, in its section, with
 * its value shape), not how it is built. `resources/engine/describe.test.ts` runs the same checks
 * on the TS mirror; the two together are the parity guard.
 */
final class EngineSchemaTest extends TestCase
{
    /** @return array<string, mixed> */
    private static function schema(): array
    {
        return json_decode(
            (string) file_get_contents(dirname(__DIR__, 3) . '/resources/engine/schema.json'),
            true,
            512,
            JSON_THROW_ON_ERROR
        );
    }

    public function test_it_has_the_documented_keys_in_order(): void
    {
        $this->assertSame(
            ['version', 'controls', 'states', 'stateControls', 'breakpoints', 'parts', 'sections', 'relations', 'valueShapes', 'valueTree', 'typeRoles'],
            array_keys(EngineSchema::describe())
        );
        $this->assertSame(EngineSchema::VERSION, EngineSchema::describe()['version']);
    }

    public function test_it_describes_every_schema_control_in_order(): void
    {
        $schema = self::schema();

        $this->assertSame(array_column($schema['controls'], 'id'), EngineSchema::controlIds());

        foreach ($schema['controls'] as $declared) {
            $control = EngineSchema::control($declared['id']);
            $this->assertNotNull($control);
            $this->assertSame($declared['section'], $control['section'], $declared['id']);
            $this->assertSame(
                ['id', 'section', 'valueShape', 'category', 'scoped', 'parts', 'partOnly', 'flag', 'value'],
                array_keys($control)
            );
            $this->assertContains($control['valueShape'], ['sides', 'corners', 'scalar']);
            $this->assertArrayHasKey($control['value']['shape'], EngineSchema::describe()['valueShapes']);
        }
    }

    public function test_value_shapes_follow_the_rule_kind(): void
    {
        $this->assertSame('sides', EngineSchema::control('spacing.padding')['valueShape']);
        $this->assertSame('sides', EngineSchema::control('position.inset')['valueShape']);
        $this->assertSame('corners', EngineSchema::control('border.radius')['valueShape']);
        $this->assertSame('scalar', EngineSchema::control('typography.role')['valueShape']);
        $this->assertSame('spacing', EngineSchema::control('spacing.padding')['category']);
    }

    public function test_part_only_controls_are_partable(): void
    {
        $content = EngineSchema::control('decoration.content');

        $this->assertTrue($content['partOnly']);
        $this->assertTrue($content['parts']);
    }

    public function test_states_breakpoints_and_parts_come_from_the_schema(): void
    {
        $schema = self::schema();
        $engine = EngineSchema::describe();

        $this->assertSame(array_keys($schema['states']), array_column($engine['states'], 'id'));
        $this->assertSame(array_keys($schema['breakpoints']), array_column($engine['breakpoints'], 'id'));
        $this->assertNull($engine['breakpoints'][0]['maxWidth'], 'the base breakpoint has no max width');
        $this->assertSame(array_keys($schema['parts']), $engine['parts']);
        $this->assertSame(array_column($schema['sections'], 'id'), array_column($engine['sections'], 'id'));
        $this->assertSame($schema['typeRoles'], $engine['typeRoles']);
        $this->assertCount(count($schema['relations']), $engine['relations']);
    }

    /** Removed in v2's clean break — they must not come back through the description. */
    public function test_dropped_v1_controls_are_absent(): void
    {
        foreach (['layout.float', 'layout.clear', 'layout.direction', 'decoration.before', 'decoration.after', 'layout.gridAutoColumns', 'animation.targetAngle'] as $id) {
            $this->assertNull(EngineSchema::control($id), "{$id} was dropped in v2");
        }
    }

    public function test_unknown_ids_describe_to_null(): void
    {
        $this->assertNull(EngineSchema::control('nope.nothing'));
    }
}
