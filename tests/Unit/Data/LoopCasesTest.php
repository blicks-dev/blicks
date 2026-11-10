<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Data;

use Blicks\Data\Formatter;
use Blicks\Data\ItemPipeline;
use Blicks\Data\JsonSource;
use Blicks\Data\Pager;
use Blicks\Data\Rules;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The shared cases in tests/fixtures/loop-cases.json, on the PHP side. The editor's TypeScript
 * mirror runs the same file; a case that passes here and fails there is a preview that lies.
 */
final class LoopCasesTest extends TestCase
{
    /** @return array<string, mixed> */
    private static function cases(string $group): array
    {
        $all = json_decode((string) file_get_contents(dirname(__DIR__, 2) . '/fixtures/loop-cases.json'), true, 64, JSON_THROW_ON_ERROR);
        $out = [];

        foreach ($all[$group] as $i => $case) {
            $out[($case['name'] ?? $group) . " #{$i}"] = [$case];
        }

        return $out;
    }

    public static function formatCases(): array { return self::cases('format'); }

    public static function resolveCases(): array { return self::cases('resolve'); }

    public static function matchCases(): array { return self::cases('match'); }

    public static function pipelineCases(): array { return self::cases('pipeline'); }

    public static function ruleCases(): array { return self::cases('rules'); }

    public static function slotCases(): array { return self::cases('slotSpan'); }

    public static function listCases(): array { return self::cases('lists'); }

    public static function pageCases(): array { return self::cases('pages'); }

    #[DataProvider('formatCases')]
    public function testFormat(array $case): void
    {
        $this->assertSame($case['out'], Formatter::format($case['value'], $case['format'], $case['arg']));
    }

    #[DataProvider('resolveCases')]
    public function testResolve(array $case): void
    {
        $this->assertSame($case['out'], Formatter::resolve($case['item'], $case['args'], $case['kind']));
    }

    #[DataProvider('matchCases')]
    public function testMatch(array $case): void
    {
        $this->assertSame($case['out'], ItemPipeline::matches($case['value'], $case['op'], $case['want']));
    }

    #[DataProvider('pipelineCases')]
    public function testPipeline(array $case): void
    {
        $run = ItemPipeline::run($case['items'], $case['config']);

        $this->assertSame($case['out']['ids'], array_column($run['items'], 'id'));
        $this->assertSame($case['out']['total'], $run['total']);
        $this->assertSame($case['out']['matched'], $run['matched']);
    }

    #[DataProvider('ruleCases')]
    public function testRules(array $case): void
    {
        $this->assertSame($case['out'], Rules::effects($case['rules'], $case['item'], $case['position'], $case['span']));
    }

    #[DataProvider('slotCases')]
    public function testSlotSpan(array $case): void
    {
        $this->assertSame($case['out'], Rules::slotSpan($case['tiles'], $case['slot'], $case['repeat']));
    }

    #[DataProvider('listCases')]
    public function testLists(array $case): void
    {
        $this->assertSame($case['out'], JsonSource::lists($case['value']));
    }

    #[DataProvider('pageCases')]
    public function testPages(array $case): void
    {
        $this->assertSame($case['out'], Pager::sequence($case['current'], $case['count']));
    }
}
