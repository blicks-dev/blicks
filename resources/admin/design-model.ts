import { __ } from '@wordpress/i18n';
import { TYPE_ROLE_LABELS } from './constants';
import { titleCase } from './data';
import type { DesignSystemSnapshot, TypeRoleValues } from './types';

/**
 * The Design System view, organised by what a person is trying to do rather than by token
 * category. Each section opens on its own; `cats` are the token categories it edits, which is
 * also what decides its unsaved-changes dot and its count.
 */
export type DesignSection = { id: string; label: string; desc: string; cats?: string[]; icon: string };
export type DesignGroup = { group: string; items: DesignSection[] };

export function designNav(): DesignGroup[] {
	return [
		{ group: __( 'Look and feel', 'blicks' ), items: [
			{ id: 'look', label: __( 'Design language', 'blicks' ), desc: __( 'How your site is drawn: corners, depth, borders, headings and surfaces, as one choice. Your colors stay your own, so any language works with any palette.', 'blicks' ), icon: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm11.5 0a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z' },
			{ id: 'color', label: __( 'Colors', 'blicks' ), cats: [ 'color' ], desc: __( 'Start from a palette, then tune any color. Every surface comes with the text color that sits on it, and each pair shows whether people can read it.', 'blicks' ), icon: 'M12 2 6.3 7.7a8 8 0 1 0 11.4 0L12 2Z' },
			{ id: 'type', label: __( 'Typography', 'blicks' ), cats: [ 'fontFamily', 'typeRoles' ], desc: __( 'Pick your fonts, then tune each text style. Headings and paragraphs in every block read from these.', 'blicks' ), icon: 'M5 4v3h5.5v12h3V7H19V4H5Z' },
		] },
		{ group: __( 'Layout', 'blicks' ), items: [
			{ id: 'space', label: __( 'Spacing', 'blicks' ), cats: [ 'spacing' ], desc: __( 'The gaps and padding blocks choose from. Keep steps clearly apart so “a bit more” always looks like more.', 'blicks' ), icon: 'M4 4h2v16H4V4Zm14 0h2v16h-2V4ZM8 11h8v2H8v-2Z' },
			{ id: 'size', label: __( 'Widths and shapes', 'blicks' ), cats: [ 'content', 'width', 'aspect' ], desc: __( 'How wide content is allowed to run, and the frame shapes offered for images and video.', 'blicks' ), icon: 'M3 5v14h18V5H3Zm16 12H5V7h14v10Z' },
			{ id: 'bp', label: __( 'Screen sizes', 'blicks' ), cats: [ 'breakpoints' ], desc: __( 'Where the layout switches to tablet and phone. Responsive settings in the editor follow these widths.', 'blicks' ), icon: 'M4 6h12v12H4V6Zm14 3h4v10h-4V9Z' },
		] },
		{ group: __( 'Surfaces', 'blicks' ), items: [
			{ id: 'radius', label: __( 'Corners', 'blicks' ), cats: [ 'radius' ], desc: __( 'How rounded buttons, fields and cards are.', 'blicks' ), icon: 'M4 20V10a6 6 0 0 1 6-6h10v3H10a3 3 0 0 0-3 3v10H4Z' },
			{ id: 'shadow', label: __( 'Shadows', 'blicks' ), cats: [ 'shadow' ], desc: __( 'Depth, from resting buttons up to dialogs. Bigger shadows read as closer to you.', 'blicks' ), icon: 'M4 4h12v12H4V4Zm14 4h2v12H8v-2h10V8Z' },
			{ id: 'border', label: __( 'Borders', 'blicks' ), cats: [ 'borderWidth' ], desc: __( 'The line thicknesses borders choose from.', 'blicks' ), icon: 'M3 3h18v18H3V3Zm2 2v14h14V5H5Z' },
			{ id: 'button', label: __( 'Buttons', 'blicks' ), cats: [ 'button' ], desc: __( 'One look for every button. Leave a value empty and buttons follow your corners and spacing.', 'blicks' ), icon: 'M3 8h18v8H3V8Zm2 2v4h14v-4H5Z' },
			{ id: 'gradient', label: __( 'Gradients', 'blicks' ), cats: [ 'gradient' ], desc: __( 'Named blends for backgrounds.', 'blicks' ), icon: 'M3 3h18v18H3V3Z' },
		] },
		{ group: __( 'Motion', 'blicks' ), items: [
			{ id: 'motion', label: __( 'Transitions', 'blicks' ), cats: [ 'transition' ], desc: __( 'How long changes take when something is hovered, opened or switched. Press play to feel each one.', 'blicks' ), icon: 'M2 12h4l3-8 4 16 3-8h6' },
			{ id: 'effects', label: __( 'Hover effects', 'blicks' ), cats: [ 'transform', 'filter' ], desc: __( 'Ready-made moves and image treatments. Point at a specimen to try it.', 'blicks' ), icon: 'M12 2 9 9H2l6 4-2 8 6-4 6 4-2-8 6-4h-7l-3-7Z' },
			{ id: 'anim', label: __( 'Animations', 'blicks' ), desc: __( 'Movements a block can play when it appears, scrolls into view or is hovered. Built-in ones ship with Blicks; make your own from steps.', 'blicks' ), icon: 'M8 5v14l11-7L8 5Z' },
		] },
		{ group: __( 'Advanced', 'blicks' ), items: [
			{ id: 'opacity', label: __( 'Transparency', 'blicks' ), cats: [ 'opacity' ], desc: __( 'See-through levels for disabled controls, overlays and hover tints.', 'blicks' ), icon: 'M12 3a9 9 0 1 0 0 18V3Z' },
			{ id: 'layers', label: __( 'Stacking', 'blicks' ), cats: [ 'zIndex' ], desc: __( 'What sits on top when things overlap. Higher numbers cover lower ones.', 'blicks' ), icon: 'm12 3 9 5-9 5-9-5 9-5Zm-7 9 7 4 7-4 2 1-9 5-9-5 2-1Z' },
			{ id: 'leading', label: __( 'Line spacing', 'blicks' ), cats: [ 'leading' ], desc: __( 'Shared line heights for text that is not tied to a text style.', 'blicks' ), icon: 'M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z' },
			{ id: 'out', label: __( 'Where it’s saved', 'blicks' ), desc: __( 'Where these values come from, and where the next save goes.', 'blicks' ), icon: 'M5 20h14v-2H5v2Zm7-3 5-5h-3V4h-4v8H7l5 5Z' },
		] },
	];
}

export const DESIGN_SECTION_IDS = [ 'look', 'color', 'type', 'space', 'size', 'bp', 'radius', 'shadow', 'border', 'button', 'gradient', 'motion', 'effects', 'anim', 'opacity', 'layers', 'leading', 'out' ] as const;

/**
 * Section ids from before the revamp, which bookmarks and other screens may still carry.
 * `motion` kept its id but now holds transitions only; transforms and filters moved to `effects`.
 * Themes became the palettes at the top of Colors.
 */
const LEGACY_SECTIONS: Record< string, string > = { z: 'layers', sizing: 'size', themes: 'color' };

export function resolveSection( id: string ): string {
	const next = LEGACY_SECTIONS[ id ] ?? id;
	return ( DESIGN_SECTION_IDS as readonly string[] ).includes( next ) ? next : 'color';
}

/** The section a token category is edited in. */
export function sectionForCategory( category: string ): string {
	const owner = designNav().flatMap( group => group.items ).find( item => item.cats?.includes( category ) );
	if ( owner ) return owner.id;
	if ( category === 'fontSize' ) return 'type';
	return 'themes';
}

/** Categories where people may add their own tokens. Fonts, text styles, screen sizes and the fixed shapes may not. */
export const ADDABLE: Record< string, string > = {
	color: 'color', spacing: 'spacing', radius: 'corner', shadow: 'shadow', gradient: 'gradient', transition: 'transition',
	zIndex: 'layer', opacity: 'transparency', borderWidth: 'border width', width: 'width', leading: 'line spacing',
};

/** Token slugs to list for a category: the catalogue, plus any the person has added and not saved yet. */
export function tokenKeys( snapshot: DesignSystemSnapshot, draft: Record< string, Record< string, string > >, category: string ): string[] {
	const catalogue = ( snapshot.tokens as Record< string, readonly string[] > )[ category ] ?? [];
	return Array.from( new Set( [ ...catalogue, ...Object.keys( draft[ category ] ?? {} ) ] ) );
}

export function isOwnToken( snapshot: DesignSystemSnapshot, category: string, slug: string ): boolean {
	return ! ( ( snapshot.tokens as Record< string, readonly string[] > )[ category ] ?? [] ).includes( slug );
}

export const slugify = ( raw: string ): string => raw.toLowerCase().trim().replace( /[^a-z0-9]+/g, '-' ).replace( /^-+|-+$/g, '' );

/** One unsaved change, as the changes popover lists it. */
export type DesignChange = {
	key: string;
	kind: 'token' | 'role' | 'breakpoint';
	category: string;
	slug: string;
	prop?: string;
	label: string;
	from: string;
	to: string;
	saved: string | undefined;
};

const ROLE_PROP_LABELS = (): Record< string, string > => ( {
	fontSize: __( 'size', 'blicks' ),
	fontWeight: __( 'weight', 'blicks' ),
	lineHeight: __( 'line height', 'blicks' ),
	letterSpacing: __( 'letter spacing', 'blicks' ),
	fontFamily: __( 'font', 'blicks' ),
	textTransform: __( 'letters', 'blicks' ),
} );

/**
 * What differs from what is saved — not the size of the draft, which is seeded from the saved
 * overrides. `from` is what is saved (or the theme value), `to` what the next save writes.
 */
export function designChanges(
	snapshot: DesignSystemSnapshot,
	draft: { tokens: Record< string, Record< string, string > >; breakpoints: Record< string, number >; typeRoles: TypeRoleValues }
): DesignChange[] {
	const out: DesignChange[] = [];
	const base = snapshot.baseValues as Record< string, Record< string, string > >;
	const saved = snapshot.overrides.tokens as Record< string, Record< string, string > >;
	const theme = __( 'theme value', 'blicks' );

	for ( const category of new Set( [ ...Object.keys( draft.tokens ), ...Object.keys( saved ) ] ) ) {
		const now = draft.tokens[ category ] ?? {};
		const was = saved[ category ] ?? {};
		for ( const slug of new Set( [ ...Object.keys( now ), ...Object.keys( was ) ] ) ) {
			if ( now[ slug ] === was[ slug ] ) continue;
			out.push( {
				key: `t:${ category }:${ slug }`,
				kind: 'token',
				category,
				slug,
				label: `${ titleCase( slug ) } · ${ titleCase( category ) }`,
				from: was[ slug ] ?? base[ category ]?.[ slug ] ?? theme,
				to: now[ slug ] ?? base[ category ]?.[ slug ] ?? theme,
				saved: was[ slug ],
			} );
		}
	}

	const props = ROLE_PROP_LABELS();
	const savedRoles = snapshot.overrides.typeRoles;
	for ( const role of new Set( [ ...Object.keys( draft.typeRoles ), ...Object.keys( savedRoles ) ] ) ) {
		const now = draft.typeRoles[ role ] ?? {};
		const was = savedRoles[ role ] ?? {};
		for ( const prop of new Set( [ ...Object.keys( now ), ...Object.keys( was ) ] ) ) {
			if ( now[ prop ] === was[ prop ] ) continue;
			const themeValue = snapshot.typeRoles.base[ role ]?.[ prop ];
			out.push( {
				key: `r:${ role }:${ prop }`,
				kind: 'role',
				category: 'typeRoles',
				slug: role,
				prop,
				label: `${ TYPE_ROLE_LABELS[ role ] ?? titleCase( role ) } ${ props[ prop ] ?? prop }`,
				from: was[ prop ] ?? themeValue ?? theme,
				to: now[ prop ] ?? themeValue ?? theme,
				saved: was[ prop ],
			} );
		}
	}

	const savedBp = snapshot.overrides.breakpoints;
	for ( const id of new Set( [ ...Object.keys( draft.breakpoints ), ...Object.keys( savedBp ) ] ) ) {
		if ( draft.breakpoints[ id ] === savedBp[ id ] ) continue;
		const fallback = snapshot.breakpoints.find( bp => bp.id === id )?.max;
		const show = ( v: number | null | undefined ): string => ( v === null || v === undefined ? theme : `${ v }px` );
		out.push( {
			key: `b:${ id }`,
			kind: 'breakpoint',
			category: 'breakpoints',
			slug: id,
			label: `${ titleCase( id ) } · ${ __( 'screen size', 'blicks' ) }`,
			from: show( savedBp[ id ] ?? fallback ),
			to: show( draft.breakpoints[ id ] ?? fallback ),
			saved: savedBp[ id ] === undefined ? undefined : String( savedBp[ id ] ),
		} );
	}

	return out;
}

/** Whether any change belongs to one of these categories — drives the nav's unsaved dots. */
export function sectionDirty( changes: DesignChange[], cats: readonly string[] = [] ): boolean {
	return changes.some( change => cats.includes( change.category ) );
}

/** What each token is for, in the words of someone building a page. */
export function tokenAbout(): Record< string, string > {
	return {
		'color.background': __( 'Page', 'blicks' ), 'color.foreground': __( 'Text on the page', 'blicks' ),
		'color.primary': __( 'Main buttons and links', 'blicks' ), 'color.primary-foreground': __( 'Text on main buttons', 'blicks' ),
		'color.secondary': __( 'Quiet buttons', 'blicks' ), 'color.secondary-foreground': __( 'Text on quiet buttons', 'blicks' ),
		'color.muted': __( 'Subtle panels', 'blicks' ), 'color.muted-foreground': __( 'Secondary text, captions', 'blicks' ),
		'color.accent': __( 'Highlights and badges', 'blicks' ), 'color.accent-foreground': __( 'Text on highlights', 'blicks' ),
		'color.card': __( 'Cards', 'blicks' ), 'color.card-foreground': __( 'Text on cards', 'blicks' ),
		'color.popover': __( 'Menus and popovers', 'blicks' ), 'color.popover-foreground': __( 'Text in menus', 'blicks' ),
		'color.destructive': __( 'Errors and delete actions', 'blicks' ), 'color.border': __( 'Dividers and outlines', 'blicks' ),
		'color.input': __( 'Form field outlines', 'blicks' ), 'color.ring': __( 'Keyboard focus', 'blicks' ),
		'spacing.0': __( 'No gap', 'blicks' ), 'spacing.px': __( 'Hairline gap', 'blicks' ), 'spacing.xs': __( 'Inside buttons and tags', 'blicks' ),
		'spacing.sm': __( 'Between related items', 'blicks' ), 'spacing.md': __( 'Card padding, default gap', 'blicks' ), 'spacing.lg': __( 'Between groups', 'blicks' ),
		'spacing.xl': __( 'Section padding', 'blicks' ), 'spacing.2xl': __( 'Between sections', 'blicks' ), 'spacing.3xl': __( 'Large section padding', 'blicks' ), 'spacing.4xl': __( 'Hero padding', 'blicks' ),
		'radius.none': __( 'Square corners', 'blicks' ), 'radius.sm': __( 'Fields and small tags', 'blicks' ), 'radius.md': __( 'Buttons', 'blicks' ),
		'radius.lg': __( 'Cards and panels', 'blicks' ), 'radius.xl': __( 'Large media', 'blicks' ), 'radius.full': __( 'Pills and avatars', 'blicks' ),
		'shadow.none': __( 'Flat', 'blicks' ), 'shadow.sm': __( 'Buttons', 'blicks' ), 'shadow.md': __( 'Cards', 'blicks' ), 'shadow.lg': __( 'Dropdowns', 'blicks' ), 'shadow.xl': __( 'Dialogs', 'blicks' ),
		'width.prose': __( 'Comfortable reading line', 'blicks' ), 'width.content': __( 'Default page content', 'blicks' ), 'width.wide': __( 'Wide sections', 'blicks' ), 'width.full': __( 'Edge-to-edge limit', 'blicks' ),
		'aspect.square': __( 'Avatars, product tiles', 'blicks' ), 'aspect.wide': __( 'Video, hero media', 'blicks' ), 'aspect.portrait': __( 'People, posters', 'blicks' ),
		'borderWidth.hair': __( 'Default outlines', 'blicks' ), 'borderWidth.strong': __( 'Emphasized outlines', 'blicks' ), 'borderWidth.heavy': __( 'Callouts', 'blicks' ),
		'content.size': __( 'The theme’s content column; sections line up to it', 'blicks' ),
		'button.radius': __( 'Button corners', 'blicks' ), 'button.height': __( 'Smallest button height', 'blicks' ), 'button.padding-x': __( 'Space beside the label', 'blicks' ),
		'button.padding-y': __( 'Space above and below the label', 'blicks' ), 'button.font-size': __( 'Label size', 'blicks' ), 'button.font-weight': __( 'Label weight', 'blicks' ), 'button.border-width': __( 'Outline thickness', 'blicks' ),
		'gradient.brand': __( 'Brand backgrounds', 'blicks' ), 'gradient.paper': __( 'Soft page backgrounds', 'blicks' ), 'gradient.atomic': __( 'Feature highlights', 'blicks' ),
		'gradient.backdrop': __( 'Behind cards and panels', 'blicks' ),
		'opacity.disabled': __( 'Disabled controls', 'blicks' ), 'opacity.muted': __( 'De-emphasized content', 'blicks' ), 'opacity.scrim': __( 'Overlay behind dialogs', 'blicks' ), 'opacity.hover': __( 'Hover tint', 'blicks' ),
		'transition.fast': __( 'Hovers, small toggles', 'blicks' ), 'transition.base': __( 'Most changes', 'blicks' ), 'transition.slow': __( 'Panels opening', 'blicks' ),
		'transform.lift': __( 'Hover: rise', 'blicks' ), 'transform.press': __( 'Pressed: sink', 'blicks' ), 'transform.zoom': __( 'Hover: grow', 'blicks' ),
		'filter.blur': __( 'Frosted backgrounds', 'blicks' ), 'filter.dim': __( 'Darken on hover', 'blicks' ), 'filter.grayscale': __( 'Inactive images', 'blicks' ),
		'zIndex.base': __( 'Raised above siblings', 'blicks' ), 'zIndex.sticky': __( 'Sticky headers', 'blicks' ), 'zIndex.drawer': __( 'Side drawers', 'blicks' ),
		'zIndex.popover': __( 'Menus, tooltips', 'blicks' ), 'zIndex.drag': __( 'Item being dragged', 'blicks' ), 'zIndex.toast': __( 'Notifications, always on top', 'blicks' ),
		'leading.tight': __( 'Large headings', 'blicks' ), 'leading.snug': __( 'Small headings', 'blicks' ), 'leading.body': __( 'Paragraphs', 'blicks' ), 'leading.loose': __( 'Small print', 'blicks' ),
	};
}
