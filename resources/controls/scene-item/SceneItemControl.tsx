import { __ } from '@wordpress/i18n';
import { getValue, setValue } from '@/framework/values';
import { CellField } from '@/controls/scene-child/CellField';
import './scene-item.scss';

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
}

/**
 * A share of the box, or `auto`.
 *
 * Percentages, because the box this sits in is a cell rectangle whose pixel size changes whenever
 * the grid is re-tracked or the box re-spanned. An inset in pixels would be correct exactly once.
 *
 * `auto` is kept for the sizes and refused for the offsets: a line of text sizing to its own
 * content is the common case, while an `auto` left offset means nothing here — the item is
 * absolutely placed and would fall back to wherever the box's flow put it.
 */
const SHARE = /^-?\d+(\.\d+)?%$/;

export function cleanShare( value: string ): string {
	const trimmed = value.trim();

	if ( SHARE.test( trimmed ) ) {
		return trimmed;
	}

	// A bare number is read as a percentage, which is what somebody typing `40` into a field
	// labelled "X" means. Anything else is discarded rather than guessed at.
	return /^-?\d+(\.\d+)?$/.test( trimmed ) ? `${ trimmed }%` : '';
}

export function cleanSize( value: string ): string {
	const trimmed = value.trim();

	return 'auto' === trimmed ? trimmed : cleanShare( trimmed );
}

/**
 * Scene-item control — where a block sits inside its parent Scene box.
 *
 * Shown only inside a box (see the `scene-box-parent` context in Inspector.tsx). The second of the
 * two placement models: a box occupies CELLS on the stage's grid, and what goes inside a box is
 * placed FREELY as a share of it. The grid keeps the composition legible when the stage changes
 * shape; inside a box there is nothing to keep legible, so nothing is constrained.
 *
 * The numbers are for precision, not for primary use — placement is a drag on the canvas. This is
 * where you check a value or type one you already know.
 */
export function SceneItemControl( { attributes, setAttributes, state, breakpoint }: Props ) {
	const read = ( id: string ) => String( getValue( attributes, id, state, breakpoint ) ?? '' );

	const write = ( id: string, value: string ) =>
		setValue( attributes, setAttributes, id, state, breakpoint, value || undefined );

	return (
		<div className="bl-scene-item bl-layout">
			<div className="grid2">
				<CellField
					label="X"
					value={ read( 'sceneItem.x' ) }
					placeholder="0%"
					onCommit={ ( v ) => write( 'sceneItem.x', cleanShare( v ) ) }
					onReset={ () => write( 'sceneItem.x', '' ) }
				/>
				<CellField
					label="Y"
					value={ read( 'sceneItem.y' ) }
					placeholder="0%"
					onCommit={ ( v ) => write( 'sceneItem.y', cleanShare( v ) ) }
					onReset={ () => write( 'sceneItem.y', '' ) }
				/>
			</div>

			<div className="grid2">
				<CellField
					label={ __( 'Width', 'blicks' ) }
					value={ read( 'sceneItem.width' ) }
					placeholder="auto"
					onCommit={ ( v ) => write( 'sceneItem.width', cleanSize( v ) ) }
					onReset={ () => write( 'sceneItem.width', '' ) }
				/>
				<CellField
					label={ __( 'Height', 'blicks' ) }
					value={ read( 'sceneItem.height' ) }
					placeholder="auto"
					onCommit={ ( v ) => write( 'sceneItem.height', cleanSize( v ) ) }
					onReset={ () => write( 'sceneItem.height', '' ) }
				/>
			</div>
		</div>
	);
}
