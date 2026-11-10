<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Data;

use Blicks\Data\EndpointRegistry;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The endpoint list is what stands between an author and "make the server fetch this address", so
 * the refusal list is tested address by address.
 */
final class EndpointRegistryTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wp_options'] = [];
        $GLOBALS['wp_object_cache'] = [];
    }

    public static function refused(): array
    {
        return [
            'plain http' => ['http://api.example.com/items'],
            'no scheme' => ['api.example.com/items'],
            'not a url' => ['items please'],
            'empty' => [''],
            'localhost' => ['https://localhost/items'],
            'a .local host' => ['https://printer.local/status'],
            'a .internal host' => ['https://db.internal/x'],
            'loopback' => ['https://127.0.0.1/x'],
            'private 10/8' => ['https://10.0.0.5/x'],
            'private 172.16/12' => ['https://172.20.1.1/x'],
            'private 192.168/16' => ['https://192.168.1.20/data.json'],
            'link-local (cloud metadata)' => ['https://169.254.169.254/latest/meta-data/'],
            'unspecified' => ['https://0.0.0.0/'],
            'ipv6 loopback' => ['https://[::1]/x'],
            'ipv6 unique-local' => ['https://[fd00::1]/x'],
            'credentials in the address' => ['https://user:secret@api.example.com/x'],
            'javascript' => ['javascript:alert(1)'],
        ];
    }

    #[DataProvider('refused')]
    public function testRefusesUnsafeAddresses(string $url): void
    {
        $this->assertNotSame('', EndpointRegistry::check($url), $url);
    }

    public function testAcceptsAPublicHttpsAddress(): void
    {
        $this->assertSame('', EndpointRegistry::check('https://api.summitgoods.example/v1/products?limit=8'));
        $this->assertSame('', EndpointRegistry::check('https://93.184.216.34/items'));
    }

    public function testSavesAnEndpointWithAnIdFromItsName(): void
    {
        $result = EndpointRegistry::save(['name' => 'Shop products', 'url' => 'https://api.shop.example/products', 'cache' => '6h']);

        $this->assertTrue($result['ok']);
        $this->assertSame('shop-products', $result['id']);
        $this->assertSame(
            ['id' => 'shop-products', 'name' => 'Shop products', 'url' => 'https://api.shop.example/products', 'cache' => '6h', 'keepLastGood' => true],
            EndpointRegistry::find('shop-products')
        );
    }

    public function testGivesEachEndpointItsOwnId(): void
    {
        EndpointRegistry::save(['name' => 'Team', 'url' => 'https://a.example/team']);
        $second = EndpointRegistry::save(['name' => 'Team', 'url' => 'https://b.example/team']);

        $this->assertSame('team-2', $second['id']);
        $this->assertCount(2, EndpointRegistry::all());
    }

    public function testRefusesAnUnsafeAddressOnSave(): void
    {
        $result = EndpointRegistry::save(['name' => 'Router', 'url' => 'https://192.168.0.1/']);

        $this->assertFalse($result['ok']);
        $this->assertArrayHasKey('url', $result['errors']);
        $this->assertSame([], EndpointRegistry::all());
    }

    /** The address is checked as typed: http gets its own message, not "Enter a full web address". */
    public function testSaysWhyPlainHttpIsRefused(): void
    {
        $result = EndpointRegistry::save(['name' => 'Shop', 'url' => 'http://api.shop.example/items']);

        $this->assertFalse($result['ok']);
        $this->assertStringContainsString('Plain http is refused', $result['errors']['url']);
    }

    public function testNeedsAName(): void
    {
        $result = EndpointRegistry::save(['name' => '  ', 'url' => 'https://api.example.com/']);

        $this->assertFalse($result['ok']);
        $this->assertArrayHasKey('name', $result['errors']);
    }

    public function testFallsBackToAnHourForAnUnknownCacheTime(): void
    {
        EndpointRegistry::save(['name' => 'X', 'url' => 'https://api.example.com/', 'cache' => 'forever']);

        $this->assertSame('1h', EndpointRegistry::find('x')['cache']);
    }

    public function testUpdatesInPlaceAndKeepsTheId(): void
    {
        EndpointRegistry::save(['name' => 'Team', 'url' => 'https://a.example/team']);
        $result = EndpointRegistry::save(['name' => 'People', 'url' => 'https://a.example/people', 'keepLastGood' => false], 'team');

        $this->assertTrue($result['ok']);
        $this->assertSame('team', $result['id']);
        $this->assertSame('People', EndpointRegistry::find('team')['name']);
        $this->assertFalse(EndpointRegistry::find('team')['keepLastGood']);
    }

    public function testRefusesToUpdateAMissingEndpoint(): void
    {
        $this->assertFalse(EndpointRegistry::save(['name' => 'X', 'url' => 'https://a.example/'], 'gone')['ok']);
    }

    public function testDeletes(): void
    {
        EndpointRegistry::save(['name' => 'Team', 'url' => 'https://a.example/team']);

        $this->assertSame([], EndpointRegistry::delete('team'));
        $this->assertNull(EndpointRegistry::find('team'));
    }

    /** A stored entry that is no longer safe (written by hand, or before a rule tightened) is not served. */
    public function testIgnoresAStoredEntryThatIsNoLongerSafe(): void
    {
        \Blicks\Models\SettingModel::setValue('data.endpoints', [
            ['id' => 'old', 'name' => 'Old', 'url' => 'http://insecure.example/', 'cache' => '1h'],
            ['id' => 'ok', 'name' => 'Ok', 'url' => 'https://secure.example/', 'cache' => '1h'],
        ]);

        $this->assertSame(['ok'], array_column(EndpointRegistry::all(), 'id'));
    }
}
