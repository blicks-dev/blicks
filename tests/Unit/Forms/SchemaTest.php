<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Forms;

use Blicks\Ai\Spec\BlockShapes;
use Blicks\Forms\Schema;
use PHPUnit\Framework\TestCase;

/**
 * The Form vocabulary is written three times: `Schema` (what the server acts on), the TS models
 * (what the editor writes) and BlockShapes::OPTIONS (what agents are told). This pins the PHP two;
 * `resources/blocks/form-schema-parity.test.ts` pins the TS side to `Schema`.
 */
final class SchemaTest extends TestCase
{
    public function test_serializer_options_match_the_schema(): void
    {
        $this->assertSame(Schema::TYPES, BlockShapes::OPTIONS['blicks/field']['type']);
        $this->assertSame(array_keys(Schema::WIDTHS), BlockShapes::OPTIONS['blicks/field']['width']);
        $this->assertSame(Schema::LOOKS, BlockShapes::OPTIONS['blicks/form']['look']);
        $this->assertSame(Schema::LABELS, BlockShapes::OPTIONS['blicks/form']['labels']);
    }

    public function test_names(): void
    {
        $this->assertTrue(Schema::isName('wedding_date'));
        $this->assertFalse(Schema::isName('Wedding'));
        $this->assertFalse(Schema::isName('1st'));
        $this->assertFalse(Schema::isName('token'));
        $this->assertFalse(Schema::isName(str_repeat('a', 41)));
    }

    public function test_find_and_fields_walk_nested_blocks_and_skip_inner_forms(): void
    {
        $field = static fn (string $name, array $extra = []): array => [
            'blockName' => 'blicks/field',
            'attrs' => ['uniqueId' => 'f' . $name, 'name' => $name] + $extra,
            'innerBlocks' => [],
        ];
        $form = [
            'blockName' => 'blicks/form',
            'attrs' => ['uniqueId' => 'abc123'],
            'innerBlocks' => [
                $field('name'),
                ['blockName' => 'blicks/box', 'attrs' => [], 'innerBlocks' => [$field('email', ['type' => 'email'])]],
                $field('name'),
                $field(''),
                ['blockName' => 'blicks/form', 'attrs' => ['uniqueId' => 'inner'], 'innerBlocks' => [$field('other')]],
            ],
        ];
        $page = [['blockName' => 'blicks/section', 'attrs' => [], 'innerBlocks' => [$form]]];

        $this->assertSame($form, Schema::find($page, 'abc123'));
        $this->assertNull(Schema::find($page, 'nope'));
        $this->assertSame(['name', 'email'], array_column(Schema::fields($form), 'name'));
    }
}
