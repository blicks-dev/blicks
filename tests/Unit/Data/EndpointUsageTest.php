<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Data;

use Blicks\Data\EndpointUsage;
use PHPUnit\Framework\TestCase;

/**
 * The "used on N pages" count behind the warning before an endpoint is removed: one phrase search
 * per endpoint, kept until a post changes.
 */
final class EndpointUsageTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['blicks_test_transients'] = [];
        $GLOBALS['blicks_test_queries'] = [];
        $GLOBALS['blicks_test_found'] = 3;
    }

    public function testSearchesPostContentForTheSavedAttribute(): void
    {
        $this->assertSame(3, EndpointUsage::count('shop'));

        $args = $GLOBALS['blicks_test_queries'][0];
        $this->assertSame('"endpoint":"shop"', $args['s']);
        $this->assertTrue($args['sentence']);
        $this->assertSame(['post_content'], $args['search_columns']);
        $this->assertNotContains('attachment', $args['post_type']);
        $this->assertNotContains('trash', $args['post_status']);
        $this->assertContains('draft', $args['post_status']);
    }

    public function testAsksOnceUntilAPostChanges(): void
    {
        EndpointUsage::count('shop');
        $GLOBALS['blicks_test_found'] = 5;

        $this->assertSame(3, EndpointUsage::count('shop'));
        $this->assertCount(1, $GLOBALS['blicks_test_queries']);

        EndpointUsage::forget();

        $this->assertSame(5, EndpointUsage::count('shop'));
        $this->assertCount(2, $GLOBALS['blicks_test_queries']);
    }

    public function testCannotBeTurnedIntoAnotherSearch(): void
    {
        EndpointUsage::count('shop"%');

        $this->assertSame('"endpoint":"shop"', $GLOBALS['blicks_test_queries'][0]['s']);
        $this->assertSame(0, EndpointUsage::count('"%'));
    }
}
