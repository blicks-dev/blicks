<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\DesignSystem;

use Blicks\DesignSystem\Overrides;
use PHPUnit\Framework\TestCase;

final class OverridesTest extends TestCase
{
    public function test_sanitize_keeps_only_known_tokens_and_editable_breakpoints(): void
    {
        $catalogue = [
            'color' => ['primary', 'background'],
            'spacing' => ['sm', 'md'],
        ];
        $breakpoints = [
            ['id' => 'base', 'label' => 'Desktop', 'max' => null],
            ['id' => 'tablet', 'label' => 'Tablet', 'max' => 782],
            ['id' => 'mobile', 'label' => 'Mobile', 'max' => 600],
        ];

        $sanitized = Overrides::sanitize([
            'tokens' => [
                'color' => [
                    'primary' => ' #111111 ',
                    'unknown' => '#ffffff',
                ],
                'unknown' => [
                    'primary' => 'bad',
                ],
            ],
            'breakpoints' => [
                'base' => 1200,
                'tablet' => '900',
                'mobile' => 200,
                'unknown' => 700,
            ],
        ], $catalogue, $breakpoints);

        $this->assertSame([
            'tokens' => [
                'color' => [
                    'primary' => '#111111',
                ],
            ],
            'breakpoints' => [
                'tablet' => 900,
            ],
            'typeRoles' => [],
        ], $sanitized);
    }

    public function test_sanitize_type_roles_validates_each_prop(): void
    {
        $catalogue = ['fontFamily' => ['sans', 'mono']];

        $sanitized = Overrides::sanitize([
            'typeRoles' => [
                'h1' => [
                    'fontSize' => 'clamp(2rem, 5vw, 4rem)',
                    'fontWeight' => '800',
                    'lineHeight' => '1.1',
                    'letterSpacing' => '-0.02em',
                    'fontFamily' => 'sans',
                    'textTransform' => 'uppercase',
                ],
                'h2' => [
                    'fontWeight' => '1000',          // invalid weight → dropped
                    'textTransform' => 'sideways',   // invalid enum → dropped
                    'fontSize' => 'red; }',          // delimiter → dropped
                    'fontFamily' => 'var(--wp--preset--font-family--serif)',
                ],
                'bogusRole' => ['fontSize' => '1rem'], // unknown role → dropped
                'code' => ['unknownProp' => 'x', 'fontFamily' => 'Fira Code, monospace'],
            ],
        ], $catalogue, []);

        $this->assertSame([
            'h1' => [
                'fontSize' => 'clamp(2rem, 5vw, 4rem)',
                'fontWeight' => '800',
                'lineHeight' => '1.1',
                'letterSpacing' => '-0.02em',
                'fontFamily' => 'sans',
                'textTransform' => 'uppercase',
            ],
            'h2' => [
                'fontFamily' => 'var(--wp--preset--font-family--serif)',
            ],
            'code' => [
                'fontFamily' => 'Fira Code, monospace',
            ],
        ], $sanitized['typeRoles']);
    }

    /**
     * PHP casts a numeric-string array key to an int, so a theme whose scale uses numeric slugs
     * (`spacing.50` — the Twenty Twenty-Five family) arrives as `[50 => '…']`. A plain
     * `is_string($slug)` guard silently dropped every one of them, making those tokens unsavable.
     */
    public function test_sanitize_keeps_numeric_token_slugs(): void
    {
        $sanitized = Overrides::sanitize([
            'tokens' => [
                'spacing' => [
                    '50' => '1.125rem',
                    '60' => '2rem',
                    '999' => 'not in the catalogue',
                ],
            ],
        ], ['spacing' => ['50', '60']], []);

        $this->assertSame(['50' => '1.125rem', '60' => '2rem'], $sanitized['tokens']['spacing']);
    }

    public function test_normalize_keeps_numeric_token_slugs(): void
    {
        $normalized = Overrides::normalize(['tokens' => ['spacing' => ['50' => '1.125rem']]]);

        $this->assertSame(['50' => '1.125rem'], $normalized['tokens']['spacing']);
    }

    public function test_slug_key_coerces_int_keys_and_rejects_anything_else(): void
    {
        $this->assertSame('50', Overrides::slugKey(50));
        $this->assertSame('md', Overrides::slugKey('md'));
        $this->assertNull(Overrides::slugKey(1.5));
        $this->assertNull(Overrides::slugKey(null));
    }
}
