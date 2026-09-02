import * as blocksApi from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';

const CATEGORY = 'blicks';

type Metadata = Record< string, any >;

interface Identity {
	title?: string;
	description?: string;
	keywords?: string[];
	icon?: any;
	example?: Record< string, any >;
}

/**
 * Blicks block-icon system. Every icon shares one brand signature so the library reads as a single
 * family — and apart from core/Stackable/Kadence:
 *   • **sharp** geometry (butt caps, miter joins, hairline 1.6 stroke) — no rounded Lucide softness;
 *   • a **glyph accent** in electric blue — one key element of each glyph is the brand color (a
 *     filled cell, the key line, the active part), so blue is *integrated into* the mark, not a
 *     bolt-on. Degrades cleanly where WP forces monochrome. Per-block `children` carry currentColor
 *     plus the one accent element (`stroke`/`fill` = `BRAND_ACCENT`). Keep glyphs sharp (no `rx`).
 */
const BRAND_ACCENT = '#002bff';

function icon( children: React.ReactNode ): any {
	return (
		<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
			<g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="butt" strokeLinejoin="miter">
				{ children }
			</g>
		</svg>
	);
}

const brandIcon = icon(
	<>
		<path d="M7 6.5h6.2a3.1 3.1 0 0 1 0 6.2H7z" />
		<path d="M7 12.7h7.1a3.4 3.4 0 0 1 0 6.8H7z" />
		<path d="M7 4v16" />
	</>
);

function ensureBlicksCategory(): void {
	const api = blocksApi as any;
	if ( typeof api.getCategories !== 'function' || typeof api.setCategories !== 'function' ) {
		return;
	}

	const categories = api.getCategories();
	if ( categories.some( ( category: any ) => category?.slug === CATEGORY ) ) {
		return;
	}

		api.setCategories( [
			...categories,
			{
				slug: CATEGORY,
				title: __( 'Blicks', 'blicks' ),
				icon: brandIcon,
			},
		] );
}

const sampleBlicks = {
	'spacing.padding': {
		default: {
			base: { top: '24px', right: '24px', bottom: '24px', left: '24px' },
		},
	},
	'border.radius': {
		default: {
			base: { topLeft: '16px', topRight: '16px', bottomRight: '16px', bottomLeft: '16px' },
		},
	},
	'colors.background': {
		default: {
			base: '#f8fafc',
		},
	},
};

const IDENTITIES: Record< string, Identity > = {
	'blicks/box': {
		title: __( 'Box', 'blicks' ),
		description: __( 'A generic styled wrapper for cards, panels, and manual layouts.', 'blicks' ),
		keywords: [ __( 'box', 'blicks' ), __( 'card', 'blicks' ), __( 'panel', 'blicks' ) ],
		icon: icon(
			<>
				<rect x="5" y="5" width="14" height="14" />
				<path d="M8 9h8" stroke={ BRAND_ACCENT } />
				<path d="M8 13h5" stroke={ BRAND_ACCENT } />
			</>
		),
		example: {
			attributes: {
				tag: 'article',
				blicks: sampleBlicks,
			},
		},
	},
	'blicks/section': {
		title: __( 'Section', 'blicks' ),
		description: __( 'A full-bleed page band with section and content sizing controls.', 'blicks' ),
		keywords: [ __( 'section', 'blicks' ), __( 'band', 'blicks' ), __( 'wrapper', 'blicks' ) ],
		icon: icon(
			<>
				<rect x="3.5" y="5" width="17" height="14" />
				<path d="M7 8.5h10" />
				<path d="M7 12h10" />
				<path d="M7 15.5h7" stroke={ BRAND_ACCENT } />
			</>
		),
		example: {
			attributes: { contentWidth: '100%', contentMaxWidth: 'var(--blicks-content-size, var(--wp--style--global--content-size, 1200px))', surface: 'muted', sectionSpace: 'md', align: 'full' },
			innerBlocks: [
				{
					name: 'blicks/stack',
					attributes: { orientation: 'vertical', gap: 'md' },
					innerBlocks: [
						{ name: 'blicks/heading', attributes: { content: 'A full-bleed section', level: 2 } },
						{ name: 'blicks/text', attributes: { content: 'Section keeps the background full width while sizing the content independently.' } },
					],
				},
			],
		},
	},
	'blicks/stack': {
		title: __( 'Stack', 'blicks' ),
		description: __( 'A one-axis auto-layout block for vertical or horizontal groups with gap and alignment controls.', 'blicks' ),
		keywords: [ __( 'flex', 'blicks' ), __( 'row', 'blicks' ), __( 'column', 'blicks' ) ],
		icon: icon(
			<>
				<rect x="5" y="5" width="14" height="3.8" />
				<rect x="5" y="10.1" width="14" height="3.8" fill={ BRAND_ACCENT } stroke={ BRAND_ACCENT } />
				<rect x="5" y="15.2" width="14" height="3.8" />
			</>
		),
		example: {
			attributes: { orientation: 'vertical', gap: 'md', align: 'center' },
			innerBlocks: [
				{ name: 'blicks/heading', attributes: { content: 'Stacked content', level: 3 } },
				{ name: 'blicks/buttons', innerBlocks: [ { name: 'blicks/button', attributes: { text: 'Action' } } ] },
			],
		},
	},
	'blicks/grid': {
		title: __( 'Grid', 'blicks' ),
		description: __( 'A responsive collection layout for cards, galleries, features, and repeatable content.', 'blicks' ),
		keywords: [ __( 'columns', 'blicks' ), __( 'cards', 'blicks' ), __( 'collection', 'blicks' ) ],
		icon: icon(
			<>
				<rect x="4.5" y="4.5" width="6" height="6" />
				<rect x="13.5" y="4.5" width="6" height="6" />
				<rect x="4.5" y="13.5" width="6" height="6" />
				<rect x="13.5" y="13.5" width="6" height="6" fill={ BRAND_ACCENT } stroke={ BRAND_ACCENT } />
			</>
		),
		example: {
			attributes: { columns: 3, autoFit: true, minColumnWidth: '14rem', gap: 'md' },
			innerBlocks: [
				{ name: 'blicks/box', attributes: { tag: 'article', blicks: sampleBlicks } },
				{ name: 'blicks/box', attributes: { tag: 'article', blicks: sampleBlicks } },
				{ name: 'blicks/box', attributes: { tag: 'article', blicks: sampleBlicks } },
			],
		},
	},
	'blicks/heading': {
		title: __( 'Heading', 'blicks' ),
		description: __( 'A theme-native h1-h6 heading with quick level and alignment controls.', 'blicks' ),
		keywords: [ __( 'title', 'blicks' ), __( 'headline', 'blicks' ), __( 'typography', 'blicks' ) ],
		icon: icon(
			<>
				<path d="M5 6v12" />
				<path d="M15 6v12" />
				<path d="M5 12h10" stroke={ BRAND_ACCENT } />
				<path d="M19 8v10" />
			</>
		),
		example: {
			attributes: { level: 2, content: 'Design with real primitives' },
		},
	},
	'blicks/text': {
		title: __( 'Text', 'blicks' ),
		description: __( 'A clean paragraph block for editable body copy that inherits your theme.', 'blicks' ),
		keywords: [ __( 'paragraph', 'blicks' ), __( 'copy', 'blicks' ), __( 'body', 'blicks' ) ],
		icon: icon(
			<>
				<path d="M5 7h14" />
				<path d="M5 11h12" />
				<path d="M5 15h14" />
				<path d="M5 19h8" stroke={ BRAND_ACCENT } />
			</>
		),
		example: {
			attributes: { content: 'Write concise body copy that can still use the full Blicks styling system.' },
		},
	},
	'blicks/buttons': {
		title: __( 'Buttons', 'blicks' ),
		description: __( 'A row or column of Button blocks with shared alignment, spacing, and wrapping.', 'blicks' ),
		keywords: [ __( 'cta', 'blicks' ), __( 'actions', 'blicks' ), __( 'group', 'blicks' ) ],
		icon: icon(
			<>
				<rect x="3" y="9" width="8" height="6" />
				<rect x="13" y="9" width="8" height="6" fill={ BRAND_ACCENT } stroke={ BRAND_ACCENT } />
			</>
		),
		example: {
			innerBlocks: [
				{ name: 'blicks/button', attributes: { text: 'Get started', variant: 'default' } },
				{ name: 'blicks/button', attributes: { text: 'Learn more', variant: 'outline' } },
			],
		},
	},
	'blicks/button': {
		title: __( 'Button', 'blicks' ),
		description: __( 'A polished action block with variants, sizes, links, and optional inline icons.', 'blicks' ),
		keywords: [ __( 'cta', 'blicks' ), __( 'link', 'blicks' ), __( 'action', 'blicks' ) ],
		icon: icon(
			<>
				<rect x="4" y="7" width="16" height="10" />
				<path d="M9 12h6" />
				<path d="M13 10l2 2-2 2" stroke={ BRAND_ACCENT } />
			</>
		),
		example: {
			attributes: { text: 'Get started', variant: 'default', size: 'default', icon: 'arrowRight', iconPosition: 'trailing' },
		},
	},
	'blicks/image': {
		title: __( 'Image', 'blicks' ),
		description: __( 'A responsive figure block with aspect ratio, object fit, caption, and link controls.', 'blicks' ),
		keywords: [ __( 'media', 'blicks' ), __( 'photo', 'blicks' ), __( 'figure', 'blicks' ) ],
		icon: icon(
			<>
				<rect x="4" y="5" width="16" height="14" />
				<circle cx="9" cy="10" r="1.4" fill={ BRAND_ACCENT } stroke={ BRAND_ACCENT } />
				<path d="M6.5 17l4.2-4.2 2.6 2.6 1.7-1.7 2.5 3.3" />
			</>
		),
		example: {
			attributes: { aspectRatio: '16 / 9', objectFit: 'cover', caption: 'Responsive media with a clean caption.' },
		},
	},
	'blicks/icon': {
		title: __( 'Icon', 'blicks' ),
		description: __( 'A curated inline SVG icon with size, stroke, label, color, and spacing controls.', 'blicks' ),
		keywords: [ __( 'svg', 'blicks' ), __( 'symbol', 'blicks' ), __( 'visual', 'blicks' ) ],
		icon: icon(
			<>
				<path d="M12 4.5l2.2 4.5 4.9.7-3.6 3.5.9 4.9-4.4-2.3-4.4 2.3.9-4.9-3.6-3.5 4.9-.7z" fill={ BRAND_ACCENT } stroke={ BRAND_ACCENT } />
			</>
		),
		example: {
			attributes: { icon: 'bolt', size: '2rem', label: 'Feature' },
		},
	},
	'blicks/spacer': {
		title: __( 'Spacer', 'blicks' ),
		description: __( 'A deliberate rhythm block for adding responsive vertical or horizontal breathing room.', 'blicks' ),
		keywords: [ __( 'space', 'blicks' ), __( 'gap', 'blicks' ), __( 'rhythm', 'blicks' ) ],
		icon: icon(
			<>
				<path d="M12 4v16" />
				<path d="M8.5 7.5L12 4l3.5 3.5" stroke={ BRAND_ACCENT } />
				<path d="M8.5 16.5L12 20l3.5-3.5" stroke={ BRAND_ACCENT } />
			</>
		),
		example: {
			attributes: { size: '48px', orientation: 'vertical' },
		},
	},
	'blicks/divider': {
		title: __( 'Divider', 'blicks' ),
		description: __( 'A semantic rule for separating groups with thickness, style, color, and spacing controls.', 'blicks' ),
		keywords: [ __( 'rule', 'blicks' ), __( 'separator', 'blicks' ), __( 'line', 'blicks' ) ],
		icon: icon(
			<>
				<path d="M5 12h14" stroke={ BRAND_ACCENT } />
				<path d="M8 8h8" />
				<path d="M8 16h8" />
			</>
		),
		example: {
			attributes: { orientation: 'horizontal', thickness: '2px', lineStyle: 'solid' },
		},
	},
};

export function applyBlockIdentity( metadata: Metadata ): Metadata {
	ensureBlicksCategory();

	const identity = IDENTITIES[ metadata.name ] ?? {};

	return {
		...metadata,
		...identity,
		category: CATEGORY,
	};
}
