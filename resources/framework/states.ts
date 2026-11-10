import { STATE_PSEUDO } from '@/engine/schema.gen';

/** The interactive states a control value can vary across. Blocks opt into a subset. */
export const STATES = [ 'default', 'group', 'groupActive', 'hover', 'focus', 'active', 'play', 'on', 'groupOn', 'reduced' ] as const;
export type State = ( typeof STATES )[ number ];

export const STATE_LABELS: Record< string, string > = {
	default: 'Default',
	group: 'Card hovered',
	groupActive: 'Card pressed',
	hover: 'Hover',
	focus: 'Focus',
	active: 'Active',
	play: 'Playing',
	on: 'On',
	groupOn: 'Card on',
	reduced: 'Motion reduced',
};

/**
 * Pseudo-class suffix for a state ('' for default), from the engine schema so tier 3 writes the
 * same selector runtime.scss does. `focus` is keyboard focus — `:focus-visible`, or a linked box
 * whose overlay link has it — never the `:focus` a mouse click also sets.
 */
export function stateSuffix( state: string ): string {
	return STATE_PSEUDO[ state ] ?? '';
}
