<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Http;

use Blicks\DesignSystem\DesignThemes;
use Blicks\DesignSystem\Store;
use Blicks\Http\Controllers\ThemesController;
use PHPUnit\Framework\TestCase;
use WP_REST_Request;

/**
 * Palettes are colours only: using one repaints them, and someone's own values — saved through the
 * Design system — stay whichever palette is in use. The live read is {@see Store::getOverrides()}
 * (the palette's colours with those values on top).
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

    public function test_your_values_stay_when_the_palette_changes_and_its_colours_win(): void
    {
        Store::saveOverrides(['tokens' => ['color' => ['primary' => '#abc123', 'muted' => '#eeeeee'], 'radius' => ['md' => '3px']]]);
        $this->assertSame('#abc123', Store::getOverrides()['tokens']['color']['primary']);

        ThemesController::apply(new WP_REST_Request(['id' => 'emerald']));
        $live = Store::getOverrides()['tokens'];

        // The palette repaints the colours it has; everything else of yours stays.
        $this->assertSame('#059669', $live['color']['primary']);
        $this->assertSame('#eeeeee', $live['color']['muted']);
        $this->assertSame('3px', $live['radius']['md']);
    }

    public function test_a_colour_equal_to_the_palettes_is_the_palettes(): void
    {
        // Saving the palette's own value back (the admin sends every value) does not make it yours.
        Store::saveOverrides(['tokens' => ['color' => ['primary' => '#4f46e5']]]);
        $this->assertSame([], Store::values()['tokens']);

        ThemesController::apply(new WP_REST_Request(['id' => 'rose']));
        $this->assertSame('#e11d48', Store::getOverrides()['tokens']['color']['primary']);
    }

    public function test_a_new_palette_is_in_use_and_holds_the_colours(): void
    {
        Store::saveOverrides(['tokens' => ['color' => ['primary' => '#101010'], 'radius' => ['md' => '2px']]]);
        $response = ThemesController::create(new WP_REST_Request(['name' => 'Ink', 'tokens' => ['color' => ['primary' => '#101010'], 'radius' => ['md' => '2px']]]));

        $this->assertSame(201, $response->get_status());
        $this->assertSame('Ink', DesignThemes::find(DesignThemes::all()['active'])['name']);
        $this->assertSame(['radius' => ['md' => '2px']], Store::values()['tokens']);
        $this->assertSame('#101010', Store::getOverrides()['tokens']['color']['primary']);
    }
}
