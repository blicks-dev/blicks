/**
 * The names the inspector shows for a style slot: its state, screen size and part, and why a value
 * was refused. Shared by the design panel and All settings, so neither view imports the other.
 */
import { __ } from '@wordpress/i18n';
import type { StyleProblemReason } from '@/framework/css/vars';
import { ELEMENT } from './all-settings-model';

export const STATE_NAME: Record< string, string > = {
	default: __( 'Normal', 'blicks' ),
	hover: __( 'Hover', 'blicks' ),
	focus: __( 'Focus', 'blicks' ),
	active: __( 'Pressed', 'blicks' ),
	group: __( 'Card hover', 'blicks' ),
	groupActive: __( 'Card pressed', 'blicks' ),
	on: __( 'On', 'blicks' ),
	groupOn: __( 'Card on', 'blicks' ),
	play: __( 'Playing', 'blicks' ),
	reduced: __( 'Reduced motion', 'blicks' ),
};
export const BP_NAME: Record< string, string > = { base: __( 'Desktop', 'blicks' ), tablet: __( 'Tablet', 'blicks' ), mobile: __( 'Phone', 'blicks' ) };
export const PART_NAME: Record< string, string > = { [ ELEMENT ]: __( 'Block', 'blicks' ), before: __( 'Before', 'blicks' ), after: __( 'After', 'blicks' ) };
export const WHY: Record< StyleProblemReason, string > = {
	'unknown-control': __( 'Not a style setting.', 'blicks' ),
	'not-allowed': __( 'This block does not take it.', 'blicks' ),
	'unknown-slot': __( 'Unknown state or part.', 'blicks' ),
	'unknown-breakpoint': __( 'Unknown screen size.', 'blicks' ),
	'not-on-part': __( 'A decoration cannot take it.', 'blicks' ),
	'invalid-value': __( 'Not a value this setting takes.', 'blicks' ),
};
