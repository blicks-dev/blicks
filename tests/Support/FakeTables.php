<?php
declare(strict_types=1);

namespace Blicks\Tests\Support;

/**
 * An in-memory `$wpdb` for the plugin's own tables, enough for what {@see \Blicks\Models\SettingModel}
 * and {@see \Blicks\Models\KitModel} ask of it. {@see FreshTables} gives every test a new one.
 */
final class FakeTables
{
    public string $prefix = 'wp_';

    /** @var array<string, string> setting_key => setting_value */
    public array $settings = [];

    /** @var list<array<string, string>> */
    public array $kits = [];

    public function get_charset_collate(): string
    {
        return 'DEFAULT CHARSET=utf8mb4';
    }

    /** @return array{0: string, 1: list<mixed>} */
    public function prepare(string $query, mixed ...$args): array
    {
        return [$query, $args];
    }

    /** @param array{0: string, 1: list<mixed>} $prepared */
    public function get_var(array $prepared): ?string
    {
        return $this->settings[(string) ($prepared[1][0] ?? '')] ?? null;
    }

    /** The settings upsert. @param array{0: string, 1: list<mixed>} $prepared */
    public function query(array|string $prepared): bool
    {
        if (is_array($prepared)) {
            $this->settings[(string) ($prepared[1][0] ?? '')] = (string) ($prepared[1][1] ?? '');
        }

        return true;
    }

    /** @return list<array<string, string>> */
    public function get_results(string $query, string $output = 'ARRAY_A'): array
    {
        return str_contains($query, 'blicks_kits') ? $this->kits : [];
    }

    /** @param array<string, string> $data */
    public function insert(string $table, array $data, array $formats = []): int
    {
        $this->kits[] = $data;

        return 1;
    }

    /**
     * @param array<string, string> $data
     * @param array<string, string> $where
     */
    public function update(string $table, array $data, array $where, array $formats = [], array $whereFormats = []): int
    {
        foreach ($this->kits as &$row) {
            if (($row['uid'] ?? null) === ($where['uid'] ?? '')) {
                $row = array_merge($row, $data);
            }
        }
        unset($row);

        return 1;
    }

    /** @param array<string, string> $where */
    public function delete(string $table, array $where, array $formats = []): int
    {
        if (isset($where['setting_key'])) {
            unset($this->settings[$where['setting_key']]);
        } else {
            $this->kits = array_values(array_filter($this->kits, static fn (array $row): bool => ($row['uid'] ?? null) !== ($where['uid'] ?? '')));
        }

        return 1;
    }
}
