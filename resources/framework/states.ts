/** The interactive states a control value can vary across. Blocks opt into a subset. */
export const STATES = [ 'default', 'hover', 'focus', 'active' ] as const;
export type State = ( typeof STATES )[ number ];

export const STATE_LABELS: Record< string, string > = {
	default: 'Default',
	hover: 'Hover',
	focus: 'Focus',
	active: 'Active',
};

/** Pseudo-class suffix for a state ('' for default). */
export function stateSuffix( state: string ): string {
	return state === 'default' ? '' : `:${ state }`;
}
