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
 *     bolt-on. Degrades cleanly where WP forces monochrome.
 *
 * The geometry itself lives in `./icons/block-glyphs.json`, not in this file, because it has a
 * second consumer: `scripts/gen-block-icons.mjs` outlines the same shapes into filled paths and
 * writes them into each `block.json`, for the surfaces that read the metadata without ever running
 * this bundle (the wordpress.org plugin page, Plugins → Add New → Blocks). One source, two
 * renderers — `block-glyphs.test.ts` holds them to the same block list.
 */
import GLYPHS from './icons/block-glyphs.json';

const BRAND_ACCENT = GLYPHS.accent;

type Shape = {
	type: string;
	accent?: boolean;
	filled?: boolean;
	x?: number; y?: number; w?: number; h?: number;
	cx?: number; cy?: number; r?: number;
	points?: number[][];
	closed?: boolean;
	d?: string;
};

/** One glyph shape as a real stroked element — the editor has no `wp_kses` to answer to. */
function shape( s: Shape, key: number ): React.ReactElement {
	const stroke = s.accent ? BRAND_ACCENT : undefined;
	const fill   = s.filled ? BRAND_ACCENT : undefined;

	switch ( s.type ) {
		case 'rect':
			return <rect key={ key } x={ s.x } y={ s.y } width={ s.w } height={ s.h } stroke={ stroke } fill={ fill } />;
		case 'circle':
			return <circle key={ key } cx={ s.cx } cy={ s.cy } r={ s.r } stroke={ stroke } fill={ fill } />;
		case 'line': {
			const [ head, ...rest ] = s.points as number[][];
			const d = `M${ head[ 0 ] } ${ head[ 1 ] }`
				+ rest.map( ( p ) => `L${ p[ 0 ] } ${ p[ 1 ] }` ).join( '' )
				+ ( s.closed ? 'Z' : '' );
			return <path key={ key } d={ d } stroke={ stroke } fill={ fill } />;
		}
		default:
			return <path key={ key } d={ s.d } stroke={ stroke } fill={ fill } />;
	}
}

function icon( children: React.ReactNode ): any {
	return (
		<svg viewBox={ GLYPHS.viewBox } width="24" height="24" aria-hidden="true" focusable="false">
			<g fill="none" stroke="currentColor" strokeWidth={ GLYPHS.strokeWidth } strokeLinecap="butt" strokeLinejoin="miter">
				{ children }
			</g>
		</svg>
	);
}

/** The icon for one block, built from its entry in the shared glyph source. */
function glyph( name: string ): any {
	const shapes = ( GLYPHS.glyphs as Record< string, Shape[] > )[ name ];
	if ( ! shapes ) return undefined;
	return icon( shapes.map( shape ) );
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
		icon: glyph( 'blicks/box' ),
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
		icon: glyph( 'blicks/section' ),
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
		icon: glyph( 'blicks/stack' ),
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
		icon: glyph( 'blicks/grid' ),
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
		icon: glyph( 'blicks/heading' ),
		example: {
			attributes: { level: 2, content: 'Design with real primitives' },
		},
	},
	'blicks/text': {
		title: __( 'Text', 'blicks' ),
		description: __( 'A clean paragraph block for editable body copy that inherits your theme.', 'blicks' ),
		keywords: [ __( 'paragraph', 'blicks' ), __( 'copy', 'blicks' ), __( 'body', 'blicks' ) ],
		icon: glyph( 'blicks/text' ),
		example: {
			attributes: { content: 'Write concise body copy that can still use the full Blicks styling system.' },
		},
	},
	'blicks/buttons': {
		title: __( 'Buttons', 'blicks' ),
		description: __( 'A row or column of Button blocks with shared alignment, spacing, and wrapping.', 'blicks' ),
		keywords: [ __( 'cta', 'blicks' ), __( 'actions', 'blicks' ), __( 'group', 'blicks' ) ],
		icon: glyph( 'blicks/buttons' ),
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
		icon: glyph( 'blicks/button' ),
		example: {
			attributes: { text: 'Get started', variant: 'default', size: 'default', icon: 'arrowRight', iconPosition: 'trailing' },
		},
	},
	'blicks/image': {
		title: __( 'Image', 'blicks' ),
		description: __( 'A responsive figure block with aspect ratio, object fit, caption, and link controls.', 'blicks' ),
		keywords: [ __( 'media', 'blicks' ), __( 'photo', 'blicks' ), __( 'figure', 'blicks' ) ],
		icon: glyph( 'blicks/image' ),
		example: {
			attributes: { aspectRatio: '16 / 9', objectFit: 'cover', caption: 'Responsive media with a clean caption.' },
		},
	},
	'blicks/icon': {
		title: __( 'Icon', 'blicks' ),
		description: __( 'A curated inline SVG icon with size, stroke, label, color, and spacing controls.', 'blicks' ),
		keywords: [ __( 'svg', 'blicks' ), __( 'symbol', 'blicks' ), __( 'visual', 'blicks' ) ],
		icon: glyph( 'blicks/icon' ),
		example: {
			attributes: { icon: 'bolt', size: '2rem', label: 'Feature' },
		},
	},
	'blicks/spacer': {
		title: __( 'Spacer', 'blicks' ),
		description: __( 'A deliberate rhythm block for adding responsive vertical or horizontal breathing room.', 'blicks' ),
		keywords: [ __( 'space', 'blicks' ), __( 'gap', 'blicks' ), __( 'rhythm', 'blicks' ) ],
		icon: glyph( 'blicks/spacer' ),
		example: {
			attributes: { size: '48px', orientation: 'vertical' },
		},
	},
	'blicks/divider': {
		title: __( 'Divider', 'blicks' ),
		description: __( 'A semantic rule for separating groups with thickness, style, color, and spacing controls.', 'blicks' ),
		keywords: [ __( 'rule', 'blicks' ), __( 'separator', 'blicks' ), __( 'line', 'blicks' ) ],
		icon: glyph( 'blicks/divider' ),
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
