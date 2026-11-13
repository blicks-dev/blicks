<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Data;

use Blicks\Data\ItemSource;
use Blicks\Data\Loop;
use Blicks\Data\LoopAttributes;
use PHPUnit\Framework\TestCase;

/**
 * "A list of the item above": a Loop inside another Loop's card repeats over one of the card
 * item's lists.
 */
final class ItemSourceTest extends TestCase
{
    private const TRIP = [
        'title' => 'Everest Base Camp Trek',
        'price' => 1290,
        'itinerary' => [
            ['day' => 1, 'title' => 'Fly to Lukla'],
            ['day' => 2, 'title' => 'Trek to Namche'],
        ],
        'includes' => ['Guide', 'Permits', 3, true],
        'empty' => [],
        'meta' => ['code' => 'EBC-14'],
    ];

    public function testListsAreTheItemsNonEmptyListsInFieldOrder(): void
    {
        $this->assertSame(
            [['path' => 'itinerary', 'count' => 2], ['path' => 'includes', 'count' => 4]],
            ItemSource::lists(self::TRIP)
        );
    }

    public function testAListOfObjectsGivesOneItemPerObject(): void
    {
        $read = ItemSource::items(self::TRIP, 'itinerary');

        $this->assertSame('itinerary', $read['path']);
        $this->assertSame([['day' => 1, 'title' => 'Fly to Lukla'], ['day' => 2, 'title' => 'Trek to Namche']], $read['items']);
    }

    public function testPlainValuesBecomeValueItems(): void
    {
        $this->assertSame(
            [['value' => 'Guide'], ['value' => 'Permits'], ['value' => 3], ['value' => true]],
            ItemSource::items(self::TRIP, 'includes')['items']
        );
    }

    public function testNoPathTakesTheFirstList(): void
    {
        $this->assertSame('itinerary', ItemSource::items(self::TRIP, '')['path']);
    }

    public function testNothingToReadIsEmptyNotAnError(): void
    {
        $this->assertSame([], ItemSource::items(null, 'itinerary')['items'], 'no Loop above');
        $this->assertSame([], ItemSource::items(self::TRIP, 'missing')['items'], 'no such field');
        $this->assertSame([], ItemSource::items(self::TRIP, 'title')['items'], 'not a list');
        $this->assertSame([], ItemSource::items(self::TRIP, 'meta')['items'], 'an object, not a list');
        $this->assertSame([], ItemSource::items(self::TRIP, 'empty')['items'], 'an empty list');
        $this->assertSame([], ItemSource::items(['title' => 'x'], '')['items'], 'no lists at all');
    }

    public function testListsOfListsAreSkipped(): void
    {
        $this->assertSame([['value' => 'a']], ItemSource::items(['l' => [['x', 'y'], 'a']], 'l')['items']);
    }

    public function testTheSourceIsBuiltInAndNeverPaged(): void
    {
        $this->assertContains(ItemSource::ID, Loop::SOURCES);

        $clean = LoopAttributes::sanitize([
            'source' => 'item',
            'path' => 'itinerary',
            'pagination' => ['mode' => 'numbers'],
        ]);

        $this->assertSame('item', $clean['source']);
        $this->assertSame('itinerary', $clean['path']);
        $this->assertNull($clean['pagination']);
    }

    public function testLoopItemsReadsTheParentItemsList(): void
    {
        $result = Loop::items(['source' => 'item', 'path' => 'itinerary', 'limit' => 1], 0, false, 1, self::TRIP);

        $this->assertSame([['day' => 1, 'title' => 'Fly to Lukla']], $result['items']);
        $this->assertSame(2, $result['total']);
        $this->assertSame(['day', 'title'], array_column($result['fields'], 'key'));
        $this->assertSame(['itinerary', 'includes'], array_column($result['lists'], 'path'));

        $this->assertSame([], Loop::items(['source' => 'item', 'path' => 'itinerary'])['items'], 'no parent');
    }
}
