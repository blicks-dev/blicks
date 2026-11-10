/**
 * The Section: the one way of composing the free Studio ships.
 *
 * A tree that flows top to bottom and reflows on a phone. It accepts every tree at priority 0, so it
 * is what anything falls back to when no companion's mode claims it.
 */
import { __ } from '@wordpress/i18n';
import { FlowMode } from './modes/FlowMode';
import type { StudioMode } from './registry';

export const SECTION_MODE: StudioMode = {
	id: 'section',
	label: __( 'Section', 'blicks' ),
	priority: 0,
	matches: () => true,
	Canvas: FlowMode,
	widths: true,
	zoom: true,
};
