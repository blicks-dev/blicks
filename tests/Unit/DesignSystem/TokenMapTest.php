<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\DesignSystem;

use Blicks\DesignSystem\TokenMap;
use Blicks\Style\Tokens;
use PHPUnit\Framework\TestCase;

final class TokenMapTest extends TestCase
{
    public function test_every_tokens_json_category_has_a_descriptor(): void
    {
        // Guard: the token catalogue and the mapper must not drift apart. Every category the
        // engine recognises (except none) needs a theme.json home, and the synthetic
        // `breakpoints` category is mapped too.
        $mapped = TokenMap::categories();
        foreach (array_keys(Tokens::catalogue()) as $category) {
            $this->assertContains($category, $mapped, "tokens.json category '{$category}' is unmapped");
        }
        $this->assertContains('breakpoints', $mapped);
    }

    public function test_descriptors_use_exact_theme_json_v3_paths(): void
    {
        // Verbatim against schemas.wp.org/trunk/theme.json (version 3). If WP renames a slot,
        // this is the test that should fail first.
        $paths = [];
        foreach (TokenMap::descriptors() as $descriptor) {
            $paths[$descriptor['category']] = implode('.', $descriptor['settings']);
        }

        $this->assertSame('color.palette', $paths['color']);
        $this->assertSame('spacing.spacingSizes', $paths['spacing']);
        $this->assertSame('typography.fontSizes', $paths['fontSize']);
        $this->assertSame('typography.fontFamilies', $paths['fontFamily']);
        $this->assertSame('border.radiusSizes', $paths['radius']);
        $this->assertSame('shadow.presets', $paths['shadow']);
        $this->assertSame('layout.contentSize', $paths['content']);
        $this->assertSame('custom.blicks.transition', $paths['transition']);
        $this->assertSame('custom.blicks.transform', $paths['transform']);
        $this->assertSame('custom.blicks.filter', $paths['filter']);
        $this->assertSame('custom.blicks.breakpoints', $paths['breakpoints']);
    }

    public function test_preset_value_keys_match_schema(): void
    {
        $valueKey = static fn (string $cat): ?string => TokenMap::forCategory($cat)['valueKey'] ?? null;

        $this->assertSame('color', $valueKey('color'));
        $this->assertSame('size', $valueKey('spacing'));
        $this->assertSame('size', $valueKey('fontSize'));
        $this->assertSame('fontFamily', $valueKey('fontFamily'));
        $this->assertSame('size', $valueKey('radius'));
        $this->assertSame('shadow', $valueKey('shadow'));
        // Non-preset kinds carry no value key.
        $this->assertNull($valueKey('content'));
        $this->assertNull($valueKey('transition'));
    }

    public function test_preset_css_vars(): void
    {
        $this->assertSame('--wp--preset--color--primary', TokenMap::cssVar('color', 'primary'));
        $this->assertSame('--wp--preset--spacing--2xl', TokenMap::cssVar('spacing', '2xl'));
        $this->assertSame('--wp--preset--font-size--base', TokenMap::cssVar('fontSize', 'base'));
        $this->assertSame('--wp--preset--font-family--sans', TokenMap::cssVar('fontFamily', 'sans'));
        $this->assertSame('--wp--preset--border-radius--lg', TokenMap::cssVar('radius', 'lg'));
        $this->assertSame('--wp--preset--shadow--md', TokenMap::cssVar('shadow', 'md'));
    }

    public function test_custom_css_vars(): void
    {
        $this->assertSame('--wp--custom--blicks--transition--fast', TokenMap::cssVar('transition', 'fast'));
        $this->assertSame('--wp--custom--blicks--transform--lift', TokenMap::cssVar('transform', 'lift'));
        $this->assertSame('--wp--custom--blicks--filter--blur', TokenMap::cssVar('filter', 'blur'));
        $this->assertSame('--wp--custom--blicks--breakpoints--md', TokenMap::cssVar('breakpoints', 'md'));
    }

    public function test_layout_css_var_is_fixed(): void
    {
        // contentSize is a single global style, not a preset fan-out — slug is ignored.
        $this->assertSame('--wp--style--global--content-size', TokenMap::cssVar('content', 'size'));
    }

    public function test_unknown_category_yields_empty_var(): void
    {
        $this->assertSame('', TokenMap::cssVar('nope', 'x'));
        $this->assertNull(TokenMap::forCategory('nope'));
    }

    public function test_kebab_matches_wp_custom_key_transform(): void
    {
        $this->assertSame('fast', TokenMap::kebab('fast'));
        $this->assertSame('my-color', TokenMap::kebab('myColor'));
        $this->assertSame('font-family', TokenMap::kebab('fontFamily'));
    }
}
