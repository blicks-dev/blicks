<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Http;

use Blicks\DesignSystem\DesignThemes;
use Blicks\DesignSystem\Store;
use Blicks\Http\Controllers\ThemesController;
use PHPUnit\Framework\TestCase;
use WP_REST_Request;

/**
 * Themes own their settings: applying a theme makes its bag the live override set, editing the
 * active theme persists into it, and reset restores a built-in's curated preset. The live read is
 * {@see Store::getOverrides()} (= the active theme's effective bag).
 */
final class ThemesControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $GLOBALS['wp_options'] = [];
        $GLOBALS['wp_object_cache'] = [];
    }

    public function test_apply_builtin_makes_its_bag_live_and_sets_active(): void
    {
        $response = ThemesController::apply(new WP_REST_Request(['id' => 'emerald']));
        $data = $response->get_data();

        $this->assertSame(200, $response->get_status());

        // The theme's brand colour (primary + mirrored ring) is now the live override set.
        $overrides = Store::getOverrides();
        $this->assertSame('#059669', $overrides['tokens']['color']['primary']);
        $this->assertSame('#059669', $overrides['tokens']['color']['ring']);

        $this->assertSame('emerald', DesignThemes::all()['active']);
        $this->assertIsArray($data);
        $this->assertSame('emerald', $data['themes']['active']);
    }

    public function test_apply_custom_theme_makes_its_bag_live(): void
    {
        $created = DesignThemes::create('Brandy', [
            'tokens' => ['color' => ['primary' => '#abcdef']],
        ]);
        $id = $created['themes'][count($created['themes']) - 1]['id'];

        $response = ThemesController::apply(new WP_REST_Request(['id' => $id]));

        $this->assertSame(200, $response->get_status());
        $this->assertSame('#abcdef', Store::getOverrides()['tokens']['color']['primary']);
        $this->assertSame($id, DesignThemes::all()['active']);
    }

    public function test_apply_missing_theme_returns_404_without_switching(): void
    {
        $response = ThemesController::apply(new WP_REST_Request(['id' => 'nope']));

        $this->assertSame(404, $response->get_status());
        $this->assertSame('indigo', DesignThemes::all()['active']);
    }

    public function test_edit_while_builtin_active_persists_and_reapply_reproduces_it(): void
    {
        // Indigo is active by default. Editing it (the PATCH save path) persists onto the theme.
        Store::saveOverrides(['tokens' => ['color' => ['primary' => '#abc123']]]);
        $this->assertSame('#abc123', Store::getOverrides()['tokens']['color']['primary']);
        $this->assertTrue(DesignThemes::find('indigo')['edited']);

        // Switch away to Emerald (its curated brand), then back to Indigo.
        ThemesController::apply(new WP_REST_Request(['id' => 'emerald']));
        $this->assertSame('#059669', Store::getOverrides()['tokens']['color']['primary']);

        ThemesController::apply(new WP_REST_Request(['id' => 'indigo']));

        // The edit stuck to Indigo — re-applying reproduces it, not the curated preset.
        $this->assertSame('#abc123', Store::getOverrides()['tokens']['color']['primary']);
    }

    public function test_reset_restores_builtin_curated_preset(): void
    {
        Store::saveOverrides(['tokens' => ['color' => ['primary' => '#abc123']]]);
        $this->assertTrue(DesignThemes::find('indigo')['edited']);

        $response = ThemesController::reset(new WP_REST_Request(['id' => 'indigo']));

        $this->assertSame(200, $response->get_status());
        $this->assertSame('#4f46e5', Store::getOverrides()['tokens']['color']['primary']);
        $this->assertFalse(DesignThemes::find('indigo')['edited']);
        $this->assertArrayHasKey('themes', $response->get_data());
    }
}
