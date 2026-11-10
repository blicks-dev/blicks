<?php

declare(strict_types=1);

namespace Blicks\Tests\Unit\Style;

use Blicks\Style\ElementStyle;
use Blicks\Style\Parts;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The part axis in the PHP engine. Every case is in tests/fixtures/part-cases.json, which
 * parts.test.ts runs against vars.ts — same inputs, same strings, so the editor preview and the
 * front end cannot disagree about a pseudo-element.
 */
final class PartsTest extends TestCase
{
    /** @return array<string, array{array<string, mixed>}> */
    public static function cases(): array
    {
        $fixture = json_decode((string) file_get_contents(__DIR__ . '/../../fixtures/part-cases.json'), true);
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
        $r = ElementStyle::build($case['blicks'], (string) ($case['uniqueId'] ?? ''));

        $this->assertSame($case['scopedCss'] ?? null, $r['scopedCss'] ?? null);
        if (isset($case['classes'])) {
            $this->assertSame($case['classes'], $r['classes']);
        }
        if (isset($case['vars'])) {
            $this->assertSame($case['vars'], $r['vars']);
        }
    }

    public function test_slot_keys_parse_like_the_editor(): void
    {
        $this->assertSame(['part' => 'element', 'state' => 'hover'], Parts::parseSlot('hover'));
        $this->assertSame(['part' => 'before', 'state' => 'default'], Parts::parseSlot('before'));
        $this->assertSame(['part' => 'after', 'state' => 'active'], Parts::parseSlot('after:active'));
        $this->assertSame(['part' => 'element', 'state' => 'default'], Parts::parseSlot('marker'));
        $this->assertSame(['part' => 'before', 'state' => 'default'], Parts::parseSlot('before:visited'));
        $this->assertSame(':hover::after', Parts::slotSelectorSuffix('after:hover'));
    }
}
