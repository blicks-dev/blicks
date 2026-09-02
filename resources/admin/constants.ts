import { __ } from '@wordpress/i18n';
import type { AdminView, TokenValues, TypeRoleSnapshot, TypeRoleSlot, TypeRoleValues } from './types';

export const ADMIN_VIEWS: readonly AdminView[] = [ 'overview', 'design', 'settings' ];

// The Design System view's section anchors (`#design/<id>` → `<section id="s-<id>">`). The
// panel renders its own nav with live counts; this is the id↔label list everything else
// (command palette, deep links) needs.
export const DESIGN_SECTIONS: ReadonlyArray< { id: string; label: string } > = [
	{ id: 'themes', label: __( 'Themes', 'blicks' ) },
	{ id: 'color', label: __( 'Color', 'blicks' ) },
	{ id: 'type', label: __( 'Typography', 'blicks' ) },
	{ id: 'space', label: __( 'Spacing', 'blicks' ) },
	{ id: 'radius', label: __( 'Radius', 'blicks' ) },
	{ id: 'shadow', label: __( 'Shadow', 'blicks' ) },
	{ id: 'gradient', label: __( 'Gradient', 'blicks' ) },
	{ id: 'motion', label: __( 'Motion', 'blicks' ) },
	{ id: 'anim', label: __( 'Animation', 'blicks' ) },
	{ id: 'z', label: __( 'Z-index', 'blicks' ) },
	{ id: 'opacity', label: __( 'Opacity', 'blicks' ) },
	{ id: 'border', label: __( 'Border', 'blicks' ) },
	{ id: 'ring', label: __( 'Focus ring', 'blicks' ) },
	{ id: 'sizing', label: __( 'Sizing', 'blicks' ) },
	{ id: 'leading', label: __( 'Line-height', 'blicks' ) },
	{ id: 'bp', label: __( 'Breakpoints', 'blicks' ) },
	{ id: 'out', label: __( 'Output', 'blicks' ) },
];

export const TOKENS = {
	color: [
		'background',
		'foreground',
		'primary',
		'primary-foreground',
		'secondary',
		'secondary-foreground',
		'muted',
		'muted-foreground',
		'accent',
		'accent-foreground',
		'destructive',
		'border',
		'input',
		'ring',
		'card',
		'card-foreground',
		'popover',
		'popover-foreground',
	],
	spacing: [ '0', 'px', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl' ],
	radius: [ 'none', 'sm', 'md', 'lg', 'xl', 'full' ],
	shadow: [ 'none', 'sm', 'md', 'lg', 'xl' ],
	fontSize: [ 'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl' ],
	fontFamily: [ 'sans', 'serif', 'mono' ],
	gradient: [ 'brand', 'paper', 'atomic' ],
	transition: [ 'fast', 'base', 'slow' ],
	transform: [ 'lift', 'press', 'zoom' ],
	filter: [ 'blur', 'dim', 'grayscale' ],
	zIndex: [ 'base', 'sticky', 'drawer', 'popover', 'drag', 'toast' ],
	opacity: [ 'disabled', 'muted', 'scrim', 'hover' ],
	borderWidth: [ 'hair', 'strong', 'heavy' ],
	borderStyle: [ 'solid', 'dashed', 'dotted' ],
	ring: [ 'brand', 'subtle', 'danger' ],
	width: [ 'prose', 'content', 'wide', 'full' ],
	aspect: [ 'square', 'wide', 'portrait' ],
	leading: [ 'tight', 'snug', 'body', 'loose' ],
} as const;

export const TOKEN_CATEGORY_KEYS = Object.keys( TOKENS ) as ( keyof typeof TOKENS )[];

// Static fallbacks for the value preview before the REST snapshot lands. Color is special-cased;
// every other category aliases its emitted `--blicks-{category}-{slug}` var, except a couple of
// human-friendly literals.
export function defaultTokenValue( category: keyof typeof TOKENS, token: string ): string {
	if ( category === 'color' ) return COLOR_FALLBACKS[ token ] ?? '';
	if ( category === 'spacing' ) return token === '0' ? '0' : token === 'px' ? '1px' : `var(--blicks-spacing-${ token })`;
	if ( category === 'shadow' ) return token === 'none' ? 'none' : `var(--blicks-shadow-${ token })`;
	return `var(--blicks-${ category }-${ token })`;
}

export const DEFAULT_BREAKPOINTS = [
	{ id: 'base', label: __( 'Desktop', 'blicks' ), max: null },
	{ id: 'tablet', label: __( 'Tablet', 'blicks' ), max: 782 },
	{ id: 'mobile', label: __( 'Mobile', 'blicks' ), max: 600 },
] as const;

// Semantic typography roles — composite per-content-type looks. Mirrors src/DesignSystem/TypeRoles.php.
export const TYPE_ROLES = [ 'display', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'body', 'lead', 'small', 'caption', 'code', 'mono' ] as const;
export const TYPE_ROLE_PROPS = [ 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'fontFamily', 'textTransform' ] as const;
export const TYPE_ROLE_LABELS: Record< string, string > = {
	display: __( 'Display', 'blicks' ),
	h1: __( 'Heading 1', 'blicks' ),
	h2: __( 'Heading 2', 'blicks' ),
	h3: __( 'Heading 3', 'blicks' ),
	h4: __( 'Heading 4', 'blicks' ),
	h5: __( 'Heading 5', 'blicks' ),
	h6: __( 'Heading 6', 'blicks' ),
	body: __( 'Body', 'blicks' ),
	lead: __( 'Lead', 'blicks' ),
	small: __( 'Small', 'blicks' ),
	caption: __( 'Caption', 'blicks' ),
	code: __( 'Code', 'blicks' ),
	mono: __( 'Eyebrow / mono', 'blicks' ),
};
export const TYPE_ROLE_DEFAULTS: Record< string, Record< string, string > > = {
	display: { fontSize: '3.5rem', fontWeight: '700', lineHeight: '1.05', letterSpacing: '-0.035em', fontFamily: 'var(--wp--preset--font-family--sans)', textTransform: 'none' },
	h1: { fontSize: '2.25rem', fontWeight: '700', lineHeight: '1.1', letterSpacing: '-0.02em', fontFamily: 'var(--wp--preset--font-family--sans)', textTransform: 'none' },
	h2: { fontSize: '1.875rem', fontWeight: '700', lineHeight: '1.15', letterSpacing: '-0.015em', fontFamily: 'var(--wp--preset--font-family--sans)', textTransform: 'none' },
	h3: { fontSize: '1.5rem', fontWeight: '600', lineHeight: '1.2', letterSpacing: '-0.01em', fontFamily: 'var(--wp--preset--font-family--sans)', textTransform: 'none' },
	h4: { fontSize: '1.25rem', fontWeight: '600', lineHeight: '1.3', letterSpacing: '0', fontFamily: 'var(--wp--preset--font-family--sans)', textTransform: 'none' },
	h5: { fontSize: '1.125rem', fontWeight: '600', lineHeight: '1.4', letterSpacing: '0', fontFamily: 'var(--wp--preset--font-family--sans)', textTransform: 'none' },
	h6: { fontSize: '1rem', fontWeight: '600', lineHeight: '1.4', letterSpacing: '0.01em', fontFamily: 'var(--wp--preset--font-family--sans)', textTransform: 'uppercase' },
	body: { fontSize: '1rem', fontWeight: '400', lineHeight: '1.6', letterSpacing: '0', fontFamily: 'var(--wp--preset--font-family--sans)', textTransform: 'none' },
	lead: { fontSize: '1.25rem', fontWeight: '400', lineHeight: '1.6', letterSpacing: '0', fontFamily: 'var(--wp--preset--font-family--sans)', textTransform: 'none' },
	small: { fontSize: '0.75rem', fontWeight: '400', lineHeight: '1.45', letterSpacing: '0', fontFamily: 'var(--wp--preset--font-family--sans)', textTransform: 'none' },
	caption: { fontSize: '0.875rem', fontWeight: '400', lineHeight: '1.4', letterSpacing: '0', fontFamily: 'var(--wp--preset--font-family--sans)', textTransform: 'none' },
	code: { fontSize: '0.875rem', fontWeight: '400', lineHeight: '1.6', letterSpacing: '0', fontFamily: 'var(--wp--preset--font-family--mono)', textTransform: 'none' },
	mono: { fontSize: '0.6875rem', fontWeight: '500', lineHeight: '1', letterSpacing: '0.1em', fontFamily: 'var(--wp--preset--font-family--mono)', textTransform: 'uppercase' },
};

// Mirrors the whitelist in src/DesignSystem/Animations.php — the server is the authority, this
// is the picker. Keep the two in step: a property offered here but rejected there would let a
// user build a step that silently vanishes on save.
export const ANIMATION_PROPERTIES: readonly string[] = [
	'opacity', 'transform', 'translate', 'rotate', 'scale',
	'filter', 'backdrop-filter',
	'color', 'background-color', 'background-position', 'background-size',
	'border-color', 'border-radius', 'box-shadow', 'text-shadow', 'outline-color',
	'clip-path',
	'width', 'height', 'max-width', 'max-height',
	'margin', 'padding', 'top', 'right', 'bottom', 'left', 'inset', 'gap',
	'letter-spacing', 'word-spacing', 'line-height', 'font-size', 'font-weight',
	'stroke-dashoffset', 'stroke-dasharray',
	'visibility', 'offset-distance', 'offset-rotate', 'perspective', 'z-index',
];

// A new animation opens on a working fade-and-rise rather than an empty shell, so the preview
// animates from the first render and the shape of a step is obvious.
export const ANIMATION_STARTER_STEPS: ReadonlyArray< { offset: number; declarations: Record< string, string > } > = [
	{ offset: 0, declarations: { opacity: '0', transform: 'translateY(12px)' } },
	{ offset: 100, declarations: { opacity: '1', transform: 'translateY(0)' } },
];

export const COLOR_FALLBACKS: Record< string, string > = {
	background: '#ffffff',
	foreground: '#09090b',
	primary: '#18181b',
	'primary-foreground': '#fafafa',
	secondary: '#f4f4f5',
	'secondary-foreground': '#18181b',
	muted: '#f4f4f5',
	'muted-foreground': '#71717a',
	accent: '#f4f4f5',
	'accent-foreground': '#18181b',
	destructive: '#dc2626',
	border: '#e4e4e7',
	input: '#e4e4e7',
	ring: '#18181b',
	card: '#ffffff',
	'card-foreground': '#09090b',
	popover: '#ffffff',
	'popover-foreground': '#09090b',
};

// Generic base-category colors (not accents/custom tokens) used for the theme-card
// swatch and the preview tiles, so every theme reads as the same set of roles.
export const PALETTE_TOKENS = [ 'background', 'primary', 'secondary', 'accent', 'foreground', 'border' ] as const;

// Core palette grouped by role (mirrors the mockup's Surfaces / Text / Brand subheads).
// `strip` is a token suffix the group label already carries, dropped from the tile name.
export const COLOR_GROUPS: ReadonlyArray< { label: string; tokens: readonly string[]; strip?: string } > = [
	{ label: 'Surfaces', tokens: [ 'background', 'card', 'popover', 'muted', 'secondary', 'accent' ] },
	{ label: 'Text', strip: 'foreground', tokens: [ 'foreground', 'card-foreground', 'popover-foreground', 'primary-foreground', 'secondary-foreground', 'muted-foreground', 'accent-foreground' ] },
	{ label: 'Brand · border · status', tokens: [ 'primary', 'border', 'input', 'ring', 'destructive' ] },
];
// Tokens that are anchors rather than steps: their value IS their meaning. `radius.none` is
// 0 because "no rounding" has no other value, and `radius.full` is a sentinel — 9999px and
// 999px draw the same pill. Editing either can only break the blocks that ask for them by
// name, so the catalogue lists them and refuses to offer a field.
export const FIXED_TOKENS: Record< string, readonly string[] > = {
	radius: [ 'none', 'full' ],
	shadow: [ 'none' ],
	spacing: [ '0' ],
};

// Surface → the text colour meant to sit on it. These pairs are the part of the palette
// WordPress has no concept of: Global Styles edits a flat list of slugs and cannot tell you
// that `muted-foreground` is what goes on `muted`, let alone whether the two are legible
// together. A surface with no `-foreground` partner in the token set stays a single tile.
export const COLOR_PAIRS: ReadonlyArray< { surface: string; text: string; label: string } > = [
	{ surface: 'background', text: 'foreground', label: 'Page' },
	{ surface: 'card', text: 'card-foreground', label: 'Card' },
	{ surface: 'popover', text: 'popover-foreground', label: 'Popover' },
	{ surface: 'primary', text: 'primary-foreground', label: 'Primary' },
	{ surface: 'secondary', text: 'secondary-foreground', label: 'Secondary' },
	{ surface: 'muted', text: 'muted-foreground', label: 'Muted' },
	{ surface: 'accent', text: 'accent-foreground', label: 'Accent' },
];

export function fallbackValues(): TokenValues {
	const out = {} as TokenValues;
	for ( const category of TOKEN_CATEGORY_KEYS ) {
		out[ category ] = Object.fromEntries( TOKENS[ category ].map( token => [ token, defaultTokenValue( category, token ) ] ) );
	}
	return out;
}

export function fallbackTypeRoles(): TypeRoleSnapshot {
	const slots: Record< string, TypeRoleSlot > = {
		display: { kind: 'custom', settingsGroup: [ 'custom', 'blicks', 'typeRoles', 'display' ] },
		h1: { kind: 'native', stylesPath: [ 'elements', 'h1', 'typography' ] },
		h2: { kind: 'native', stylesPath: [ 'elements', 'h2', 'typography' ] },
		h3: { kind: 'native', stylesPath: [ 'elements', 'h3', 'typography' ] },
		h4: { kind: 'native', stylesPath: [ 'elements', 'h4', 'typography' ] },
		h5: { kind: 'native', stylesPath: [ 'elements', 'h5', 'typography' ] },
		h6: { kind: 'native', stylesPath: [ 'elements', 'h6', 'typography' ] },
		body: { kind: 'native', stylesPath: [ 'typography' ] },
		caption: { kind: 'native', stylesPath: [ 'elements', 'caption', 'typography' ] },
		lead: { kind: 'custom', settingsGroup: [ 'custom', 'blicks', 'typeRoles', 'lead' ] },
		code: { kind: 'custom', settingsGroup: [ 'custom', 'blicks', 'typeRoles', 'code' ] },
	};
	const clone = (): TypeRoleValues => Object.fromEntries( TYPE_ROLES.map( role => [ role, { ...TYPE_ROLE_DEFAULTS[ role ] } ] ) );

	return { roles: [ ...TYPE_ROLES ], props: [ ...TYPE_ROLE_PROPS ], slots, base: clone(), values: clone() };
}

