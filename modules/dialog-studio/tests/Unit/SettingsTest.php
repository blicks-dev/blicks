<?php
declare(strict_types=1);

namespace BlicksPro\DialogStudio\Tests\Unit;

use BlicksPro\DialogStudio\Settings;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../bootstrap.php';

/**
 * The triggers and rules meta, cleaned. The cases are shared with `resources/settings.test.ts`, so
 * the browser's copy and this one agree on every one of them.
 */
final class SettingsTest extends TestCase
{
    /** @return array<string, array{mixed, array<string, mixed>}> */
    private static function cases(string $kind): array
    {
        $all = json_decode((string) file_get_contents(dirname(__DIR__) . '/settings-cases.json'), true);
        $out = [];

        foreach ($all[$kind] as $case) {
            $out[$case['name']] = [$case['in'], $case['out']];
        }

        return $out;
    }

    /** @return array<string, array{mixed, array<string, mixed>}> */
    public static function triggerCases(): array
    {
        return self::cases('triggers');
    }

    /** @return array<string, array{mixed, array<string, mixed>}> */
    public static function ruleCases(): array
    {
        return self::cases('rules');
    }

    /** @param array<string, mixed> $expected */
    #[DataProvider('triggerCases')]
    public function test_triggers(mixed $in, array $expected): void
    {
        $this->assertSame($expected, Settings::triggers($in));
    }

    /** @param array<string, mixed> $expected */
    #[DataProvider('ruleCases')]
    public function test_rules(mixed $in, array $expected): void
    {
        $this->assertSame($expected, Settings::rules($in));
    }

    public function test_automatic_only_with_a_trigger_on(): void
    {
        $this->assertFalse(Settings::automatic(null));
        $this->assertTrue(Settings::automatic(['idle' => ['on' => true]]));
    }

    public function test_the_defaults_are_what_cleaning_nothing_gives(): void
    {
        $this->assertSame(Settings::triggerDefaults(), Settings::triggers([]));
        $this->assertSame(Settings::ruleDefaults(), Settings::rules([]));
    }
}
