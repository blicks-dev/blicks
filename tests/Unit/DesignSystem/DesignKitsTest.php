<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\DesignSystem;

use Blicks\DesignSystem\DesignKits;
use Blicks\DesignSystem\DesignLanguages;
use Blicks\DesignSystem\DesignThemes;
use Blicks\DesignSystem\Store;
use Blicks\Http\Controllers\KitsController;
use PHPUnit\Framework\TestCase;
use WP_REST_Request;

final class DesignKitsTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wp_options'] = [];
        $GLOBALS['wp_object_cache'] = [];
    }

    public function test_a_kit_saves_and_restores_language_palette_and_values(): void
    {
        DesignLanguages::setActive('clay');
        Store::usePalette('rose');
        Store::saveOverrides(['tokens' => ['radius' => ['md' => '3px']], 'breakpoints' => ['tablet' => 900]]);

        $response = KitsController::create(new WP_REST_Request(['name' => 'Shop']));
        $this->assertSame(201, $response->get_status());
        $kit = $response->get_data()[0];
        $this->assertSame(['Shop', 'clay', 'rose', 2], [$kit['name'], $kit['language'], $kit['palette'], $kit['count']]);

        // Change everything, then use the kit.
        DesignLanguages::setActive('brutal');
        Store::usePalette('slate');
        Store::saveOverrides(['tokens' => ['radius' => ['md' => '0']]]);

        $used = KitsController::apply(new WP_REST_Request(['id' => $kit['id']]));
        $this->assertSame(200, $used->get_status());
        $this->assertSame('clay', DesignLanguages::activeId());
        $this->assertSame('rose', DesignThemes::all()['active']);
        $this->assertSame('3px', Store::getOverrides()['tokens']['radius']['md']);
        $this->assertSame(900, Store::getOverrides()['breakpoints']['tablet']);
        $this->assertSame('clay', $used->get_data()['language']['active']);
    }

    /** Kits, the language and your own values live in the plugin's tables, never in wp_options. */
    public function test_nothing_is_written_to_wp_options(): void
    {
        DesignLanguages::setActive('glass');
        Store::saveOverrides(['tokens' => ['radius' => ['md' => '3px']]]);
        DesignKits::create('Shop', 'glass', 'indigo', ['tokens' => ['radius' => ['md' => '3px']]]);

        Store::registerCustomSlugs(['opacity' => ['tertiary']]);
        DesignThemes::create('Ink', ['tokens' => ['color' => ['primary' => '#111111']]]);
        \Blicks\DesignSystem\Animations::all();

        foreach (['blicks_design_language', 'blicks_design_values', 'blicks_design_kits', 'blicks_design_themes', 'blicks_design_custom_slugs', 'blicks_design_animations'] as $option) {
            $this->assertArrayNotHasKey($option, $GLOBALS['wp_options']);
        }
        $this->assertSame('glass', $GLOBALS['wpdb']->settings['design.language']);
        $this->assertStringContainsString('"3px"', $GLOBALS['wpdb']->settings['design.values']);
        $this->assertSame('Shop', $GLOBALS['wpdb']->kits[0]['name']);
    }

    public function test_rename_delete_and_unknown_kits(): void
    {
        $kit = DesignKits::create('Draft', 'minimal', 'indigo', []);

        $this->assertSame(200, KitsController::update(new WP_REST_Request(['id' => $kit['id'], 'name' => 'Blog']))->get_status());
        $this->assertSame('Blog', DesignKits::find($kit['id'])['name']);
        $this->assertSame(404, KitsController::apply(new WP_REST_Request(['id' => 'nope']))->get_status());
        $this->assertSame(200, KitsController::remove(new WP_REST_Request(['id' => $kit['id']]))->get_status());
        $this->assertSame(404, KitsController::remove(new WP_REST_Request(['id' => $kit['id']]))->get_status());
    }

    public function test_kit_values_are_validated_and_a_missing_palette_or_language_falls_back(): void
    {
        $kit = DesignKits::create('Hostile', 'gone', 'gone', ['tokens' => ['color' => ['primary' => 'red;}body{x:url(https://a.example)}', 'accent' => '#00ff00']]]);

        $this->assertSame('minimal', $kit['language']);
        $this->assertSame(['color' => ['accent' => '#00ff00']], $kit['values']['tokens']);

        Store::usePalette('emerald');
        DesignKits::apply($kit['id']);
        // The kit's palette is gone, so the one in use stays.
        $this->assertSame('emerald', DesignThemes::all()['active']);
        $this->assertSame('#00ff00', Store::getOverrides()['tokens']['color']['accent']);
    }

    /** Before kits, palettes held every value. The first read moves them out without losing any. */
    public function test_values_saved_into_old_palettes_move_into_your_values_and_kits(): void
    {
        $GLOBALS['wp_options']['blicks_design_themes'] = [
            'active' => 'c1',
            'custom' => [
                ['id' => 'c1', 'name' => 'Northwind', 'tokens' => ['tokens' => ['color' => ['primary' => '#7c4a1e'], 'radius' => ['md' => '4px']]]],
                ['id' => 'c2', 'name' => 'Ink', 'tokens' => ['tokens' => ['color' => ['primary' => '#111111']]]],
            ],
            'builtinOverrides' => [
                'emerald' => ['tokens' => ['color' => ['primary' => '#047857'], 'spacing' => ['md' => '1.25rem']]],
            ],
        ];

        $live = Store::getOverrides();

        // The palette in use hands its values over; its colour stays the palette's.
        $this->assertSame('4px', $live['tokens']['radius']['md']);
        $this->assertSame('#7c4a1e', $live['tokens']['color']['primary']);
        $this->assertSame(['radius' => ['md' => '4px']], Store::values()['tokens']);

        // Palettes keep colours only; a colours-only palette needs no kit; an edited built-in does.
        $this->assertSame(['color' => ['primary' => '#7c4a1e']], DesignThemes::find('c1')['tokens']['tokens']);
        $kits = DesignKits::all();
        $this->assertSame(['Northwind', 'Emerald Citrus, your values'], array_column($kits, 'name'));
        $this->assertSame('1.25rem', $kits[1]['values']['tokens']['spacing']['md']);
        $this->assertSame('#047857', $kits[1]['values']['tokens']['color']['primary']);

        // It happens once, and the old option is gone: palettes are in the settings table now.
        Store::getOverrides();
        $this->assertCount(2, DesignKits::all());
        $this->assertArrayNotHasKey('blicks_design_themes', $GLOBALS['wp_options']);
        $this->assertSame('c1', \Blicks\Models\SettingModel::getValue('design.palettes', null)['active']);
    }
}
