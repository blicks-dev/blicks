<?php
/**
 * A saved dialog's triggers and display rules: their shape, their defaults, and cleaning.
 *
 * @package BlicksPro
 */

declare(strict_types=1);

namespace BlicksPro\DialogStudio;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Two post meta values, each one JSON object, cleaned on every write and read so nothing
 * downstream checks a shape again. Anything unknown is dropped; anything out of range is clamped;
 * anything missing takes its default. `resources/settings.ts` is the browser's copy of the same
 * rules, and the two are tested against the same cases.
 *
 * The defaults are the conservative ones from the plan's Accessibility section: no automatic
 * trigger until one is switched on, a delay of at least 3 s when it is, once per visit.
 */
final class Settings {

	public const TRIGGERS = 'blicks_dialog_triggers';

	public const RULES = 'blicks_dialog_rules';

	public const VISITORS = [ 'all', 'out', 'in' ];

	public const FREQUENCIES = [ 'view', 'session', 'days', 'once' ];

	/** @return array{load: array{on: bool, delay: int}, scroll: array{on: bool, percent: int}, exit: array{on: bool}, idle: array{on: bool, seconds: int}} */
	public static function triggerDefaults(): array {
		return [
			'load' => [
				'on' => false,
				'delay' => 5,
			],
			'scroll' => [
				'on' => false,
				'percent' => 50,
			],
			'exit' => [ 'on' => false ],
			'idle' => [
				'on' => false,
				'seconds' => 30,
			],
		];
	}

	/** @return array<string, mixed> */
	public static function ruleDefaults(): array {
		return [
			'where' => 'all',
			'include' => [],
			'exclude' => [],
			'screens' => [
				'desktop' => true,
				'tablet' => true,
				'phone' => true,
			],
			'visitors' => 'all',
			'frequency' => 'session',
			'days' => 7,
			'stopAfterConvert' => true,
			'schedule' => [
				'on' => false,
				'from' => '',
				'to' => '',
			],
		];
	}

	/**
	 * @param mixed $raw
	 * @return array{load: array{on: bool, delay: int}, scroll: array{on: bool, percent: int}, exit: array{on: bool}, idle: array{on: bool, seconds: int}}
	 */
	public static function triggers( mixed $raw ): array {
		$raw = self::object( $raw );
		$load = self::object( $raw['load'] ?? null );
		$scroll = self::object( $raw['scroll'] ?? null );
		$exit = self::object( $raw['exit'] ?? null );
		$idle = self::object( $raw['idle'] ?? null );
		$d = self::triggerDefaults();

		return [
			'load' => [
				'on' => self::flag( $load['on'] ?? null, false ),
				'delay' => self::int( $load['delay'] ?? null, $d['load']['delay'], 0, 600 ),
			],
			'scroll' => [
				'on' => self::flag( $scroll['on'] ?? null, false ),
				'percent' => self::int( $scroll['percent'] ?? null, $d['scroll']['percent'], 1, 100 ),
			],
			'exit' => [ 'on' => self::flag( $exit['on'] ?? null, false ) ],
			'idle' => [
				'on' => self::flag( $idle['on'] ?? null, false ),
				'seconds' => self::int( $idle['seconds'] ?? null, $d['idle']['seconds'], 5, 600 ),
			],
		];
	}

	/**
	 * @param mixed $raw
	 * @return array<string, mixed>
	 */
	public static function rules( mixed $raw ): array {
		$raw = self::object( $raw );
		$d = self::ruleDefaults();
		$screens = self::object( $raw['screens'] ?? null );
		$schedule = self::object( $raw['schedule'] ?? null );
		$from = self::date( $schedule['from'] ?? null );
		$to = self::date( $schedule['to'] ?? null );

		// A window given backwards is read the right way round, not as "never".
		if ( '' !== $from && '' !== $to && $from > $to ) {
			[ $from, $to ] = [ $to, $from ];
		}

		return [
			'where' => in_array( $raw['where'] ?? null, [ 'all', 'some' ], true ) ? $raw['where'] : $d['where'],
			'include' => self::places( $raw['include'] ?? null ),
			'exclude' => self::places( $raw['exclude'] ?? null ),
			'screens' => [
				'desktop' => self::flag( $screens['desktop'] ?? null, true ),
				'tablet' => self::flag( $screens['tablet'] ?? null, true ),
				'phone' => self::flag( $screens['phone'] ?? null, true ),
			],
			'visitors' => in_array( $raw['visitors'] ?? null, self::VISITORS, true ) ? $raw['visitors'] : $d['visitors'],
			'frequency' => in_array( $raw['frequency'] ?? null, self::FREQUENCIES, true ) ? $raw['frequency'] : $d['frequency'],
			'days' => self::int( $raw['days'] ?? null, $d['days'], 1, 365 ),
			'stopAfterConvert' => self::flag( $raw['stopAfterConvert'] ?? null, true ),
			'schedule' => [
				'on' => self::flag( $schedule['on'] ?? null, false ),
				'from' => $from,
				'to' => $to,
			],
		];
	}

	/** Whether any trigger opens the dialog by itself. */
	public static function automatic( mixed $triggers ): bool {
		foreach ( self::triggers( $triggers ) as $trigger ) {
			if ( $trigger['on'] ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * A place a rule names: `front` (the front page), `type:<post type>` (every single post of a
	 * type, and its archive) or `post:<id>` (one post or page). Others are dropped.
	 *
	 * @param mixed $raw
	 * @return list<string>
	 */
	public static function places( mixed $raw ): array {
		$out = [];

		foreach ( is_array( $raw ) ? $raw : [] as $place ) {
			if ( ! is_string( $place ) ) {
				continue;
			}

			if ( 'front' === $place || 1 === preg_match( '/^type:[a-z0-9_-]{1,20}$/', $place ) || 1 === preg_match( '/^post:[1-9][0-9]{0,19}$/', $place ) ) {
				$out[] = $place;
			}
		}

		return array_slice( array_values( array_unique( $out ) ), 0, 50 );
	}

	/** The REST schema of the triggers meta. @return array<string, mixed> */
	public static function triggersSchema(): array {
		$switch = [ 'on' => [ 'type' => 'boolean' ] ];

		return self::objectSchema(
			[
				'load' => self::objectSchema( $switch + [ 'delay' => [ 'type' => 'integer' ] ] ),
				'scroll' => self::objectSchema( $switch + [ 'percent' => [ 'type' => 'integer' ] ] ),
				'exit' => self::objectSchema( $switch ),
				'idle' => self::objectSchema( $switch + [ 'seconds' => [ 'type' => 'integer' ] ] ),
			]
		);
	}

	/** The REST schema of the rules meta. @return array<string, mixed> */
	public static function rulesSchema(): array {
		$list = [
			'type' => 'array',
			'items' => [ 'type' => 'string' ],
		];

		return self::objectSchema(
			[
				'where' => [ 'type' => 'string' ],
				'include' => $list,
				'exclude' => $list,
				'screens' => self::objectSchema(
					[
						'desktop' => [ 'type' => 'boolean' ],
						'tablet' => [ 'type' => 'boolean' ],
						'phone' => [ 'type' => 'boolean' ],
					]
				),
				'visitors' => [ 'type' => 'string' ],
				'frequency' => [ 'type' => 'string' ],
				'days' => [ 'type' => 'integer' ],
				'stopAfterConvert' => [ 'type' => 'boolean' ],
				'schedule' => self::objectSchema(
					[
						'on' => [ 'type' => 'boolean' ],
						'from' => [ 'type' => 'string' ],
						'to' => [ 'type' => 'string' ],
					]
				),
			]
		);
	}

	/**
	 * @param array<string, mixed> $properties
	 * @return array<string, mixed>
	 */
	private static function objectSchema( array $properties ): array {
		return [
			'type' => 'object',
			'properties' => $properties,
			'additionalProperties' => false,
		];
	}

	/** @return array<string, mixed> */
	private static function object( mixed $raw ): array {
		if ( is_string( $raw ) && '' !== $raw ) {
			$raw = json_decode( $raw, true );
		}

		return is_array( $raw ) ? $raw : [];
	}

	private static function flag( mixed $raw, bool $fallback ): bool {
		return is_bool( $raw ) ? $raw : ( in_array( $raw, [ 1, '1', 'true' ], true ) ? true : ( in_array( $raw, [ 0, '0', 'false' ], true ) ? false : $fallback ) );
	}

	private static function int( mixed $raw, int $fallback, int $min, int $max ): int {
		$n = is_numeric( $raw ) ? (int) round( (float) $raw ) : $fallback;

		return max( $min, min( $max, $n ) );
	}

	/** `2026-11-20`, or '' when it is not a real day. */
	private static function date( mixed $raw ): string {
		if ( ! is_string( $raw ) || 1 !== preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/', $raw, $m ) ) {
			return '';
		}

		return checkdate( (int) $m[2], (int) $m[3], (int) $m[1] ) ? $raw : '';
	}
}
