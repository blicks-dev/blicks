<?php
declare(strict_types=1);

namespace Blicks\Tests\Unit\Style;

use Blicks\Style\CssValue;
use PHPUnit\Framework\TestCase;

final class CssValueTest extends TestCase
{
    /** Values the style engine legitimately emits must survive untouched. */
    public function test_accepts_real_css_values(): void
    {
        foreach ([
            '12px',
            '-1.5rem',
            '66.5%',
            '0',
            'flex',
            'space-between',
            '#fff',
            '#ffffffaa',
            'rgba(0,0,0,0.1)',
            'oklch(0.7 0.1 200)',
            'color-mix(in srgb, #fff 45%, #000)',
            'var(--blicks-color-primary, #fff)',
            'calc(100% - 2rem)',
            'clamp(20rem, 50vw, 60rem)',
            'linear-gradient(90deg, #fff 0%, #000 100%)',
            'polygon(0 0, 100% 0, 100% 100%, 0 100%)',
            'translate3d(0, 0, 0) rotate(45deg)',
            'repeat(auto-fill, minmax(200px, 1fr))',
            'blur(4px) brightness(1.2)',
            '"Inter", sans-serif',
            '16 / 9',
            'all 0.3s ease-in-out',
            '0 1px 2px rgba(0,0,0,0.1)',
            '[full-start] minmax(1rem, 1fr) [content-start]',
        ] as $value) {
            $this->assertSame($value, CssValue::clean($value), "should accept: {$value}");
        }
    }

    public function test_rejects_empty_and_non_scalar(): void
    {
        $this->assertSame('', CssValue::clean(null));
        $this->assertSame('', CssValue::clean(''));
        $this->assertSame('', CssValue::clean('   '));
        $this->assertSame('', CssValue::clean(['12px']));
        $this->assertSame('', CssValue::clean(str_repeat('a', 501)));
    }

    /**
     * The style-attribute sink: values are joined `--var:value` with `;`, and esc_attr() does not
     * touch `;` or `:`, so either character in a value forges a second declaration.
     */
    public function test_rejects_declaration_injection(): void
    {
        foreach ([
            '1px; background:url(https://attacker.example/ls.png)',
            'circle(50%); background-image:url(https://attacker.example/pixel.png)',
            'red; background-image:url(https://attacker.example/g.png)',
            'none; background-image:url(https://attacker.example/m.png)',
            'red:blue',
        ] as $payload) {
            $this->assertSame('', CssValue::clean($payload), "should reject: {$payload}");
        }
    }

    /**
     * The stylesheet sink: values are wrapped in `.bl-{id}{prop:value}`, so a `}` closes the rule
     * and lets whatever follows open a new one with an arbitrary selector.
     */
    public function test_rejects_rule_escape(): void
    {
        foreach ([
            'red} body{background-image:url(https://attacker.example/exfil.png)',
            'x 1s} .wp-block{display:none',
            '10px}',
            'a{b',
        ] as $payload) {
            $this->assertSame('', CssValue::clean($payload), "should reject: {$payload}");
        }
    }

    public function test_rejects_markup_comments_and_escapes(): void
    {
        $this->assertSame('', CssValue::clean('red</style><script>alert(1)</script>'));
        $this->assertSame('', CssValue::clean('red/*'));
        $this->assertSame('', CssValue::clean('*/red'));
        $this->assertSame('', CssValue::clean('\\3c script'));
        $this->assertSame('', CssValue::clean('@import "evil.css"'));
        $this->assertSame('', CssValue::clean("red\nbackground:blue"));
    }

    public function test_rejects_unbalanced_parens_and_quotes(): void
    {
        $this->assertSame('', CssValue::clean('calc(100% - 2rem'));
        $this->assertSame('', CssValue::clean('calc)100%('));
        $this->assertSame('', CssValue::clean('"Inter'));
    }

    /** url() is not an allow-listed function: image values go through CssValue::url() instead. */
    public function test_rejects_non_allow_listed_functions(): void
    {
        $this->assertSame('', CssValue::clean('url(https://attacker.example/x.png)'));
        $this->assertSame('', CssValue::clean('expression(alert(1))'));
        $this->assertSame('', CssValue::clean('image-set("a.png" 1x)'));
        $this->assertSame('', CssValue::clean('calc(1px) somethingelse(2px)'));
    }

    public function test_all_clean_requires_every_value_to_pass(): void
    {
        $this->assertTrue(CssValue::allClean(['1px', '2px', '#fff']));
        $this->assertFalse(CssValue::allClean(['1px', '2px} body{a:b']));
        $this->assertFalse(CssValue::allClean(['1px', '']));
    }

    public function test_url_accepts_http_and_site_relative_only(): void
    {
        $this->assertSame('https://example.com/a.png', CssValue::url('https://example.com/a.png'));
        $this->assertSame('http://example.com/a.png', CssValue::url('http://example.com/a.png'));
        $this->assertSame('/wp-content/uploads/a.png', CssValue::url('/wp-content/uploads/a.png'));
    }

    public function test_url_rejects_dangerous_schemes_and_breakouts(): void
    {
        foreach ([
            'javascript:alert(1)',
            'data:text/html;base64,PHN2Zz4=',
            'vbscript:msgbox(1)',
            '//attacker.example/a.png',
            'https://example.com/a.png") ; background:url("https://attacker.example/b.png',
            "https://example.com/a'.png",
            'https://example.com/a\\.png',
            'relative/path.png',
            '',
        ] as $payload) {
            $this->assertSame('', CssValue::url($payload), "should reject: {$payload}");
        }
    }
}
