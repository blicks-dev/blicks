import { __ } from '@wordpress/i18n';
import { getValue, setValue, setValueSlots } from '@/framework/values';
import { FieldHead, MoreSettings } from '@/controls/common';
import { CellField } from './CellField';
import { cleanCell, cleanRotate, cleanSpan, clean, SCALE_PATTERN, DEFAULT_TRACKS } from './cells';
import './scene-child.scss';

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
}

const ico = ( path: JSX.Element ): JSX.Element => (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
		{ path }
	</svg>
);

/**
 * Span presets, as fractions of whatever the stage's track count happens to be.
 *
 * Fractions rather than fixed numbers because the track count is the author's to change: "half"
 * has to mean six columns on a twelve-track stage and five on a ten-track one. A preset row of
 * `4 · 6 · 12` would be wrong the moment somebody edits the grid.
 */
const SPANS: Array< { label: string; of: number; title: string } > = [
	{ label: '⅓', of: 1 / 3, title: __( 'One third', 'blicks' ) },
	{ label: '½', of: 1 / 2, title: __( 'Half', 'blicks' ) },
	{ label: '⅔', of: 2 / 3, title: __( 'Two thirds', 'blicks' ) },
	{ label: '1', of: 1, title: __( 'Full width', 'blicks' ) },
];

/**
 * Scene-child control — which cells a block occupies on its parent `blicks/scene` stage. Shown
 * only when that parent is a scene (see `useHasSceneParent()` in Inspector.tsx). The stage
 * parallel to `GridChildControl` / `FlexChildControl`, reusing `.bl-layout`'s grid2/sub/sub-row
 * foundation the same way they do.
 *
 * **Placement is a cell rectangle, not a coordinate.** A start column and row, and a span in each
 * axis — all unitless integers. Nothing here stores a pixel, which is what lets a composition
 * reflow when the stage changes size or aspect instead of merely shrinking.
 *
 * These carry per-breakpoint slots, unlike the coordinates they replace: a box can be four columns
 * wide on a desktop and twelve on a phone. That is the one thing a uniformly scaled stage could
 * never express, and the reason the grid is worth the change.
 *
 * The numbers are here for precision, not for primary use — placement is a drag on the canvas,
 * where the grid makes it exact. This panel is where you check a value or type one you already
 * know.
 */
export function SceneChildControl( { attributes, setAttributes, state, breakpoint }: Props ) {
	const read = ( id: string ) => String( getValue( attributes, id, state, breakpoint ) ?? '' );

	const col = read( 'sceneChild.col' );
	const row = read( 'sceneChild.row' );
	const colSpan = read( 'sceneChild.colSpan' );
	const rowSpan = read( 'sceneChild.rowSpan' );
	const scale = read( 'sceneChild.scale' );
	const rotate = read( 'sceneChild.rotate' );

	// The stage's own track count, read from the scene's value rather than assumed. A preset of
	// "half" is meaningless without it, and twelve is only the default — not the contract.
	const cols = parseInt( String( getValue( attributes, 'scene.cols', 'default', 'base' ) ?? '' ), 10 ) || DEFAULT_TRACKS;

	const write = ( id: string, value: string ) =>
		setValue( attributes, setAttributes, id, state, breakpoint, value || undefined );

	/**
	 * A span preset moves the start column too, when it has to.
	 *
	 * Widening a box sitting at column 8 to full width would otherwise put its right edge four
	 * tracks past the stage. Both values go through `setValueSlots` because two separate writes
	 * derive from the same stale snapshot and only the second survives.
	 */
	const applySpan = ( fraction: number ) => {
		const span = Math.max( 1, Math.round( cols * fraction ) );
		const start = Math.min( parseInt( col, 10 ) || 0, cols - span );

		setValueSlots( attributes, setAttributes, [
			{ controlId: 'sceneChild.colSpan', state, breakpoint, value: String( span ) },
			{ controlId: 'sceneChild.col', state, breakpoint, value: start > 0 ? String( start ) : undefined },
		] );
	};

	return (
		<div className="bl-scene-child bl-layout">
			<div className="field">
				<FieldHead
					label={ __( 'Width', 'blicks' ) }
					showReset={ Boolean( colSpan ) }
					onReset={ () => write( 'sceneChild.colSpan', '' ) }
				/>
				<div className="seg-row" role="group" aria-label={ __( 'Span presets', 'blicks' ) }>
					{ SPANS.map( ( preset ) => {
						const span = Math.max( 1, Math.round( cols * preset.of ) );

						return (
							<button
								key={ preset.label }
								type="button"
								aria-pressed={ colSpan === String( span ) }
								className={ colSpan === String( span ) ? 'on' : '' }
								title={ preset.title }
								onClick={ () => applySpan( preset.of ) }
							>
								{ preset.label }
							</button>
						);
					} ) }
				</div>
			</div>

			<div className="grid2">
				<CellField
					label={ __( 'Column', 'blicks' ) }
					value={ col }
					placeholder="0"
					onCommit={ ( v ) => write( 'sceneChild.col', cleanCell( v ) ) }
					onReset={ () => write( 'sceneChild.col', '' ) }
				/>
				<CellField
					label={ __( 'Row', 'blicks' ) }
					value={ row }
					placeholder="0"
					onCommit={ ( v ) => write( 'sceneChild.row', cleanCell( v ) ) }
					onReset={ () => write( 'sceneChild.row', '' ) }
				/>
			</div>

			<div className="grid2">
				<CellField
					label={ __( 'Columns wide', 'blicks' ) }
					value={ colSpan }
					placeholder="1"
					onCommit={ ( v ) => write( 'sceneChild.colSpan', cleanSpan( v ) ) }
					onReset={ () => write( 'sceneChild.colSpan', '' ) }
				/>
				<CellField
					label={ __( 'Rows tall', 'blicks' ) }
					value={ rowSpan }
					placeholder="1"
					onCommit={ ( v ) => write( 'sceneChild.rowSpan', cleanSpan( v ) ) }
					onReset={ () => write( 'sceneChild.rowSpan', '' ) }
				/>
			</div>

			<MoreSettings label={ __( 'Transform', 'blicks' ) } defaultOpen={ Boolean( scale || rotate ) }>
				<div className="grid2">
					<CellField
						label={ __( 'Scale', 'blicks' ) }
						value={ scale }
						placeholder="1"
						onCommit={ ( v ) => write( 'sceneChild.scale', clean( v, SCALE_PATTERN ) ) }
						onReset={ () => write( 'sceneChild.scale', '' ) }
					/>
					<CellField
						label={ __( 'Rotation', 'blicks' ) }
						value={ rotate }
						placeholder="0deg"
						onCommit={ ( v ) => write( 'sceneChild.rotate', cleanRotate( v ) ) }
						onReset={ () => write( 'sceneChild.rotate', '' ) }
					/>
				</div>
			</MoreSettings>
		</div>
	);
}
