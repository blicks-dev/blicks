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
 * shipped, `BLICKS_API_VERSION` must be bumped and Pro's guard updated in the same release.
 *
 * Version 2 is Blicks 2.0's surface. It was re-pinned for the clean break: the PHP classes below
 * all carried over from 1, the engine gained a read-only description (`EngineSchema`) and the
 * validator Pro and the AI layer already called (`ElementStyle::problems()`, `CoreAbilities::validate()`)
 * joined the list, and the blocks removed in 2.0 must stay removed. While 2.0 is unreleased the
 * surface may still change inside version 2; this list is the contract.
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
                // `controls` and `allowsControl` describe the engine to Pro's AI layer: what can
                // be styled, and what a given block is allowed to style. Pro validates against
                // them before writing a style tree, so losing either turns a refusal into a
                // silently ignored control.
                //
                // `problems` is the same judgement build() makes silently, made out loud: the
                // validator Studio and the AI layer run before writing; `valueSchema` is one
                // control's JSON Schema, for a model's tool definition.
                ['blockProps', 'build', 'registerRule', 'registerCssValueBuilder', 'controls', 'allowsControl', 'problems', 'valueSchema'],
            ],
            // The engine, described read-only — the PHP mirror of `window.blicks.engine.schema()`.
            // Pro, Studio and the AI validator read control ids, value shapes, slots and relations
            // from it rather than from the generated `Schema` tables, which stay internal.
            'EngineSchema' => [\Blicks\Style\EngineSchema::class, ['describe', 'control', 'controlIds']],
            // A whole layout validated the way `blicks/validate-layout` does, without WordPress.
            'CoreAbilities' => [\Blicks\Ai\Abilities\CoreAbilities::class, ['validate']],
            // The three below are listed with ONLY the methods Pro actually calls. Every extra
            // name here is a promise that constrains refactoring in this plugin, so the list
            // tracks real consumption rather than the whole public surface of each class.
            //
            // Pro locates this plugin's own `resources/blocks/*/block.json` through Plugin::path();
            // that metadata is where its block catalogue comes from.
            'Plugin' => [\Blicks\Core\Plugin::class, ['path']],
            // Resolves design-system slugs before deciding a value is literal CSS.
            'Tokens' => [\Blicks\Style\Tokens::class, ['isToken']],
            // The live, theme-projected design system. Pro hands its slugs and resolved values to
            // the model so generated layouts reference tokens rather than hardcoded hex and px.
            'Catalogue' => [\Blicks\DesignSystem\Catalogue::class, ['snapshot']],
            'CssValue' => [\Blicks\Style\CssValue::class, ['clean', 'url']],
            'Sanitize' => [\Blicks\Style\Sanitize::class, ['styleTagContent']],
            'Dimension' => [\Blicks\Style\Dimension::class, ['clean']],
            'ScopedCss' => [\Blicks\Style\ScopedCss::class, ['css', 'reset']],
            // Pro's providers hook WordPress through these attributes, read by ServiceProvider.
            'Action' => [\Blicks\Core\Attributes\Action::class, ['__construct']],
            'Filter' => [\Blicks\Core\Attributes\Filter::class, ['__construct']],
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
            "/define\(\s*'BLICKS_API_VERSION',\s*'2'\s*\)/",
            (string) $source,
            'BLICKS_API_VERSION is 2 for Blicks 2.0 — the surface pinned in this file'
        );
    }

    /** The JS half carries the same number, so a companion checking either side gets one answer. */
    public function test_the_js_api_version_matches(): void
    {
        $source = (string) file_get_contents(dirname(__DIR__, 3) . '/resources/framework/public-api.ts');

        $this->assertStringContainsString('export const API_VERSION = 2;', $source);
    }

    /**
     * Stack, Grid, Spacer and Divider became Box kinds in 2.0. Re-adding one would hand a companion
     * a block name the clean break promised was gone, and the reserved Pro names must never be
     * registered here — two plugins in one namespace, and load order decides which one loses.
     */
    public function test_removed_and_reserved_blocks_are_not_shipped(): void
    {
        $blocks = dirname(__DIR__, 3) . '/resources/blocks';

        foreach (['stack', 'grid', 'spacer', 'divider', 'scene', 'scene-box', 'scene-text', 'scene-image'] as $name) {
            $this->assertFileDoesNotExist("{$blocks}/{$name}/block.json", "blicks/{$name} must not be registered by the free plugin");
        }
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
