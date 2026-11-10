/**
 * The patterns that ship with the plugin, as collections rather than as a pile.
 *
 * **Every built-in belongs to a set.** Four compositions — a hero, a feature triplet, an offer and
 * a call to action — are built once here and then drawn five times, once per collection in
 * `collections.ts`. A collection supplies the palette, the type scale, the radius and the words;
 * the composition supplies the shape. Mount Funky's hero and Funky's offer and you get a page,
 * because both took every colour and every size from the same declaration.
 *
 * That is the trade this file makes deliberately: **shared structure, distinct character.** Five
 * hand-drawn heroes would differ structurally too, and would also drift — the fourth one would
 * quietly stop matching its own set, which is exactly the failure collections exist to prevent.
 * Structure in common is visible and checkable; look in common is the thing people actually see.
 * When a set earns a composition of its own, it gets one here and the shared four stay as they are.
 *
 * Versioned with releases, offline, and read-only: editing one and saving makes a copy on the site,
 * so an update can never overwrite someone's work and their library can never drift from what
 * shipped. That rule lives in `library.ts`; this is the cargo.
 *
 * Block JSON rather than serialized markup. Markup would have to stay valid against every future
 * `save()` — exactly the contract the free plugin's golden tests exist to police — and a built-in
 * that silently became invalid content would be the worst possible first impression. JSON is
 * rebuilt through `createBlock` at mount, so it picks up whatever the current block defines.
 *
 * Every block used here ships with the FREE plugin, so a built-in can never be the thing that needs
 * a plugin the site does not have.
 */

import {
	COLLECTIONS,
	accentPanel,
	body,
	bodyOnAccent,
	cta,
	display,
	displayOnAccent,
	ground,
	heading,
	headingOnAccent,
	panel,
	type Collection,
	type ValueTree,
} from './collections';
import type { BlockNode } from './mount';
import type { PatternEntry } from './library';

/** The words one collection puts in the four compositions. */
interface Copy {
	heroTitle: string;
	heroBody: string;
	heroAction: string;
	features: [ string, string ][];
	featuresTitle: string;
	offerTitle: string;
	offerPrice: string;
	offerBody: string;
	offerAction: string;
	ctaTitle: string;
	ctaBody: string;
	ctaAction: string;
}

/* ---------- block shorthands ---------- */

/**
 * Box arrangements, as the Box's own Arrange writes them (box/model.ts `applyArrange`): children
 * full width down a stack, and cards in as many even columns as fit, which needs no phone rule.
 * Written out as data — importing the Box model would split the Studio bundle into shared chunks.
 */
const at = ( value: string ) => ( { default: { base: value } } );
export const STACK: ValueTree = {
	'layout.display': at( 'flex' ),
	'layout.flexDirection': at( 'column' ),
	'layout.alignItems': at( 'stretch' ),
	'layout.justifyContent': at( 'flex-start' ),
	'layout.gapRow': at( 'md' ),
} as ValueTree;
export const GRID: ValueTree = {
	'layout.display': at( 'grid' ),
	'layout.gridColumns': at( 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))' ),
	'layout.alignContent': at( 'start' ),
	'layout.gapRow': at( 'md' ),
	'layout.gapColumn': at( 'md' ),
} as ValueTree;

const block = ( name: string, blicks?: ValueTree, innerBlocks: BlockNode[] = [] ): BlockNode => ( {
	name,
	attributes: blicks ? { blicks } : {},
	innerBlocks,
} );

const text = ( name: string, attr: Record< string, unknown >, blicks: ValueTree ): BlockNode => ( {
	name,
	attributes: { ...attr, blicks },
	innerBlocks: [],
} );

const h = ( content: string, blicks: ValueTree ): BlockNode =>
	text( 'blicks/heading', { content }, blicks );

const p = ( content: string, blicks: ValueTree ): BlockNode =>
	text( 'blicks/text', { content }, blicks );

/**
 * A Box of the card or panel kind. The kind is what carries the design language's surface — the
 * sheen, the blur, the frosted or pastel fill, the recoloured edge (`box/style.scss`) — so a panel
 * drawn as a plain stack would wear the language's colours and none of its look.
 */
const box = ( kind: 'card' | 'panel', blicks: ValueTree, innerBlocks: BlockNode[] ): BlockNode => ( {
	name: 'blicks/box',
	attributes: { kind, tag: kind === 'card' ? 'article' : 'div', blicks },
	innerBlocks,
} );

const button = ( label: string, c: Collection ): BlockNode =>
	block( 'blicks/buttons', undefined, [ text( 'blicks/button', { text: label }, cta( c ) ) ] );

/* ---------- the four compositions ---------- */

/**
 * The headline, the sentence under it, the one button.
 *
 * Flat on the ground rather than in a panel: a hero IS the surface, and a card floating on a page's
 * own background is the look of a pattern that was pasted in.
 */
function hero( c: Collection, copy: Copy ): BlockNode[] {
	return [
		block( 'blicks/section', ground( c ), [
			block( 'blicks/box', STACK, [
				h( copy.heroTitle, display( c ) ),
				p( copy.heroBody, body( c ) ),
				button( copy.heroAction, c ),
			] ),
		] ),
	];
}

/** Three panels across, each a heading over a line. The set's radius is most of what you see. */
function features( c: Collection, copy: Copy ): BlockNode[] {
	return [
		block( 'blicks/section', ground( c ), [
			block( 'blicks/box', STACK, [
				h( copy.featuresTitle, heading( c ) ),
				block(
					'blicks/box',
					GRID,
					copy.features.map( ( [ title, line ] ) =>
						box( 'card', panel( c ), [
							h( title, heading( c ) ),
							p( line, body( c ) ),
						] )
					)
				),
			] ),
		] ),
	];
}

/**
 * The offer: one accent panel carrying a price.
 *
 * This is where a collection's accent earns its place — the only block on the page wearing it, so
 * the eye goes to the number. A set with the accent on three things at once has no focal point,
 * which is why `accentPanel` appears once per composition.
 */
function offer( c: Collection, copy: Copy ): BlockNode[] {
	return [
		block( 'blicks/section', ground( c ), [
			box( 'panel', accentPanel( c ), [
				h( copy.offerTitle, headingOnAccent( c ) ),
				h( copy.offerPrice, displayOnAccent( c ) ),
				p( copy.offerBody, bodyOnAccent( c ) ),
				button( copy.offerAction, c ),
			] ),
		] ),
	];
}

/**
 * The close. A heading over a line, then the button, on one card.
 *
 * The words pair into their own stack rather than sitting beside the button as a third sibling,
 * and that nesting is not tidiness — it is what makes the card legible. A preview is drawn from
 * the first container's children, so a hero and a closing call that both held three flat children
 * drew the IDENTICAL miniature, and two cards in one set were distinguishable only by reading
 * their names. Two children, the first heavier, is a shape of its own.
 */
function closer( c: Collection, copy: Copy ): BlockNode[] {
	return [
		block( 'blicks/section', ground( c ), [
			box( 'card', panel( c ), [
				block( 'blicks/box', STACK, [
					h( copy.ctaTitle, heading( c ) ),
					p( copy.ctaBody, body( c ) ),
				] ),
				button( copy.ctaAction, c ),
			] ),
		] ),
	];
}

/* ---------- what each set says ---------- */

/**
 * The words are the other half of a set's character.
 *
 * Funky's hero shouts and Clinic's reassures, in the same composition at the same sizes. Copy is
 * the cheapest way for two patterns to feel like they came from the same place, and the first thing
 * anyone notices when they do not.
 */
const COPY: Record< string, Copy > = {
	funky: {
		heroTitle: 'Drop it loud',
		heroBody: 'Your best thing, on a page that refuses to be ignored. Built in an afternoon.',
		heroAction: 'Shop the drop',
		featuresTitle: 'Why this one',
		features: [
			[ 'Made small', 'Short runs, numbered, then gone.' ],
			[ 'Shipped fast', 'Out the door the same week you order.' ],
			[ 'Wear it hard', 'Built to survive what you put it through.' ],
		],
		offerTitle: 'The whole set',
		offerPrice: '$89',
		offerBody: 'Everything in the drop, one box, free shipping.',
		offerAction: 'Take all of it',
		ctaTitle: 'Still here?',
		ctaBody: 'The last one sold out in four days. This one is smaller.',
		ctaAction: 'Get yours',
	},
	brutalist: {
		heroTitle: 'We make things that work',
		heroBody: 'A studio of six. Brand, product and the uncomfortable questions in between.',
		heroAction: 'See the work',
		featuresTitle: 'What we do',
		features: [
			[ 'Strategy', 'The decisions that make the rest cheap.' ],
			[ 'Identity', 'A system, not a logo and a hope.' ],
			[ 'Build', 'We ship it ourselves. That is the point.' ],
		],
		offerTitle: 'Engagement',
		offerPrice: 'From £12k',
		offerBody: 'Six weeks, one team, everything delivered as source.',
		offerAction: 'Start a project',
		ctaTitle: 'Tell us the problem',
		ctaBody: 'No deck, no discovery phase. One call, then a straight answer.',
		ctaAction: 'Get in touch',
	},
	editorial: {
		heroTitle: 'The long version',
		heroBody:
			'Reporting that takes the time a subject deserves, published when it is finished and not before.',
		heroAction: 'Start reading',
		featuresTitle: 'In this issue',
		features: [
			[ 'The field', 'Four months with the people who grow it.' ],
			[ 'The kitchen', 'What changed when the menu stopped changing.' ],
			[ 'The table', 'A meal, and the argument that came with it.' ],
		],
		offerTitle: 'Subscribe',
		offerPrice: '£6 a month',
		offerBody: 'Four issues a year in print, everything online, no advertising ever.',
		offerAction: 'Become a reader',
		ctaTitle: 'Written for people who finish things',
		ctaBody: 'One letter each Sunday. The pieces we are working on, and why.',
		ctaAction: 'Join the letter',
	},
	clinic: {
		heroTitle: 'Care that takes its time',
		heroBody:
			'Same-day appointments, unhurried consultations, and a team you will see more than once.',
		heroAction: 'Book an appointment',
		featuresTitle: 'How it works',
		features: [
			[ 'Book', 'Choose a time online, or call and speak to someone.' ],
			[ 'Meet', 'Thirty minutes, not seven. Bring your questions.' ],
			[ 'Follow up', 'We check in afterwards, without being asked.' ],
		],
		offerTitle: 'Membership',
		offerPrice: '£45 a month',
		offerBody: 'Unlimited consultations, tests included, cancel whenever you like.',
		offerAction: 'See what is covered',
		ctaTitle: 'Not sure where to start?',
		ctaBody: 'Tell us what is going on. We will say honestly whether we are the right people.',
		ctaAction: 'Ask us first',
	},
	'soft-saas': {
		heroTitle: 'Ship the thing, not the config',
		heroBody: 'One command to deploy, sensible defaults everywhere, and an exit any time.',
		heroAction: 'Start free',
		featuresTitle: 'Built in',
		features: [
			[ 'Deploys', 'Every push, every branch, rolled back in one click.' ],
			[ 'Insight', 'What broke, where, and who is awake to fix it.' ],
			[ 'Portable', 'Your data leaves as fast as it arrived.' ],
		],
		offerTitle: 'Team',
		offerPrice: '$29 per seat',
		offerBody: 'Unlimited projects, unlimited environments, support that answers.',
		offerAction: 'Try it for 14 days',
		ctaTitle: 'Move a project across this afternoon',
		ctaBody: 'Import from anywhere, keep your domains, no card until you are happy.',
		ctaAction: 'Import a project',
	},
};

/* ---------- the shelf ---------- */

/**
 * The four kinds every collection carries, in the order a page is usually built.
 *
 * Shared across sets on purpose: "Heroes" means the same thing in Clinic as in Funky, which is what
 * makes the Kind filter worth having beside the collection. A kind that meant something different
 * in each set would be a second collection axis wearing the wrong name.
 */
const COMPOSITIONS: {
	slug: string;
	kind: string;
	title: string;
	build: ( c: Collection, copy: Copy ) => BlockNode[];
}[] = [
	{ slug: 'hero', kind: 'Heroes', title: 'Hero', build: hero },
	{ slug: 'features', kind: 'Features', title: 'Feature triplet', build: features },
	{ slug: 'offer', kind: 'Pricing', title: 'Offer panel', build: offer },
	{ slug: 'cta', kind: 'Call to action', title: 'Closing call', build: closer },
];

/**
 * Every shipped pattern, collection by collection.
 *
 * Built rather than written out, so a set cannot end up missing a kind the others have — a
 * collection with no closing call reads as unfinished, and nobody would notice in a file of twenty
 * hand-written entries until they went looking for it.
 */
export const BUILTIN_PATTERNS: PatternEntry[] = COLLECTIONS.flatMap( ( collection ) => {
	const copy = COPY[ collection.id ];

	if ( ! copy ) {
		return [];
	}

	return COMPOSITIONS.map( ( composition ) => ( {
		id: `builtin:${ collection.id }:${ composition.slug }`,
		title: composition.title,
		source: 'builtin' as const,
		collection: collection.id,
		kind: composition.kind,
		blocks: composition.build( collection, copy ),
	} ) );
} );
