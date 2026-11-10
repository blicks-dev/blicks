<?php
/**
 * What an agent may not put in a page, whoever it signs in as.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Ai\Spec;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Checks finished markup for script, for every account.
 *
 * WordPress lets an administrator or editor post unfiltered HTML, scripts included, and KSES never
 * runs for them. That is a decision about a *person* typing into the editor. An agent is different:
 * it acts on text it read somewhere, and a page that tells it "add this script" should not be able
 * to put one on the site because the agent happens to be signed in as an administrator. So
 * whatever an agent writes — rich text, a link, a block from another plugin — is checked here
 * regardless of capability, and refused if it carries:
 *
 * - an element that runs or loads code or re-targets the page (`<script>`, `<iframe>`, `<form>`…),
 * - an event-handler attribute (`onclick`, `onerror`…),
 * - a link or source whose scheme is not http, https, mailto or tel ({@see Links}).
 *
 * Read with core's HTML tag processor, which decodes attribute values the way a browser does —
 * so an encoded `javascript:` is seen as one. It is not a sanitizer and changes nothing: anything it
 * objects to is reported, and nothing is written.
 *
 * **Where the tag processor and a browser disagree, this refuses.** The processor does not track
 * namespaces: it always skips the inside of `<title>`, `<textarea>` and the other raw-text elements,
 * while inside `<svg>` a browser parses that same inside as markup — `<svg><title><img onerror>` runs
 * script there. So raw-text elements and `<math>` are refused outright, and inside `<svg>` only the
 * plain drawing elements the icon set is made of are allowed. A fragment that ends partway through
 * a tag is refused too: joined to the next block on the page, its open attribute would swallow the
 * next block's text as attribute value and turn it into attributes.
 */
final class MarkupGuard {

	/**
	 * Elements an agent may not write. The second line is the raw-text elements the tag processor
	 * skips the inside of, and MathML, whose parsing it does not follow.
	 */
	private const FORBIDDEN_TAGS = [
		'SCRIPT',
		'STYLE',
		'IFRAME',
		'FRAME',
		'FRAMESET',
		'OBJECT',
		'EMBED',
		'APPLET',
		'BASE',
		'META',
		'LINK',
		'FORM',
		'NOSCRIPT',
		'TEMPLATE',
		'SET',
		'ANIMATE',
		'HANDLER',
		'TITLE',
		'TEXTAREA',
		'XMP',
		'NOEMBED',
		'NOFRAMES',
		'PLAINTEXT',
		'MATH',
	];

	/** The only elements allowed inside `<svg>`: what the Lucide icons are drawn with. */
	private const SVG_ELEMENTS = [ 'PATH', 'CIRCLE', 'RECT', 'LINE', 'POLYLINE', 'POLYGON', 'ELLIPSE', 'G' ];

	/** Attributes holding one URL. */
	private const URL_ATTRIBUTES = [ 'href', 'src', 'action', 'formaction', 'xlink:href', 'poster', 'cite', 'data', 'background', 'longdesc', 'ping' ];

	/**
	 * Every problem in a piece of markup, as short phrases naming what was found. Empty means clean.
	 *
	 * @return list<string>
	 */
	public static function problems( string $markup ): array {
		if ( ! class_exists( \WP_HTML_Tag_Processor::class ) ) {
			// Cannot judge, so cannot vouch for it.
			return [ 'markup that cannot be checked on this WordPress version' ];
		}

		$found = [];
		$tags = new \WP_HTML_Tag_Processor( $markup );
		$svgDepth = 0;

		while ( $tags->next_tag( [ 'tag_closers' => 'visit' ] ) ) {
			$tag = (string) $tags->get_tag();

			if ( $tags->is_tag_closer() ) {
				if ( 'SVG' === $tag && $svgDepth > 0 ) {
					--$svgDepth;
				}
				continue;
			}

			if ( in_array( $tag, self::FORBIDDEN_TAGS, true ) ) {
				$found[] = sprintf( 'a <%s> element', strtolower( $tag ) );
				continue;
			}

			if ( $svgDepth > 0 && ! in_array( $tag, self::SVG_ELEMENTS, true ) ) {
				$found[] = sprintf( 'a <%s> element inside <svg>', strtolower( $tag ) );
				continue;
			}

			if ( 'SVG' === $tag && ! $tags->has_self_closing_flag() ) {
				++$svgDepth;
			}

			foreach ( (array) $tags->get_attribute_names_with_prefix( 'on' ) as $name ) {
				$found[] = sprintf( 'an event handler (%s) on <%s>', $name, strtolower( $tag ) );
			}

			foreach ( self::URL_ATTRIBUTES as $name ) {
				$value = $tags->get_attribute( $name );

				if ( is_string( $value ) && ! Links::isSafe( $value ) ) {
					$found[] = sprintf( 'a %s link in %s on <%s>', Links::scheme( $value ), $name, strtolower( $tag ) );
				}
			}

			$srcset = $tags->get_attribute( 'srcset' );

			if ( is_string( $srcset ) ) {
				foreach ( explode( ',', $srcset ) as $candidate ) {
					$url = (string) strtok( trim( $candidate ), " \t\n" );

					if ( '' !== $url && ! Links::isSafe( $url ) ) {
						$found[] = sprintf( 'a %s link in srcset on <%s>', Links::scheme( $url ), strtolower( $tag ) );
					}
				}
			}
		}

		if ( $tags->paused_at_incomplete_token() ) {
			$found[] = 'a tag, comment or attribute that is not closed';
		}

		return array_values( array_unique( $found ) );
	}
}
