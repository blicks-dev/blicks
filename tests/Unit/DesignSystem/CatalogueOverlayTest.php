<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\DesignSystem;

use Blicks\DesignSystem\Catalogue;
use PHPUnit\Framework\TestCase;

final class CatalogueOverlayTest extends TestCase
{
    public function test_with_saved_values_overlays_sanitized_payload_onto_snapshot(): void
    {
        $snapshot = [
            'values' => [
                'color' => ['primary' => '#000000'],
                'spacing' => ['lg' => '1.5rem'],
            ],
            'breakpoints' => [
                ['id' => 'base', 'max' => null],
                ['id' => 'tablet', 'max' => 782],
            ],
        ];

        $result = Catalogue::withSavedValues($snapshot, [
            'tokens' => [
                'color' => ['primary' => '#ff0000'],
                'spacing' => ['lg' => '3rem'],
            ],
            'breakpoints' => ['tablet' => 900],
        ]);

        // Just-saved values win over the (possibly cache-stale) snapshot.
        $this->assertSame('#ff0000', $result['values']['color']['primary']);
        $this->assertSame('3rem', $result['values']['spacing']['lg']);
        $this->assertSame(900, $result['breakpoints'][1]['max']);
    }

    public function test_with_saved_values_overlays_type_roles(): void
    {
        $snapshot = [
            'values' => [],
            'breakpoints' => [],
            'typeRoles' => [
                'values' => [
                    'h1' => ['fontWeight' => '700', 'fontSize' => '2.25rem'],
                    'body' => ['fontSize' => '1rem'],
                ],
            ],
        ];

        $result = Catalogue::withSavedValues($snapshot, [
            'typeRoles' => [
                'h1' => ['fontWeight' => '900'],
                'body' => ['fontSize' => 'bad; value'], // invalid → dropped, base kept
            ],
        ]);

        $this->assertSame('900', $result['typeRoles']['values']['h1']['fontWeight']);
        $this->assertSame('2.25rem', $result['typeRoles']['values']['h1']['fontSize']);
        $this->assertSame('1rem', $result['typeRoles']['values']['body']['fontSize']);
    }

    public function test_with_saved_values_ignores_unknown_and_invalid_tokens(): void
    {
        $snapshot = ['values' => ['color' => ['primary' => '#000000']], 'breakpoints' => []];

        $result = Catalogue::withSavedValues($snapshot, [
            'tokens' => [
                'color' => ['primary' => '#abcdef', 'bogus-slug' => '#fff'],
                'made-up' => ['x' => 'y'],
            ],
        ]);

        $this->assertSame('#abcdef', $result['values']['color']['primary']);
        $this->assertArrayNotHasKey('bogus-slug', $result['values']['color']);
        $this->assertArrayNotHasKey('made-up', $result['values']);
    }
}
