<?php
/**
 * Plugin Name: Blicks e2e endpoint
 * Description: Answers the Loop specs' data endpoint, so they need no network. Test-only; never shipped.
 *
 * Playground runs with networking off, and a real API would make the suite depend on someone
 * else's uptime. `pre_http_request` runs before WordPress resolves or checks the address, so the
 * plugin's own fetch path (wp_safe_remote_get, size and status checks, caching) is still exercised.
 */

add_filter(
	'pre_http_request',
	static function ( $pre, $args, $url ) {
		if ( 0 !== strpos( (string) $url, 'https://api.blicks-e2e.example/' ) ) {
			return $pre;
		}

		$items = [
			[ 'title' => 'Arc floor lamp', 'blurb' => 'Brass and linen, 160 cm.' ],
			[ 'title' => 'Oak side table', 'blurb' => 'Solid oak, oiled.' ],
			[ 'title' => 'Linen throw', 'blurb' => 'Stone-washed, 130 × 170 cm.' ],
			[ 'title' => 'Wool rug', 'blurb' => 'Hand-tufted, 2 × 3 m.' ],
		];

		return [
			'headers' => [ 'content-type' => 'application/json' ],
			'body' => wp_json_encode( [ 'data' => [ 'items' => $items ] ] ),
			'response' => [
				'code' => 200,
				'message' => 'OK',
			],
			'cookies' => [],
			'filename' => null,
		];
	},
	10,
	3
);
