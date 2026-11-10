<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Ai;

use Blicks\Ai\Abilities\CoreAbilities;
use Blicks\Ai\Catalog\BlockCatalog;
use Blicks\Core\Plugin as BlicksPlugin;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The ability table. These are security tests as much as anything: who may call each tool is
 * declared here, and what a client reads to decide whether to ask the user first is the annotation.
 */
final class CoreAbilitiesTest extends TestCase
{
    private const WRITES = ['blicks/save-animation', 'blicks/update-post-layout', 'blicks/create-page', 'blicks/set-post-status'];

    protected function setUp(): void
    {
        BlicksPlugin::boot(dirname(__DIR__, 3) . '/blicks.php');
        BlockCatalog::reset();
    }

    /** @return array<string, array{string}> */
    public static function names(): array
    {
        $names = [];
        foreach (array_keys(CoreAbilities::all()) as $name) {
            $names[$name] = [$name];
        }

        return $names;
    }

    public function test_it_defines_the_expected_abilities(): void
    {
        $this->assertSame(
            [
                'blicks/list-blocks', 'blicks/describe-block', 'blicks/get-design-system', 'blicks/save-animation',
                'blicks/validate-layout', 'blicks/list-posts', 'blicks/get-post-layout',
                'blicks/update-post-layout', 'blicks/create-page', 'blicks/set-post-status',
            ],
            array_keys(CoreAbilities::all())
        );
    }

    #[DataProvider('names')]
    public function test_every_ability_declares_a_permission_and_no_callback_of_its_own(string $name): void
    {
        $args = CoreAbilities::all()[$name];

        $this->assertArrayHasKey('permission', $args);
        $this->assertArrayNotHasKey('permission_callback', $args, 'the provider builds callbacks from declarations');
        foreach (['label', 'description', 'category', 'input_schema', 'execute_callback'] as $key) {
            $this->assertArrayHasKey($key, $args, "{$name} lacks {$key}");
        }
    }

    public function test_tools_on_one_post_are_gated_on_that_post_not_on_editing_in_general(): void
    {
        foreach (['blicks/get-post-layout', 'blicks/update-post-layout', 'blicks/set-post-status'] as $name) {
            $permission = CoreAbilities::all()[$name]['permission'];
            $this->assertSame('edit_post', $permission['cap'], $name);
            $this->assertSame('id', $permission['arg'], $name);
        }

        $this->assertSame('status', CoreAbilities::all()['blicks/set-post-status']['permission']['publishArg']);
        $this->assertSame('create_posts', CoreAbilities::all()['blicks/create-page']['permission']['typeCap']);
    }

    public function test_read_tools_need_the_editor_capability_not_just_a_login(): void
    {
        foreach (['blicks/list-blocks', 'blicks/describe-block', 'blicks/get-design-system', 'blicks/validate-layout', 'blicks/list-posts'] as $name) {
            $this->assertSame('edit_posts', CoreAbilities::all()[$name]['permission'], $name);
        }
    }

    #[DataProvider('names')]
    public function test_nothing_is_offered_on_the_adapters_default_server(string $name): void
    {
        $meta = CoreAbilities::all()[$name]['meta'];

        $this->assertFalse($meta['mcp']['public'], 'one door: the Blicks server, behind its own gate');
        $this->assertArrayNotHasKey('show_in_rest', $meta);
    }

    #[DataProvider('names')]
    public function test_only_the_write_tools_say_they_write(string $name): void
    {
        $annotations = CoreAbilities::all()[$name]['meta']['annotations'];
        $writes = in_array($name, self::WRITES, true);

        $this->assertSame(! $writes, $annotations['readonly'], $name);
    }

    public function test_replacing_a_layout_and_changing_status_are_destructive(): void
    {
        $this->assertTrue(CoreAbilities::all()['blicks/update-post-layout']['meta']['annotations']['destructive']);
        $this->assertTrue(CoreAbilities::all()['blicks/set-post-status']['meta']['annotations']['destructive']);
    }

    public function test_saving_an_animation_needs_the_design_system_capability(): void
    {
        $args = CoreAbilities::all()['blicks/save-animation'];

        $this->assertSame('manage_options', $args['permission'], 'the library is site-wide, as the Design System screen gates it');
        $this->assertFalse($args['meta']['annotations']['destructive'], 'it adds or replaces one entry, never a page');
        $this->assertSame(['slug', 'steps'], $args['input_schema']['required']);
    }

    #[DataProvider('names')]
    public function test_every_input_is_a_closed_object(string $name): void
    {
        $schema = CoreAbilities::all()[$name]['input_schema'];

        $this->assertSame('object', $schema['type']);
        $this->assertFalse($schema['additionalProperties'], "{$name} accepts unknown arguments");
    }

    public function test_block_inputs_are_bounded(): void
    {
        $blocks = CoreAbilities::all()['blicks/update-post-layout']['input_schema']['properties']['blocks'];

        $this->assertSame(500, $blocks['maxItems']);
        $this->assertFalse($blocks['items']['additionalProperties']);
        $this->assertSame(100, $blocks['items']['properties']['name']['maxLength']);
    }

    public function test_describe_block_carries_each_controls_value_schema_and_the_tree_shape(): void
    {
        $described = CoreAbilities::describe('blicks/box');
        $byId = array_column($described['controls'], null, 'id');

        $this->assertArrayHasKey('spacing.padding', $byId);
        $this->assertSame('sides', $byId['spacing.padding']['valueShape']);
        $this->assertSame('spacing', $byId['spacing.padding']['valueSchema']['x-tokens']);
        $this->assertSame('object', $described['valueTree']['type']);
        $this->assertSame(['base', 'tablet', 'mobile'], $described['breakpoints']);
    }

    public function test_describe_block_answers_an_unknown_name_with_the_real_ones(): void
    {
        $this->assertStringContainsString('blicks/box', CoreAbilities::describe('blicks/carousel')['error']);
    }

    public function test_validate_reports_values_the_engine_would_drop(): void
    {
        $result = CoreAbilities::validate([[
            'name' => 'blicks/box',
            'blicks' => ['layout.gapRow' => ['default' => ['base' => '1px; background:url(x)']]],
        ]]);

        $this->assertFalse($result['valid']);
        $this->assertSame('invalid-value', $result['errors'][0]['reason']);
        $this->assertSame('blocks[0].blicks.layout.gapRow.default.base', $result['errors'][0]['path']);
    }

    public function test_validate_reports_a_control_the_block_does_not_allow(): void
    {
        $result = CoreAbilities::validate([['name' => 'blicks/icon', 'blicks' => ['typography.fontSize' => ['default' => ['base' => 'lg']]]]]);

        $this->assertSame('not-allowed', $result['errors'][0]['reason']);
    }

    public function test_validate_refuses_an_oversized_tree_before_looking_at_it(): void
    {
        $result = CoreAbilities::validate(array_fill(0, 501, ['name' => 'blicks/box']));

        $this->assertSame('too-large', $result['errors'][0]['reason']);
        $this->assertCount(1, $result['errors']);
    }

    public function test_validate_accepts_a_good_tree(): void
    {
        $this->assertSame(['valid' => true], CoreAbilities::validate([[
            'name' => 'blicks/box',
            'innerBlocks' => [['name' => 'blicks/heading', 'attributes' => ['content' => 'Hi', 'level' => 2]]],
        ]]));
    }
}
