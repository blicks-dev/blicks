<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Models;

use Blicks\Models\SettingModel;
use PHPUnit\Framework\TestCase;

final class SettingModelTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $GLOBALS['wpdb'] = new FakeWpdb();
        $GLOBALS['wp_options'] = [];
        $GLOBALS['wp_object_cache'] = [];

        $cache = new \ReflectionProperty(SettingModel::class, 'runtimeCache');
        $cache->setValue(null, []);
    }

    public function testGetValueCachesDatabaseResult(): void
    {
        $GLOBALS['wpdb']->settings['admin.delete_data_on_uninstall'] = '1';

        $this->assertTrue(SettingModel::getValue('admin.delete_data_on_uninstall', false));
        $this->assertSame(1, $GLOBALS['wpdb']->selects);

        $this->assertTrue(SettingModel::getValue('admin.delete_data_on_uninstall', false));
        $this->assertSame(1, $GLOBALS['wpdb']->selects);
    }

    public function testSetValueStoresStringsWithoutJsonQuotes(): void
    {
        SettingModel::setValue('legacy.string_value', 'https://example.test/');

        $this->assertSame('https://example.test/', $GLOBALS['wpdb']->settings['legacy.string_value']);
        $this->assertSame('https://example.test/', SettingModel::getValue('legacy.string_value', ''));
    }

    public function testSetValueStoresBooleansWithoutSerialization(): void
    {
        SettingModel::setValue('admin.delete_data_on_uninstall', false);

        $this->assertSame('0', $GLOBALS['wpdb']->settings['admin.delete_data_on_uninstall']);
        $this->assertFalse(SettingModel::getValue('admin.delete_data_on_uninstall', true));
    }

    public function testGetValueReadsLegacyJsonEncodedRows(): void
    {
        $GLOBALS['wpdb']->settings['legacy.string_value'] = '"https://legacy.example/"';
        $GLOBALS['wpdb']->settings['admin.delete_data_on_uninstall'] = 'false';

        $this->assertSame('https://legacy.example/', SettingModel::getValue('legacy.string_value', ''));
        $this->assertFalse(SettingModel::getValue('admin.delete_data_on_uninstall', true));
    }

    public function testNormalizeStorageEncodingRewritesLegacyJsonRows(): void
    {
        $GLOBALS['wpdb']->settings['legacy.string_value'] = '"https://legacy.example/"';
        $GLOBALS['wpdb']->settings['admin.delete_data_on_uninstall'] = 'false';

        SettingModel::normalizeStorageEncoding();

        $this->assertSame('https://legacy.example/', $GLOBALS['wpdb']->settings['legacy.string_value']);
        $this->assertSame('0', $GLOBALS['wpdb']->settings['admin.delete_data_on_uninstall']);
    }
}

final class FakeWpdb
{
    public string $prefix = 'wp_';

    /** @var array<string, string> */
    public array $settings = [];
    public int $selects = 0;

    public function get_charset_collate(): string
    {
        return 'DEFAULT CHARSET=utf8mb4';
    }

    public function prepare(string $query, mixed ...$args): array
    {
        return [$query, $args];
    }

    /** @param array{0:string,1:array<int,mixed>} $prepared */
    public function get_var(array $prepared): ?string
    {
        $this->selects++;
        $key = (string) ($prepared[1][0] ?? '');
        return $this->settings[$key] ?? null;
    }

    /** @param array{0:string,1:array<int,mixed>} $prepared */
    public function query(array $prepared): bool
    {
        $key = (string) ($prepared[1][0] ?? '');
        $value = (string) ($prepared[1][1] ?? '');
        $this->settings[$key] = $value;
        return true;
    }

    /** @return list<array{setting_key:string,setting_value:string}> */
    public function get_results(string $query, string $output): array
    {
        $rows = [];
        foreach ($this->settings as $key => $value) {
            $rows[] = [
                'setting_key' => $key,
                'setting_value' => $value,
            ];
        }

        return $rows;
    }

    /**
     * @param array{setting_value:string} $data
     * @param array{setting_key:string}  $where
     */
    public function update(string $table, array $data, array $where, array $formats, array $whereFormats): bool
    {
        $this->settings[$where['setting_key']] = $data['setting_value'];
        return true;
    }

    /** @param array<string,string> $where */
    public function delete(string $table, array $where, array $formats): bool
    {
        unset($this->settings[(string) ($where['setting_key'] ?? '')]);
        return true;
    }
}
