<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Ai;

use Blicks\Ai\Spec\BlockSpec;
use Blicks\Ai\Spec\SpecParser;
use PHPUnit\Framework\TestCase;

/**
 * Reading stored content back into specs.
 *
 * Driven from `parse_blocks()`-shaped arrays rather than markup: core's parser is not what would
 * break, and this way the mapping is covered without WordPress loaded.
 */
final class SpecParserTest extends TestCase
{
    public function test_it_lifts_the_style_tree_out_of_the_attributes(): void
    {
        $specs = SpecParser::fromParsedBlocks([
            [
                'blockName' => 'blicks/box',
                'attrs' => [
                    'uniqueId' => 'accfc3c6',
                    'align' => 'center',
                    'blicks' => ['layout.gapRow' => ['default' => ['base' => 'md']]],
                ],
                'innerBlocks' => [],
            ],
        ]);

        $this->assertCount(1, $specs);
        $this->assertSame('blicks/box', $specs[0]->name);
        $this->assertSame(['uniqueId' => 'accfc3c6', 'align' => 'center'], $specs[0]->attributes);
        $this->assertSame(['layout.gapRow' => ['default' => ['base' => 'md']]], $specs[0]->blicks);
    }

    /**
     * The gaps between blocks parse as entries with a null blockName and nothing but whitespace
     * in them. They are not blocks and carry nothing a caller could act on.
     */
    public function test_it_drops_the_freeform_gaps_between_blocks(): void
    {
        $specs = SpecParser::fromParsedBlocks([
            ['blockName' => null, 'attrs' => [], 'innerBlocks' => [], 'innerHTML' => "\n\n"],
            ['blockName' => 'blicks/box', 'attrs' => [], 'innerBlocks' => []],
            ['blockName' => null, 'attrs' => [], 'innerBlocks' => [], 'innerHTML' => "\n"],
        ]);

        $this->assertCount(1, $specs);
        $this->assertSame('blicks/box', $specs[0]->name);
    }

    /**
     * A page is a mix. Returning only the Blicks blocks would invite a caller to write back a
     * layout with everything else deleted.
     */
    public function test_it_keeps_blocks_from_other_plugins(): void
    {
        $specs = SpecParser::fromParsedBlocks([
            ['blockName' => 'core/paragraph', 'attrs' => ['content' => 'Hello'], 'innerBlocks' => []],
        ]);

        $this->assertSame('core/paragraph', $specs[0]->name);
    }

    public function test_it_recurses_into_inner_blocks(): void
    {
        $specs = SpecParser::fromParsedBlocks([
            [
                'blockName' => 'blicks/box',
                'attrs' => [],
                'innerBlocks' => [
                    [
                        'blockName' => 'blicks/buttons',
                        'attrs' => [],
                        'innerBlocks' => [
                            ['blockName' => 'blicks/button', 'attrs' => ['text' => 'Action'], 'innerBlocks' => []],
                        ],
                    ],
                ],
            ],
        ]);

        $button = $specs[0]->innerBlocks[0]->innerBlocks[0];

        $this->assertSame('blicks/button', $button->name);
        $this->assertSame(['text' => 'Action'], $button->attributes);
        $this->assertCount(3, $specs[0]->walk(), 'walk() yields the block and both descendants');
    }

    public function test_a_block_with_no_styling_carries_an_empty_tree(): void
    {
        $specs = SpecParser::fromParsedBlocks([
            ['blockName' => 'blicks/box', 'attrs' => [], 'innerBlocks' => []],
        ]);

        $this->assertSame([], $specs[0]->blicks);
        $this->assertSame(['name' => 'blicks/box'], $specs[0]->toArray(), 'nothing empty is serialised');
    }

    public function test_round_tripping_a_spec_through_its_array_form_is_lossless(): void
    {
        $original = SpecParser::fromParsedBlocks([
            [
                'blockName' => 'blicks/box',
                'attrs' => ['align' => 'center', 'blicks' => ['layout.gapRow' => ['default' => ['base' => 'md']]]],
                'innerBlocks' => [
                    ['blockName' => 'blicks/heading', 'attrs' => ['level' => 2], 'innerBlocks' => []],
                ],
            ],
        ])[0];

        $this->assertEquals($original, BlockSpec::fromArray($original->toArray()));
    }

    public function test_wp_attributes_folds_the_style_tree_back_in(): void
    {
        $spec = new BlockSpec(
            'blicks/box',
            ['align' => 'center'],
            ['layout.gapRow' => ['default' => ['base' => 'md']]]
        );

        $this->assertSame(
            ['align' => 'center', 'blicks' => ['layout.gapRow' => ['default' => ['base' => 'md']]]],
            $spec->wpAttributes()
        );
    }
}
