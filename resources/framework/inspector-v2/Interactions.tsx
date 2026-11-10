import { __ } from '@wordpress/i18n';
import { Chips, Row, SegText, Sec, Slider, Switch, type Option } from './kit';
import { readInteractions, writeInteractions, type Interactions } from './interaction-model';
import type { Tree } from './style-model';

/** The design system's animations, as the editor settings carry them. */
function library(): Option[] {
	const list = ( window as unknown as { blicksEditorSettings?: { animations?: Array< { name?: string; label?: string } > } } ).blicksEditorSettings?.animations;
	return ( Array.isArray( list ) ? list : [] ).filter( ( a ) => typeof a?.name === 'string' && a.name ).map( ( a ) => [ a.name!, a.label || a.name! ] );
}

/**
 * Studio-only: behaviours a block runs on the front end. Each writes a custom attribute the
 * interactions runtime reads, plus the style it needs; the look of each state is styled as usual.
 */
export function InteractionsSec( { attributes, setAttributes }: { attributes: any; setAttributes: ( a: any ) => void } ) {
	const tree: Tree = attributes.blicks ?? {};
	const now = readInteractions( attributes.htmlAttributes, tree );
	const set = ( patch: Partial< Interactions > ) => setAttributes( writeInteractions( attributes.htmlAttributes, tree, { ...now, ...patch } ) );
	const animations = library();

	return (
		<Sec title={ __( 'Interactions', 'blicks' ) } icon="touch_app">
			<Switch label={ __( 'Follows the pointer', 'blicks' ) } checked={ now.follow !== null } onChange={ ( on ) => set( { follow: on ? 12 : null, move: on } ) } />
			{ now.follow !== null && (
				<>
					<Slider label={ __( 'Leans', 'blicks' ) } min={ 2 } max={ 40 } value={ now.follow } onChange={ ( follow ) => set( { follow } ) } />
					<Switch label={ __( 'Move the block', 'blicks' ) } hint={ __( 'Off: only its decorations and inner blocks can use the pointer position', 'blicks' ) } checked={ now.move } onChange={ ( move ) => set( { move } ) } />
				</>
			) }
			<Switch label={ __( 'Replays an animation when pressed', 'blicks' ) } checked={ !! now.replay } onChange={ ( on ) => set( { replay: on ? { name: animations[ 0 ]?.[ 0 ] ?? 'bl-zoom-in', duration: '600ms' } : null } ) } />
			{ now.replay && (
				<>
					<Row label={ __( 'Animation', 'blicks' ) } stack set>
						<Chips label={ __( 'Animation', 'blicks' ) } options={ animations } value={ now.replay.name } onChange={ ( name ) => set( { replay: { ...now.replay!, name } } ) } />
					</Row>
					<Slider label={ __( 'Length', 'blicks' ) } min={ 150 } max={ 2000 } step={ 50 } unit="ms" value={ Number.parseInt( now.replay.duration, 10 ) || 600 } onChange={ ( ms ) => set( { replay: { ...now.replay!, duration: `${ ms }ms` } } ) } />
				</>
			) }
			<Switch label={ __( 'Turns on and off when clicked', 'blicks' ) } checked={ !! now.toggle } onChange={ ( on ) => set( { toggle: on ? 'self' : null } ) } />
			{ now.toggle && (
				<>
					<Row label={ __( 'What turns', 'blicks' ) } set>
						<SegText label={ __( 'What turns', 'blicks' ) } options={ [ [ 'self', __( 'Itself', 'blicks' ) ], [ 'card', __( 'Its card', 'blicks' ) ] ] } value={ now.toggle } onChange={ ( toggle ) => set( { toggle: toggle as 'self' | 'card' } ) } />
					</Row>
					<Row label={ __( 'A click', 'blicks' ) } stack set={ !! now.set } note={ now.set ? __( 'One of a pair: give the other option the opposite.', 'blicks' ) : now.toggle === 'card' && ! now.keep ? __( 'Opens its card, e.g. to show a menu. Escape or a click outside closes it.', 'blicks' ) : __( 'Its On look is the On state, styled like hover.', 'blicks' ) } noteIcon="info">
						<SegText label={ __( 'A click', 'blicks' ) } options={ [ [ '', __( 'Switches', 'blicks' ) ], [ 'on', __( 'Turns on', 'blicks' ) ], [ 'off', __( 'Turns off', 'blicks' ) ] ] } value={ now.set ?? '' } onChange={ ( v ) => set( { set: ( v || null ) as Interactions[ 'set' ] } ) } />
					</Row>
					{ now.toggle === 'card' && ! now.set && (
						<Switch label={ __( 'Stays on', 'blicks' ) } hint={ __( 'A mode, like Night or Yearly: Escape and clicks elsewhere leave it on', 'blicks' ) } checked={ now.keep } onChange={ ( keep ) => set( { keep } ) } />
					) }
				</>
			) }
		</Sec>
	);
}
