<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Ai;

use Blicks\Ai\Catalog\TokenCatalog;
use PHPUnit\Framework\TestCase;

/**
 * The token catalogue's projection.
 *
 * Driven from snapshot-shaped arrays rather than a live site: `Catalogue::snapshot()` reads Global
 * Styles and the plugin's options, and it is not what would break. Reshaping it is ours.
 */
final class TokenCatalogTest extends TestCase
{
    /** @return array<string, mixed> */
    private static function snapshot(): array
    {
        return [
            'tokens' => [
                'spacing' => ['sm', 'md', 'lg'],
                'color' => ['primary', 'surface'],
            ],
            'values' => [
                'spacing' => ['sm' => '0.5rem', 'md' => '1rem', 'lg' => '2rem'],
                'color' => ['primary' => '#4f46e5', 'surface' => '#ffffff'],
            ],
            'breakpoints' => [
                ['id' => 'base', 'label' => 'Desktop', 'max' => null],
                ['id' => 'tablet', 'label' => 'Tablet', 'max' => 782],
                ['id' => 'mobile', 'label' => 'Mobile', 'max' => 600],
            ],
        ];
    }

    public function test_it_pairs_every_slug_with_its_resolved_value(): void
    {
        $catalogue = TokenCatalog::fromSnapshot(self::snapshot());

        $this->assertSame(['sm' => '0.5rem', 'md' => '1rem', 'lg' => '2rem'], $catalogue['spacing']);
        $this->assertSame('#4f46e5', $catalogue['color']['primary']);
    }

    /**
     * Colour and font family are the two categories `Catalogue::tokenCatalogue()` leaves out,
     * because the editor bridges them separately for its pickers. For a model they are the most
     * useful entries there are.
     */
    public function test_it_includes_colour(): void
    {
        $this->assertArrayHasKey('color', TokenCatalog::fromSnapshot(self::snapshot()));
    }

    /** Categories come from the snapshot, so a newly added one needs no change here. */
    public function test_it_takes_its_categories_from_the_snapshot(): void
    {
        $snapshot = self::snapshot();
        $snapshot['tokens']['elevation'] = ['flat'];
        $snapshot['values']['elevation'] = ['flat' => 'none'];

        $this->assertSame(['flat' => 'none'], TokenCatalog::fromSnapshot($snapshot)['elevation']);
    }

    /**
     * A slug the inspector offers but nothing has resolved is still a real slug. Dropping it would
     * tell a caller the token does not exist, which is a worse answer than an empty value.
     */
    public function test_a_slug_with_no_value_is_kept_as_empty(): void
    {
        $snapshot = self::snapshot();
        $snapshot['tokens']['spacing'][] = 'xl';

        $catalogue = TokenCatalog::fromSnapshot($snapshot);

        $this->assertArrayHasKey('xl', $catalogue['spacing']);
        $this->assertSame('', $catalogue['spacing']['xl']);
    }

    public function test_a_missing_values_block_still_yields_the_slugs(): void
    {
        $catalogue = TokenCatalog::fromSnapshot(['tokens' => ['spacing' => ['sm']]]);

        $this->assertSame(['sm' => ''], $catalogue['spacing']);
    }

    public function test_an_empty_snapshot_is_an_empty_catalogue(): void
    {
        $this->assertSame([], TokenCatalog::fromSnapshot([]));
    }

    public function test_categories_and_slugs_read_from_a_supplied_catalogue(): void
    {
        $catalogue = TokenCatalog::fromSnapshot(self::snapshot());

        $this->assertSame(['color', 'spacing'], TokenCatalog::categories($catalogue), 'sorted');
        $this->assertSame(['sm', 'md', 'lg'], TokenCatalog::slugs('spacing', $catalogue));
        $this->assertSame([], TokenCatalog::slugs('nonsense', $catalogue));
    }

    public function test_has_answers_for_a_supplied_catalogue(): void
    {
        $catalogue = TokenCatalog::fromSnapshot(self::snapshot());

        $this->assertTrue(TokenCatalog::has('color', 'primary', $catalogue));
        $this->assertFalse(TokenCatalog::has('color', 'tertiary', $catalogue));
        $this->assertFalse(TokenCatalog::has('nonsense', 'primary', $catalogue));
    }

    // ── breakpoints ─────────────────────────────────────────────────────────────

    /**
     * These are max widths and `base` is the unbounded default — the opposite of a mobile-first
     * framework, and the thing most likely to be generated backwards.
     */
    public function test_breakpoints_are_keyed_by_id_and_keep_their_max_width(): void
    {
        $breakpoints = TokenCatalog::breakpoints(self::snapshot());

        $this->assertSame(['base', 'tablet', 'mobile'], array_keys($breakpoints));
        $this->assertNull($breakpoints['base']['maxWidth'], 'base is unbounded');
        $this->assertSame(782, $breakpoints['tablet']['maxWidth']);
        $this->assertSame('Mobile', $breakpoints['mobile']['label']);
    }

    public function test_a_breakpoint_without_a_label_falls_back_to_its_id(): void
    {
        $breakpoints = TokenCatalog::breakpoints([
            'breakpoints' => [['id' => 'wide', 'max' => 1600]],
        ]);

        $this->assertSame('wide', $breakpoints['wide']['label']);
    }

    public function test_malformed_breakpoint_rows_are_skipped(): void
    {
        $breakpoints = TokenCatalog::breakpoints([
            'breakpoints' => [['label' => 'No id'], 'not an array', ['id' => '', 'max' => 1]],
        ]);

        $this->assertSame([], $breakpoints);
    }
}
