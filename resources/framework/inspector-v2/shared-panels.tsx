import type { InspectorPanels, PanelProps } from './InspectorV2';
import { MotionPanel } from './MotionPanel';
import { StylePanel } from './StylePanel';

/** The shared Style tab, as a plain box: fill, border and corners, shadow, space, text. */
function SharedStyle( { attributes, setAttributes }: PanelProps ) {
	return <StylePanel attributes={ attributes } setAttributes={ setAttributes } kind="box" linked={ false } />;
}

/** The shared Motion tab: entrance, and how hover changes move. */
function SharedMotion( { attributes, setAttributes }: PanelProps ) {
	return <MotionPanel attributes={ attributes } setAttributes={ setAttributes } linked={ false } kind="box" />;
}

/**
 * A companion block's panels, with the shared Style and Motion tabs filled in.
 *
 * `StylePanel` and `MotionPanel` are not on the Extension API, so a companion block passing
 * `panels: { Settings }` used to get no Style or Motion tab at all: its `supports.blicks.controls`
 * (spacing, background, border…) existed in the engine but had nowhere to be set. It now gets the
 * same box panels a Blicks box has, which read the block's own allow-list for their "all settings"
 * view. A companion that supplies its own Style or Motion keeps it, and `tabsFor` still hides a tab.
 *
 * Blicks' own blocks are left as they are: each decides its tabs itself.
 */
export function withSharedPanels( panels: InspectorPanels, name: string, hasControls: boolean ): InspectorPanels {
	if ( name.startsWith( 'blicks/' ) || ! hasControls ) {
		return panels;
	}

	return {
		...panels,
		Style: panels.Style ?? SharedStyle,
		Motion: panels.Motion ?? SharedMotion,
	};
}
