<?php
/**
 * Kits — a whole look saved under one name.
 *
 * @package Blicks
 */

declare(strict_types=1);

namespace Blicks\DesignSystem;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use Blicks\Models\KitModel;
use Blicks\Style\Breakpoints;

/**
 * A kit is a design language, a palette and someone's own values, saved together: "Shop", "Blog",
 * "Client A". Using one sets all three. Kits are rows in the `blicks_kits` table ({@see KitModel});
 * nothing is built in.
 *
 * A kit names its language and palette by id. One that no longer exists falls back where it is
 * used (the default language, the default palette), so deleting a palette never breaks a kit.
 */
final class DesignKits {

	private const MAX_NAME_LENGTH = 60;

	/**
	 * Every kit, oldest first.
	 *
	 * @return list<array{id: string, name: string, language: string, palette: string, values: array{tokens: array<string, array<string, string>>, breakpoints: array<string, int>, typeRoles: array<string, array<string, string>>}}>
	 */
	public static function all(): array {
		return array_map(
			static fn ( array $row ): array => [
				'id' => $row['uid'],
				'name' => $row['name'],
				'language' => '' !== $row['language'] ? $row['language'] : DesignLanguages::DEFAULT,
				'palette' => $row['palette'],
				'values' => Overrides::normalize( $row['values'] ),
			],
			KitModel::all()
		);
	}

	/** @return array{id: string, name: string, language: string, palette: string, values: array<string, mixed>}|null */
	public static function find( string $id ): ?array {
		foreach ( self::all() as $kit ) {
			if ( $kit['id'] === $id ) {
				return $kit;
			}
		}

		return null;
	}

	/**
	 * Save a kit. Its values go through the same whole-value allow-list as a design-system save.
	 *
	 * @param array<string, mixed> $values
	 * @return array{id: string, name: string, language: string, palette: string, values: array<string, mixed>}
	 */
	public static function create( string $name, string $language, string $palette, array $values ): array {
		$name = self::sanitizeName( $name );
		$kit = [
			'id' => self::generateId(),
			'name' => '' !== $name ? $name : __( 'My kit', 'blicks' ),
			'language' => null !== DesignLanguages::find( $language ) ? $language : DesignLanguages::DEFAULT,
			'palette' => sanitize_key( $palette ),
			'values' => Overrides::sanitize( $values, Catalogue::catalogue(), Breakpoints::defaults() ),
		];
		KitModel::insert( $kit['id'], $kit['name'], $kit['language'], $kit['palette'], $kit['values'] );

		return $kit;
	}

	/**
	 * Add a kit as it was already stored — for {@see Store}'s one-time move of palettes' values,
	 * which were validated when they were first saved.
	 *
	 * @param array<string, mixed> $values
	 */
	public static function adopt( string $name, string $language, string $palette, array $values ): void {
		KitModel::insert( self::generateId(), self::sanitizeName( $name ), $language, $palette, Overrides::normalize( $values ) );
	}

	/** Rename a kit. False when there is no such kit or the name is empty. */
	public static function rename( string $id, string $name ): bool {
		$name = self::sanitizeName( $name );
		if ( '' === $name || null === self::find( $id ) ) {
			return false;
		}
		KitModel::rename( $id, $name );

		return true;
	}

	public static function delete( string $id ): bool {
		if ( null === self::find( $id ) ) {
			return false;
		}
		KitModel::delete( $id );

		return true;
	}

	/**
	 * Use a kit: its language, its palette and its values become the site's. False when there is no
	 * such kit.
	 */
	public static function apply( string $id ): bool {
		$kit = self::find( $id );
		if ( null === $kit ) {
			return false;
		}

		DesignLanguages::setActive( null !== DesignLanguages::find( $kit['language'] ) ? $kit['language'] : DesignLanguages::DEFAULT );
		Store::replaceValues( $kit['palette'], $kit['values'] );

		return true;
	}

	private static function sanitizeName( string $name ): string {
		return mb_substr( trim( sanitize_text_field( $name ) ), 0, self::MAX_NAME_LENGTH );
	}

	private static function generateId(): string {
		return 'k' . substr( str_replace( '-', '', wp_generate_uuid4() ), 0, 12 );
	}
}
