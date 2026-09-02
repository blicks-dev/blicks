<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\DesignSystem;

use Blicks\DesignSystem\Store;
use PHPUnit\Framework\TestCase;

final class StoreTest extends TestCase
{
    public function test_changed_values_tracks_only_newly_changed_tokens_and_breakpoints(): void
    {
        $changed = Store::changedValues([
            'tokens' => [
                'color' => [
                    'primary' => '#111111',
                    'background' => '#ffffff',
                ],
                'spacing' => [
                    'md' => '1rem',
                ],
            ],
            'breakpoints' => [
                'tablet' => 782,
            ],
        ], [
            'tokens' => [
                'color' => [
                    'primary' => '#222222',
                    'background' => '#ffffff',
                ],
                'spacing' => [
                    'md' => '1rem',
                ],
            ],
            'breakpoints' => [
                'tablet' => 900,
            ],
        ]);

        $this->assertSame([
            'tokens' => [
                'color' => [
                    'primary' => '#222222',
                ],
            ],
            'breakpoints' => [
                'tablet' => 900,
            ],
            'typeRoles' => [],
        ], $changed);
    }

    public function test_without_values_removes_migrated_values_from_option_payload(): void
    {
        $remaining = Store::withoutValues([
            'tokens' => [
                'color' => [
                    'primary' => '#222222',
                    'background' => '#ffffff',
                ],
                'spacing' => [
                    'md' => '1rem',
                ],
            ],
            'breakpoints' => [
                'tablet' => 900,
                'mobile' => 600,
            ],
        ], [
            'tokens' => [
                'color' => [
                    'primary' => '#222222',
                ],
            ],
            'breakpoints' => [
                'tablet' => 900,
            ],
        ]);

        $this->assertSame([
            'tokens' => [
                'color' => [
                    'background' => '#ffffff',
                ],
                'spacing' => [
                    'md' => '1rem',
                ],
            ],
            'breakpoints' => [
                'mobile' => 600,
            ],
        ], $remaining);
    }
}
