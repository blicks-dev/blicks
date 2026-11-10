/**
 * The **part** axis — which box on the element a control value styles.
 *
 * `element` is the block's own box. The others are pseudo-elements (declared in
 * resources/engine/schema.json → `parts`), styled through the same controls: a value in a part slot
 * writes the pseudo-element instead of the element.
 *
 * ## Why parts are not just more states
 *
 * States are a **tier-1/2** axis: runtime.scss loops `$states` across the whole style map, so
 * `:hover` costs a static rule per control that every page shares. Crossing two pseudo-elements
 * with four states and three breakpoints would add ~2500 selectors — roughly doubling the runtime
 * stylesheet on every page, including the ones with no pseudo-elements on them.
 *
 * So a part slot routes to **tier-3 scoped CSS** instead (`.bl-{uniqueId}::before{…}`), emitted
 * per instance and only where it is used. That also makes part × state free: `:hover::before` is
 * one more selector on one block, not another static tier.
 *
 * ## Slot keys
 *
 * Part and state share one level of the value tree (`blicks[controlId][slot][breakpoint]`):
 *
 * ```
 * 'default'       → element, base state
 * 'hover'         → element, :hover
 * 'before'        → ::before, base state
 * 'before:hover'  → ::before while the element is hovered
 * ```
 *
 * A state on a part is the **element's** state: `.bl-{id}:hover::before`. The other order,
 * `::before:hover`, is legal in Selectors 4 but Chrome drops the whole rule, so it would be dead CSS.
 *
 * Compose and split slots with `slotId()` / `parseSlot()`, never by string-munging. PHP mirror:
 * src/Style/Parts.php.
 */

import { PARTS, STATE_ANCESTOR, STATE_CONTROLS, STATE_MEDIA } from '@/engine/schema.gen';
import { STATES, stateSuffix } from './states';

export const ELEMENT_PART = 'element';

/** Every part id, the element first. */
export const PART_IDS: readonly string[] = [ ELEMENT_PART, ...Object.keys( PARTS ) ];

export function isPart( id: string ): boolean {
	return id === ELEMENT_PART || id in PARTS;
}

/** The selector suffix a part adds after `.bl-{uniqueId}` — `''` for the element itself. */
export function partSuffix( id: string ): string {
	return PARTS[ id ] ?? '';
}

/** Compose the value-tree slot key for a (part, state) pair. Both defaults elide. */
export function slotId( part: string, state: string ): string {
	const p = part && part !== ELEMENT_PART ? part : '';
	const s = state && state !== 'default' ? state : '';
	if ( ! p ) return s || 'default';
	return s ? `${ p }:${ s }` : p;
}

/**
 * Split a slot key back into its part and state.
 *
 * An unrecognised key resolves to the element's base state, mirroring how the emitters treat an
 * unknown state key — a value under a slot this build does not know styles the element rather
 * than vanishing.
 */
export function parseSlot( slot: string ): { part: string; state: string } {
	const states = STATES as readonly string[];
	const colon = slot.indexOf( ':' );
	if ( colon > -1 ) {
		const part = slot.slice( 0, colon );
		const state = slot.slice( colon + 1 );
		return {
			part: isPart( part ) ? part : ELEMENT_PART,
			state: states.includes( state ) ? state : 'default',
		};
	}
	if ( states.includes( slot ) ) return { part: ELEMENT_PART, state: slot };
	if ( isPart( slot ) ) return { part: slot, state: 'default' };
	return { part: ELEMENT_PART, state: 'default' };
}

export function isElementSlot( slot: string ): boolean {
	return parseSlot( slot ).part === ELEMENT_PART;
}

/**
 * The selector suffix a slot contributes after `.bl-{uniqueId}` — e.g. `:hover::before`. The state
 * comes first: Chrome rejects a pseudo-class after a pseudo-element.
 */
export function slotSelectorSuffix( slot: string ): string {
	const { part, state } = parseSlot( slot );
	// An ancestor-selected state cannot be a suffix; it is marked, and `selectorFor()` expands it.
	if ( STATE_ANCESTOR[ state ] ) return `@${ state }${ partSuffix( part ) }`;
	// A media-selected state is no selector at all; it is marked, and the emitter wraps the rule.
	if ( STATE_MEDIA[ state ] ) return `!${ state }${ partSuffix( part ) }`;
	return `${ stateSuffix( state ) }${ partSuffix( part ) }`;
}

/** The media query a slot suffix plays under (`!reduced::after` → its query), or ''. */
export function slotMedia( suffix: string ): string {
	const media = /^!([a-zA-Z]+)/.exec( suffix );
	return media ? STATE_MEDIA[ media[ 1 ]! ] ?? '' : '';
}

/**
 * The full selector for an element (`base`, e.g. `.bl-abc123`) and a slot suffix from
 * `slotSelectorSuffix()`. A plain suffix is appended. An ancestor state (`@group::before`) becomes
 * the nearest-card form runtime.scss's `state-selector()` writes: weightless ancestor, doubled base
 * so it weighs what a hover rule does, and a `:not()` so an outer card never plays an inner card's
 * children. Mirrored by `Parts::selectorFor()`.
 */
export function selectorFor( base: string, suffix: string ): string {
	const media = /^!([a-zA-Z]+)(.*)$/.exec( suffix );
	if ( media && STATE_MEDIA[ media[ 1 ]! ] ) return `${ base }${ media[ 2 ] }`;
	const marked = /^@([a-zA-Z]+)(.*)$/.exec( suffix );
	const ancestor = marked ? STATE_ANCESTOR[ marked[ 1 ]! ] : undefined;

	if ( ! marked || ! ancestor ) return `${ base }${ suffix }`;

	return `:where(${ ancestor.on }) ${ base }${ base }:not(:where(${ ancestor.off }) *)${ marked[ 2 ] }`;
}

/** Can this state style that control? A state `stateControls` limits styles only its own list. */
export function stateAllows( state: string, controlId: string ): boolean {
	const allowed = STATE_CONTROLS[ state ];
	return ! allowed || allowed.includes( controlId );
}

/**
 * A control's value tree without the slots its state may not style. Dropped here, before either
 * tier sees them, so the editor and the front end leave out the same values — runtime.scss has no
 * rule for them, and a class with no rule behind it would be a silent no-op.
 */
export function allowedSlots< T >( controlId: string, tree: Record< string, T > ): Record< string, T > {
	const out: Record< string, T > = {};
	for ( const [ slot, value ] of Object.entries( tree ) ) {
		if ( stateAllows( parseSlot( slot ).state, controlId ) ) out[ slot ] = value;
	}
	return out;
}
