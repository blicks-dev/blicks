<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Ai;

use Blicks\Core\Plugin as BlicksPlugin;
use Blicks\Ai\Catalog\BlockCatalog;
use PHPUnit\Framework\TestCase;

/**
 * The block catalogue — what a caller is told about a block before it tries to build one.
 *
 * Reads the *free* plugin's block metadata, which is the one place this layer reaches outside
 * Pro's own checkout.
 */
final class BlockCatalogTest extends TestCase
{
    protected function setUp(): void
    {
        // The free plugin's root, resolved the same way tests/bootstrap.php resolves its
        // autoloader. Nothing here touches WordPress beyond the plugin_dir_path() stub.
        BlicksPlugin::boot(self::blicksPath() . '/blicks.php');
        BlockCatalog::reset();
    }

    private static function blicksPath(): string
    {
        return dirname(__DIR__, 3);
    }

    public function test_it_finds_every_shipped_block(): void
    {
        $names = BlockCatalog::names();

        $this->assertContains('blicks/box', $names);
        $this->assertContains('blicks/heading', $names);
        $this->assertContains('blicks/list', $names);
        $this->assertContains('blicks/list-item', $names);
        $this->assertContains('blicks/steps', $names);
        $this->assertContains('blicks/loop', $names);
        $this->assertContains('blicks/dialog', $names);
        $this->assertContains('blicks/menu-link', $names);
        $this->assertContains('blicks/form', $names);
        $this->assertContains('blicks/field', $names);
        $this->assertContains('blicks/input', $names);
        $this->assertCount(18, $names, 'eight layout primitives, the List pair, the Steps pair, the Loop, the Dialog, the Menu link and the Form, Field and Input ship today');
    }

    /**
     * `__golden__` and the shared block helpers sit in the same directory as the blocks, so
     * "a subdirectory" is not what defines a block — a block.json is.
     */
    public function test_it_ignores_directories_without_block_metadata(): void
    {
        $this->assertNotContains('blicks/__golden__', BlockCatalog::names());
        $this->assertFalse(BlockCatalog::has('blicks/shared'));
    }

    public function test_it_accepts_a_bare_slug_or_a_qualified_name(): void
    {
        $this->assertTrue(BlockCatalog::has('blicks/box'));
        $this->assertTrue(BlockCatalog::has('box'));
        $this->assertFalse(BlockCatalog::has('blicks/carousel'));
    }

    /**
     * The point of the catalogue: a caller asking what it may style gets concrete ids, not the
     * globs the metadata happens to store.
     */
    public function test_it_expands_the_control_globs(): void
    {
        $box = BlockCatalog::describe('blicks/box');

        $this->assertNotContains('spacing.*', $box['controls'], 'a caller cannot write a glob');
        $this->assertContains('spacing.padding', $box['controls']);
        $this->assertContains('layout.gapRow', $box['controls']);
    }

    public function test_it_reports_the_states_a_block_styles(): void
    {
        $this->assertSame(
            ['default', 'group', 'groupActive', 'hover', 'focus', 'active', 'play', 'on', 'groupOn', 'reduced'],
            BlockCatalog::describe('blicks/box')['states']
        );
    }

    public function test_it_carries_the_attributes_and_their_defaults(): void
    {
        $box = BlockCatalog::describe('blicks/box');

        $this->assertArrayHasKey('kind', $box['attributes']);
        $this->assertSame('plain', BlockCatalog::defaults('blicks/box')['kind']);
        $this->assertArrayNotHasKey('uniqueId', BlockCatalog::defaults('blicks/box'), 'no default declared');
    }

    /**
     * `json_decode( …, true )` flattens `{}` to `[]`, so an object attribute's empty default would
     * re-encode as an array and tell a caller to send one. It would then be refused by the
     * validator for doing what the catalogue told it.
     */
    public function test_an_empty_object_default_stays_an_object(): void
    {
        $blicks = BlockCatalog::describe('blicks/box')['attributes']['blicks'];

        $this->assertSame('object', $blicks['type']);
        $this->assertIsObject($blicks['default']);
        $this->assertSame('{"type":"object","default":{}}', json_encode($blicks));
    }

    public function test_an_unknown_block_describes_as_null(): void
    {
        $this->assertNull(BlockCatalog::describe('blicks/carousel'));
        $this->assertNull(BlockCatalog::describe('core/paragraph'));
    }

    /**
     * Every block ships a title and description — they are what a caller picking a block reads,
     * and an empty one makes the catalogue useless for exactly the block it omits.
     */
    public function test_every_block_is_described(): void
    {
        foreach (BlockCatalog::all() as $name => $described) {
            $this->assertNotSame('', $described['title'], "{$name} has no title");
            $this->assertNotSame('', $described['description'], "{$name} has no description");
        }
    }
}
