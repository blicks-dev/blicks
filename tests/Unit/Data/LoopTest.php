<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Data;

use Blicks\Data\Loop;
use Blicks\Data\LoopAttributes;
use Blicks\Data\QuerySource;
use PHPUnit\Framework\TestCase;

/**
 * A Loop's settings come from post content, which any author can write by hand, so they are
 * narrowed the same way for the page and the editor preview. And a query may only ever reach
 * what a visitor could see.
 */
final class LoopTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wp_options'] = [];
        $GLOBALS['wp_object_cache'] = [];
    }

    public function testKeepsPastedJsonByteForByte(): void
    {
        $json = "[\n  {\"title\": \"<b>Bold</b>  &  spaced\"}\n]";

        $this->assertSame($json, LoopAttributes::sanitize(['source' => 'json', 'data' => $json])['data']);
    }

    public function testDropsKeysTheLoopDoesNotHave(): void
    {
        $clean = LoopAttributes::sanitize([
            'source' => 'nope',
            'data' => '[]',
            'path' => 'data.items; DROP',
            'limit' => 999,
            'offset' => -4,
            'filter' => ['field' => "cat\0egory", 'op' => 'regex', 'value' => ['x']],
            'sort' => ['field' => 'price', 'dir' => 'sideways'],
            'evil' => 'x',
        ]);

        $this->assertSame('json', $clean['source']);
        $this->assertSame('', $clean['path']);
        $this->assertSame(50, $clean['limit']);
        $this->assertSame(0, $clean['offset']);
        $this->assertSame(['field' => 'category', 'op' => 'is', 'value' => ''], $clean['filter']);
        $this->assertSame(['field' => 'price', 'dir' => 'asc'], $clean['sort']);
        $this->assertArrayNotHasKey('evil', $clean);
    }

    public function testNarrowsAQuery(): void
    {
        $clean = LoopAttributes::sanitize(['source' => 'query', 'query' => [
            'postType' => 'Post<script>',
            'post_status' => 'any',
            'taxonomy' => ['category' => ['Design', '<x>'], 'post_tag' => 'release'],
            'meta' => ['key' => 'price', 'op' => 'gt', 'value' => '100'],
            'orderBy' => 'meta:price',
            'sticky' => 'only',
        ]])['query'];

        $this->assertSame('postscript', $clean['postType']);
        $this->assertArrayNotHasKey('post_status', $clean);
        $this->assertSame(['category' => ['design', 'x'], 'post_tag' => ['release']], $clean['taxonomy']);
        $this->assertSame(['key' => 'price', 'op' => 'gt', 'value' => '100'], $clean['meta']);
        $this->assertSame('meta:price', $clean['orderBy']);
        $this->assertSame('only', $clean['sticky']);
    }

    public function testInheritIgnoresEverythingElse(): void
    {
        $this->assertSame(['inherit' => true], LoopAttributes::sanitize(['source' => 'query', 'query' => ['inherit' => true, 'postType' => 'page']])['query']);
    }

    public function testQueryAsksOnlyForPublishedVisibleContent(): void
    {
        $args = QuerySource::args(['postType' => 'post'], 0, 0, 0);

        $this->assertSame('publish', $args['post_status']);
        $this->assertFalse($args['has_password']);
        $this->assertTrue($args['no_found_rows']);
        $this->assertSame(12, $args['posts_per_page']);
        $this->assertSame('DESC', $args['order']);
    }

    public function testQueryRefusesAPostTypeVisitorsCannotSee(): void
    {
        $this->assertNull(QuerySource::args(['postType' => 'secret'], 6, 0, 0));
        $this->assertNull(QuerySource::args(['postType' => 'not_registered'], 6, 0, 0));
    }

    public function testQueryCapsTheNumberOfPosts(): void
    {
        $this->assertSame(50, QuerySource::args(['postType' => 'post'], 500, 0, 0)['posts_per_page']);
    }

    public function testQueryFiltersOnlyByPublicTaxonomiesOfThatType(): void
    {
        $args = QuerySource::args(['postType' => 'post', 'taxonomy' => ['category' => ['design'], 'internal_flag' => ['x'], 'product_cat' => ['lamps']]], 6, 0, 0);

        $this->assertSame([['taxonomy' => 'category', 'field' => 'slug', 'terms' => ['design']]], $args['tax_query']);
    }

    public function testQueryReadsOnlyPublicCustomFields(): void
    {
        $product = QuerySource::args(['postType' => 'product', 'meta' => ['key' => 'price', 'op' => 'gt', 'value' => '100'], 'orderBy' => 'meta:price', 'order' => 'asc'], 6, 0, 0);

        $this->assertSame([['key' => 'price', 'compare' => '>', 'value' => '100', 'type' => 'NUMERIC']], $product['meta_query']);
        $this->assertSame('meta_value', $product['orderby']);
        $this->assertSame('price', $product['meta_key']);
        $this->assertSame('ASC', $product['order']);

        foreach (['_price', 'supplier_note'] as $key) {
            $args = QuerySource::args(['postType' => 'product', 'meta' => ['key' => $key, 'op' => 'set'], 'orderBy' => "meta:{$key}"], 6, 0, 0);
            $this->assertArrayNotHasKey('meta_query', $args, $key);
            $this->assertArrayNotHasKey('meta_key', $args, $key);
            $this->assertSame('date', $args['orderby'], $key);
        }
    }

    public function testQueryStickyAndCurrentPost(): void
    {
        $GLOBALS['wp_options']['sticky_posts'] = [7, 9];

        $only = QuerySource::args(['postType' => 'post', 'sticky' => 'only', 'excludeCurrent' => true], 6, 0, 42);
        $first = QuerySource::args(['postType' => 'post', 'sticky' => 'include'], 6, 0, 42);
        $page = QuerySource::args(['postType' => 'page', 'sticky' => 'only'], 6, 0, 42);

        $this->assertSame([7, 9], $only['post__in']);
        $this->assertSame([42], $only['post__not_in']);
        $this->assertFalse($first['ignore_sticky_posts']);
        $this->assertArrayNotHasKey('post__not_in', $first);
        $this->assertArrayNotHasKey('post__in', $page, 'sticky is a post thing');
    }

    public function testRandomOrderHasNoDirection(): void
    {
        $args = QuerySource::args(['postType' => 'post', 'orderBy' => 'rand', 'order' => 'asc'], 6, 0, 0);

        $this->assertSame('rand', $args['orderby']);
        $this->assertArrayNotHasKey('order', $args);
    }

    public function testItemsFromPastedJson(): void
    {
        $json = json_encode(['data' => ['items' => [
            ['id' => 1, 'title' => 'Lamp', 'price' => 189],
            ['id' => 2, 'title' => 'Table', 'price' => 240],
            ['id' => 3, 'title' => 'Vase', 'price' => 48],
        ]]]);

        $result = Loop::items(['source' => 'json', 'data' => $json, 'path' => 'data.items', 'sort' => ['field' => 'price', 'dir' => 'asc'], 'limit' => 2]);

        $this->assertSame([3, 1], array_column($result['items'], 'id'));
        $this->assertSame(3, $result['total']);
        $this->assertSame('data.items', $result['path']);
        $this->assertSame([['path' => 'data.items', 'count' => 3]], $result['lists']);
        $this->assertSame([['key' => 'id', 'type' => 'number'], ['key' => 'title', 'type' => 'text'], ['key' => 'price', 'type' => 'number']], $result['fields']);
        $this->assertNull($result['endpoint']);
    }

    public function testAMissingPathFallsBackToTheFirstList(): void
    {
        $result = Loop::items(['source' => 'json', 'data' => '{"people":[{"name":"Ada"}]}', 'path' => 'old.path']);

        $this->assertSame('people', $result['path']);
        $this->assertSame('Ada', $result['items'][0]['name']);
    }

    public function testBadJsonAndNoListAreErrors(): void
    {
        $this->assertSame('blicks_loop_bad_json', Loop::items(['source' => 'json', 'data' => '{ bad'])->get_error_code());
        $this->assertSame('blicks_loop_no_list', Loop::items(['source' => 'json', 'data' => '{"a":1}'])->get_error_code());
        $this->assertSame('blicks_loop_no_data', Loop::items(['source' => 'json'])->get_error_code());
        $this->assertSame('blicks_loop_too_large', Loop::items(['source' => 'json', 'data' => '[' . str_repeat(' ', 262144) . ']'])->get_error_code());
    }
}
