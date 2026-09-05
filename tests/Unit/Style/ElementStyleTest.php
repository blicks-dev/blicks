<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Style;

use Blicks\Style\ElementStyle;
use PHPUnit\Framework\TestCase;

/**
 * Tests for ElementStyle::build() — the PHP port of buildElementStyle() in vars.ts.
 * Mirrors the JS logic; keep both in sync when maps or serialisers change.
 */
final class ElementStyleTest extends TestCase
{
    // ── helpers ─────────────────────────────────────────────────────────────────

    /** @return array{classes: list<string>, vars: array<string, string>} */
    private function build(array $blicks): array
    {
        return ElementStyle::build($blicks);
    }

    // ── empty / null ─────────────────────────────────────────────────────────────

    public function test_empty_blicks_returns_empty(): void
    {
        $this->assertSame(['classes' => [], 'vars' => []], $this->build([]));
    }

    public function test_null_blicks_returns_empty(): void
    {
        $this->assertSame(['classes' => [], 'vars' => []], ElementStyle::build(null));
    }

    // ── enum (library preset → bl-{cls}--{slug}, no var) ─────────────────────────

    public function test_enum_emits_library_class_without_var(): void
    {
        $r = $this->build([
            'typography.role' => ['default' => ['base' => 'lead']],
        ]);
        $this->assertSame(['bl-type--lead'], $r['classes']);
        $this->assertSame([], $r['vars']);
    }

    public function test_enum_reads_first_set_slot_when_base_empty(): void
    {
        $r = $this->build([
            'typography.role' => ['default' => ['base' => ''], 'hover' => ['base' => 'h1']],
        ]);
        $this->assertSame(['bl-type--h1'], $r['classes']);
    }

    public function test_enum_sanitises_slug_and_drops_empty(): void
    {
        $this->assertSame(
            ['bl-type--h1drop'],
            $this->build(['typography.role' => ['default' => ['base' => 'h1; drop{}']]])['classes']
        );
        $this->assertSame(
            [],
            $this->build(['typography.role' => ['default' => ['base' => '']]])['classes']
        );
    }

    // ── spacing (box-model sides) ────────────────────────────────────────────────

    public function test_padding_emits_consumer_class_and_side_vars(): void
    {
        $r = $this->build([
            'spacing.padding' => ['default' => ['base' => ['top' => '20px', 'right' => '10px', 'bottom' => '20px', 'left' => '10px']]],
        ]);
        $this->assertContains('bl-pad', $r['classes']);
        $this->assertSame('20px', $r['vars']['--bl-pt']);
        $this->assertSame('10px', $r['vars']['--bl-pr']);
    }

    public function test_padding_bare_number_appends_px(): void
    {
        // '37' is not a spacing token so the bare-number rule fires.
        $r = $this->build([
            'spacing.padding' => ['default' => ['base' => ['top' => '37', 'right' => '37', 'bottom' => '37', 'left' => '37']]],
        ]);
        $this->assertSame('37px', $r['vars']['--bl-pt']);
    }

    public function test_padding_token_resolves_to_var(): void
    {
        $r = $this->build([
            'spacing.padding' => ['default' => ['base' => ['top' => 'md', 'right' => 'md', 'bottom' => 'md', 'left' => 'md']]],
        ]);
        $this->assertSame('var(--blicks-spacing-md)', $r['vars']['--bl-pt']);
    }

    public function test_hover_state_emits_marker_class_and_state_suffixed_vars(): void
    {
        $r = $this->build([
            'spacing.padding' => ['hover' => ['base' => ['top' => '30px', 'right' => '0', 'bottom' => '30px', 'left' => '0']]],
        ]);
        $this->assertContains('bl-pad', $r['classes']);
        $this->assertContains('bl-pad--hov', $r['classes']);
        $this->assertSame('30px', $r['vars']['--bl-pt-hov']);
    }

    public function test_tablet_breakpoint_emits_bp_marker_and_suffixed_var(): void
    {
        $r = $this->build([
            'spacing.padding' => ['default' => ['tablet' => ['top' => '8px', 'right' => '0', 'bottom' => '8px', 'left' => '0']]],
        ]);
        $this->assertContains('bl-pad--tab', $r['classes']);
        $this->assertSame('8px', $r['vars']['--bl-pt-tab']);
    }

    public function test_hover_mobile_slot_produces_combined_key(): void
    {
        $r = $this->build([
            'spacing.padding' => ['hover' => ['mobile' => ['top' => '4px', 'right' => '0', 'bottom' => '4px', 'left' => '0']]],
        ]);
        $this->assertContains('bl-pad--hov-mob', $r['classes']);
        $this->assertSame('4px', $r['vars']['--bl-pt-hov-mob']);
    }

    // ── border radius (corners) ──────────────────────────────────────────────────

    public function test_border_radius_emits_corner_vars(): void
    {
        $r = $this->build([
            'border.radius' => ['default' => ['base' => ['topLeft' => '8px', 'topRight' => '8px', 'bottomRight' => '0', 'bottomLeft' => '0']]],
        ]);
        $this->assertContains('bl-br', $r['classes']);
        $this->assertSame('8px', $r['vars']['--bl-brtl']);
        $this->assertSame('8px', $r['vars']['--bl-brtr']);
        // A bare "0" stays the literal "0" (not "0px", not a token var) — keeps shorthands valid.
        $this->assertSame('0', $r['vars']['--bl-brbr']);
    }

    // ── border width (dedicated scale + legacy spacing-scale fallback) ──────────

    public function test_border_width_token_resolves_to_border_width_var(): void
    {
        $r = $this->build([
            'border.width' => ['default' => ['base' => ['top' => 'hair', 'right' => 'hair', 'bottom' => 'hair', 'left' => 'hair']]],
        ]);
        $this->assertSame('var(--blicks-borderWidth-hair)', $r['vars']['--bl-bwt']);
    }

    public function test_border_width_legacy_spacing_slug_falls_back(): void
    {
        // Pre-migration saved content used the spacing scale for border.width — 'md' isn't a
        // borderWidth slug, so it must still resolve via the fallback category, not pass through
        // as a literal (which would be invalid CSS).
        $r = $this->build([
            'border.width' => ['default' => ['base' => ['top' => 'md', 'right' => 'md', 'bottom' => 'md', 'left' => 'md']]],
        ]);
        $this->assertSame('var(--blicks-spacing-md)', $r['vars']['--bl-bwt']);
    }

    // ── border style / colour (per-side, with legacy string spread) ──────────────

    public function test_border_style_and_color_emit_per_side_vars(): void
    {
        $r = $this->build([
            'border.style' => ['default' => ['base' => ['top' => 'solid', 'bottom' => 'dashed']]],
            'border.color' => ['default' => ['base' => ['top' => 'primary', 'bottom' => '#ccc']]],
        ]);
        $this->assertSame('solid', $r['vars']['--bl-bst']);
        $this->assertSame('dashed', $r['vars']['--bl-bsb']);
        // An unset side falls back to the property's initial value — `0` would invalidate the
        // whole border-style shorthand and drop all four sides.
        $this->assertSame('none', $r['vars']['--bl-bsr']);
        $this->assertSame('none', $r['vars']['--bl-bsl']);
        $this->assertSame('var(--blicks-color-primary)', $r['vars']['--bl-bct']);
        $this->assertSame('#ccc', $r['vars']['--bl-bcb']);
        $this->assertSame('currentcolor', $r['vars']['--bl-bcr']);
    }

    public function test_border_style_and_color_legacy_string_spreads_to_all_sides(): void
    {
        // Content saved before these became per-side stores a bare string.
        $r = $this->build([
            'border.style' => ['default' => ['base' => 'dashed']],
            'border.color' => ['default' => ['base' => 'primary']],
        ]);
        foreach (['bst', 'bsr', 'bsb', 'bsl'] as $v) {
            $this->assertSame('dashed', $r['vars']['--bl-' . $v]);
        }
        foreach (['bct', 'bcr', 'bcb', 'bcl'] as $v) {
            $this->assertSame('var(--blicks-color-primary)', $r['vars']['--bl-' . $v]);
        }
        $this->assertContains('bl-bs', $r['classes']);
        $this->assertContains('bl-bc', $r['classes']);
    }

    // ── position inset (extra '-' before side suffix) ────────────────────────────

    public function test_position_inset_uses_dashed_var_name(): void
    {
        $r = $this->build([
            'position.inset' => ['default' => ['base' => ['top' => '10px', 'right' => 'auto', 'bottom' => 'auto', 'left' => '0']]],
        ]);
        $this->assertContains('bl-inset', $r['classes']);
        $this->assertSame('10px', $r['vars']['--bl-pos-t']);
        $this->assertSame('auto', $r['vars']['--bl-pos-r']);
    }

    public function test_z_index_token_slug_resolves_to_alias_var(): void
    {
        $r = $this->build([
            'position.zIndex' => ['default' => ['base' => 'sticky']],
        ]);
        $this->assertSame('var(--blicks-zIndex-sticky)', $r['vars']['--bl-zi']);
    }

    // ── single props ─────────────────────────────────────────────────────────────

    public function test_layout_display_emits_class_and_var(): void
    {
        $r = $this->build([
            'layout.display' => ['default' => ['base' => 'flex']],
        ]);
        $this->assertContains('bl-d', $r['classes']);
        $this->assertSame('flex', $r['vars']['--bl-d']);
    }

    public function test_color_token_resolves_to_blicks_var(): void
    {
        $r = $this->build([
            'colors.background' => ['default' => ['base' => 'primary']],
        ]);
        $this->assertSame('var(--blicks-color-primary)', $r['vars']['--bl-bg']);
    }

    public function test_image_url_wrapped_in_url_function(): void
    {
        $r = $this->build([
            'background.image' => ['default' => ['base' => 'https://example.com/img.jpg']],
        ]);
        $this->assertSame('url("https://example.com/img.jpg")', $r['vars']['--bl-bg-img']);
    }

    public function test_box_shadow_serialised(): void
    {
        $r = $this->build([
            'effects.boxShadow' => ['default' => ['base' => [
                'inset' => false, 'x' => '0px', 'y' => '4px', 'blur' => '8px', 'spread' => '0px', 'color' => 'rgba(0,0,0,0.2)',
            ]]],
        ]);
        $this->assertSame('0px 4px 8px 0px rgba(0,0,0,0.2)', $r['vars']['--bl-bsh']);
    }

    public function test_inset_box_shadow_prepends_inset_keyword(): void
    {
        $r = $this->build([
            'effects.boxShadow' => ['default' => ['base' => [
                'inset' => true, 'x' => '2px', 'y' => '2px', 'blur' => '4px', 'spread' => '0px', 'color' => '#000',
            ]]],
        ]);
        $this->assertStringStartsWith('inset ', $r['vars']['--bl-bsh']);
    }

    public function test_box_shadow_token_slug_resolves_to_alias_var(): void
    {
        $r = $this->build([
            'effects.boxShadow' => ['default' => ['base' => 'md']],
        ]);
        $this->assertSame('var(--blicks-shadow-md)', $r['vars']['--bl-bsh']);
    }

    public function test_box_shadow_unknown_slug_is_dropped(): void
    {
        $r = $this->build([
            'effects.boxShadow' => ['default' => ['base' => 'bogus']],
        ]);
        $this->assertArrayNotHasKey('--bl-bsh', $r['vars']);
    }

    public function test_motion_token_slugs_resolve_to_alias_vars(): void
    {
        $r = $this->build([
            'effects.transition' => ['default' => ['base' => 'base']],
            'effects.transform' => ['default' => ['base' => 'lift']],
            'effects.filter' => ['default' => ['base' => 'blur']],
        ]);
        $this->assertSame('var(--blicks-transition-base)', $r['vars']['--bl-tr']);
        $this->assertSame('var(--blicks-transform-lift)', $r['vars']['--bl-tfm']);
        $this->assertSame('var(--blicks-filter-blur)', $r['vars']['--bl-flt']);
    }

    public function test_motion_literal_value_passes_through(): void
    {
        $r = $this->build([
            'effects.transition' => ['default' => ['base' => 'all 200ms ease']],
        ]);
        $this->assertSame('all 200ms ease', $r['vars']['--bl-tr']);
    }

    public function test_opacity_token_slug_resolves_to_alias_var(): void
    {
        $r = $this->build([
            'effects.opacity' => ['default' => ['base' => 'muted']],
        ]);
        $this->assertSame('var(--blicks-opacity-muted)', $r['vars']['--bl-op']);
    }

    public function test_opacity_literal_ratio_passes_through(): void
    {
        $r = $this->build([
            'effects.opacity' => ['default' => ['base' => '0.5']],
        ]);
        $this->assertSame('0.5', $r['vars']['--bl-op']);
    }

    public function test_grid_child_placement_emits_classes_and_vars(): void
    {
        $r = $this->build([
            'gridChild.columnSpan' => ['default' => ['base' => '2', 'tablet' => '1']],
            'gridChild.rowSpan' => ['default' => ['base' => '3']],
            'gridChild.alignSelf' => ['default' => ['base' => 'center']],
            'gridChild.justifySelf' => ['default' => ['mobile' => 'stretch']],
            'gridChild.order' => ['default' => ['base' => '-1']],
        ]);

        foreach (['bl-gcs', 'bl-gcs--tab', 'bl-grs', 'bl-gas', 'bl-gjs', 'bl-gjs--mob', 'bl-go'] as $class) {
            $this->assertContains($class, $r['classes']);
        }
        $this->assertSame('2', $r['vars']['--bl-gcs']);
        $this->assertSame('1', $r['vars']['--bl-gcs-tab']);
        $this->assertSame('3', $r['vars']['--bl-grs']);
        $this->assertSame('center', $r['vars']['--bl-gas']);
        $this->assertSame('stretch', $r['vars']['--bl-gjs-mob']);
        $this->assertSame('-1', $r['vars']['--bl-go']);
    }

    public function test_flex_child_emits_classes_and_vars_resolving_basis_against_width_scale(): void
    {
        $r = $this->build([
            'flexChild.grow' => ['default' => ['base' => '1']],
            'flexChild.shrink' => ['default' => ['base' => '0']],
            'flexChild.basis' => ['default' => ['base' => 'prose']],
            'flexChild.alignSelf' => ['default' => ['base' => 'center']],
            'flexChild.order' => ['default' => ['base' => '-1']],
        ]);

        foreach (['bl-fg', 'bl-fsk', 'bl-fb', 'bl-fas', 'bl-fco'] as $class) {
            $this->assertContains($class, $r['classes']);
        }
        $this->assertSame('1', $r['vars']['--bl-fg']);
        $this->assertSame('0', $r['vars']['--bl-fsk']);
        $this->assertSame('var(--blicks-width-prose)', $r['vars']['--bl-fb']);
        $this->assertSame('center', $r['vars']['--bl-fas']);
        $this->assertSame('-1', $r['vars']['--bl-fco']);
    }

    public function test_text_shadow_serialised(): void
    {
        $r = $this->build([
            'effects.textShadow' => ['default' => ['base' => [
                'x' => '1px', 'y' => '1px', 'blur' => '2px', 'color' => '#333',
            ]]],
        ]);
        $this->assertSame('1px 1px 2px #333', $r['vars']['--bl-tsh']);
    }

    public function test_gradient_token_slug_resolves_to_alias_var(): void
    {
        $r = $this->build([
            'background.gradient' => ['default' => ['base' => 'brand']],
        ]);
        $this->assertSame('var(--blicks-gradient-brand)', $r['vars']['--bl-bg-grad']);
    }

    public function test_unknown_gradient_string_passes_through(): void
    {
        $r = $this->build([
            'background.gradient' => ['default' => ['base' => 'not-a-real-slug']],
        ]);
        $this->assertSame('not-a-real-slug', $r['vars']['--bl-bg-grad']);
    }

    public function test_linear_gradient_serialised(): void
    {
        $r = $this->build([
            'background.gradient' => ['default' => ['base' => [
                'type' => 'linear', 'angle' => '135deg',
                'stops' => [
                    ['color' => '#ff0000', 'position' => '0%'],
                    ['color' => '#0000ff', 'position' => '100%'],
                ],
            ]]],
        ]);
        $this->assertSame('linear-gradient(135deg, #ff0000 0%, #0000ff 100%)', $r['vars']['--bl-bg-grad']);
    }

    public function test_radial_gradient_serialised(): void
    {
        $r = $this->build([
            'background.gradient' => ['default' => ['base' => [
                'type' => 'radial',
                'stops' => [
                    ['color' => '#fff', 'position' => '0%'],
                    ['color' => '#000', 'position' => '100%'],
                ],
            ]]],
        ]);
        $this->assertStringStartsWith('radial-gradient(circle,', $r['vars']['--bl-bg-grad']);
    }

    // ── blockProps helper ────────────────────────────────────────────────────────

    public function test_block_props_includes_block_name_and_unique_id(): void
    {
        $props = ElementStyle::blockProps(null, 'abc123', 'box');
        $this->assertStringContainsString('bl-box', $props['class']);
        $this->assertStringContainsString('bl-abc123', $props['class']);
        $this->assertSame('', $props['style']);
    }

    public function test_block_props_style_contains_vars(): void
    {
        $props = ElementStyle::blockProps(
            ['layout.display' => ['default' => ['base' => 'grid']]],
            'abc',
            'container'
        );
        $this->assertStringContainsString('--bl-d:grid', $props['style']);
    }

    public function test_builder_category_can_be_registered_with_one_function(): void
    {
        ElementStyle::registerCssValueBuilder(
            'blurTest',
            static fn (mixed $value): string => 'blur(' . (string) $value . ')'
        );

        $this->assertSame('blur(4px)', ElementStyle::cssValueForCategory('blurTest', '4px'));
    }

    /**
     * Registered builders are an extension seam, so their output is validated like any other
     * value — a builder cannot opt its category out of the CSS-injection guard.
     */
    public function test_registered_builder_output_is_validated(): void
    {
        ElementStyle::registerCssValueBuilder(
            'blurTest',
            static fn (mixed $value): string => 'blur(' . (string) $value . ')'
        );

        $this->assertSame('', ElementStyle::cssValueForCategory('blurTest', '4px); background:url(https://attacker.example/x.png'));
    }

    // ── Scoped (tier-3 / WA) emit — MUST match the JS strings in vars.test.ts ────────

    protected function tearDown(): void
    {
        ElementStyle::clearDynamicRules();
    }

    public function test_selector_suffix_emits_scoped_rule_not_classes_or_vars(): void
    {
        ElementStyle::registerRule([
            'attr' => 'deco.after', 'cls' => 'deco', 'kind' => 'single', 'v' => '--bl-deco',
            'prop' => 'content', 'selectorSuffix' => '::after',
        ]);
        $r = ElementStyle::build(['deco.after' => ['default' => ['base' => '"New"']]], 'card123');
        $this->assertSame([], $r['classes']);
        $this->assertSame([], $r['vars']);
        $this->assertSame(['.bl-card123::after{content:"New"}'], $r['scopedCss'] ?? []);
    }

    public function test_at_rule_wraps_scoped_rule_in_container_query(): void
    {
        ElementStyle::registerRule([
            'attr' => 'cq.cols', 'cls' => 'cq', 'kind' => 'single', 'v' => '--bl-cq',
            'prop' => 'grid-template-columns', 'atRule' => ['type' => 'container', 'query' => '(min-width:380px)'],
        ]);
        $r = ElementStyle::build(['cq.cols' => ['default' => ['base' => '2']]], 'card123');
        $this->assertSame(
            ['@container (min-width:380px){.bl-card123{grid-template-columns:2}}'],
            $r['scopedCss'] ?? []
        );
    }

    public function test_register_property_emits_property_block(): void
    {
        ElementStyle::registerRule([
            'attr' => 'anim.angle', 'cls' => 'ang', 'kind' => 'single', 'v' => '--bl-ang',
            'prop' => 'rotate', 'registerProperty' => ['syntax' => '<angle>', 'initialValue' => '0deg', 'inherits' => false],
        ]);
        $r = ElementStyle::build(['anim.angle' => ['default' => ['base' => '90deg']]], 'spin123');
        $this->assertContains(
            '@property --bl-ang{syntax:"<angle>";initial-value:0deg;inherits:false}',
            $r['scopedCss'] ?? []
        );
    }

    public function test_keyframes_emits_animation_name_rule_gated_by_reduced_motion(): void
    {
        ElementStyle::registerRule([
            'attr' => 'anim.spin', 'cls' => 'spin', 'kind' => 'single', 'v' => '--bl-spin',
            'prop' => 'animation-name', 'keyframes' => 'bl-spin',
        ]);
        $r = ElementStyle::build(['anim.spin' => ['default' => ['base' => 'on']]], 'spinner123');
        $this->assertSame(
            ['@media (prefers-reduced-motion: no-preference){.bl-spinner123{animation-name:bl-spin}}'],
            $r['scopedCss'] ?? []
        );
    }

    // ── Wave B parity fixtures ───────────────────────────────────────────────────

    public function test_wave_b_container_type_and_name(): void
    {
        $r = $this->build([
            'layout.containerType' => ['default' => ['base' => 'inline-size']],
            'layout.containerName' => ['default' => ['base' => 'card']],
        ]);
        $this->assertContains('bl-ct', $r['classes']);
        $this->assertContains('bl-cn', $r['classes']);
        $this->assertSame('inline-size', $r['vars']['--bl-ct']);
        $this->assertSame('card',        $r['vars']['--bl-cn']);
    }

    public function test_wave_b_grid_areas_and_auto_flow(): void
    {
        $r = $this->build([
            'layout.gridAreas'    => ['default' => ['base' => '"h h" "n m"']],
            'layout.gridAutoFlow' => ['default' => ['base' => 'row dense']],
        ]);
        $this->assertContains('bl-areas', $r['classes']);
        $this->assertContains('bl-gaf',   $r['classes']);
        $this->assertSame('"h h" "n m"', $r['vars']['--bl-areas']);
        $this->assertSame('row dense',   $r['vars']['--bl-gaf']);
    }

    public function test_wave_b_scroll_snap_type_and_overflow_xy(): void
    {
        $r = $this->build([
            'layout.scrollSnapType' => ['default' => ['base' => 'x mandatory']],
            'layout.overflowX'      => ['default' => ['base' => 'scroll']],
            'layout.overflowY'      => ['default' => ['base' => 'hidden']],
        ]);
        $this->assertSame('x mandatory', $r['vars']['--bl-sst']);
        $this->assertSame('scroll',      $r['vars']['--bl-ovx']);
        $this->assertSame('hidden',      $r['vars']['--bl-ovy']);
    }

    public function test_wave_b_aspect_ratio_and_object_fit(): void
    {
        $r = $this->build([
            'layout.aspectRatio' => ['default' => ['base' => '16/9']],
            'layout.objectFit'   => ['default' => ['base' => 'cover']],
        ]);
        $this->assertSame('16/9',  $r['vars']['--bl-ar']);
        $this->assertSame('cover', $r['vars']['--bl-of']);
    }

    public function test_aspect_ratio_token_slug_resolves_to_alias_var(): void
    {
        $r = $this->build([
            'layout.aspectRatio' => ['default' => ['base' => 'square']],
        ]);
        $this->assertSame('var(--blicks-aspect-square)', $r['vars']['--bl-ar']);
    }

    public function test_layout_gap_width_height_token_slugs_resolve_to_alias_vars(): void
    {
        $r = $this->build([
            'layout.gapRow' => ['default' => ['base' => 'md']],
            'layout.width' => ['default' => ['base' => 'prose']],
            'layout.height' => ['default' => ['base' => 'prose']],
        ]);
        $this->assertSame('var(--blicks-spacing-md)', $r['vars']['--bl-gap-r']);
        $this->assertSame('var(--blicks-width-prose)', $r['vars']['--bl-w']);
        $this->assertSame('var(--blicks-width-prose)', $r['vars']['--bl-h']);
    }

    public function test_wave_g_align_content_and_grid_auto_tracks(): void
    {
        $r = $this->build([
            'layout.alignContent' => ['default' => ['base' => 'space-between']],
            'layout.gridAutoColumns' => ['default' => ['base' => 'minmax(0, 1fr)']],
            'layout.gridAutoRows' => ['default' => ['base' => '1fr']],
        ]);
        $this->assertSame('space-between', $r['vars']['--bl-ac']);
        $this->assertSame('minmax(0, 1fr)', $r['vars']['--bl-gac']);
        $this->assertSame('1fr', $r['vars']['--bl-gar']);
    }

    public function test_wave_g_min_max_width_height_tokens_and_literals(): void
    {
        $r = $this->build([
            'layout.minWidth' => ['default' => ['base' => 'prose']],
            'layout.maxWidth' => ['default' => ['base' => '600px']],
            'layout.minHeight' => ['default' => ['base' => 'content']],
            'layout.maxHeight' => ['default' => ['base' => '80vh']],
        ]);
        $this->assertSame('var(--blicks-width-prose)', $r['vars']['--bl-miw']);
        $this->assertSame('600px', $r['vars']['--bl-maw']);
        $this->assertSame('var(--blicks-width-content)', $r['vars']['--bl-mih']);
        $this->assertSame('80vh', $r['vars']['--bl-mah']);
    }

    public function test_wave_g_box_sizing_box_behavior_scroll_extras_and_direction(): void
    {
        $r = $this->build([
            'layout.boxSizing' => ['default' => ['base' => 'border-box']],
            'layout.visibility' => ['default' => ['base' => 'hidden']],
            'layout.float' => ['default' => ['base' => 'left']],
            'layout.clear' => ['default' => ['base' => 'both']],
            'layout.isolation' => ['default' => ['base' => 'isolate']],
            'layout.resize' => ['default' => ['base' => 'both']],
            'layout.scrollBehavior' => ['default' => ['base' => 'smooth']],
            'layout.overscrollBehavior' => ['default' => ['base' => 'contain']],
            'layout.scrollSnapStop' => ['default' => ['base' => 'always']],
            'layout.direction' => ['default' => ['base' => 'rtl']],
        ]);
        $this->assertSame('border-box', $r['vars']['--bl-bxz']);
        $this->assertSame('hidden', $r['vars']['--bl-vis']);
        $this->assertSame('left', $r['vars']['--bl-flt2']);
        $this->assertSame('both', $r['vars']['--bl-clr']);
        $this->assertSame('isolate', $r['vars']['--bl-iso']);
        $this->assertSame('both', $r['vars']['--bl-rsz']);
        $this->assertSame('smooth', $r['vars']['--bl-sb']);
        $this->assertSame('contain', $r['vars']['--bl-osb']);
        $this->assertSame('always', $r['vars']['--bl-sss']);
        $this->assertSame('rtl', $r['vars']['--bl-dir']);
    }

    public function test_wave_h_contain_content_visibility_intrinsic_size(): void
    {
        $r = $this->build([
            'layout.contain' => ['default' => ['base' => 'layout']],
            'layout.contentVisibility' => ['default' => ['base' => 'auto']],
            'layout.containIntrinsicSize' => ['default' => ['base' => 'auto 300px']],
        ]);
        $this->assertSame('layout', $r['vars']['--bl-ctn']);
        $this->assertSame('auto', $r['vars']['--bl-cv']);
        $this->assertSame('auto 300px', $r['vars']['--bl-cis']);
    }

    public function test_wave_h_line_clamp(): void
    {
        $r = $this->build([
            'layout.lineClamp' => ['default' => ['base' => '3']],
        ]);
        $this->assertSame('3', $r['vars']['--bl-lc']);
        $this->assertContains('bl-lc', $r['classes']);
    }

    public function test_wave_b_columns_section_vars(): void
    {
        $r = $this->build([
            'columns.columnCount' => ['default' => ['base' => '3']],
            'columns.columnWidth' => ['default' => ['base' => '16rem']],
            'columns.columnGap'   => ['default' => ['base' => '24px']],
        ]);
        $this->assertSame('3',     $r['vars']['--bl-cc']);
        $this->assertSame('16rem', $r['vars']['--bl-cw']);
        $this->assertSame('24px',  $r['vars']['--bl-cgap']);
    }

    public function test_columns_width_and_gap_token_slugs_resolve_to_alias_vars(): void
    {
        $r = $this->build([
            'columns.columnWidth' => ['default' => ['base' => 'prose']],
            'columns.columnGap' => ['default' => ['base' => 'md']],
        ]);
        $this->assertSame('var(--blicks-width-prose)', $r['vars']['--bl-cw']);
        $this->assertSame('var(--blicks-spacing-md)', $r['vars']['--bl-cgap']);
    }

    public function test_wave_b_columns_break_inside_emits_scoped_child_rule(): void
    {
        $r = ElementStyle::build(['columns.breakInside' => ['default' => ['base' => 'avoid']]], 'col42');
        $this->assertSame([], $r['classes']);
        $this->assertSame([], array_values($r['vars']));
        $this->assertSame(['.bl-col42 > *{break-inside:avoid}'], $r['scopedCss'] ?? []);
    }

    public function test_wave_b_grid_child_grid_area_and_snap_align(): void
    {
        $r = $this->build([
            'gridChild.gridArea'        => ['default' => ['base' => 'header']],
            'gridChild.scrollSnapAlign' => ['default' => ['base' => 'center']],
        ]);
        $this->assertSame('header', $r['vars']['--bl-ga']);
        $this->assertSame('center', $r['vars']['--bl-ssa']);
    }

    // ── Wave C parity fixtures ───────────────────────────────────────────────────

    public function test_wave_c_gradient_builder_conic_with_position(): void
    {
        $r = $this->build([
            'background.gradient' => [
                'default' => [
                    'base' => [
                        'type' => 'conic',
                        'angle' => '45deg',
                        'position' => '30% 70%',
                        'stops' => [
                            ['color' => '#f59e0b', 'position' => '0%'],
                            ['color' => '#ef4444', 'position' => '50%'],
                            ['color' => '#8b5cf6', 'position' => '100%'],
                        ],
                    ],
                ],
            ],
        ]);
        $this->assertSame(
            'conic-gradient(from 45deg at 30% 70%, #f59e0b 0%, #ef4444 50%, #8b5cf6 100%)',
            $r['vars']['--bl-bg-grad']
        );
    }

    public function test_wave_c_gradient_builder_conic_without_position(): void
    {
        $r = $this->build([
            'background.gradient' => [
                'default' => [
                    'base' => [
                        'type' => 'conic',
                        'angle' => '0deg',
                        'stops' => [
                            ['color' => '#000', 'position' => '0%'],
                            ['color' => '#fff', 'position' => '100%'],
                        ],
                    ],
                ],
            ],
        ]);
        $this->assertSame(
            'conic-gradient(from 0deg, #000 0%, #fff 100%)',
            $r['vars']['--bl-bg-grad']
        );
    }

    public function test_wave_c_radial_with_shape_and_position(): void
    {
        $r = $this->build([
            'background.gradient' => [
                'default' => [
                    'base' => [
                        'type' => 'radial',
                        'shape' => 'ellipse',
                        'position' => 'top right',
                        'stops' => [
                            ['color' => '#000', 'position' => '0%'],
                            ['color' => '#fff', 'position' => '100%'],
                        ],
                    ],
                ],
            ],
        ]);
        $this->assertSame(
            'radial-gradient(ellipse at top right, #000 0%, #fff 100%)',
            $r['vars']['--bl-bg-grad']
        );
    }

    public function test_wave_c_legacy_radial_circle_only(): void
    {
        $r = $this->build([
            'background.gradient' => [
                'default' => [
                    'base' => [
                        'type' => 'radial',
                        'from' => '#111827',
                        'to' => '#f9fafb',
                    ],
                ],
            ],
        ]);
        $this->assertSame(
            'radial-gradient(circle, #111827 0%, #f9fafb 100%)',
            $r['vars']['--bl-bg-grad']
        );
    }

    public function test_wave_c_background_blend_and_clip_text(): void
    {
        $r = $this->build([
            'background.blendMode' => ['default' => ['base' => 'multiply']],
            'colors.clipText'      => ['default' => ['base' => 'on']],
        ]);
        $this->assertContains('bl-bg-blend', $r['classes']);
        $this->assertContains('bl-cliptext', $r['classes']);
        $this->assertSame('multiply', $r['vars']['--bl-bg-blend']);
        $this->assertSame('on',       $r['vars']['--bl-cliptext']);
    }

    public function test_wave_c_writing_mode_and_text_orientation(): void
    {
        $r = $this->build([
            'typography.writingMode'     => ['default' => ['base' => 'vertical-rl']],
            'typography.textOrientation' => ['default' => ['base' => 'upright']],
        ]);
        $this->assertContains('bl-wm', $r['classes']);
        $this->assertContains('bl-to', $r['classes']);
        $this->assertSame('vertical-rl', $r['vars']['--bl-wm']);
        $this->assertSame('upright',     $r['vars']['--bl-to']);
    }

    public function test_line_height_token_slug_resolves_to_alias_var(): void
    {
        $r = $this->build([
            'typography.lineHeight' => ['default' => ['base' => 'tight']],
        ]);
        $this->assertSame('var(--blicks-leading-tight)', $r['vars']['--bl-lh']);
    }

    public function test_line_height_literal_passes_through(): void
    {
        $r = $this->build([
            'typography.lineHeight' => ['default' => ['base' => '1.5']],
        ]);
        $this->assertSame('1.5', $r['vars']['--bl-lh']);
    }

    // ── Wave D parity fixtures ───────────────────────────────────────────────────

    public function test_wave_d_clip_path_diagonal(): void
    {
        $r = $this->build([
            'effects.clipPath' => ['default' => ['base' => ['shape' => 'diagonal', 'amount' => '40px']]],
        ]);
        $this->assertSame(
            'polygon(0 0, 100% 0, 100% calc(100% - 40px), 0 100%)',
            $r['vars']['--bl-clip']
        );
    }

    public function test_wave_d_clip_path_fold(): void
    {
        $r = $this->build([
            'effects.clipPath' => ['default' => ['base' => ['shape' => 'fold', 'amount' => '40px']]],
        ]);
        $this->assertSame(
            'polygon(0 0, calc(100% - 40px) 0, 100% 40px, 100% 100%, 0 100%)',
            $r['vars']['--bl-clip']
        );
    }

    public function test_wave_d_clip_path_circle_and_inset(): void
    {
        $rc = $this->build([
            'effects.clipPath' => ['default' => ['base' => ['shape' => 'circle', 'amount' => '50%']]],
        ]);
        $this->assertSame('circle(50% at center)', $rc['vars']['--bl-clip']);

        $ri = $this->build([
            'effects.clipPath' => ['default' => ['base' => ['shape' => 'inset', 'amount' => '12px']]],
        ]);
        $this->assertSame('inset(12px)', $ri['vars']['--bl-clip']);
    }

    public function test_wave_d_backdrop_filter_composes_calls(): void
    {
        $r = $this->build([
            'effects.backdropFilter' => ['default' => ['base' => [
                'blur' => '12px', 'brightness' => '110%', 'saturate' => '150%',
            ]]],
        ]);
        $this->assertSame(
            'blur(12px) brightness(110%) saturate(150%)',
            $r['vars']['--bl-bdf']
        );
    }

    public function test_wave_d_mask_edge_fade(): void
    {
        $r = $this->build([
            'effects.mask' => ['default' => ['base' => ['kind' => 'edge-fade', 'side' => 'right', 'size' => '24%']]],
        ]);
        $this->assertSame(
            'linear-gradient(to left, transparent, black 24%)',
            $r['vars']['--bl-mask']
        );
    }

    public function test_wave_d_mask_edge_fade_both(): void
    {
        $r = $this->build([
            'effects.mask' => ['default' => ['base' => ['kind' => 'edge-fade-both', 'axis' => 'x', 'size' => '15%']]],
        ]);
        $this->assertSame(
            'linear-gradient(to right, transparent, black 15%, black calc(100% - 15%), transparent)',
            $r['vars']['--bl-mask']
        );
    }

    public function test_wave_d_structured_transform(): void
    {
        $r = $this->build([
            'effects.transform' => ['default' => ['base' => [
                'translateX' => '10px', 'translateY' => '0', 'translateZ' => '0',
                'rotateX' => '15deg', 'scale' => '1.05',
            ]]],
        ]);
        $this->assertSame(
            'translate3d(10px, 0, 0) rotateX(15deg) scale(1.05)',
            $r['vars']['--bl-tfm']
        );
    }

    public function test_wave_d_transform_passes_string_through(): void
    {
        $r = $this->build([
            'effects.transform' => ['default' => ['base' => 'rotate(2deg)']],
        ]);
        $this->assertSame('rotate(2deg)', $r['vars']['--bl-tfm']);
    }

    public function test_wave_e_animation_preset_and_timing(): void
    {
        $r = $this->build([
            'animation.name'      => ['default' => ['base' => 'bl-spin']],
            'animation.duration'  => ['default' => ['base' => '8s']],
            'animation.easing'    => ['default' => ['base' => 'linear']],
            'animation.iteration' => ['default' => ['base' => 'infinite']],
        ]);
        $this->assertContains('bl-anim-name', $r['classes']);
        $this->assertSame('bl-spin',   $r['vars']['--bl-anim-name']);
        $this->assertSame('8s',        $r['vars']['--bl-anim-dur']);
        $this->assertSame('linear',    $r['vars']['--bl-anim-ease']);
        $this->assertSame('infinite',  $r['vars']['--bl-anim-iter']);
    }

    public function test_wave_e_scroll_timeline(): void
    {
        $r = $this->build([
            'animation.timeline' => ['default' => ['base' => 'scroll()']],
            'animation.range'    => ['default' => ['base' => 'entry 0% entry 60%']],
        ]);
        $this->assertContains('bl-anim-tl', $r['classes']);
        $this->assertSame('scroll()',           $r['vars']['--bl-anim-tl']);
        $this->assertSame('entry 0% entry 60%', $r['vars']['--bl-anim-range']);
    }

    public function test_wave_e_property_targets(): void
    {
        $r = $this->build([
            'animation.targetAngle' => ['default' => ['base' => '360deg']],
            'animation.target'      => ['default' => ['base' => '0.75']],
        ]);
        $this->assertSame('360deg', $r['vars']['--bl-ang']);
        $this->assertSame('0.75',   $r['vars']['--bl-p-target']);
    }

    public function test_wave_f_decoration_after_emits_scoped_body(): void
    {
        $r = ElementStyle::build(
            ['decoration.after' => [
                'default' => [
                    'base' => [
                        'content' => '""',
                        'width' => '40px',
                        'height' => '40px',
                        'borderRadius' => '50%',
                        'background' => '#000',
                        'inset' => ['top' => 'auto', 'right' => '-12px', 'bottom' => '-12px', 'left' => 'auto'],
                        'blur' => '12px',
                    ],
                ],
            ]],
            'orb1'
        );
        $this->assertSame(
            ['.bl-orb1::after{content:"";position:absolute;background:#000;width:40px;height:40px;top:auto;right:-12px;bottom:-12px;left:auto;border-radius:50%;filter:blur(12px)}'],
            $r['scopedCss'] ?? []
        );
    }

    public function test_decoration_extended_box_surface_matches_js_contract(): void
    {
        $r = ElementStyle::build(
            ['decoration.after' => [
                'default' => [
                    'base' => [
                        'content' => '""',
                        'boxShadow' => '0 4px 6px #000',
                        'backdropFilter' => 'blur(8px)',
                        'clipPath' => 'circle(50%)',
                        'transition' => 'all .3s',
                        'mask' => 'linear-gradient(#000,transparent)',
                        'backgroundClip' => 'text',
                    ],
                ],
            ]],
            'x'
        );
        $this->assertSame(
            ['.bl-x::after{content:"";position:absolute;box-shadow:0 4px 6px #000;backdrop-filter:blur(8px);clip-path:circle(50%);transition:all .3s;-webkit-mask:linear-gradient(#000,transparent);mask:linear-gradient(#000,transparent);-webkit-background-clip:text;background-clip:text}'],
            $r['scopedCss'] ?? []
        );
    }

    public function test_decoration_content_quote_is_escaped(): void
    {
        $r = ElementStyle::build(
            ['decoration.before' => ['default' => ['base' => ['content' => '"']]]],
            'x'
        );
        $this->assertSame(['.bl-x::before{content:"\"";position:absolute}'], $r['scopedCss'] ?? []);
    }

    public function test_decoration_content_plain_quoted_keywords_passthrough(): void
    {
        $plain = ElementStyle::build(
            ['decoration.after' => ['default' => ['base' => ['content' => 'Get started']]]],
            'x'
        );
        $this->assertSame(['.bl-x::after{content:"Get started";position:absolute}'], $plain['scopedCss'] ?? []);

        $fn = ElementStyle::build(
            ['decoration.after' => ['default' => ['base' => ['content' => 'counter(item)']]]],
            'x'
        );
        $this->assertSame(['.bl-x::after{content:counter(item);position:absolute}'], $fn['scopedCss'] ?? []);
    }

    public function test_wave_f_decoration_disabled_emits_nothing(): void
    {
        $r = ElementStyle::build(
            ['decoration.before' => ['default' => ['base' => ['enabled' => false]]]],
            'orb1'
        );
        $this->assertSame([], $r['scopedCss'] ?? []);
    }

    public function test_wave_f_counters_emit_plain_vars(): void
    {
        $r = $this->build([
            'decoration.counterReset'     => ['default' => ['base' => 'item']],
            'decoration.counterIncrement' => ['default' => ['base' => 'item']],
        ]);
        $this->assertContains('bl-cnt-r', $r['classes']);
        $this->assertContains('bl-cnt-i', $r['classes']);
        $this->assertSame('item', $r['vars']['--bl-cnt-r']);
        $this->assertSame('item', $r['vars']['--bl-cnt-i']);
    }

    public function test_wave_d_transform_origin_style_perspective(): void
    {
        $r = $this->build([
            'effects.transformOrigin' => ['default' => ['base' => 'top left']],
            'effects.transformStyle'  => ['default' => ['base' => 'preserve-3d']],
            'effects.perspective'     => ['default' => ['base' => '800px']],
        ]);
        $this->assertContains('bl-tfo', $r['classes']);
        $this->assertContains('bl-tfs', $r['classes']);
        $this->assertContains('bl-psp', $r['classes']);
        $this->assertSame('top left',    $r['vars']['--bl-tfo']);
        $this->assertSame('preserve-3d', $r['vars']['--bl-tfs']);
        $this->assertSame('800px',       $r['vars']['--bl-psp']);
    }
}
