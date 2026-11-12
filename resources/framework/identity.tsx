import * as blocksApi from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { fieldSpec, specToExample } from '@/blocks/field/create';

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
 *   • **flat** solid geometry at a 2px weight, softly rounded — it holds up at 16px in a tree row
 *     where a hairline outline breaks up;
 *   • a **glyph accent** in electric blue — one key element of each glyph is the brand color (a
 *     filled cell, the key bar, the active part), so blue is *integrated into* the mark, not a
 *     bolt-on. Degrades cleanly where WP forces monochrome.
 *
 * The geometry lives in `./icons/block-glyphs.json`, and `scripts/gen-block-icons.mjs` outlines it
 * into the filled-path markup in each `block.json` — the only form wordpress.org's `wp_kses` lets
 * through. The editor renders that same markup back out of the metadata, so there is one drawing
 * everywhere and nothing to keep in step.
 */
import GLYPHS from './icons/block-glyphs.json';

const PATH = /<path d="([^"]+)" fill="([^"]+)"\/>/g;

/**
 * The block.json icon as a React element. The accent path carries a class, so a surface that paints
 * its selection in the admin colour can fold the accent into `currentColor` instead of losing it
 * blue-on-blue.
 */
function glyph( markup: unknown ): any {
	if ( typeof markup !== 'string' || ! markup.startsWith( '<svg' ) ) return undefined;

	const paths = [ ...markup.matchAll( PATH ) ].map( ( [ , d, fill ], i ) => (
		<path key={ i } d={ d } fill={ fill } className={ fill === GLYPHS.accent ? 'bl-icon-accent' : undefined } />
	) );

	return (
		<svg viewBox={ GLYPHS.viewBox } width="24" height="24" aria-hidden="true" focusable="false">
			{ paths }
		</svg>
	);
}

function icon( children: React.ReactNode ): any {
	return (
		<svg viewBox={ GLYPHS.viewBox } width="24" height="24" aria-hidden="true" focusable="false">
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

/** A Box arranged as a stack, as Box's own Arrange ▸ Stacked writes it (stretched children). */
const stackedLayout = {
	'layout.display': { default: { base: 'flex' } },
	'layout.flexDirection': { default: { base: 'column' } },
	'layout.alignItems': { default: { base: 'stretch' } },
	'layout.justifyContent': { default: { base: 'flex-start' } },
	'layout.gapRow': { default: { base: 'md' } },
};

const IDENTITIES: Record< string, Identity > = {
	'blicks/box': {
		title: __( 'Box', 'blicks' ),
		description: __( 'A generic styled wrapper for cards, panels, and manual layouts.', 'blicks' ),
		keywords: [ __( 'box', 'blicks' ), __( 'card', 'blicks' ), __( 'panel', 'blicks' ) ],
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
		example: {
			attributes: { contentWidth: '100%', contentMaxWidth: 'var(--blicks-content-size, var(--wp--style--global--content-size, 1200px))', surface: 'muted', sectionSpace: 'md', align: 'full' },
			innerBlocks: [
				{
					name: 'blicks/box',
					attributes: { blicks: stackedLayout },
					innerBlocks: [
						{ name: 'blicks/heading', attributes: { content: 'A full-bleed section', level: 2 } },
						{ name: 'blicks/text', attributes: { content: 'Section keeps the background full width while sizing the content independently.' } },
					],
				},
			],
		},
	},
	'blicks/loop': {
		title: __( 'Loop', 'blicks' ),
		description: __( 'Repeat a card for every item in a list: pasted JSON, a data endpoint or a WordPress query.', 'blicks' ),
		keywords: [ __( 'query', 'blicks' ), __( 'repeater', 'blicks' ), __( 'json', 'blicks' ), __( 'api', 'blicks' ), __( 'bento', 'blicks' ) ],
		example: {
			attributes: {
				source: 'json',
				data: '[{"title":"Arc floor lamp","price":189},{"title":"Oak side table","price":240},{"title":"Linen throw","price":72}]',
				layout: 'grid',
				limit: 3,
			},
			innerBlocks: [
				{
					name: 'blicks/box',
					attributes: { kind: 'card', tag: 'article', blicks: sampleBlicks },
					innerBlocks: [
						{ name: 'blicks/heading', attributes: { content: 'Item title', level: 3, metadata: { bindings: { content: { source: 'blicks/item', args: { key: 'title' } } } } } },
						{ name: 'blicks/text', attributes: { content: '$0', metadata: { bindings: { content: { source: 'blicks/item', args: { key: 'price', format: 'currency', formatArg: '$' } } } } } },
					],
				},
			],
		},
	},
	'blicks/heading': {
		title: __( 'Heading', 'blicks' ),
		description: __( 'A theme-native h1-h6 heading with quick level and alignment controls.', 'blicks' ),
		keywords: [ __( 'title', 'blicks' ), __( 'headline', 'blicks' ), __( 'typography', 'blicks' ) ],
		example: {
			attributes: { level: 2, content: 'Design with real primitives' },
		},
	},
	'blicks/text': {
		title: __( 'Text', 'blicks' ),
		description: __( 'A clean paragraph block for editable body copy that inherits your theme.', 'blicks' ),
		keywords: [ __( 'paragraph', 'blicks' ), __( 'copy', 'blicks' ), __( 'body', 'blicks' ) ],
		example: {
			attributes: { content: 'Write concise body copy that can still use the full Blicks styling system.' },
		},
	},
	'blicks/list': {
		title: __( 'List', 'blicks' ),
		description: __( 'A bulleted, numbered or icon list you type into: Enter adds an item, Tab indents it.', 'blicks' ),
		keywords: [ __( 'bullets', 'blicks' ), __( 'numbered', 'blicks' ), __( 'checklist', 'blicks' ), __( 'ul', 'blicks' ), __( 'ol', 'blicks' ) ],
		example: {
			attributes: { kind: 'icons', icon: 'check', markerColour: 'primary', markerBehind: 'tint' },
			innerBlocks: [
				{ name: 'blicks/list-item', attributes: { content: 'Unlimited pages and sites' } },
				{
					name: 'blicks/list-item',
					attributes: { content: 'Shared design tokens' },
					innerBlocks: [
						{
							name: 'blicks/list',
							attributes: { kind: 'icons', nested: true },
							innerBlocks: [ { name: 'blicks/list-item', attributes: { content: 'Colours, type and spacing' } } ],
						},
					],
				},
				{ name: 'blicks/list-item', attributes: { content: 'Single sign-on', state: 'out' } },
			],
		},
	},
	'blicks/list-item': {
		title: __( 'List item', 'blicks' ),
		description: __( 'One item of a List. It can hold an inner list.', 'blicks' ),
		example: {
			attributes: { content: 'Pack a light rain jacket' },
		},
	},
	'blicks/steps': {
		title: __( 'Steps', 'blicks' ),
		description: __( 'Numbered steps across or down: a stepper, a how-it-works row or a timeline, with a current step.', 'blicks' ),
		keywords: [ __( 'stepper', 'blicks' ), __( 'process', 'blicks' ), __( 'timeline', 'blicks' ), __( 'how it works', 'blicks' ) ],
		example: {
			attributes: { current: 2, markerColour: 'primary' },
			innerBlocks: [
				{ name: 'blicks/step', attributes: { state: 'done' }, innerBlocks: [ { name: 'blicks/heading', attributes: { level: 3, content: 'Pick a starter' } } ] },
				{ name: 'blicks/step', attributes: { state: 'cur' }, innerBlocks: [ { name: 'blicks/heading', attributes: { level: 3, content: 'Swap the content' } } ] },
				{ name: 'blicks/step', attributes: { state: 'next' }, innerBlocks: [ { name: 'blicks/heading', attributes: { level: 3, content: 'Publish' } } ] },
			],
		},
	},
	'blicks/step': {
		title: __( 'Step', 'blicks' ),
		description: __( 'One step of a Steps block. It holds a heading, text and any other blocks.', 'blicks' ),
		example: {
			innerBlocks: [ { name: 'blicks/heading', attributes: { level: 3, content: 'Invite your team' } }, { name: 'blicks/text', attributes: { content: 'They can join now or later.' } } ],
		},
	},
	'blicks/buttons': {
		title: __( 'Buttons', 'blicks' ),
		description: __( 'A row or column of Button blocks with shared alignment, spacing, and wrapping.', 'blicks' ),
		keywords: [ __( 'cta', 'blicks' ), __( 'actions', 'blicks' ), __( 'group', 'blicks' ) ],
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
		example: {
			attributes: { text: 'Get started', variant: 'default', size: 'default', icon: 'arrowRight', iconPosition: 'trailing' },
		},
	},
	'blicks/image': {
		title: __( 'Image', 'blicks' ),
		description: __( 'A responsive figure block with aspect ratio, object fit, caption, and link controls.', 'blicks' ),
		keywords: [ __( 'media', 'blicks' ), __( 'photo', 'blicks' ), __( 'figure', 'blicks' ) ],
		example: {
			attributes: { aspectRatio: '16 / 9', objectFit: 'cover', caption: 'Responsive media with a clean caption.' },
		},
	},
	'blicks/icon': {
		title: __( 'Icon', 'blicks' ),
		description: __( 'A curated inline SVG icon with size, stroke, label, color, and spacing controls.', 'blicks' ),
		keywords: [ __( 'svg', 'blicks' ), __( 'symbol', 'blicks' ), __( 'visual', 'blicks' ) ],
		example: {
			attributes: { icon: 'bolt', size: '2rem', label: 'Feature' },
		},
	},
	'blicks/dialog': {
		title: __( 'Dialog', 'blicks' ),
		description: __( 'A native dialog — modal, drawer, bottom sheet or full screen — opened by a Button or a link to it.', 'blicks' ),
		keywords: [ __( 'modal', 'blicks' ), __( 'popup', 'blicks' ), __( 'drawer', 'blicks' ), __( 'lightbox', 'blicks' ) ],
		example: {
			attributes: { title: 'Size guide', anchor: 'size-guide', kind: 'modal', phone: 'sheet' },
			innerBlocks: [
				{ name: 'blicks/heading', attributes: { content: 'Size guide', level: 2 } },
				{ name: 'blicks/text', attributes: { content: 'Chest and length, in centimetres.' } },
			],
		},
	},
	'blicks/form': {
		title: __( 'Form', 'blicks' ),
		description: __( 'A contact or sign-up form built from Field blocks, with entries, email and spam protection.', 'blicks' ),
		keywords: [ __( 'contact', 'blicks' ), __( 'newsletter', 'blicks' ), __( 'subscribe', 'blicks' ), __( 'enquiry', 'blicks' ) ],
		example: {
			attributes: { template: 'contact' },
			innerBlocks: [
				specToExample( fieldSpec( { type: 'text', label: 'Name', name: 'name', width: 'half', required: true } ) ),
				specToExample( fieldSpec( { type: 'email', label: 'Email', name: 'email', width: 'half', required: true, placeholder: 'name@example.com' } ) ),
				specToExample( fieldSpec( { type: 'textarea', label: 'Message', name: 'message', required: true } ) ),
				{ name: 'blicks/button', attributes: { text: 'Send message', action: 'submit' } },
			],
		},
	},
	'blicks/field': {
		title: __( 'Field', 'blicks' ),
		description: __( 'One question in a Form — its label, control and help as blocks: short or long text, email, phone, number, date, dropdown, choices, consent or hidden.', 'blicks' ),
		keywords: [ __( 'input', 'blicks' ), __( 'email', 'blicks' ), __( 'checkbox', 'blicks' ), __( 'dropdown', 'blicks' ) ],
		example: ( ( { attributes, innerBlocks } ) => ( { attributes, innerBlocks } ) )(
			specToExample( fieldSpec( { type: 'email', label: 'Email', name: 'email', required: true, placeholder: 'name@example.com', help: 'We reply within a day.' } ) )
		),
	},
	'blicks/input': {
		title: __( 'Input', 'blicks' ),
		description: __( 'The control of a Field: the box, list or choices a visitor fills in, styled on its own.', 'blicks' ),
		keywords: [ __( 'control', 'blicks' ), __( 'text box', 'blicks' ), __( 'field', 'blicks' ) ],
		example: { attributes: {} },
	},
	'blicks/menu-link': {
		title: __( 'Menu link', 'blicks' ),
		description: __( 'A link for menus and link columns: a label with an optional line of description, an icon and a badge.', 'blicks' ),
		keywords: [ __( 'menu', 'blicks' ), __( 'link', 'blicks' ), __( 'navigation', 'blicks' ), __( 'mega menu', 'blicks' ) ],
		example: {
			attributes: { label: 'Analytics', description: 'Dashboards and reports', url: '/analytics', icon: 'chart-column', badge: 'New' },
		},
	},
};

export function applyBlockIdentity( metadata: Metadata ): Metadata {
	ensureBlicksCategory();

	const identity = IDENTITIES[ metadata.name ] ?? {};

	return {
		...metadata,
		...identity,
		icon: glyph( metadata.icon ) ?? metadata.icon,
		category: blockCategory( metadata as { name: string; category?: unknown } ),
	};
}

/**
 * Blicks' own blocks sit in the Blicks category. A companion block registered through
 * `defineBlock` keeps the category its `block.json` names (a travel block in "Travel"), and lands
 * in Blicks only when it names none.
 */
export function blockCategory( metadata: { name: string; category?: unknown } ): string {
	if ( metadata.name.startsWith( 'blicks/' ) ) {
		return CATEGORY;
	}

	return 'string' === typeof metadata.category && '' !== metadata.category ? metadata.category : CATEGORY;
}
