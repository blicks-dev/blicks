<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\DesignSystem;

use Blicks\DesignSystem\Catalogue;
use Blicks\DesignSystem\CssVariables;
use Blicks\DesignSystem\DesignLanguages;
use PHPUnit\Framework\TestCase;

final class DesignLanguagesTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wp_options'] = [];
    }

    public function test_minimal_is_the_default_and_changes_nothing(): void
    {
        $this->assertSame('minimal', DesignLanguages::activeId());
        $minimal = DesignLanguages::active();
        $this->assertSame([], $minimal['tokens']);
        $this->assertSame([], $minimal['typeRoles']);
        $this->assertSame([], $minimal['components']);

        // A site that never picks a language renders exactly as before: no component variables.
        $css = CssVariables::css(['values' => ['radius' => ['md' => '0.5rem']]]);
        $this->assertStringNotContainsString('--blicks-button-sheen', $css);
        $this->assertStringNotContainsString('--blicks-surface-', $css);
    }

    public function test_an_unknown_id_is_refused_and_a_stale_one_reads_as_the_default(): void
    {
        $this->assertFalse(DesignLanguages::setActive('nope'));
        $this->assertSame('minimal', DesignLanguages::activeId());

        \Blicks\Models\SettingModel::setValue('design.language', 'gone');
        $this->assertSame('minimal', DesignLanguages::activeId());
    }

    public function test_every_language_sets_the_same_token_keys(): void
    {
        $keys = null;
        foreach (DesignLanguages::builtins() as $language) {
            if ('minimal' === $language['id']) {
                continue;
            }
            $mine = [];
            foreach (['radius', 'shadow'] as $category) {
                foreach (array_keys($language['tokens'][$category]) as $slug) {
                    $mine[] = $category . '.' . $slug;
                }
            }
            sort($mine);
            $keys ??= $mine;
            $this->assertSame($keys, $mine, $language['id'] . ' leaves another language\'s corner or shadow behind');
        }
    }

    public function test_the_language_is_the_base_and_saved_values_still_win(): void
    {
        DesignLanguages::setActive('brutal');

        $snapshot = Catalogue::snapshot(['tokens' => ['radius' => ['lg' => '3px']]]);

        $this->assertSame('brutal', $snapshot['language']['active']);
        // Reset-to-base goes back to the language's value, not the theme's.
        $this->assertSame('0', $snapshot['baseValues']['radius']['md']);
        $this->assertSame('5px 5px 0 #09090b', $snapshot['values']['shadow']['md']);
        // A value someone saved still wins over the language.
        $this->assertSame('3px', $snapshot['values']['radius']['lg']);
        $this->assertSame('800', $snapshot['typeRoles']['base']['h1']['fontWeight']);
    }

    public function test_component_variables_resolve_palette_colours_and_drop_unsafe_values(): void
    {
        DesignLanguages::setActive('skeuo');
        $css = CssVariables::css(['values' => [], 'language' => ['active' => 'skeuo']]);

        $this->assertStringContainsString('--blicks-button-border-color: color-mix(in srgb, var(--blicks-color-primary) 65%, #000);', $css);
        $this->assertStringContainsString('--blicks-button-sheen: linear-gradient(', $css);

        $lines = DesignLanguages::componentDeclarations([
            'ok' => '{color.accent}',
            'bad' => 'red; color: blue',
            'Bad Name' => 'red',
            'escape' => '\\75rl(x)',
        ]);
        $this->assertSame(['  --blicks-ok: var(--blicks-color-accent);'], $lines);
    }

    /** A value the allow-list refuses is dropped silently, so every built-in one must pass it. */
    public function test_every_built_in_value_passes_the_css_allow_list(): void
    {
        foreach (DesignLanguages::builtins() as $language) {
            foreach ($language['tokens'] as $category => $tokens) {
                foreach ($tokens as $slug => $value) {
                    $this->assertNotSame('', \Blicks\Style\CssValue::clean($value), "{$language['id']} {$category}.{$slug}");
                }
            }
            foreach ($language['typeRoles'] as $role => $props) {
                foreach ($props as $prop => $value) {
                    $this->assertNotSame('', \Blicks\Style\CssValue::clean($value), "{$language['id']} {$role}.{$prop}");
                }
            }
            $this->assertCount(count($language['components']), DesignLanguages::componentDeclarations($language['components']), $language['id'] . ' drops a component value');
        }
    }

    public function test_summary_lists_languages_without_their_values(): void
    {
        $summary = DesignLanguages::summary();

        $this->assertSame('minimal', $summary['active']);
        $this->assertSame(['minimal', 'flat', 'skeuo', 'glass', 'liquid-glass', 'neumorph', 'clay', 'brutal', 'bento', 'y2k'], array_column($summary['languages'], 'id'));
        $this->assertArrayNotHasKey('tokens', $summary['languages'][0]);
        // A card can draw each language: Neo-brutalism is square with a hard shadow; Claymorphism
        // has pill buttons; Skeuomorphism serif headings.
        $byId = array_column($summary['languages'], 'sample', 'id');
        $this->assertSame('0', $byId['brutal']['cardRadius']);
        $this->assertSame('3px 3px 0 #09090b', $byId['brutal']['shadow']);
        $this->assertSame('9999px', $byId['clay']['radius']);
        $this->assertSame('1', $byId['skeuo']['headingSerif']);
    }
}
