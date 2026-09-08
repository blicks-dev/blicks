<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Presets;

use Blicks\Presets\Presets;
use PHPUnit\Framework\TestCase;

/**
 * The user-preset store validates every payload before it reaches the table: a well-formed block
 * reference, a real title, and a size-capped attribute bundle of scalar/array leaves. These cover the
 * validation rules, unique-key generation, and the create/rename/delete round trip against a fake
 * `$wpdb` standing in for `wp_blicks_presets`.
 */
final class PresetsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $GLOBALS['wpdb'] = new FakePresetsWpdb();
        $GLOBALS['wp_object_cache'] = [];
        $GLOBALS['wp_current_user_id'] = 7;
    }

    private function valid(array $overrides = []): array
    {
        return array_merge([
            'blockName' => 'blicks/button',
            'title' => 'Promo CTA',
            'attributes' => [
                'variant' => 'default',
                'size' => 'lg',
                'blicks' => ['colors.background' => ['default' => ['base' => '#7c3aed']]],
            ],
        ], $overrides);
    }

    public function testStoresAValidPreset(): void
    {
        $result = Presets::save($this->valid());

        $this->assertTrue($result['ok']);
        $this->assertSame('blicks/button', $result['blockName']);
        $this->assertSame('promo-cta', $result['preset']['key']);
        $this->assertSame('Promo CTA', $result['preset']['title']);
        $this->assertSame(7, $result['preset']['author']);
        $this->assertGreaterThan(0, $result['preset']['id']);

        $grouped = Presets::grouped();
        $this->assertCount(1, $grouped['blicks/button']);
        $this->assertSame(
            '#7c3aed',
            $grouped['blicks/button'][0]['attributes']['blicks']['colors.background']['default']['base']
        );
    }

    public function testRejectsANonBlicksBlock(): void
    {
        foreach (['core/paragraph', 'notblicks/button', 'blicks/', 'blicks/Button!'] as $name) {
            $result = Presets::save($this->valid(['blockName' => $name]));
            $this->assertFalse($result['ok'], "{$name} should be rejected");
            $this->assertSame('invalid_block', $result['error']);
        }
    }

    public function testRejectsAnEmptyTitle(): void
    {
        foreach (['', '   ', '<b></b>'] as $title) {
            $result = Presets::save($this->valid(['title' => $title]));
            $this->assertFalse($result['ok']);
            $this->assertSame('invalid_title', $result['error']);
        }
    }

    public function testRejectsEmptyOrNonObjectAttributes(): void
    {
        foreach ([[], null, 'nope'] as $attributes) {
            $result = Presets::save($this->valid(['attributes' => $attributes]));
            $this->assertFalse($result['ok']);
            $this->assertSame('invalid_attributes', $result['error']);
        }
    }

    public function testTitleIsTrimmedAndCapped(): void
    {
        $result = Presets::save($this->valid(['title' => '  ' . str_repeat('x', 80) . '  ']));

        $this->assertTrue($result['ok']);
        $this->assertSame(60, mb_strlen($result['preset']['title']));
    }

    public function testStripsTagsFromStringLeavesButKeepsStructure(): void
    {
        $result = Presets::save($this->valid([
            'attributes' => [
                'blicks' => ['label' => '<script>alert(1)</script>hi'],
                'variant' => 'default',
            ],
        ]));

        $this->assertTrue($result['ok']);
        $label = $result['preset']['attributes']['blicks']['label'];
        $this->assertStringNotContainsString('<', $label);
        $this->assertSame('default', $result['preset']['attributes']['variant']);
    }

    public function testPreservesScalarLeafTypes(): void
    {
        $result = Presets::save($this->valid([
            'attributes' => ['a' => 1, 'b' => true, 'c' => 1.5, 'd' => null, 'e' => 'x'],
        ]));

        $this->assertTrue($result['ok']);
        $this->assertSame(['a' => 1, 'b' => true, 'c' => 1.5, 'd' => null, 'e' => 'x'], $result['preset']['attributes']);
    }

    public function testRejectsAnOversizedAttributeBundle(): void
    {
        $result = Presets::save($this->valid([
            'attributes' => ['blob' => str_repeat('a', 21000)],
        ]));

        $this->assertFalse($result['ok']);
        $this->assertSame('invalid_attributes', $result['error']);
    }

    public function testGeneratesAUniqueKeyPerBlock(): void
    {
        $first = Presets::save($this->valid());
        $second = Presets::save($this->valid());

        $this->assertSame('promo-cta', $first['preset']['key']);
        $this->assertSame('promo-cta-2', $second['preset']['key']);
    }

    public function testUpdateRenamesInPlaceKeepingTheKeyStable(): void
    {
        $created = Presets::save($this->valid());
        $id = $created['preset']['id'];

        $updated = Presets::save($this->valid(['title' => 'Renamed CTA']), $id);

        $this->assertTrue($updated['ok']);
        $this->assertSame($created['preset']['key'], $updated['preset']['key']);
        $this->assertSame('Renamed CTA', $updated['preset']['title']);

        $grouped = Presets::grouped();
        $this->assertCount(1, $grouped['blicks/button']);
        $this->assertSame('Renamed CTA', $grouped['blicks/button'][0]['title']);
    }

    public function testUpdateRejectsAMismatchedBlock(): void
    {
        $created = Presets::save($this->valid());

        $result = Presets::save($this->valid(['blockName' => 'blicks/section']), $created['preset']['id']);

        $this->assertFalse($result['ok']);
        $this->assertSame('not_found', $result['error']);
    }

    public function testDeleteRemovesTheRow(): void
    {
        $created = Presets::save($this->valid());

        $result = Presets::delete($created['preset']['id']);

        $this->assertTrue($result['ok']);
        $this->assertSame('blicks/button', $result['blockName']);
        $this->assertSame('promo-cta', $result['key']);
        $this->assertSame([], Presets::grouped());
    }

    public function testDeleteReportsAMissingRow(): void
    {
        $result = Presets::delete(999);

        $this->assertFalse($result['ok']);
        $this->assertSame('not_found', $result['error']);
    }

    public function testRefusesToExceedTheLibraryLimit(): void
    {
        $GLOBALS['wpdb']->seedCount(200);

        $result = Presets::save($this->valid());

        $this->assertFalse($result['ok']);
        $this->assertSame('limit', $result['error']);
    }
}

/**
 * In-memory stand-in for the `wp_blicks_presets` table. Interprets only the query shapes
 * {@see \Blicks\Models\PresetModel} actually issues (string queries for all-rows/COUNT; prepared
 * arrays for per-block/find/key-exists lookups).
 */
final class FakePresetsWpdb
{
    public string $prefix = 'wp_';
    public int $insert_id = 0;

    /** @var array<int, array<string,mixed>> */
    private array $rows = [];
    private int $autoInc = 0;

    public function get_charset_collate(): string
    {
        return 'DEFAULT CHARSET=utf8mb4';
    }

    /** Pad the table with throwaway rows so the count-based limit can be exercised. */
    public function seedCount(int $n): void
    {
        for ($i = 0; $i < $n; $i++) {
            $id = ++$this->autoInc;
            $this->rows[$id] = [
                'id' => $id,
                'block_name' => 'blicks/button',
                'preset_key' => 'seed-' . $id,
                'title' => 'Seed ' . $id,
                'attributes' => '{}',
                'author' => 0,
            ];
        }
    }

    public function prepare(string $query, mixed ...$args): array
    {
        return [$query, $args];
    }

    /** @param array{0:string,1:array<int,mixed>}|string $arg */
    public function get_results(array|string $arg, string $output): array
    {
        // Prepared array → per-block filter; plain string → every row (grouped/all).
        if (is_array($arg)) {
            $block = (string) ($arg[1][0] ?? '');
            return array_values(array_filter($this->rows, static fn ($r) => $r['block_name'] === $block));
        }

        return array_values($this->rows);
    }

    /** @param array{0:string,1:array<int,mixed>} $prepared */
    public function get_row(array $prepared, string $output): ?array
    {
        $id = (int) ($prepared[1][0] ?? 0);
        return $this->rows[$id] ?? null;
    }

    /** @param array{0:string,1:array<int,mixed>}|string $arg */
    public function get_var(array|string $arg): ?string
    {
        // COUNT(*) is issued as a plain string; key-exists as a prepared array.
        if (is_string($arg)) {
            return (string) count($this->rows);
        }

        $block = (string) ($arg[1][0] ?? '');
        $key = (string) ($arg[1][1] ?? '');
        foreach ($this->rows as $row) {
            if ($row['block_name'] === $block && $row['preset_key'] === $key) {
                return (string) $row['id'];
            }
        }

        return null;
    }

    /** @param array<string,mixed> $data */
    public function insert(string $table, array $data, array $formats): bool
    {
        $id = ++$this->autoInc;
        $this->rows[$id] = ['id' => $id] + $data;
        $this->insert_id = $id;
        return true;
    }

    /**
     * @param array<string,mixed> $data
     * @param array{id:int}       $where
     */
    public function update(string $table, array $data, array $where, array $formats, array $whereFormats): bool
    {
        $id = (int) ($where['id'] ?? 0);
        if (isset($this->rows[$id])) {
            $this->rows[$id] = array_merge($this->rows[$id], $data);
        }
        return true;
    }

    /** @param array{id:int} $where */
    public function delete(string $table, array $where, array $formats): bool
    {
        unset($this->rows[(int) ($where['id'] ?? 0)]);
        return true;
    }
}
