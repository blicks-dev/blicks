/**
 * Static type-role catalogue for editor block controls (the Typography "Style" picker).
 *
 * The roles + labels are fixed metadata (not user data), so blocks can offer the picker without a
 * REST/snapshot fetch — the live look comes from the emitted `bl-type--{role}` class + the
 * `--blicks-type-{role}-*` vars in the canvas.
 *
 * MUST stay in sync with:
 *   - `TypeRoles::ROLES` (PHP, src/DesignSystem/TypeRoles.php) — source of truth
 *   - the `$type-roles` list in resources/runtime/runtime.scss (the global classes)
 *   - `TYPE_ROLE_LABELS` in resources/admin/constants.ts (admin editor labels)
 */
import { __ } from '@wordpress/i18n';

/** Ordered role slugs — 1:1 with `TypeRoles::ROLES`. */
export const TYPE_ROLES = [
	'display', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'lead', 'small', 'caption', 'code', 'mono',
] as const;

export type TypeRole = ( typeof TYPE_ROLES )[ number ];

export const TYPE_ROLE_LABELS: Record< TypeRole, string > = {
	display: __( 'Display', 'blicks' ),
	h1:      __( 'Heading 1', 'blicks' ),
	h2:      __( 'Heading 2', 'blicks' ),
	h3:      __( 'Heading 3', 'blicks' ),
	h4:      __( 'Heading 4', 'blicks' ),
	h5:      __( 'Heading 5', 'blicks' ),
	h6:      __( 'Heading 6', 'blicks' ),
	body:    __( 'Body', 'blicks' ),
	lead:    __( 'Lead', 'blicks' ),
	small:   __( 'Small', 'blicks' ),
	caption: __( 'Caption', 'blicks' ),
	code:    __( 'Code', 'blicks' ),
	mono:    __( 'Eyebrow / mono', 'blicks' ),
};

/** Coarse grouping for the picker dropdown. */
export const TYPE_ROLE_GROUPS: Array< { label: string; roles: TypeRole[] } > = [
	{ label: __( 'Headings', 'blicks' ), roles: [ 'display', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6' ] },
	{ label: __( 'Text', 'blicks' ),     roles: [ 'body', 'lead', 'small', 'caption' ] },
	{ label: __( 'Mono', 'blicks' ),     roles: [ 'code', 'mono' ] },
];

export function isTypeRole( value: unknown ): value is TypeRole {
	return typeof value === 'string' && ( TYPE_ROLES as readonly string[] ).includes( value );
}
