<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Ai;

use Blicks\Ai\Catalog\BlockCatalog;
use Blicks\Ai\Spec\BlockShapes;
use Blicks\Ai\Spec\BlockSpec;
use Blicks\Ai\Spec\SpecSerializer;
use PHPUnit\Framework\TestCase;

/**
 * `blicks_ai_block_catalog` and `blicks_spec_shapes`: a companion's blocks, described to agents
 * and written by the serializer, without being able to redefine the plugin's own.
 */
final class CompanionBlocksTest extends TestCase
{
    private const PROMO_BAR = [
        'name' => 'blicks/promo-bar',
        'title' => 'Promo bar',
        'description' => 'A strip across the top of a page.',
        'attributes' => ['label' => ['type' => 'string', 'default' => '']],
    ];

    protected function setUp(): void
    {
        blicks_test_reset_filters();
        BlockCatalog::reset();
        BlockShapes::reset();
    }

    protected function tearDown(): void
    {
        blicks_test_reset_filters();
        BlockCatalog::reset();
        BlockShapes::reset();
    }

    public function test_a_companion_block_joins_the_catalogue(): void
    {
        blicks_test_add_filter('blicks_ai_block_catalog', static fn (array $blocks): array => $blocks + ['promo-bar' => self::PROMO_BAR]);

        $this->assertTrue(BlockCatalog::has('blicks/promo-bar'));
        $this->assertSame('Promo bar', BlockCatalog::describe('blicks/promo-bar')['title']);
        $this->assertContains('blicks/promo-bar', BlockCatalog::names());
    }

    public function test_the_plugins_own_blocks_cannot_be_redefined_or_removed(): void
    {
        $title = BlockCatalog::describe('blicks/box')['title'];
        BlockCatalog::reset();

        blicks_test_add_filter('blicks_ai_block_catalog', static fn (): array => [
            'box' => ['name' => 'blicks/box', 'title' => 'Hijacked'],
            'x' => ['name' => 'acme/box', 'title' => 'Shadow'],
            'y' => 'nonsense',
        ]);

        $this->assertSame($title, BlockCatalog::describe('blicks/box')['title']);
        $this->assertNotContains('acme/box', BlockCatalog::names());
    }

    public function test_a_companion_shape_lets_the_serializer_write_its_block(): void
    {
        $spec = new BlockSpec('blicks/promo-bar', ['label' => 'Spring sale']);
        $this->assertSame(['blicks/promo-bar'], SpecSerializer::unsupported([$spec]));

        BlockShapes::reset();
        blicks_test_add_filter('blicks_spec_shapes', static fn (array $shapes): array => $shapes + [
            'blicks/promo-bar' => ['tag' => 'a', 'classes' => static fn (): array => ['bl-promo-bar'], 'content' => 'label'],
        ]);

        $this->assertTrue(BlockShapes::supports('blicks/promo-bar'));
        $this->assertSame([], SpecSerializer::unsupported([$spec]));
        $this->assertStringContainsString('<!-- wp:blicks/promo-bar', SpecSerializer::toMarkup([$spec]));
    }

    public function test_a_companion_cannot_change_how_one_of_ours_is_written(): void
    {
        $own = BlockShapes::for('blicks/box');

        blicks_test_add_filter('blicks_spec_shapes', static fn (): array => [
            'blicks/box' => ['tag' => 'div'],
            'acme/thing' => ['tag' => 'div'],
            'blicks/odd' => 'nonsense',
        ]);

        $this->assertSame(array_keys($own), array_keys(BlockShapes::for('blicks/box')));
        $this->assertNull(BlockShapes::for('acme/thing'));
        $this->assertNull(BlockShapes::for('blicks/odd'));
    }

    public function test_a_shape_can_wrap_its_children_in_an_element(): void
    {
        blicks_test_add_filter('blicks_spec_shapes', static fn (array $shapes): array => $shapes + [
            'blicks/promo-bar' => [
                'tag' => 'nav',
                'inner' => static fn (): array => ['tag' => 'ul', 'class' => 'bl-promo-bar__list'],
            ],
        ]);

        $markup = SpecSerializer::toMarkup([new BlockSpec('blicks/promo-bar', ['uniqueId' => 'a1b2c3d4'])]);

        $this->assertStringContainsString('<nav class="bl-promo-bar bl-a1b2c3d4"><ul class="bl-promo-bar__list"></ul></nav>', $markup);
    }

    public function test_a_tag_named_like_a_php_function_is_a_tag(): void
    {
        blicks_test_add_filter('blicks_spec_shapes', static fn (array $shapes): array => $shapes + [
            'blicks/promo-bar' => ['tag' => 'header'],
        ]);

        $markup = SpecSerializer::toMarkup([new BlockSpec('blicks/promo-bar', ['uniqueId' => 'a1b2c3d4'])]);

        $this->assertStringContainsString('<header class="bl-promo-bar bl-a1b2c3d4"></header>', $markup);
    }
}
