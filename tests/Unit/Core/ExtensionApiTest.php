<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Core;

use PHPUnit\Framework\TestCase;

/**
 * Guards the surface companion plugins are allowed to consume.
 *
 * Blicks Pro runs in the same PHP process and resolves these classes through this plugin's
 * autoloader, so there is no package manager to catch a breaking change — a removed method is a
 * fatal on every Pro site, at runtime, after the update has already installed.
 *
 * These tests are the substitute. A failure here means one of two things: the change was
 * accidental and should be reverted, or it was deliberate — in which case, once this plugin has
 * shipped, `BLICKS_API_VERSION` must be bumped and Pro's guard updated in the same release. While
 * it is still unreleased there is nothing installed to break, so the surface may change inside
 * version 1; this list is the contract.
 */
final class ExtensionApiTest extends TestCase
{
    /** @return array<string, array{class-string, list<string>}> */
    public static function stableSurface(): array
    {
        return [
            'ServiceProvider' => [\Blicks\Core\ServiceProvider::class, ['register']],
            'Asset' => [\Blicks\Core\Assets\Asset::class, ['script', 'style']],
            'ScriptAsset' => [\Blicks\Core\Assets\ScriptAsset::class, ['deps', 'version', 'footer', 'enqueue']],
            'StyleAsset' => [\Blicks\Core\Assets\StyleAsset::class, ['deps', 'version', 'addInlineStyle', 'enqueue']],
            'Rest' => [\Blicks\Core\Http\Rest::class, ['get', 'post', 'patch', 'delete']],
            'RestRoute' => [\Blicks\Core\Http\RestRoute::class, ['permission', 'schema', 'toArgs']],
            'ElementStyle' => [
                \Blicks\Style\ElementStyle::class,
                ['blockProps', 'build', 'registerRule', 'registerCssValueBuilder'],
            ],
            'CssValue' => [\Blicks\Style\CssValue::class, ['clean', 'url']],
            'Sanitize' => [\Blicks\Style\Sanitize::class, ['styleTagContent']],
            'Dimension' => [\Blicks\Style\Dimension::class, ['clean']],
            'ScopedCss' => [\Blicks\Style\ScopedCss::class, ['css', 'reset']],
        ];
    }

    /**
     * @param class-string $class
     * @param list<string> $methods
     */
    #[\PHPUnit\Framework\Attributes\DataProvider('stableSurface')]
    public function test_stable_classes_keep_their_public_methods(string $class, array $methods): void
    {
        $this->assertTrue(class_exists($class), "{$class} is part of the extension API and must exist");

        foreach ($methods as $method) {
            $this->assertTrue(
                method_exists($class, $method),
                "{$class}::{$method}() is part of the extension API — removing or renaming it breaks Blicks Pro"
            );
        }
    }

    /**
     * `ServiceProvider` is extended by Pro's own providers, so it cannot become final, and
     * `register()` has to stay callable from a subclass.
     */
    public function test_service_provider_stays_extendable(): void
    {
        $reflection = new \ReflectionClass(\Blicks\Core\ServiceProvider::class);

        $this->assertTrue($reflection->isAbstract(), 'ServiceProvider is the documented base class');
        $this->assertFalse($reflection->isFinal(), 'a final ServiceProvider cannot be extended by Pro');
        $this->assertTrue($reflection->getMethod('register')->isPublic());
    }

    /**
     * The registries are how Pro adds style rules and value builders without touching this
     * plugin. They are static because they are read during render, before any provider instance
     * exists.
     */
    public function test_style_registries_are_public_and_static(): void
    {
        foreach (['registerRule', 'registerCssValueBuilder'] as $method) {
            $reflection = new \ReflectionMethod(\Blicks\Style\ElementStyle::class, $method);
            $this->assertTrue($reflection->isPublic(), "ElementStyle::{$method}() must stay public");
            $this->assertTrue($reflection->isStatic(), "ElementStyle::{$method}() must stay static");
        }
    }

    /** The declared API version and the surface above are one thing; changing either alone is the bug. */
    public function test_api_version_is_declared_in_the_plugin_file(): void
    {
        $source = file_get_contents(dirname(__DIR__, 3) . '/blicks.php');

        $this->assertMatchesRegularExpression(
            "/define\(\s*'BLICKS_API_VERSION',\s*'(\d+)'\s*\)/",
            (string) $source,
            'BLICKS_API_VERSION must be defined as an integer string'
        );
    }

    /**
     * The PHP half of the admin extension API.
     *
     * A companion plugin's whole screen hangs off these three: the filter that declares the page,
     * the slug map the app routes on, and the list the nav is built from. Renaming any of them
     * silently removes a paid plugin's admin screen.
     */
    public function test_the_admin_page_extension_points_exist(): void
    {
        foreach (['views', 'pageSlugs', 'externalViews', 'viewForSlug'] as $method) {
            $this->assertTrue(
                method_exists(\Blicks\Providers\AdminServiceProvider::class, $method),
                "AdminServiceProvider::{$method}() is part of the admin extension API"
            );
        }

        $source = (string) file_get_contents(
            dirname(__DIR__, 3) . '/src/Providers/AdminServiceProvider.php'
        );

        $this->assertStringContainsString(
            "apply_filters( 'blicks_admin_views'",
            $source,
            'the filter name is the extension point companion plugins hook; it cannot be renamed freely'
        );
    }

    /**
     * The JS half.
     *
     * A separately-bundled plugin has no import path into this build, so `window.blicks.admin` is
     * the only way in. The registry must also stay observable: a companion script depends on
     * `blicks-admin` and therefore always registers *after* the app has mounted.
     */
    public function test_the_admin_view_registry_is_exposed_on_window(): void
    {
        $registry = (string) file_get_contents(
            dirname(__DIR__, 3) . '/resources/admin/registry.ts'
        );

        $this->assertStringContainsString('globalScope.blicks.admin = {', $registry);
        $this->assertStringContainsString('registerView', $registry);
        $this->assertStringContainsString('subscribeToViews', $registry);
    }

    /**
     * The app must not mount at module evaluation.
     *
     * A companion bundle runs after this one, so mounting immediately would render every
     * registered page empty on first paint.
     */
    public function test_the_admin_app_defers_its_mount(): void
    {
        $app = (string) file_get_contents(dirname(__DIR__, 3) . '/resources/admin/app.tsx');

        $this->assertStringContainsString('DOMContentLoaded', $app);
        $this->assertStringContainsString('useSyncExternalStore', $app);
    }
}
