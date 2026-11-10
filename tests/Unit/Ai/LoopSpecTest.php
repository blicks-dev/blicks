<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Ai;

use Blicks\Ai\Abilities\CoreAbilities;
use Blicks\Ai\Catalog\BlockCatalog;
use Blicks\Ai\Spec\BlockShapes;
use Blicks\Ai\Spec\BlockSpec;
use Blicks\Ai\Spec\SpecValidator;
use Blicks\Core\Plugin as BlicksPlugin;
use Blicks\Data\EndpointRegistry;
use PHPUnit\Framework\TestCase;

/**
 * Loops written by an agent: describe-block says how, the validator refuses a Loop that would
 * render nothing, and bindings are only accepted where the page can fill them.
 */
final class LoopSpecTest extends TestCase
{
    protected function setUp(): void
    {
        BlicksPlugin::boot(dirname(__DIR__, 3) . '/blicks.php');
        BlockCatalog::reset();
        $GLOBALS['wp_options'] = [];
        $GLOBALS['wp_object_cache'] = [];
    }

    private static function bound(string $key): array
    {
        return ['bindings' => ['content' => ['source' => 'blicks/item', 'args' => ['key' => $key]]]];
    }

    /** @param array<string, mixed> $data */
    private function messages(array $data): string
    {
        return implode("\n", array_column(SpecValidator::validate(BlockSpec::fromArray($data)), 'message'));
    }

    /** @param array<string, mixed> $attributes */
    private static function loop(array $attributes, array $inner = []): array
    {
        return [
            'name' => 'blicks/loop',
            'attributes' => $attributes,
            'innerBlocks' => $inner ?: [['name' => 'blicks/heading', 'attributes' => ['metadata' => self::bound('title')]]],
        ];
    }

    public function test_the_guides_example_is_a_valid_loop(): void
    {
        $guide = CoreAbilities::describe('blicks/loop')['loop'];

        $this->assertSame([], SpecValidator::validate(BlockSpec::fromArray($guide['example'])));
        $this->assertSame(['content'], $guide['bindable']['blicks/heading']);
        $this->assertSame(['url', 'alt', 'href'], $guide['bindable']['blicks/image']);
        $this->assertContains('currency', $guide['formats']);
    }

    public function test_the_guide_lists_endpoints_without_their_addresses(): void
    {
        EndpointRegistry::save(['name' => 'Shop', 'url' => 'https://api.shop.example/items']);

        $this->assertSame([['id' => 'shop', 'name' => 'Shop']], CoreAbilities::loopGuide()['endpoints']);
    }

    public function test_a_loop_is_a_block_the_server_can_write(): void
    {
        $this->assertTrue(BlockShapes::supports('blicks/loop'));
        $this->assertSame(['json', 'endpoint', 'query'], CoreAbilities::describe('blicks/loop')['attributes']['source']['enum']);
    }

    public function test_pasted_data_must_be_a_list_of_objects(): void
    {
        $this->assertStringContainsString('not valid JSON', $this->messages(self::loop(['data' => '[{"title":'])));
        $this->assertStringContainsString('no list of objects', $this->messages(self::loop(['data' => '{"title":"One"}'])));
        $this->assertSame('', $this->messages(self::loop(['data' => '{"data":{"items":[{"title":"One"}]}}', 'path' => 'data.items'])));
    }

    public function test_an_endpoint_must_be_one_the_site_has(): void
    {
        $this->assertStringContainsString('no data endpoints', $this->messages(self::loop(['source' => 'endpoint', 'endpoint' => 'shop'])));

        EndpointRegistry::save(['name' => 'Shop', 'url' => 'https://api.shop.example/items']);

        $this->assertSame('', $this->messages(self::loop(['source' => 'endpoint', 'endpoint' => 'shop'])));
        $this->assertStringContainsString('one of this site\'s data endpoints: shop', $this->messages(self::loop(['source' => 'endpoint', 'endpoint' => 'https://evil.example/'])));
    }

    public function test_a_query_must_name_a_public_post_type(): void
    {
        $this->assertSame('', $this->messages(self::loop(['source' => 'query', 'query' => ['postType' => 'post']])));
        $this->assertStringContainsString('public post type', $this->messages(self::loop(['source' => 'query', 'query' => ['postType' => 'secret']])));
    }

    public function test_a_loop_needs_a_card_and_cannot_nest(): void
    {
        $this->assertStringContainsString('Give it a card', $this->messages(['name' => 'blicks/loop', 'attributes' => ['data' => '[{"a":1}]']]));
        $this->assertStringContainsString('inside another Loop', $this->messages(self::loop(['data' => '[{"a":1}]'], [self::loop(['data' => '[{"a":1}]'])])));
    }

    public function test_bindings_only_inside_a_loop_and_only_on_bindable_attributes(): void
    {
        $this->assertStringContainsString('Only blocks inside a blicks/loop', $this->messages(['name' => 'blicks/heading', 'attributes' => ['metadata' => self::bound('title')]]));

        $level = ['bindings' => ['level' => ['source' => 'blicks/item', 'args' => ['key' => 'n']]]];
        $this->assertStringContainsString('can show a field in: content', $this->messages(self::loop(['data' => '[{"a":1}]'], [['name' => 'blicks/heading', 'attributes' => ['metadata' => $level]]])));
    }

    public function test_a_binding_has_one_shape(): void
    {
        $with = static fn (array $binding): array => self::loop(['data' => '[{"a":1}]'], [['name' => 'blicks/text', 'attributes' => ['metadata' => ['bindings' => ['content' => $binding]]]]]);

        $this->assertStringContainsString('A binding is', $this->messages($with(['source' => 'core/post-meta', 'args' => ['key' => 'a']])));
        $this->assertStringContainsString('A binding is', $this->messages($with(['source' => 'blicks/item', 'args' => []])));
        $this->assertStringContainsString('"format" must be one of', $this->messages($with(['source' => 'blicks/item', 'args' => ['key' => 'a', 'format' => 'php']])));
        $this->assertStringContainsString('may hold only', $this->messages($with(['source' => 'blicks/item', 'args' => ['key' => 'a', 'html' => '<b>']])));
        $this->assertStringContainsString('HTML comment', $this->messages($with(['source' => 'blicks/item', 'args' => ['key' => 'a', 'fallback' => '--><!-- wp:x']])));
        $this->assertSame('', $this->messages($with(['source' => 'blicks/item', 'args' => ['key' => 'a', 'format' => 'truncate', 'formatArg' => '40', 'fallback' => 'None']])));
    }

    public function test_a_link_fallback_must_be_a_safe_address(): void
    {
        $button = static fn (string $fallback): array => self::loop(['data' => '[{"a":1}]'], [['name' => 'blicks/button', 'attributes' => ['text' => 'Go', 'metadata' => ['bindings' => ['url' => ['source' => 'blicks/item', 'args' => ['key' => 'link', 'fallback' => $fallback]]]]]]]);

        $this->assertStringContainsString('fallback must be an http(s) address', $this->messages($button('javascript:alert(1)')));
        $this->assertSame('', $this->messages($button('/shop')));
    }

    public function test_metadata_holds_only_bindings_and_a_name(): void
    {
        $this->assertStringContainsString('may hold only bindings and name', $this->messages(['name' => 'blicks/text', 'attributes' => ['metadata' => ['blockVisibility' => false]]]));
        $this->assertSame('', $this->messages(['name' => 'blicks/text', 'attributes' => ['metadata' => ['name' => 'Price']]]));
    }

    public function test_the_guide_says_how_to_page_a_loop(): void
    {
        $guide = CoreAbilities::describe('blicks/loop')['loop'];

        $this->assertStringContainsString('"pagination"', $guide['about']);
        $this->assertSame(['pages', 'more'], $guide['pagination']['modes']);
        $this->assertSame([], SpecValidator::validate(BlockSpec::fromArray(self::loop(['source' => 'json', 'data' => '[{"title":"A"}]', 'limit' => 12, 'pagination' => ['mode' => 'more', 'button' => 'secondary']]))));
    }

    public function test_an_unknown_pagination_mode_is_refused(): void
    {
        $this->assertStringContainsString('"pagination" must be an object whose "mode" is one of: pages, more', $this->messages(self::loop(['source' => 'json', 'data' => '[{"title":"A"}]', 'pagination' => ['mode' => 'scroll']])));
    }
}
