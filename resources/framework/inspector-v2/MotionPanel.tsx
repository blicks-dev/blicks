import { __ } from '@wordpress/i18n';
import { useSelect } from '@wordpress/data';
import { doorFor } from './all-settings-model';
import { requestFocus } from './design-focus';
import { InteractionsSec } from './Interactions';
import { Chips, Note, Opts, SegText, Sec, Slider, type Option, Row } from './kit';
import { readStyle, writeStyle, type Look, type Tree } from './style-model';
import { loops, readCalm, withCalm, withEntrance, readEntrance, type Calm, type CalmLook, type Entrance } from './motion-model';

const ENTRANCES: Option< Entrance >[] = [
	[ 'none', __( 'None', 'blicks' ), 'M6 12h12' ],
	[ 'fade', __( 'Fade in', 'blicks' ), 'M4 12h2M9 12h2M14 12h2M19 12h1' ],
	[ 'rise', __( 'Rise', 'blicks' ), 'M12 19V5M7 10l5-5 5 5' ],
	[ 'zoom', __( 'Zoom', 'blicks' ), 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5' ],
];

/**
 * The Motion tab: how the block arrives, and how its hover and click changes move. The timing is
 * part of the look (one `transition` for every state), so it is written through the style model.
 */
export function MotionPanel( { attributes, setAttributes, linked, kind = 'box', timed = true }: { attributes: any; setAttributes: ( a: any ) => void; linked: boolean; kind?: string; timed?: boolean } ) {
	const tree: Tree = attributes.blicks ?? {};
	const { look } = readStyle( tree, { linked, kind } );
	const set = ( patch: Partial< Look > ) => setAttributes( { blicks: writeStyle( tree, { ...look, ...patch }, { linked, kind } ) } );
	// Interactions are a Studio tool, like Decorations: the post editor keeps the simpler panel.
	const inStudio = useSelect( ( select: any ) => !! select( 'core/block-editor' ).getSettings()?.blicksStudio, [] );
	// The inspector only ever shows the selected block. Read through the data store rather than
	// `@wordpress/block-editor`, which this module's node-run tests cannot load (it needs `window`).
	const clientId: string = useSelect( ( select: any ) => select( 'core/block-editor' ).getSelectedBlockClientId() ?? '', [] );
	// The Studio's door: the entrance's keyframes and timing, in the design panel's Motion tab.
	const entrance = inStudio && clientId ? doorFor( 'entrance', [] ) : null;
	const moves = look.hover !== 'none' || ( linked && look.press !== 'none' ) || !! look.focus || !! look.depth;

	return (
		<>
			<Sec title={ __( 'Entrance', 'blicks' ) } icon="animation" { ...( entrance ? { onFineTune: () => requestFocus( { clientId, ...entrance } ) } : {} ) }>
				<Row label={ __( 'Effect', 'blicks' ) } stack set={ readEntrance( tree ) !== 'none' && !! readEntrance( tree ) } note={ __( 'Plays as it scrolls into view.', 'blicks' ) } noteIcon="info">
					<Chips label={ __( 'Entrance', 'blicks' ) } options={ ENTRANCES } value={ readEntrance( tree ) } onChange={ ( e ) => setAttributes( { blicks: withEntrance( tree, e ) } ) } />
				</Row>
			</Sec>
			{ /* Only a block whose Style tab has hover and click looks has something to time. */ }
			{ timed && (
			<Sec title={ __( 'Hover and click', 'blicks' ) } icon="arrow_selector_tool">
				{ ! moves && <Note>{ __( 'Nothing changes on hover or click yet — pick a look under Style › States.', 'blicks' ) }</Note> }
				<Row label={ __( 'Speed', 'blicks' ) } stack set={ !! look.speed }>
				<Opts columns={ 4 } value={ look.speed } onChange={ ( speed ) => set( { speed: speed as Look[ 'speed' ] } ) } options={ ( [ [ 'instant', __( 'Instant', 'blicks' ), 60 ], [ 'quick', __( 'Quick', 'blicks' ), 150 ], [ 'smooth', __( 'Smooth', 'blicks' ), 260 ], [ 'slow', __( 'Slow', 'blicks' ), 450 ] ] as const ).map( ( [ v, l, ms ] ) => [ v, l, <span key={ v } className="spd"><i style={ { animationDuration: `${ ms * 4 }ms` } } /></span> ] ) } />
				</Row>
				<Row label={ __( 'Feel', 'blicks' ) } stack set={ !! look.feel }>
				<Opts columns={ 3 } value={ look.feel } onChange={ ( feel ) => set( { feel: feel as Look[ 'feel' ] } ) } options={ ( [ [ 'ease', __( 'Gentle', 'blicks' ), 'M2 18C14 18 18 2 38 2' ], [ 'spring', __( 'Springy', 'blicks' ), 'M2 18C10 18 14 -4 26 4S34 2 38 2' ], [ 'steady', __( 'Steady', 'blicks' ), 'M2 18L38 2' ] ] as const ).map( ( [ v, l, d ] ) => [ v, l, <svg key={ v } viewBox="0 0 40 20" width="36" height="18" aria-hidden="true"><path d={ d } fill="none" stroke="currentColor" strokeWidth="2" /></svg> ] ) } />
				</Row>
			</Sec>
			) }
			{ /* Studio only, a block-only section: after the fixed ones, before Reduced motion. */ }
			{ inStudio && <InteractionsSec attributes={ attributes } setAttributes={ setAttributes } /> }
			{ /* Fixed order: Entrance, Hover and click, then Reduced motion. */ }
			{ loops( tree ) && <CalmSec tree={ tree } setTree={ ( blicks ) => setAttributes( { blicks } ) } /> }
		</>
	);
}

const CALMS: Option< Calm >[] = [ [ 'still', __( 'Still', 'blicks' ) ], [ 'hide', __( 'Hide', 'blicks' ) ], [ 'custom', __( 'Custom', 'blicks' ) ] ];

/** For a block that keeps moving: how it rests for someone who reduces motion. */
function CalmSec( { tree, setTree }: { tree: Tree; setTree: ( t: Tree ) => void } ) {
	const calm = readCalm( tree );
	const set = ( patch: Partial< CalmLook > ) => setTree( withCalm( tree, { ...calm, ...patch } ) );
	return (
		<Sec title={ __( 'Reduced motion', 'blicks' ) } icon="motion_photos_off">
			<Row label={ __( 'Then', 'blicks' ) } set={ calm.mode !== 'still' }>
			<SegText label={ __( 'When motion is reduced', 'blicks' ) } options={ CALMS } value={ calm.mode } onChange={ ( mode ) => set( mode === 'custom' && calm.mode !== 'custom' ? { mode, size: 100, opacity: 50 } : { mode } ) } />
			</Row>
			{ calm.mode === 'custom' && (
				<>
					<Slider label={ __( 'Size', 'blicks' ) } min={ 50 } max={ 300 } step={ 5 } unit="%" value={ calm.size } onChange={ ( size ) => set( { size } ) } />
					<Slider label={ __( 'Opacity', 'blicks' ) } min={ 0 } max={ 100 } step={ 5 } unit="%" value={ calm.opacity } onChange={ ( opacity ) => set( { opacity } ) } />
				</>
			) }
			<Note>{ calm.mode === 'still' ? __( 'It stops and keeps its normal look.', 'blicks' ) : calm.mode === 'hide' ? __( 'It is hidden for people who reduce motion.', 'blicks' ) : __( 'It stops and rests at this size and fade.', 'blicks' ) }</Note>
		</Sec>
	);
}
