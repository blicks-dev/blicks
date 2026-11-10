<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Ai;

use Blicks\Ai\Spec\Links;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** A link is judged as the browser reads it: character references decoded first. */
final class LinksTest extends TestCase
{
    /** @return array<string, array{string}> */
    public static function unsafe(): array
    {
        return [
            'plain' => ['javascript:alert(1)'],
            'decimal reference' => ['java&#115;cript:alert(1)'],
            'named colon' => ['javascript&colon;alert(1)'],
            'leading reference' => ['&#106;avascript:x'],
            'hex reference' => ['&#x6A;avascript:x'],
            'double encoded' => ['java&amp;#115;cript:x'],
            'tab inside' => ["java\tscript:x"],
            'upper case' => ['JAVASCRIPT:x'],
            'data' => ['data:text/html,<b>x</b>'],
            'vbscript' => ['vbscript:x'],
        ];
    }

    #[DataProvider('unsafe')]
    public function test_an_unsafe_scheme_is_refused_however_it_is_spelled(string $url): void
    {
        $this->assertFalse(Links::isSafe($url));
    }

    /** @return array<string, array{string}> */
    public static function safe(): array
    {
        return [
            'https' => ['https://example.test/a?x=1&amp;y=2'],
            'http' => ['http://example.test'],
            'mailto' => ['mailto:a@example.test'],
            'tel' => ['tel:+1555'],
            'path' => ['/about'],
            'fragment' => ['#top'],
            'query with a colon' => ['?q=a:b'],
            'path with a colon later' => ['/a/b:c'],
            'empty' => [''],
        ];
    }

    #[DataProvider('safe')]
    public function test_ordinary_links_pass(string $url): void
    {
        $this->assertTrue(Links::isSafe($url));
    }
}
