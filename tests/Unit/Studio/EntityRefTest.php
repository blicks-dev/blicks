<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Studio;

use Blicks\Studio\EntityRef;
use PHPUnit\Framework\TestCase;
use WP_REST_Request;
use WP_REST_Response;

/**
 * `EntityRef`: what a Studio mode may open and save, and as whom.
 *
 * The post kind is proved with a type that exists only in this test (`product`, registered in the
 * data stubs, opted in through the filter here), so no Pro type lands in the free plugin to test it.
 */
final class EntityRefTest extends TestCase
{
    protected function setUp(): void
    {
        blicks_test_reset_filters();
        $GLOBALS['blicks_test_posts'] = [];
        $GLOBALS['blicks_test_templates'] = [];
        $GLOBALS['blicks_test_updates'] = [];
    }

    protected function tearDown(): void
    {
        blicks_test_reset_filters();
    }

    private function allow(mixed ...$types): void
    {
        blicks_test_add_filter('blicks_studio_entity_types', static fn (array $t): array => [...$t, ...$types]);
    }

    private function post(int $id, string $type, string $content = '', string $title = 'Size guide'): void
    {
        $GLOBALS['blicks_test_posts'][$id] = (object) ['ID' => $id, 'post_type' => $type, 'post_title' => $title, 'post_content' => $content];
    }

    private function template(string $type, string $id, string $title, string $content = ''): void
    {
        [, $slug] = explode('//', $id, 2);
        $GLOBALS['blicks_test_templates'][$type][] = (object) ['id' => $id, 'slug' => $slug, 'title' => $title, 'content' => $content];
    }

    public function test_a_template_part_ref_needs_theme_and_slug(): void
    {
        $this->assertSame(['kind' => 'template-part', 'id' => 'twentytwentyfive//header', 'type' => 'wp_template_part'], EntityRef::from(['kind' => 'template-part', 'id' => 'twentytwentyfive//header']));
        $this->assertNull(EntityRef::from(['kind' => 'template-part', 'id' => 'header']));
        $this->assertNull(EntityRef::from(['kind' => 'template-part', 'id' => '../etc//passwd']));
        $this->assertNull(EntityRef::from(['kind' => 'template-part', 'id' => 7]));
    }

    public function test_no_post_type_is_open_until_one_opts_in(): void
    {
        $this->assertSame([], EntityRef::postTypes());
        $this->assertNull(EntityRef::from(['kind' => 'post', 'type' => 'page', 'id' => 3]));

        $this->allow('product');

        $this->assertSame(['kind' => 'post', 'id' => 3, 'type' => 'product'], EntityRef::from(['kind' => 'post', 'type' => 'product', 'id' => '3']));
        $this->assertNull(EntityRef::from(['kind' => 'post', 'type' => 'product', 'id' => 0]));
        $this->assertNull(EntityRef::from(['kind' => 'menu', 'id' => 3]));
    }

    public function test_only_registered_types_can_opt_in(): void
    {
        $this->allow('product', 'not_registered', 'Product', '', 42);

        $this->assertSame(['product'], EntityRef::postTypes());
    }

    public function test_each_kind_asks_for_its_own_capability(): void
    {
        $this->assertSame(['edit_theme_options'], EntityRef::capability(['kind' => 'template-part', 'id' => 'a//b', 'type' => 'wp_template_part']));
        $this->assertSame(['edit_post', 3], EntityRef::capability(['kind' => 'post', 'id' => 3, 'type' => 'product']));
    }

    public function test_a_post_of_another_type_cannot_be_reached_through_an_allowed_type(): void
    {
        $this->allow('product');
        $this->post(3, 'product');
        $this->post(4, 'page');

        $this->assertTrue(EntityRef::canEdit(['kind' => 'post', 'id' => 3, 'type' => 'product']));
        $this->assertFalse(EntityRef::canEdit(['kind' => 'post', 'id' => 4, 'type' => 'product']));
        $this->assertFalse(EntityRef::canEdit(['kind' => 'post', 'id' => 9, 'type' => 'product']));
    }

    public function test_reads_a_post_and_asks_its_type_where_it_is_used(): void
    {
        $this->allow('product');
        $this->post(3, 'product', '<!-- wp:blicks/dialog /-->');
        blicks_test_add_filter('blicks_studio_entity_used_on', static fn (array $used, array $ref): array => [
            ['id' => 12, 'title' => 'Shirt', 'kind' => 'page'],
            ['title' => 'no id'],
            'nonsense',
        ]);

        $this->assertSame([
            'content' => '<!-- wp:blicks/dialog /-->',
            'title' => 'Size guide',
            'usedOn' => [['id' => '12', 'title' => 'Shirt', 'kind' => 'page']],
        ], EntityRef::read(['kind' => 'post', 'id' => 3, 'type' => 'product']));
    }

    public function test_writes_a_post_slashed_and_answers_with_what_was_stored(): void
    {
        $this->allow('product');
        $this->post(3, 'product', 'old');
        $content = '<!-- wp:blicks/text {"content":"a \\"quote\\""} /-->';

        $result = EntityRef::write(['kind' => 'post', 'id' => 3, 'type' => 'product'], $content);

        $this->assertSame(addslashes($content), $GLOBALS['blicks_test_updates'][0]['post_content']);
        $this->assertSame($content, $result['content']);
    }

    public function test_reads_a_template_part_and_the_templates_that_place_it(): void
    {
        $this->template('wp_template_part', 'tt5//header', 'Main header', '<!-- wp:blicks/header --><!-- /wp:blicks/header -->');
        $this->template('wp_template', 'tt5//index', 'Index', '<!-- wp:template-part {"slug":"header"} --><!-- /wp:template-part -->');
        $this->template('wp_template', 'tt5//page', 'Page', '<!-- wp:template-part {"slug":"header","theme":"tt5"} --><!-- /wp:template-part -->');
        $this->template('wp_template', 'tt5//single', 'Single', '<!-- wp:template-part {"slug":"footer"} --><!-- /wp:template-part -->');
        $this->template('wp_template', 'tt5//other', 'Other theme', '<!-- wp:template-part {"slug":"header","theme":"other"} --><!-- /wp:template-part -->');

        $read = EntityRef::read(['kind' => 'template-part', 'id' => 'tt5//header', 'type' => 'wp_template_part']);

        $this->assertSame('Main header', $read['title']);
        $this->assertSame(['tt5//index', 'tt5//page'], array_column($read['usedOn'], 'id'));
    }

    public function test_a_missing_entity_is_a_404_not_an_empty_tree(): void
    {
        $response = EntityRef::show(new WP_REST_Request(['kind' => 'template-part', 'id' => 'tt5//nope']));

        $this->assertInstanceOf(WP_REST_Response::class, $response);
        $this->assertSame(404, $response->get_status());
    }

    public function test_the_routes_refuse_a_ref_they_cannot_read(): void
    {
        $this->post(4, 'page');

        $this->assertFalse(EntityRef::permission(new WP_REST_Request(['kind' => 'post', 'type' => 'page', 'id' => 4])));
        $this->assertFalse(EntityRef::permission(new WP_REST_Request(['kind' => 'template-part', 'id' => 'header'])));
        $this->assertTrue(EntityRef::permission(new WP_REST_Request(['kind' => 'template-part', 'id' => 'tt5//header'])));
    }

    public function test_saving_needs_content(): void
    {
        $this->allow('product');
        $this->post(3, 'product', 'old');

        $response = EntityRef::update(new WP_REST_Request(['kind' => 'post', 'type' => 'product', 'id' => 3]));

        $this->assertSame(422, $response->get_status());
        $this->assertSame([], $GLOBALS['blicks_test_updates']);
    }
}
