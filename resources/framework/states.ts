/** The interactive states a control value can vary across. Blocks opt into a subset. */
export const STATES = [ 'default', 'hover', 'focus', 'active' ] as const;
export type State = ( typeof STATES )[ number ];

export const STATE_LABELS: Record< string, string > = {
	default: 'Default',
	hover: 'Hover',
	focus: 'Focus',
	active: 'Active',
};

/**
 * The same states, labelled for a block **element** (a Button's icon, say). An element's states
 * resolve against the BLOCK, not the element — hovering the button is what moves its icon — so the
 * labels have to say so, or "Hover" reads as "hover the icon" and the author sets the wrong thing.
 */
export const ELEMENT_STATE_LABELS: Record< string, string > = {
	default: 'Default',
	hover: 'On block hover',
	focus: 'On block focus',
	active: 'On block press',
};

/** Pseudo-class suffix for a state ('' for default). */
export function stateSuffix( state: string ): string {
	return state === 'default' ? '' : `:${ state }`;
}
