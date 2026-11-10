<?php
declare(strict_types=1);

namespace BlicksPro\HeaderStudio\Tests;

use Blicks\Ai\Catalog\BlockCatalog;
use Blicks\Ai\Spec\BlockShapes;
use Blicks\Ai\Spec\BlockSpec;
use Blicks\Ai\Spec\SpecSerializer;
use BlicksPro\HeaderStudio\Ai;
use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__ ) . '/support.php';

/**
 * The header blocks' shapes write what their `save()` writes. The reference is
 * `fixtures/shape-cases.json`, recorded from the real JavaScript by blocks.test.tsx, so the two
 * implementations of each block's markup cannot drift apart unnoticed.
 */
final class ShapesTest extends TestCase
{
    protected function setUp(): void
    {
        blicks_test_reset_filters();
        BlockCatalog::reset();
        BlockShapes::reset();
        blicks_test_add_filter('blicks_ai_block_catalog', static fn (array $blocks): array => Ai::catalog($blocks, dirname(__DIR__, 2) . '/blocks'));
        blicks_test_add_filter('blicks_spec_shapes', [Ai::class, 'shapes']);
    }

    protected function tearDown(): void
    {
        blicks_test_reset_filters();
        BlockCatalog::reset();
        BlockShapes::reset();
    }

    /** @return array<string, array{array<string, mixed>, string}> */
    public static function cases(): array
    {
        $cases = [];

        foreach (json_decode((string) file_get_contents(dirname(__DIR__) . '/fixtures/shape-cases.json'), true) as $case) {
            $cases[$case['title']] = [$case['block'], $case['markup']];
        }

        return $cases;
    }

    /**
     * @dataProvider cases
     * @param array<string, mixed> $block
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('cases')]
    public function test_a_spec_is_written_as_the_editor_writes_it(array $block, string $markup): void
    {
        $spec = BlockSpec::fromArray($block);

        $this->assertSame([], SpecSerializer::unsupported([$spec]));
        $this->assertSame($markup, SpecSerializer::toMarkup([$spec]));
    }

    public function test_every_block_is_in_the_catalogue_with_a_shape(): void
    {
        foreach (['header', 'header-row', 'header-area', 'nav', 'nav-item', 'mega-panel', 'link-list'] as $name) {
            $this->assertTrue(BlockCatalog::has('blicks/' . $name), $name);
            $this->assertTrue(BlockShapes::supports('blicks/' . $name), $name);
        }
    }

    public function test_the_plugins_own_blocks_keep_their_shapes(): void
    {
        $shapes = Ai::shapes(['blicks/nav' => ['tag' => 'section']]);

        $this->assertSame(['tag' => 'section'], $shapes['blicks/nav']);
    }
}
