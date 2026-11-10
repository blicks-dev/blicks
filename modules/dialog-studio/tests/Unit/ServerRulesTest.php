<?php
declare(strict_types=1);

namespace BlicksPro\DialogStudio\Tests\Unit;

use BlicksPro\DialogStudio\ServerRules;
use BlicksPro\DialogStudio\Settings;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../bootstrap.php';

/** Where and when, decided on the server with nothing about the visitor. */
final class ServerRulesTest extends TestCase
{
    /** @return array{front: bool, type: string, id: int, today: string} */
    private static function page(string $type = 'post', int $id = 12, bool $front = false, string $today = '2026-11-25'): array
    {
        return ['front' => $front, 'type' => $type, 'id' => $id, 'today' => $today];
    }

    public function test_every_page_by_default(): void
    {
        $this->assertTrue(ServerRules::passes(Settings::rules([]), self::page()));
        $this->assertTrue(ServerRules::passes(Settings::rules([]), self::page('', 0)));
    }

    public function test_chosen_pages_only(): void
    {
        $rules = Settings::rules(['where' => 'some', 'include' => ['type:post', 'front']]);

        $this->assertTrue(ServerRules::passes($rules, self::page('post')));
        $this->assertTrue(ServerRules::passes($rules, self::page('page', 2, true)));
        $this->assertFalse(ServerRules::passes($rules, self::page('page', 3)));
        $this->assertFalse(ServerRules::passes(Settings::rules(['where' => 'some']), self::page()), 'chosen pages with none chosen is nowhere');
    }

    public function test_an_exception_wins(): void
    {
        $rules = Settings::rules(['exclude' => ['post:12']]);

        $this->assertFalse(ServerRules::passes($rules, self::page('post', 12)));
        $this->assertTrue(ServerRules::passes($rules, self::page('post', 13)));
    }

    public function test_the_schedule_is_inclusive_at_both_ends(): void
    {
        $rules = Settings::rules(['schedule' => ['on' => true, 'from' => '2026-11-20', 'to' => '2026-12-01']]);

        $this->assertFalse(ServerRules::passes($rules, self::page(today: '2026-11-19')));
        $this->assertTrue(ServerRules::passes($rules, self::page(today: '2026-11-20')));
        $this->assertTrue(ServerRules::passes($rules, self::page(today: '2026-12-01')));
        $this->assertFalse(ServerRules::passes($rules, self::page(today: '2026-12-02')));
        $this->assertTrue(ServerRules::passes(Settings::rules(['schedule' => ['on' => false, 'from' => '2030-01-01']]), self::page()), 'a schedule switched off is ignored');
    }

    public function test_the_window_for_the_browser_is_in_the_site_time_zone(): void
    {
        $rules = Settings::rules(['schedule' => ['on' => true, 'from' => '2026-11-20', 'to' => '2026-11-20']]);
        [$from, $to] = ServerRules::window($rules, new \DateTimeZone('Asia/Kathmandu'));

        $this->assertSame((new \DateTimeImmutable('2026-11-20 00:00:00', new \DateTimeZone('Asia/Kathmandu')))->getTimestamp() * 1000, $from);
        $this->assertSame($from + 86_400_000 - 1, $to);
        $this->assertSame([0, 0], ServerRules::window(Settings::rules([]), new \DateTimeZone('UTC')));
    }
}
