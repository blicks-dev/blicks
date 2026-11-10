<?php

declare(strict_types=1);

namespace Blicks\Tests\Unit\Marketplace;

use Blicks\Marketplace\Client;
use Blicks\Settings\AdminSettings;
use PHPUnit\Framework\TestCase;

final class ClientTest extends TestCase
{
    protected function tearDown(): void
    {
        unset($GLOBALS['blicks_test_filters']['blicks_marketplace_request_headers'], $GLOBALS['blicks_test_filters']['blicks_marketplace_licensed']);
        unset($GLOBALS['wp_options'][AdminSettings::MARKETPLACE_OPTION]);
    }

    /**
     * Off until an administrator turns it on, and while off nothing is read or sent: the unit suite
     * has no HTTP or transient functions, so reaching either would be a fatal error here.
     */
    public function testRefusesEveryRouteBeforeAnyRequestWhileOff(): void
    {
        $this->assertFalse(Client::enabled());

        foreach ([Client::list('items', ['built' => 1]), Client::list('terms', []), Client::content('aurora')] as $answer) {
            $this->assertInstanceOf(\WP_Error::class, $answer);
            $this->assertSame('blicks_marketplace_off', $answer->get_error_code());
            $this->assertSame(['status' => 403], $answer->get_error_data());
        }
    }

    public function testIsOnOnlyWhenTheOptionSaysSo(): void
    {
        $GLOBALS['wp_options'][AdminSettings::MARKETPLACE_OPTION] = '0';
        $this->assertFalse(Client::enabled());

        $GLOBALS['wp_options'][AdminSettings::MARKETPLACE_OPTION] = '1';
        $this->assertTrue(Client::enabled());
    }

    public function testJoinsAPathAndQueryOntoAPrettyRoot(): void
    {
        $this->assertSame(
            'https://blicks.dev/wp-json/blicks-marketplace/v1/items?built=1&search=glow',
            Client::url('https://blicks.dev/wp-json/blicks-marketplace/v1', 'items', ['built' => 1, 'search' => 'glow'])
        );
    }

    /** A site without pretty permalinks: the path goes inside rest_route, the rest after `&`. */
    public function testJoinsOntoAQueryStringRoot(): void
    {
        $this->assertSame(
            'http://localhost/?rest_route=/blicks-marketplace/v1/items/aurora/content',
            Client::url('http://localhost/?rest_route=/blicks-marketplace/v1', 'items/aurora/content')
        );
        $this->assertSame(
            'http://localhost/?rest_route=/blicks-marketplace/v1/items&built=1',
            Client::url('http://localhost/?rest_route=/blicks-marketplace/v1', 'items', ['built' => 1])
        );
    }

    public function testPassesOnlyKnownFiltersAndAlwaysAsksForBuiltItems(): void
    {
        $query = Client::listQuery(['search' => 'glow', 'tier' => 'pro', 'evil' => 'x', 'group' => ['a'], 'type' => '']);

        $this->assertSame(['search' => 'glow', 'tier' => 'pro', 'built' => 1], $query);
    }

    /** A filter may add the marketplace's own headers and nothing else. */
    public function testKeepsOnlyBlicksHeadersFromTheFilter(): void
    {
        $GLOBALS['blicks_test_filters']['blicks_marketplace_request_headers'][] = static fn (array $h): array => $h + [
            'X-Blicks-License' => "BLK-123\r\nX-Injected: 1",
            'Authorization' => 'Bearer nope',
            'X-Blicks-Instance' => 'lki_1',
        ];

        $this->assertSame(
            ['Accept' => 'application/json', 'X-Blicks-License' => 'BLK-123X-Injected: 1', 'X-Blicks-Instance' => 'lki_1'],
            Client::headers()
        );
    }

    public function testIsUnlicensedUntilProSaysOtherwise(): void
    {
        $this->assertFalse(Client::licensed());

        $GLOBALS['blicks_test_filters']['blicks_marketplace_licensed'][] = static fn (): bool => true;
        $this->assertTrue(Client::licensed());
    }
}
