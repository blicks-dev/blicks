/**
 * What a fill picker edits, and where it stores it.
 *
 * The picker is deliberately ignorant of both. A caller says *which slots exist* — which
 * `controlId` holds the solid colour, which holds the gradient, whether there is an image slot at
 * all — and the picker offers exactly the sources those slots can carry. That is the whole
 * versatility story: colour-only, colour+gradient, or the full three come from the slot map, not
 * from a variant enum that has to grow a case every time a new combination is wanted.
 */

/** The three kinds of paint a fill can be. */
export type FillSource = 'color' | 'gradient' | 'image';

export const FILL_SOURCES: FillSource[] = [ 'color', 'gradient', 'image' ];

/**
 * Which value-tree `controlId` backs each part of a fill. Every key is optional: a missing key
 * means "this picker has no such slot", and the source that needs it is not offered.
 *
 * `size`/`position`/`repeat`/`attachment` are the image's own placement properties, `blendMode`
 * and `clipText` the two that apply across sources. Omit them for a picker that should stay a
 * plain swatch.
 */
export interface FillSlots {
	color?: string;
	gradient?: string;
	image?: string;
	size?: string;
	position?: string;
	repeat?: string;
	attachment?: string;
	blendMode?: string;
	clipText?: string;
}

/** A block's background: everything, stored where the style engine expects it. */
export const BACKGROUND_SLOTS: FillSlots = {
	color: 'colors.background',
	gradient: 'background.gradient',
	image: 'background.image',
	size: 'background.size',
	position: 'background.position',
	repeat: 'background.repeat',
	attachment: 'background.attachment',
	blendMode: 'background.blendMode',
	clipText: 'colors.clipText',
};

/**
 * A text fill. The solid case lands on `colors.text` — a plain `color:` declaration, no background
 * layer and no clip — while a gradient or an image can only be painted as a background, so those
 * keep the `background.*` slots and the clip is managed for the author.
 */
export const TEXT_FILL_SLOTS: FillSlots = {
	...BACKGROUND_SLOTS,
	color: 'colors.text',
};

/**
 * Read/write access to one fill, whatever is behind it.
 *
 * `FillControl` builds this over the block's value tree; a test or a non-block caller can build
 * one over plain state. The editor only ever sees this interface, which is why the same editor
 * renders inline in the Background facet and inside a popover in Typography.
 */
export interface FillBinding {
	slots: FillSlots;
	/** Current value of a slot, or `''`/`null` when unset. Unknown slots read as `''`. */
	get: ( slot: keyof FillSlots ) => any;
	/** Write a slot. Passing `''` clears it. Writing to a slot the picker does not have is a no-op. */
	set: ( slot: keyof FillSlots, value: any ) => void;
	/** Whether the picker has this slot at all. */
	has: ( slot: keyof FillSlots ) => boolean;
}

/** The sources a slot map can actually carry, in display order. */
export function sourcesFor( slots: FillSlots, only?: FillSource[] ): FillSource[] {
	return FILL_SOURCES.filter(
		( source ) => Boolean( slots[ source ] ) && ( ! only || only.includes( source ) )
	);
}
