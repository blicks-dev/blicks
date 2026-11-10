<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Data;

use Blicks\Data\EndpointRegistry;
use Blicks\Data\EndpointSource;
use PHPUnit\Framework\TestCase;

/**
 * Caching and failure handling: visitors are served from the cache, a stale answer is refreshed in
 * the background, and a failing API either keeps the last good answer or empties the Loop, as the
 * endpoint says.
 */
final class EndpointSourceTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wp_options'] = [];
        $GLOBALS['wp_object_cache'] = [];
        $GLOBALS['blicks_test_transients'] = [];
        $GLOBALS['blicks_test_transient_ttl'] = [];
        $GLOBALS['blicks_test_http'] = [];
        $GLOBALS['blicks_test_http_log'] = [];
        $GLOBALS['blicks_test_cron'] = [];
        EndpointRegistry::save(['name' => 'Shop', 'url' => 'https://api.shop.example/items', 'cache' => '1h']);
    }

    private static function ok(mixed $json, int $code = 200): array
    {
        return ['response' => ['code' => $code], 'body' => is_string($json) ? $json : json_encode($json)];
    }

    /** Expire the fresh copy, keeping the last good one, as time passing would. */
    private function expire(): void
    {
        foreach (array_keys($GLOBALS['blicks_test_transients']) as $key) {
            if (!str_ends_with($key, '_last')) {
                unset($GLOBALS['blicks_test_transients'][$key]);
            }
        }
    }

    public function testFetchesOnceThenServesTheCache(): void
    {
        $GLOBALS['blicks_test_http'][] = self::ok([['id' => 1]]);

        $first = EndpointSource::read('shop');
        $second = EndpointSource::read('shop');

        $this->assertSame([['id' => 1]], $first['value']);
        $this->assertSame([['id' => 1]], $second['value']);
        $this->assertFalse($second['stale']);
        $this->assertCount(1, $GLOBALS['blicks_test_http_log']);
        $this->assertContains(3600, $GLOBALS['blicks_test_transient_ttl']);
    }

    public function testAsksSafelyWithATimeoutAndASizeCap(): void
    {
        $GLOBALS['blicks_test_http'][] = self::ok([]);
        EndpointSource::read('shop');

        $args = $GLOBALS['blicks_test_http_log'][0]['args'];
        $this->assertSame('https://api.shop.example/items', $GLOBALS['blicks_test_http_log'][0]['url']);
        $this->assertSame(EndpointSource::TIMEOUT, $args['timeout']);
        $this->assertSame(2, $args['redirection']);
        $this->assertSame(EndpointSource::MAX_BYTES + 1, $args['limit_response_size']);
    }

    /** Nobody's page load is the one that waits on the API once there is an answer to show. */
    public function testServesTheLastGoodAnswerAndRefreshesInTheBackground(): void
    {
        $GLOBALS['blicks_test_http'][] = self::ok([['id' => 1]]);
        EndpointSource::read('shop');
        $this->expire();

        $read = EndpointSource::read('shop');

        $this->assertTrue($read['stale']);
        $this->assertSame([['id' => 1]], $read['value']);
        $this->assertCount(1, $GLOBALS['blicks_test_http_log'], 'no inline fetch');
        $this->assertSame([['time' => $GLOBALS['blicks_test_cron'][0]['time'], 'hook' => EndpointSource::REFRESH_HOOK, 'args' => ['shop']]], $GLOBALS['blicks_test_cron']);

        EndpointSource::read('shop');
        $this->assertCount(1, $GLOBALS['blicks_test_cron'], 'one refresh queued, not one per visitor');
    }

    public function testKeepsTheLastGoodAnswerWhenARefreshFails(): void
    {
        $GLOBALS['blicks_test_http'][] = self::ok([['id' => 1]]);
        EndpointSource::read('shop');
        $this->expire();
        $GLOBALS['blicks_test_http'][] = self::ok('{"error":"down"}', 503);

        $read = EndpointSource::read('shop', true);

        $this->assertTrue($read['stale']);
        $this->assertSame([['id' => 1]], $read['value']);
        $this->assertStringContainsString('503', $read['error']);
    }

    public function testEmptiesTheLoopWhenTheEndpointSaysNotToKeepOldAnswers(): void
    {
        EndpointRegistry::save(['name' => 'Shop', 'url' => 'https://api.shop.example/items', 'keepLastGood' => false], 'shop');
        $GLOBALS['blicks_test_http'][] = self::ok([['id' => 1]]);
        EndpointSource::read('shop');
        $this->expire();
        $GLOBALS['blicks_test_http'][] = self::ok('', 500);

        $this->assertInstanceOf(\WP_Error::class, EndpointSource::read('shop', true));
    }

    public function testRefusesAnAnswerOverOneMegabyte(): void
    {
        $GLOBALS['blicks_test_http'][] = self::ok('[' . str_repeat('1,', EndpointSource::MAX_BYTES) . '1]');

        $read = EndpointSource::read('shop');

        $this->assertInstanceOf(\WP_Error::class, $read);
        $this->assertSame('blicks_loop_too_large', $read->get_error_code());
    }

    public function testRefusesAnAnswerThatIsNotJson(): void
    {
        $GLOBALS['blicks_test_http'][] = self::ok('<html>Login</html>');

        $this->assertSame('blicks_loop_bad_json', EndpointSource::read('shop')->get_error_code());
    }

    public function testSaysWhenItCannotReachTheEndpoint(): void
    {
        $GLOBALS['blicks_test_http'][] = new \WP_Error('http_request_failed', 'timed out');

        $this->assertSame('blicks_loop_unreachable', EndpointSource::read('shop')->get_error_code());
    }

    public function testAnUnknownEndpointIsAnError(): void
    {
        $this->assertSame('blicks_loop_no_endpoint', EndpointSource::read('gone')->get_error_code());
        $this->assertSame([], $GLOBALS['blicks_test_http_log']);
    }

    public function testALoopWithNoEndpointChosenIsNotToldItWasRemoved(): void
    {
        $this->assertSame('blicks_loop_endpoint_unset', EndpointSource::read('')->get_error_code());
        $this->assertSame([], $GLOBALS['blicks_test_http_log']);
    }

    public function testEditingTheAddressStartsANewCache(): void
    {
        $GLOBALS['blicks_test_http'][] = self::ok([['id' => 1]]);
        EndpointSource::read('shop');
        EndpointRegistry::save(['name' => 'Shop', 'url' => 'https://api.shop.example/v2/items'], 'shop');
        $GLOBALS['blicks_test_http'][] = self::ok([['id' => 2]]);

        $this->assertSame([['id' => 2]], EndpointSource::read('shop')['value']);
    }

    public function testStatusIsReadFromTheCacheWithoutFetching(): void
    {
        $shop = EndpointRegistry::find('shop');

        $this->assertSame('never', EndpointSource::status($shop)['state']);

        $GLOBALS['blicks_test_http'][] = self::ok([['id' => 1]]);
        EndpointSource::read('shop');
        $fresh = EndpointSource::status($shop);
        $this->assertSame('fresh', $fresh['state']);
        $this->assertGreaterThan(0, $fresh['fetchedAt']);

        $this->expire();
        $this->assertSame('stale', EndpointSource::status($shop)['state']);
        $this->assertCount(1, $GLOBALS['blicks_test_http_log'], 'status never fetches');
    }

    public function testStatusKeepsTheLastFailureUntilAFetchWorks(): void
    {
        $shop = EndpointRegistry::find('shop');
        $GLOBALS['blicks_test_http'][] = self::ok('', 503);
        EndpointSource::refresh('shop');

        $failed = EndpointSource::status($shop);
        $this->assertSame('failed', $failed['state']);
        $this->assertStringContainsString('503', $failed['error']);
        $this->assertGreaterThan(0, $failed['failedAt']);

        $GLOBALS['blicks_test_http'][] = self::ok([]);
        EndpointSource::refresh('shop');
        $this->assertSame(['state' => 'fresh', 'error' => ''], array_intersect_key(EndpointSource::status($shop), ['state' => 1, 'error' => 1]));
    }

    /** A down API is asked once, not on every page view, until the retry window passes. */
    public function testDoesNotRetryAFailedFetchOnEveryPageView(): void
    {
        $GLOBALS['blicks_test_http'][] = self::ok('', 503);

        $this->assertInstanceOf(\WP_Error::class, EndpointSource::read('shop'));
        $again = EndpointSource::read('shop', true);

        $this->assertInstanceOf(\WP_Error::class, $again);
        $this->assertStringContainsString('503', $again->get_error_message());
        $this->assertCount(1, $GLOBALS['blicks_test_http_log']);
    }

    public function testABackgroundFailureDropsTheOldAnswerWhenTheEndpointSaysSo(): void
    {
        EndpointRegistry::save(['name' => 'Shop', 'url' => 'https://api.shop.example/items', 'keepLastGood' => false], 'shop');
        $GLOBALS['blicks_test_http'][] = self::ok([['id' => 1]]);
        EndpointSource::read('shop');
        $this->expire();
        $GLOBALS['blicks_test_http'][] = self::ok('', 500);

        EndpointSource::refresh('shop');

        $this->assertInstanceOf(\WP_Error::class, EndpointSource::read('shop'));
    }

    /** A name that resolves to the machine itself is refused; an answer another filter gave is left alone. */
    public function testRefusesAHostThatResolvesToAPrivateAddress(): void
    {
        $refused = EndpointSource::refusePrivateHost(false, [], 'https://localhost/items');
        $this->assertInstanceOf(\WP_Error::class, $refused);
        $this->assertSame('blicks_loop_unsafe_url', $refused->get_error_code());

        $answered = ['response' => ['code' => 200], 'body' => '[]'];
        $this->assertSame($answered, EndpointSource::refusePrivateHost($answered, [], 'https://localhost/items'));
        $this->assertFalse(EndpointSource::refusePrivateHost(false, [], 'https://93.184.216.34/items'));
    }
}
