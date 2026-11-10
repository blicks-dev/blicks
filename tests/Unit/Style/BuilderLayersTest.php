<?php

declare(strict_types=1);

namespace Blicks\Tests\Unit\Style;

use Blicks\Style\ElementStyle;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * Layered values in the PHP engine. Every case is in tests/fixtures/builder-layer-cases.json, which
 * builder-layers.test.ts runs against vars.ts — same inputs, same strings.
 */
final class BuilderLayersTest extends TestCase
{
    /** @return array<string, array{array<string, mixed>}> */
    public static function cases(): array
    {
        $fixture = json_decode((string) file_get_contents(__DIR__ . '/../../fixtures/builder-layer-cases.json'), true);
        $out = [];
        foreach ($fixture['cases'] as $case) {
            $out[$case['name']] = [$case];
        }

        return $out;
    }

    /** @param array<string, mixed> $case */
    #[DataProvider('cases')]
    public function test_matches_the_shared_fixture(array $case): void
    {
        $r = ElementStyle::build($case['blicks']);
        if (isset($case['vars'])) {
            $this->assertSame($case['vars'], $r['vars']);
        }
        if (isset($case['classes'])) {
            $this->assertSame($case['classes'], $r['classes']);
        }
    }
}
