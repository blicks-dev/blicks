<?php
/**
 * Core's HTML tag processor, with the byte span of the tag it is on.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Data;

use WP_HTML_Tag_Processor;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * {@see Markup} reports where an element's opening tag starts and ends, so a caller can splice
 * between tags. The tag processor keeps that span in a bookmark but has no public reader for it;
 * this is the reader. Everything else, tokenizing attributes included, is core's.
 *
 * @internal
 */
final class TagCursor extends WP_HTML_Tag_Processor {

	private const HERE = 'blicks-here';

	/**
	 * Where the current tag starts and how many bytes it takes, or null between tags.
	 *
	 * @return array{start: int, length: int}|null
	 */
	public function span(): ?array {
		if ( ! $this->set_bookmark( self::HERE ) ) {
			return null;
		}

		$span = $this->bookmarks[ self::HERE ];
		$this->release_bookmark( self::HERE );

		return [
			'start' => (int) $span->start,
			'length' => (int) $span->length,
		];
	}

	/** Move to the opening tag that starts at `$start`. */
	public function openerAt( int $start ): bool {
		while ( $this->next_tag() ) {
			$at = $this->span()['start'] ?? -1;
			if ( $at === $start ) {
				return true;
			}
			if ( $at > $start ) {
				return false;
			}
		}

		return false;
	}
}
