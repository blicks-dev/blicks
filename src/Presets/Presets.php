<?php
/**
 * The user-saved block design preset library.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\Presets;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Models\PresetModel;

/**
 * Create/read/delete for user-saved design presets, backed by {@see PresetModel}
 * (the `wp_blicks_presets` table). A preset is a named bundle of a block's design attributes; the
 * editor re-registers each one as a native block variation at load (see
 * `resources/framework/presets/register.ts`), so picking a saved preset applies its whole look.
 *
 * This is the authoritative validation layer. The REST arg builders ({@see \Blicks\Http\RestArgs})
 * clean the payload at the boundary; this decides what a *valid* preset is: a well-formed block
 * reference, a non-empty title, and a size-capped attribute bundle of scalar/array leaves. Those
 * attributes are only ever re-applied as ordinary block attributes, which the existing
 * StyleService/Sanitize front-end gate already narrows — so no per-block allowlist is duplicated here.
 */
final class Presets {

	private const MAX_PRESETS = 200;
	private const MAX_TITLE = 60;
	private const MAX_KEY = 120;
	private const MAX_ATTR_BYTES = 20000;
	private const MAX_DEPTH = 12;

	/** A registered Blicks block type, e.g. `blicks/button`. */
	private const BLOCK_NAME_RE = '/^blicks\/[a-z][a-z0-9-]{0,40}$/';

	/**
	 * Every preset grouped by block name — the editor bootstrap payload and REST index shape.
	 *
	 * @return array<string, list<array<string,mixed>>>
	 */
	public static function grouped(): array {
		return PresetModel::grouped();
	}

	/**
	 * Create or replace a preset. With `$id`, updates that row (rename in place); without, inserts a
	 * new one under a freshly generated unique key.
	 *
	 * @param array<string,mixed> $payload { blockName, title, attributes }
	 * @return array{ok:bool,error?:string,preset?:array<string,mixed>,blockName?:string}
	 */
	public static function save( array $payload, ?int $id = null ): array {
		$blockName = self::blockName( (string) ( $payload['blockName'] ?? '' ) );
		if ( null === $blockName ) {
			return [
				'ok' => false,
				'error' => 'invalid_block',
			];
		}

		$title = self::title( (string) ( $payload['title'] ?? '' ) );
		if ( '' === $title ) {
			return [
				'ok' => false,
				'error' => 'invalid_title',
			];
		}

		$attributes = self::attributes( $payload['attributes'] ?? null );
		if ( null === $attributes ) {
			return [
				'ok' => false,
				'error' => 'invalid_attributes',
			];
		}

		if ( null !== $id ) {
			$existing = PresetModel::findRow( $id );
			if ( null === $existing || $existing['block_name'] !== $blockName ) {
				return [
					'ok' => false,
					'error' => 'not_found',
				];
			}

			// Keep the stored key stable across a rename so the editor can match the variation it
			// already registered; only regenerate if the key somehow no longer reflects the title.
			$key = $existing['preset_key'];
			PresetModel::updateRow( $id, $blockName, $key, $title, $attributes );

			return [
				'ok' => true,
				'blockName' => $blockName,
				'preset' => [
					'id' => $id,
					'key' => $key,
					'title' => $title,
					'attributes' => $attributes,
					'author' => $existing['author'],
				],
			];
		}

		if ( PresetModel::count() >= self::MAX_PRESETS ) {
			return [
				'ok' => false,
				'error' => 'limit',
			];
		}

		$key = self::uniqueKey( $blockName, $title );
		$author = function_exists( 'get_current_user_id' ) ? (int) get_current_user_id() : 0;
		$newId = PresetModel::insertRow( $blockName, $key, $title, $attributes, $author );

		return [
			'ok' => true,
			'blockName' => $blockName,
			'preset' => [
				'id' => $newId,
				'key' => $key,
				'title' => $title,
				'attributes' => $attributes,
				'author' => $author,
			],
		];
	}

	/** @return array{ok:bool,error?:string,blockName?:string,key?:string} */
	public static function delete( int $id ): array {
		$row = PresetModel::findRow( $id );
		if ( null === $row ) {
			return [
				'ok' => false,
				'error' => 'not_found',
			];
		}

		PresetModel::deleteRow( $id, $row['block_name'] );

		return [
			'ok' => true,
			'blockName' => $row['block_name'],
			'key' => $row['preset_key'],
		];
	}

	/** A registered-looking Blicks block name, or null. */
	private static function blockName( string $value ): ?string {
		$name = strtolower( trim( $value ) );

		return 1 === preg_match( self::BLOCK_NAME_RE, $name ) ? $name : null;
	}

	private static function title( string $value ): string {
		$clean = trim( wp_strip_all_tags( (string) preg_replace( '/[\x00-\x1F\x7F]/', '', $value ) ) );

		return mb_strlen( $clean ) > self::MAX_TITLE ? mb_substr( $clean, 0, self::MAX_TITLE ) : $clean;
	}

	/** Lowercase-kebab key from the title, made unique within the block by numeric suffix. */
	private static function uniqueKey( string $blockName, string $title ): string {
		$base = strtolower( $title );
		$base = (string) preg_replace( '/[^a-z0-9]+/', '-', $base );
		$base = trim( (string) preg_replace( '/-+/', '-', $base ), '-' );
		if ( '' === $base ) {
			$base = 'preset';
		}
		$base = mb_substr( $base, 0, self::MAX_KEY - 6 );

		$key = $base;
		$n = 2;
		while ( PresetModel::keyExists( $blockName, $key ) ) {
			$key = $base . '-' . $n;
			++$n;
		}

		return $key;
	}

	/**
	 * A size-capped bundle of scalar/array leaves. Returns null if empty, too large, or not an object.
	 *
	 * @param mixed $raw
	 * @return array<string,mixed>|null
	 */
	private static function attributes( $raw ): ?array {
		if ( ! is_array( $raw ) || [] === $raw ) {
			return null;
		}

		$clean = self::sanitizeBranch( $raw, 0 );
		if ( ! is_array( $clean ) || [] === $clean ) {
			return null;
		}

		$encoded = wp_json_encode( $clean );
		if ( ! is_string( $encoded ) || strlen( $encoded ) > self::MAX_ATTR_BYTES ) {
			return null;
		}

		return $clean;
	}

	/**
	 * Recursively strip tags/control chars from string leaves, preserving keys and structure. Depth
	 * capped so a hand-crafted payload cannot exhaust the stack. Mirrors {@see \Blicks\Http\RestArgs}.
	 *
	 * @param mixed $value
	 * @return mixed
	 */
	private static function sanitizeBranch( $value, int $depth ) {
		if ( $depth > self::MAX_DEPTH ) {
			return null;
		}

		if ( is_array( $value ) ) {
			$clean = [];
			foreach ( $value as $key => $item ) {
				$clean[ $key ] = self::sanitizeBranch( $item, $depth + 1 );
			}

			return $clean;
		}

		if ( is_string( $value ) ) {
			return sanitize_text_field( $value );
		}

		if ( is_bool( $value ) || is_int( $value ) || is_float( $value ) || null === $value ) {
			return $value;
		}

		return null;
	}
}
