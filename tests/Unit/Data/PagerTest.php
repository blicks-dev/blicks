<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Data;

use Blicks\Data\Loop;
use Blicks\Data\LoopAttributes;
use Blicks\Data\Pager;
use Blicks\Data\QuerySource;
use PHPUnit\Framework\TestCase;

/**
 * A Loop's pages: settings narrowed like every other attribute, the page read from the Loop's own
 * arg, the window each address renders, and links that work with no script.
 */
final class PagerTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wp_options'] = [];
        $GLOBALS['wp_object_cache'] = [];
        $GLOBALS['blicks_test_url'] = '/shop/';
        $GLOBALS['blicks_test_paged'] = 0;
        $GLOBALS['blicks_test_queries'] = [];
        $_GET = [];
    }

    /** @return array<string, mixed> */
    private static function settings(array $more = []): array
    {
        return Pager::sanitize($more + ['mode' => 'pages']);
    }

    /** @return array<string, mixed> */
    private static function state(array $more = []): array
    {
        return $more + ['page' => 1, 'pages' => 1, 'shown' => 0, 'total' => 0, 'arg' => 'loop-3fa2c1d8', 'inherit' => false, 'id' => 'bl-loop-3fa2c1d8'];
    }

    /** A JSON Loop over `$n` items with ids 1…n. */
    private static function json(int $n, array $more = []): array
    {
        return $more + [
            'source' => 'json',
            'data' => (string) json_encode(array_map(static fn (int $i): array => ['id' => $i, 'tier' => 0 === $i % 2 ? 'Pro' : 'Free'], range(1, $n))),
        ];
    }

    public function testOffUnlessAKnownMode(): void
    {
        $this->assertNull(Pager::sanitize(null));
        $this->assertNull(Pager::sanitize(['mode' => 'infinite']));
        $this->assertNull(LoopAttributes::sanitize(['source' => 'json'])['pagination']);
    }

    public function testNarrowsEverySetting(): void
    {
        $clean = Pager::sanitize([
            'mode' => 'pages',
            'show' => 'everything',
            'look' => '"><script>',
            'button' => 'huge',
            'align' => 'left',
            'infinite' => true,
            'labels' => ['prev' => '<b>Back</b>', 'next' => ['x'], 'nav' => '  ', 'evil' => 'x', 'more' => str_repeat('a', 200)],
        ]);

        $this->assertSame('numbers', $clean['show']);
        $this->assertSame('pills', $clean['look']);
        $this->assertSame('outline', $clean['button']);
        $this->assertSame('center', $clean['align']);
        $this->assertFalse($clean['infinite'], 'scroll loading is a Load more option');
        $this->assertSame(['prev', 'more'], array_keys($clean['labels']));
        $this->assertStringNotContainsString('<', $clean['labels']['prev']);
        $this->assertSame(80, mb_strlen($clean['labels']['more']));
    }

    public function testEachLoopReadsItsOwnArg(): void
    {
        $_GET = ['loop-3fa2c1d8' => '3', 'loop-91c0e4a7' => '2'];

        $this->assertSame('loop-3fa2c1d8', Pager::arg('3fa2c1d8'));
        $this->assertSame(3, Pager::requested('loop-3fa2c1d8', false));
        $this->assertSame(2, Pager::requested('loop-91c0e4a7', false));
        $this->assertSame(1, Pager::requested('loop-ffffffff', false));
    }

    public function testABadPageIsPageOne(): void
    {
        foreach (['0', '-2', 'abc', '2.5', '9999999', ''] as $raw) {
            $_GET = ['loop-a' => $raw];
            $this->assertSame(1, Pager::requested('loop-a', false), $raw);
        }
        $_GET = ['loop-a' => ['2']];
        $this->assertSame(1, Pager::requested('loop-a', false));
    }

    public function testAnInheritingLoopFollowsTheArchive(): void
    {
        $GLOBALS['blicks_test_paged'] = 4;
        $_GET = ['loop-a' => '2'];

        $this->assertSame(4, Pager::requested('loop-a', true));
        $this->assertSame('https://site.test/archive/page/3/#x', Pager::url(3, 'loop-a', true, 'x'));
    }

    public function testLinksKeepTheOtherLoopsArg(): void
    {
        $GLOBALS['blicks_test_url'] = '/shop/?loop-91c0e4a7=3&loop-3fa2c1d8=2';

        $this->assertSame('/shop/?loop-91c0e4a7=3&loop-3fa2c1d8=4#top', Pager::url(4, 'loop-3fa2c1d8', false, 'top'));
        $this->assertSame('/shop/?loop-91c0e4a7=3', Pager::url(1, 'loop-3fa2c1d8', false), 'page 1 has no arg');
    }

    public function testLoadMoreRendersPagesOneToN(): void
    {
        $this->assertSame([1, 3], Pager::window('more', 3, 12));
        $this->assertSame([3, 1], Pager::window('pages', 3, 12));
        $this->assertSame([20, 1], Pager::window('more', 20, 12), 'past 200 items an address shows its page alone');
        $this->assertSame(12, Pager::perPage(0));
        $this->assertSame(50, Pager::perPage(80));
    }

    public function testPageLinks(): void
    {
        $html = Pager::markup(self::settings(), self::state(['page' => 2, 'pages' => 6]));

        $this->assertStringContainsString('<nav class="bl-loop__pages is-pills is-align-center" aria-label="Pages">', $html);
        $this->assertStringContainsString('href="/shop/#bl-loop-3fa2c1d8" rel="prev"', $html);
        $this->assertStringContainsString('href="/shop/?loop-3fa2c1d8=3#bl-loop-3fa2c1d8" rel="next"', $html);
        $this->assertStringContainsString('class="bl-loop__page is-current" href="/shop/?loop-3fa2c1d8=2#bl-loop-3fa2c1d8" aria-label="Page 2" aria-current="page">2</a>', $html);
        $this->assertSame(1, substr_count($html, 'aria-current'));
        $this->assertStringContainsString('class="bl-loop__page is-wide"', $html, 'page 4 is shown on wide screens only');
    }

    public function testOnePageNeedsNoLinks(): void
    {
        $this->assertSame('', Pager::markup(self::settings(), self::state(['pages' => 1])));
    }

    public function testTheEndsAreInert(): void
    {
        $first = Pager::markup(self::settings(), self::state(['page' => 1, 'pages' => 3]));
        $last = Pager::markup(self::settings(['show' => 'count', 'labels' => ['nav' => 'Pages of posts']]), self::state(['page' => 3, 'pages' => 3]));

        $this->assertStringContainsString('<span class="bl-loop__page bl-loop__prev is-off" aria-hidden="true">', $first);
        $this->assertStringContainsString('<span class="bl-loop__page bl-loop__next is-off" aria-hidden="true">', $last);
        $this->assertStringContainsString('<span class="bl-loop__count">Page 3 of 3</span>', $last);
        $this->assertStringContainsString('aria-label="Pages of posts"', $last);
    }

    public function testLoadMoreIsALinkToTheNextAddress(): void
    {
        $html = Pager::markup(self::settings(['mode' => 'more', 'button' => 'secondary', 'infinite' => true]), self::state(['page' => 1, 'pages' => 3, 'shown' => 6, 'total' => 17]));

        $this->assertStringContainsString('<p class="bl-loop__status" role="status">Showing 6 of 17</p>', $html);
        $this->assertStringContainsString('class="bl-loop__load bl-button bl-button--secondary bl-button--default-size" href="/shop/?loop-3fa2c1d8=2#bl-loop-3fa2c1d8-7" data-bl-loop-more data-bl-auto', $html);
    }

    public function testLoadMoreEndsWithTheCount(): void
    {
        $html = Pager::markup(self::settings(['mode' => 'more', 'labels' => ['status' => '{shown} / {total} shown']]), self::state(['page' => 3, 'pages' => 3, 'shown' => 17, 'total' => 17]));

        $this->assertStringContainsString('17 / 17 shown', $html);
        $this->assertStringNotContainsString('bl-loop__load', $html);
    }

    public function testJsonIsPagedAfterFilterAndSort(): void
    {
        $attrs = self::json(30, ['limit' => 4, 'offset' => 1, 'filter' => ['field' => 'tier', 'op' => 'is', 'value' => 'pro'], 'sort' => ['field' => 'id', 'dir' => 'desc'], 'pagination' => ['mode' => 'pages']]);
        $page = Loop::items($attrs, 0, false, 2);

        // 15 Pro items, newest first, the first one skipped: 28 26 24 22 | 20 18 16 14 | …
        $this->assertSame([20, 18, 16, 14], array_column($page['items'], 'id'));
        $this->assertSame(14, $page['found']);
        $this->assertSame(4, $page['pages']);
        $this->assertSame(4, $page['from']);
    }

    public function testLoadMoreStacksPages(): void
    {
        $result = Loop::items(self::json(30, ['limit' => 6, 'pagination' => ['mode' => 'more']]), 0, false, 3);

        $this->assertSame(range(1, 18), array_column($result['items'], 'id'));
        $this->assertSame(0, $result['from']);
        $this->assertSame(5, $result['pages']);
    }

    public function testPastTheLastPageIsEmpty(): void
    {
        $result = Loop::items(self::json(5, ['limit' => 2, 'pagination' => ['mode' => 'pages']]), 0, false, 9);

        $this->assertSame([], $result['items']);
        $this->assertSame(3, $result['pages']);
        $this->assertSame(9, $result['page']);
    }

    public function testAnUnpagedLoopIgnoresThePage(): void
    {
        $result = Loop::items(self::json(80), 0, false, 3);

        $this->assertSame(range(1, 50), array_column($result['items'], 'id'), 'still capped at 50');
        $this->assertSame(1, $result['pages']);
    }

    public function testAPagedQueryCountsItsPosts(): void
    {
        $GLOBALS['blicks_test_found'] = 23;

        $result = Loop::items(['source' => 'query', 'query' => ['postType' => 'post'], 'limit' => 5, 'offset' => 2, 'pagination' => ['mode' => 'pages']], 0, false, 3);
        $args = end($GLOBALS['blicks_test_queries']);

        $this->assertSame(5, $args['posts_per_page']);
        $this->assertSame(12, $args['offset'], 'skip 2, then two pages of 5');
        $this->assertFalse($args['no_found_rows']);
        $this->assertSame(21, $result['found']);
        $this->assertSame(5, $result['pages']);
    }

    public function testAnUnpagedQueryStillSkipsCounting(): void
    {
        Loop::items(['source' => 'query', 'query' => ['postType' => 'post'], 'limit' => 5]);

        $this->assertTrue(end($GLOBALS['blicks_test_queries'])['no_found_rows']);
    }

    public function testLoadMoreMayAskForMoreThanFiftyPosts(): void
    {
        $this->assertSame(50, QuerySource::args(['postType' => 'post'], 120, 0, 0)['posts_per_page']);
        $this->assertSame(120, QuerySource::args(['postType' => 'post'], 120, 0, 0, 200)['posts_per_page']);
        $this->assertSame(200, QuerySource::args(['postType' => 'post'], 900, 0, 0, 900)['posts_per_page']);
    }

    public function testAnUnpagedInheritingLoopKeepsTheArchivesPosts(): void
    {
        $GLOBALS['wp_query'] = new \WP_Query(['posts_per_page' => 10]);
        $GLOBALS['blicks_test_queries'] = [];

        $result = Loop::items(['source' => 'query', 'query' => ['inherit' => true]]);

        $this->assertSame([], $GLOBALS['blicks_test_queries'], 'no second query');
        $this->assertSame(1, $result['pages']);
        unset($GLOBALS['wp_query']);
    }

    public function testAPagedInheritingLoopTakesTheArchivesPages(): void
    {
        $GLOBALS['blicks_test_found'] = 34;
        $main = new \WP_Query(['post_type' => 'pattern', 'posts_per_page' => 10, 'paged' => 3]);
        $main->max_num_pages = 4;
        $GLOBALS['wp_query'] = $main;
        $GLOBALS['blicks_test_queries'] = [];

        $pages = Loop::items(['source' => 'query', 'query' => ['inherit' => true], 'limit' => 6, 'pagination' => ['mode' => 'pages']], 0, false, 3);
        $this->assertSame([], $GLOBALS['blicks_test_queries'], 'page 3 is the archive\'s own query');
        $this->assertSame(4, $pages['pages']);
        $this->assertSame(10, $pages['perPage'], 'the archive sets the size, not the limit');
        $this->assertSame(34, $pages['found']);
        $this->assertSame(20, $pages['from']);

        $more = Loop::items(['source' => 'query', 'query' => ['inherit' => true], 'pagination' => ['mode' => 'more']], 0, false, 3);
        $again = end($GLOBALS['blicks_test_queries']);
        $this->assertSame(['pattern', 1, 0, 30], [$again['post_type'], $again['paged'], $again['offset'], $again['posts_per_page']], 'pages 1 to 3 of the same query');
        $this->assertSame(0, $more['from']);
        unset($GLOBALS['wp_query']);
    }
}
