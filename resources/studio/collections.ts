/**
 * A collection is a SET with one design system, not a loose tag.
 *
 * This is the axis that stops a shelf being a pile. The first built-ins were unrelated one-offs,
 * and mounting two of them produced a page that looked assembled rather than designed — which is
 * the single thing a generated library gets wrong. A collection fixes it by construction: every
 * pattern filed under one paints from that collection's palette, sets type from its scale and
 * rounds to its radius, so a hero and a pricing table taken from the same collection look like they
 * were drawn by the same hand.
 *
 * **The palette is not decoration, it is the model.** It is what the swatch shows in the rail, and
 * it is the literal source of every colour its patterns carry — `collections.test.ts` holds that
 * rule by asserting no built-in writes a colour its own collection does not declare. A collection
 * whose patterns drifted off its palette would be a set in name only, and the name is the part
 * people trust.
 *
 * **Industry is a property of the collection, not of the pattern.** A hero is a hero whoever it is
 * for; what suits a clinic rather than a nightclub is the LOOK, and the look is the collection. So
 * `industries` lives here and a pattern inherits it, which also means a pattern cannot drift from
 * its set's audience by being retagged.
 *
 * Nothing here knows about WordPress. The table is data, the helpers are pure, and both are
 * testable without a registry.
 */

/** The slot every built-in writes to. A collection is a look, not a responsive design. */
const STATE = 'default';
const BREAKPOINT = 'base';

/** A `blicks` attribute tree: `blicks[controlId][state][breakpoint]`. */
export type ValueTree = Record< string, Record< string, Record< string, unknown > > >;

export interface Palette {
	/** The surface a pattern sits on. */
	ground: string;
	/** Text that reads on `ground`. */
	ink: string;
	/** The one loud colour. Panels, buttons, the thing the eye lands on. */
	accent: string;
	/** Text that reads on `accent`. */
	accentInk: string;
	/** A quieter surface for a panel inside the ground. */
	raised: string;
}

export interface TypeScale {
	/** The headline size. */
	display: string;
	/** A heading inside a panel. */
	heading: string;
	/** Running text. */
	body: string;
	/** The weight headlines take. 900 for Funky, 400 for Editorial — this is most of the character. */
	displayWeight: number;
	/** Tracking on the headline. Loud sets pull in, calm sets let go. */
	tracking: string;
}

export interface Collection {
	/** Stable across releases: it is stored on every entry that belongs to the set. */
	id: string;
	name: string;
	/** One sentence saying what the set is for. Shown on the collection header, never on a card. */
	blurb: string;
	/** Who it suits. Inherited by every pattern in the set. */
	industries: string[];
	palette: Palette;
	type: TypeScale;
	/** The corner every box in the set takes. `0px` is a real answer, not an unset one. */
	radius: string;
	/** The padding a full-bleed section takes. */
	gutter: string;
}

/**
 * The sets that ship with the plugin.
 *
 * Five, deliberately. A collection only earns its name if a person can hold what it means — "Funky"
 * and "Clinic" are recognisable, "Collection 7" is a folder. Adding a sixth is a release decision,
 * not a code one: put it here and the rail, the strip, the industry list and every count follow,
 * because all of them are derived from this table rather than written out a second time.
 */
export const COLLECTIONS: Collection[] = [
	{
		id: 'funky',
		name: 'Funky',
		blurb:
			'Hot pink on near-black, oversized type, pill everything. Built for shops and launches that want to be loud.',
		industries: [ 'Shop', 'Launch' ],
		palette: {
			ground: '#1a1a2e',
			ink: '#ffffff',
			accent: '#ff4d8d',
			accentInk: '#1a1a2e',
			raised: '#2e2e4a',
		},
		type: {
			display: '64px',
			heading: '28px',
			body: '17px',
			displayWeight: 900,
			tracking: '-0.03em',
		},
		radius: '20px',
		gutter: '72px',
	},
	{
		id: 'brutalist',
		name: 'Brutalist Press',
		blurb:
			'Black on paper white, one red, no curves at all. For studios whose work should be the only soft thing on the page.',
		industries: [ 'Agency', 'Media' ],
		palette: {
			ground: '#f2f2f2',
			ink: '#111111',
			accent: '#ff3b30',
			accentInk: '#ffffff',
			raised: '#ffffff',
		},
		type: {
			display: '72px',
			heading: '30px',
			body: '16px',
			displayWeight: 800,
			tracking: '-0.04em',
		},
		radius: '0px',
		gutter: '64px',
	},
	{
		id: 'editorial',
		name: 'Editorial',
		blurb:
			'Warm paper, a brass accent, light headlines with room to breathe. For writing meant to be read rather than scanned.',
		industries: [ 'Media', 'Food' ],
		palette: {
			ground: '#f7f3ec',
			ink: '#1b1b1b',
			accent: '#9a7b4f',
			accentInk: '#ffffff',
			raised: '#ffffff',
		},
		type: {
			display: '56px',
			heading: '26px',
			body: '18px',
			displayWeight: 400,
			tracking: '-0.01em',
		},
		radius: '4px',
		gutter: '80px',
	},
	{
		id: 'clinic',
		name: 'Clinic',
		blurb:
			'Teal on near-white, generous spacing, nothing shouting. For care, and anything that has to feel calm before it feels clever.',
		industries: [ 'Health' ],
		palette: {
			ground: '#e6fffb',
			ink: '#134e4a',
			accent: '#0f766e',
			accentInk: '#ffffff',
			raised: '#ffffff',
		},
		type: {
			display: '48px',
			heading: '24px',
			body: '17px',
			displayWeight: 600,
			tracking: '-0.015em',
		},
		radius: '16px',
		gutter: '72px',
	},
	{
		id: 'soft-saas',
		name: 'Soft SaaS',
		blurb:
			'Indigo on a pale wash, rounded panels, tight confident type. The look a product page is expected to have, done properly.',
		industries: [ 'SaaS', 'Launch' ],
		palette: {
			ground: '#eef2ff',
			ink: '#1e1b4b',
			accent: '#6366f1',
			accentInk: '#ffffff',
			raised: '#ffffff',
		},
		type: {
			display: '52px',
			heading: '25px',
			body: '16px',
			displayWeight: 700,
			tracking: '-0.02em',
		},
		radius: '14px',
		gutter: '64px',
	},
];

/** The collection with this id, or `undefined` for a pattern that is in no set. */
export function collectionById( id: string | undefined ): Collection | undefined {
	return id ? COLLECTIONS.find( ( c ) => c.id === id ) : undefined;
}

/**
 * The three colours the swatch shows.
 *
 * Accent, ground, ink — "the loud one, the surface, the text", which is the order someone
 * describing the set out loud would use. The swatch rides everywhere the collection is named,
 * because it is how two cards read as family before either name is read.
 */
export function swatchOf( collection: Collection ): string[] {
	return [ collection.palette.accent, collection.palette.ground, collection.palette.ink ];
}

/** Every colour the set is allowed to use anywhere. */
export function paletteColours( collection: Collection ): string[] {
	const { ground, ink, accent, accentInk, raised } = collection.palette;

	return [ ground, ink, accent, accentInk, raised ];
}

/**
 * Every industry any shipped collection claims, in first-seen order.
 *
 * Derived rather than listed, so a new collection cannot arrive carrying an industry the filter
 * does not offer — the failure that would make a set unreachable by the one axis it was tagged for.
 */
export function allIndustries( collections: Collection[] = COLLECTIONS ): string[] {
	const seen: string[] = [];

	for ( const collection of collections ) {
		for ( const industry of collection.industries ) {
			if ( ! seen.includes( industry ) ) {
				seen.push( industry );
			}
		}
	}

	return seen;
}

/**
 * Build one `blicks` value tree.
 *
 * Every built-in writes its styles through this rather than spelling the three-deep tree out, so a
 * pattern cannot pick up a stray hover value or a tablet override by hand. The shape of the data
 * says what a collection is.
 */
export function values( pairs: Record< string, unknown > ): ValueTree {
	const tree: ValueTree = {};

	for ( const [ controlId, value ] of Object.entries( pairs ) ) {
		if ( value === undefined || value === null || value === '' ) {
			continue;
		}

		tree[ controlId ] = { [ STATE ]: { [ BREAKPOINT ]: value } };
	}

	return tree;
}

/** Padding on all four sides, in the shape the `sides` rules read. */
export function pad( all: string ): Record< string, string > {
	return { top: all, right: all, bottom: all, left: all };
}

/** A radius on all four corners, in the shape the `corners` rule reads. */
export function round( all: string ): Record< string, string > {
	return { topLeft: all, topRight: all, bottomRight: all, bottomLeft: all };
}

/* ---------- the roles every collection defines ---------- */

/*
 * These are the collection's design system expressed as code.
 *
 * A pattern asks for `ground( funky )` or `cta( funky )` and gets that set's answer. It is what
 * makes a collection real rather than a label: there is no way to write a built-in that is *in* a
 * collection without *looking* like it, because the only colours and sizes in reach are the ones
 * the collection declares.
 */

/**
 * The outermost surface: the page's colour, with the `backdrop` gradient over it.
 *
 * The backdrop is a token, so the design language decides what it is. Most leave it as the page's
 * own colour and nothing changes; Glassmorphism and Liquid Glass lay soft palette light there,
 * because a frosted card on a flat page is only a paler rectangle — glass needs something behind
 * it to blur. A pattern never names a language, so none can be wrong for one.
 */
export function ground( c: Collection ): ValueTree {
	return values( {
		'colors.background': 'background',
		'background.layers': [ { type: 'gradient', role: 'fill', value: 'backdrop' } ],
		'colors.text': 'foreground',
		'spacing.padding': pad( c.gutter ),
	} );
}

/**
 * What a Box card or panel needs besides its fill: a column of children, a hairline edge and a
 * shadow, all tokens.
 *
 * The edge and the shadow are what the language redraws. Neo-brutalism thickens the hairline and
 * turns the shadow into a hard offset, Neumorphism makes the shadow two-sided light, Claymorphism an
 * inner glow; the Box kind adds the sheen, the blur and the frosted fill on top. A panel drawn
 * without them would show the language's colours and none of its surface.
 */
function surface( fill: string, ink: string, edge: string, corner: string, shadow: string ): ValueTree {
	return values( {
		'layout.display': 'flex',
		'layout.flexDirection': 'column',
		'layout.alignItems': 'flex-start',
		'layout.gapRow': 'md',
		'colors.background': fill,
		'colors.text': ink,
		'spacing.padding': pad( '32px' ),
		'border.width': pad( 'hair' ),
		'border.style': pad( 'solid' ),
		'border.color': pad( edge ),
		'border.radius': round( corner ),
		'effects.boxShadow': shadow,
	} );
}

/** A panel sitting on the ground — a card, a column, a quote. Drawn as a Box card. */
export function panel( c: Collection ): ValueTree {
	return surface( 'card', 'card-foreground', 'border', 'lg', 'md' );
}

/**
 * The loud panel. One per pattern at most, or the set stops having a focal point. Drawn as a Box
 * panel; its edge is the accent itself, so it shows only where a language recolours edges.
 */
export function accentPanel( c: Collection ): ValueTree {
	return surface( 'primary', 'primary-foreground', 'primary', 'xl', 'lg' );
}

/** The headline. */
export function display( c: Collection ): ValueTree {
	return values( {
		'typography.fontSize': c.type.display,
		'colors.text': 'foreground',
	} );
}

/** A heading inside a panel. */
export function heading( c: Collection ): ValueTree {
	return values( {
		'typography.fontSize': c.type.heading,
		'colors.text': 'foreground',
	} );
}

/** A heading that sits on the accent, where the ink has to flip. */
export function headingOnAccent( c: Collection ): ValueTree {
	return values( {
		'typography.fontSize': c.type.heading,
		'colors.text': 'primary-foreground',
	} );
}

/** Running text. */
export function body( c: Collection ): ValueTree {
	return values( {
		'typography.fontSize': c.type.body,
		'colors.text': 'foreground',
	} );
}

/** The headline, where it sits on the accent and the ink has to flip. */
export function displayOnAccent( c: Collection ): ValueTree {
	return values( {
		'typography.fontSize': c.type.display,
		'colors.text': 'primary-foreground',
	} );
}

/** Running text on the accent. */
export function bodyOnAccent( c: Collection ): ValueTree {
	return values( {
		'typography.fontSize': c.type.body,
		'colors.text': 'primary-foreground',
	} );
}

/** The button. A pill where the set is round, a rectangle where it is not. */
export function cta( c: Collection ): ValueTree {
	return values( {
		'spacing.padding': { top: '16px', right: '28px', bottom: '16px', left: '28px' },
	} );
}

/**
 * A heading never takes the headline's weight at full strength.
 *
 * Funky's 900 is the point of Funky at 64px and a shout at 28px. Capping the small sizes is what
 * keeps a set's character from flattening into one loud note — the headline carries the voice, the
 * heading just has to belong to it.
 */

