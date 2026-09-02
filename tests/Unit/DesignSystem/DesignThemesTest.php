<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\DesignSystem;

use Blicks\DesignSystem\DesignThemes;
use PHPUnit\Framework\TestCase;

final class DesignThemesTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wp_options'] = [];
    }

    public function test_all_returns_builtins_with_indigo_active_by_default(): void
    {
        $all = DesignThemes::all();

        $this->assertSame('indigo', $all['active']);
        $ids = array_map(static fn (array $t): string => $t['id'], $all['themes']);
        $this->assertSame(['indigo', 'emerald', 'rose', 'violet', 'slate'], $ids);
        foreach ($all['themes'] as $theme) {
            $this->assertTrue($theme['builtin']);
        }
        // Built-ins drive the shadcn brand colour (primary + matching focus ring) plus a paired accent.
        $emerald = $all['themes'][1];
        $this->assertSame('#059669', $emerald['tokens']['tokens']['color']['primary']);
        $this->assertSame('#059669', $emerald['tokens']['tokens']['color']['ring']);
        $this->assertSame('#f59e0b', $emerald['tokens']['tokens']['color']['accent']);
        $this->assertSame('#1c1917', $emerald['tokens']['tokens']['color']['accent-foreground']);
    }

    public function test_create_appends_custom_theme_and_makes_it_active(): void
    {
        $all = DesignThemes::create('My Brand', [
            'tokens' => ['color' => ['primary' => '#ff0066']],
        ]);

        $this->assertCount(6, $all['themes']);
        $custom = $all['themes'][5];
        $this->assertFalse($custom['builtin']);
        $this->assertSame('My Brand', $custom['name']);
        $this->assertSame('#ff0066', $custom['tokens']['tokens']['color']['primary']);
        $this->assertSame($custom['id'], $all['active']);
    }

    public function test_update_and_delete_custom_theme(): void
    {
        $created = DesignThemes::create('Draft', [ 'tokens' => ['color' => ['primary' => '#111111']] ]);
        $id = $created['themes'][5]['id'];

        $renamed = DesignThemes::update($id, 'Renamed', null);
        $this->assertSame('Renamed', DesignThemes::find($id)['name']);
        $this->assertSame('Renamed', $renamed['themes'][5]['name']);

        $afterDelete = DesignThemes::delete($id);
        $this->assertCount(5, $afterDelete['themes']);
        // Deleting the active theme falls back to the default.
        $this->assertSame('indigo', $afterDelete['active']);
        $this->assertNull(DesignThemes::find($id));
    }

    public function test_builtins_cannot_be_updated_or_deleted(): void
    {
        DesignThemes::update('emerald', 'Hacked', null);
        DesignThemes::delete('indigo');

        $all = DesignThemes::all();
        $this->assertCount(5, $all['themes']);
        $this->assertSame('Emerald Citrus', DesignThemes::find('emerald')['name']);
    }

    public function test_active_bag_reflects_the_active_theme(): void
    {
        $this->assertSame('#4f46e5', DesignThemes::activeBag()['tokens']['color']['primary']); // indigo by default
        DesignThemes::setActive('emerald');
        $this->assertSame('#059669', DesignThemes::activeBag()['tokens']['color']['primary']);
    }

    public function test_save_active_overrides_records_builtin_layer_and_marks_edited(): void
    {
        DesignThemes::saveActiveOverrides(['tokens' => ['color' => ['primary' => '#abc123']]]);

        $indigo = DesignThemes::find('indigo');
        $this->assertTrue($indigo['edited']);
        $this->assertSame('#abc123', $indigo['tokens']['tokens']['color']['primary']);
        $this->assertSame('#abc123', DesignThemes::activeBag()['tokens']['color']['primary']);
    }

    public function test_save_active_overrides_equal_to_preset_drops_the_layer(): void
    {
        // Re-saving the curated values verbatim should leave the theme pristine, not flag it edited.
        DesignThemes::saveActiveOverrides(DesignThemes::find('indigo')['tokens']);

        $this->assertFalse(DesignThemes::find('indigo')['edited']);
    }

    public function test_reset_theme_restores_builtin_and_empties_custom(): void
    {
        DesignThemes::saveActiveOverrides(['tokens' => ['color' => ['primary' => '#abc123']]]);
        $this->assertTrue(DesignThemes::find('indigo')['edited']);

        DesignThemes::resetTheme('indigo');
        $indigo = DesignThemes::find('indigo');
        $this->assertFalse($indigo['edited']);
        $this->assertSame('#4f46e5', $indigo['tokens']['tokens']['color']['primary']);

        $created = DesignThemes::create('Draft', ['tokens' => ['color' => ['primary' => '#222222']]]);
        $id = $created['themes'][count($created['themes']) - 1]['id'];
        DesignThemes::resetTheme($id);
        $reset = DesignThemes::find($id);
        $this->assertFalse($reset['edited']);
        $this->assertSame([], $reset['tokens']['tokens']);
    }
}
