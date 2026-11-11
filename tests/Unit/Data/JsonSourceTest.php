<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Data;

use Blicks\Data\JsonSource;
use PHPUnit\Framework\TestCase;

/**
 * Pasted JSON comes from post content, so its size and depth are capped before it is decoded.
 * Both caps are exact: one level or one byte past them is refused, the cap itself is not.
 */
final class JsonSourceTest extends TestCase
{
    /** `$levels` levels counting the innermost value, as json_decode's depth does. */
    private static function nested(int $levels): string
    {
        return str_repeat('[', $levels - 1) . '1' . str_repeat(']', $levels - 1);
    }

    public function testRefusesJsonDeeperThanTheCap(): void
    {
        $this->assertNotInstanceOf(\WP_Error::class, JsonSource::decode(self::nested(JsonSource::MAX_DEPTH)));

        $deep = JsonSource::decode(self::nested(JsonSource::MAX_DEPTH + 1));
        $this->assertInstanceOf(\WP_Error::class, $deep);
        $this->assertSame('blicks_loop_bad_json', $deep->get_error_code());
    }

    public function testRefusesOneByteOverTheSizeCapAndAcceptsTheCapItself(): void
    {
        $exact = '"' . str_repeat('a', JsonSource::MAX_BYTES - 2) . '"';
        $this->assertSame(JsonSource::MAX_BYTES, strlen($exact));
        $this->assertSame(JsonSource::MAX_BYTES - 2, strlen(JsonSource::decode($exact)));

        $over = JsonSource::decode('"' . str_repeat('a', JsonSource::MAX_BYTES - 1) . '"');
        $this->assertInstanceOf(\WP_Error::class, $over);
        $this->assertSame('blicks_loop_too_large', $over->get_error_code());
    }
}
