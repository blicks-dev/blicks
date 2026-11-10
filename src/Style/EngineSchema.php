<?php
/**
 * The style engine, described read-only for code outside it.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Style;

defined( 'ABSPATH' ) || exit;

/**
 * A read-only projection of `resources/engine/schema.json` for Blicks Pro, Studio and the AI
 * validator — the PHP mirror of `describeEngine()` in `resources/engine/describe.ts`, same keys,
 * same order, built from the same generated tables.
 *
 * {@see Schema} holds the tables themselves and stays internal: class letters, var names and part
 * guards are emission details free to change. This is the smaller, steadier surface a caller can
 * rely on — which control ids exist, what a value of each looks like, which slots it may be written
 * in, and how controls bear on one another.
 *
 * Built-in controls only. A rule a companion adds at runtime through
 * {@see ElementStyle::registerRule()} appears in {@see ElementStyle::controls()}, not here.
 *
 * Part of the extension API (`tests/Unit/Core/ExtensionApiTest.php`). `version` is the format of
 * the array this returns; it goes up when a key is removed or changes meaning, never for an
 * addition.
 */
final class EngineSchema {

	public const VERSION = 1;

	/** @var array<string, mixed>|null */
	private static ?array $cache = null;

	/**
	 * The whole description.
	 *
	 * @return array{
	 *     version: int,
	 *     controls: list<array{id: string, section: string|null, valueShape: string, category: string|null, scoped: bool, parts: bool, partOnly: bool, flag: string|null, value: array<string, mixed>}>,
	 *     states: list<array{id: string, key: string}>,
	 *     stateControls: array<string, list<string>>,
	 *     breakpoints: list<array{id: string, key: string, maxWidth: string|null}>,
	 *     parts: list<string>,
	 *     sections: list<array{id: string, controls: list<string>}>,
	 *     relations: list<array<string, mixed>>,
	 *     valueShapes: array<string, array<string, mixed>>,
	 *     valueTree: array<string, mixed>,
	 *     typeRoles: list<string>
	 * }
	 */
	public static function describe(): array {
		if ( null !== self::$cache ) {
			return self::$cache;
		}

		$sectionOf = [];
		foreach ( Schema::SECTION_CONTROLS as $section => $ids ) {
			foreach ( $ids as $id ) {
				$sectionOf[ $id ] ??= (string) $section;
			}
		}

		$controls = [];
		foreach ( Schema::RULES as $rule ) {
			$id   = (string) $rule['attr'];
			$kind = (string) ( $rule['kind'] ?? 'single' );

			$controls[] = [
				'id' => $id,
				'section' => $sectionOf[ $id ] ?? null,
				'valueShape' => match ( $kind ) {
					'sides', 'inset' => 'sides',
					'corners' => 'corners',
					default => 'scalar',
				},
				'category' => isset( $rule['category'] ) ? (string) $rule['category'] : null,
				'scoped' => isset( $rule['selectorSuffix'] ),
				'parts' => in_array( $id, Schema::PART_CONTROLS, true ),
				'partOnly' => true === ( $rule['partOnly'] ?? false ),
				'flag' => Schema::CONTROL_FLAGS[ $id ] ?? null,
				'value' => Schema::CONTROL_VALUES[ $id ] ?? [],
			];
		}

		$states = [];
		foreach ( Schema::STATE_KEY as $state => $key ) {
			$states[] = [
				'id' => (string) $state,
				'key' => $key,
			];
		}

		$breakpoints = [];
		foreach ( Schema::BP_KEY as $bp => $key ) {
			$max           = Schema::BP_MAX[ $key ] ?? '';
			$breakpoints[] = [
				'id' => (string) $bp,
				'key' => $key,
				'maxWidth' => '' === $max ? null : $max,
			];
		}

		$sections = [];
		foreach ( Schema::SECTION_CONTROLS as $section => $ids ) {
			$sections[] = [
				'id' => (string) $section,
				'controls' => array_values( $ids ),
			];
		}

		self::$cache = [
			'version' => self::VERSION,
			'controls' => $controls,
			'states' => $states,
			'stateControls' => Schema::STATE_CONTROLS,
			'breakpoints' => $breakpoints,
			'parts' => array_keys( Schema::PARTS ),
			'sections' => $sections,
			'relations' => Schema::RELATIONS,
			'valueShapes' => Schema::VALUE_SHAPES,
			'valueTree' => Schema::VALUE_TREE,
			'typeRoles' => Schema::TYPE_ROLES,
		];

		return self::$cache;
	}

	/**
	 * One control's description, or null for an id the engine does not ship.
	 *
	 * @return array<string, mixed>|null
	 */
	public static function control( string $id ): ?array {
		foreach ( self::describe()['controls'] as $control ) {
			if ( $control['id'] === $id ) {
				return $control;
			}
		}

		return null;
	}

	/**
	 * Every built-in control id, in emission order.
	 *
	 * @return list<string>
	 */
	public static function controlIds(): array {
		return array_column( self::describe()['controls'], 'id' );
	}
}
