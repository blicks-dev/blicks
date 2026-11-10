import { useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { getValue, setValue, setValueSlots } from '@/framework/values';
import { CellField } from '@/controls/scene-child/CellField';
import { DEFAULT_TRACKS } from '@/controls/scene-child/cells';
import './scene-grid.scss';

interface Props {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
}

/**
 * How large the picker is, which is not the same as how large a grid may be.
 *
 * Sixteen is what fits a rail at a touchable cell size while still covering every track count
 * anyone reaches for by dragging. A grid bigger than this is set by typing, not by aiming at a
 * square — so the picker does not pretend to offer it rather than shrinking every cell to spite.
 */
const PICKER = 16;

/**
 * Scene grid control — the stage's track counts and the look its boxes inherit.
 *
 * **Picked, not typed.** Columns and rows are one gesture over a matrix: hover to preview, click
 * to set, with the result read back as `3×3` beside the title. Two number fields are more precise
 * and worse — the grid is a shape, and a shape is something you recognise rather than compute, so
 * the control shows the shape you are about to get.
 *
 * Written to the base slot only. A stage whose track count changed per breakpoint would move every
 * child's meaning with it — `col: 8` is a different place on a ten-track grid than on a twelve —
 * so the grid stays fixed and the CHILDREN carry the per-breakpoint placement.
 */
export function SceneGridControl( { attributes, setAttributes }: Props ) {
	const read = ( id: string ) => String( getValue( attributes, id, 'default', 'base' ) ?? '' );

	const write = ( id: string, value: string ) =>
		setValue( attributes, setAttributes, id, 'default', 'base', value || undefined );

	const cols = parseInt( read( 'scene.cols' ), 10 ) || DEFAULT_TRACKS;
	const rows = parseInt( read( 'scene.rows' ), 10 ) || DEFAULT_TRACKS;

	/** What the pointer is currently over, or null when it has left the matrix. */
	const [ hover, setHover ] = useState< { cols: number; rows: number } | null >( null );

	/*
	 * Both counts in ONE write.
	 *
	 * They are two controls and a single gesture, and two separate `setValue` calls would each
	 * derive from the same stale snapshot of the attributes — only the second would survive, so a
	 * pick of 4×2 would land as 3×2. `setValueSlots` is the whole reason this is not two writes.
	 */
	const pick = ( nextCols: number, nextRows: number ) =>
		setValueSlots( attributes, setAttributes, [
			{ controlId: 'scene.cols', state: 'default', breakpoint: 'base', value: String( nextCols ) },
			{ controlId: 'scene.rows', state: 'default', breakpoint: 'base', value: String( nextRows ) },
		] );

	const shown = hover ?? { cols, rows };

	return (
		<div className="bl-scene-grid bl-layout">
			<div className="bl-scene-grid__head">
				<span className="sub">{ __( 'Grid', 'blicks' ) }</span>
				{ /*
				 * Columns × rows, in that order, matching how every other pair in this plugin reads
				 * and how the control ids are named. It tracks the HOVER while the pointer is over
				 * the matrix, so the number confirms the shape before the click commits it.
				 */ }
				<span className="bl-scene-grid__readout">
					{ sprintf(
						/* translators: 1: number of columns, 2: number of rows. */
						__( '%1$d×%2$d', 'blicks' ),
						shown.cols,
						shown.rows
					) }
				</span>
			</div>

			<div
				className="bl-scene-grid__matrix"
				role="group"
				aria-label={ __( 'Grid size', 'blicks' ) }
				onMouseLeave={ () => setHover( null ) }
			>
				{ Array.from( { length: PICKER * PICKER }, ( _, index ) => {
					const col = ( index % PICKER ) + 1;
					const row = Math.floor( index / PICKER ) + 1;

					const within = col <= shown.cols && row <= shown.rows;
					const isSet = col <= cols && row <= rows;

					return (
						<button
							key={ index }
							type="button"
							className={ [
								'bl-scene-grid__cell',
								within ? 'is-within' : '',
								// Kept visible under a hover that would shrink the grid, so the
								// cells about to be GIVEN UP read differently from the ones about
								// to be taken. Picking a smaller grid is the destructive direction
								// and the one worth showing.
								isSet && ! within ? 'is-losing' : '',
							]
								.filter( Boolean )
								.join( ' ' ) }
							aria-label={ sprintf(
								/* translators: 1: number of columns, 2: number of rows. */
								__( '%1$d by %2$d', 'blicks' ),
								col,
								row
							) }
							aria-pressed={ col === cols && row === rows }
							onMouseEnter={ () => setHover( { cols: col, rows: row } ) }
							onFocus={ () => setHover( { cols: col, rows: row } ) }
							onClick={ () => pick( col, row ) }
						/>
					);
				} ) }
			</div>

			{ /*
			 * "Overrides" because each of these has a sensible value the Scene already uses — these
			 * fields are where an author departs from it, not where the value comes from. Left
			 * empty they fall back to the stylesheet's own defaults rather than to zero.
			 */ }
			<p className="bl-scene-grid__group">{ __( 'Overrides', 'blicks' ) }</p>

			<div className="grid2">
				<CellField
					label={ __( 'Boxes gap', 'blicks' ) }
					value={ read( 'scene.gap' ) }
					placeholder="16px"
					onCommit={ ( v ) => write( 'scene.gap', v.trim() ) }
					onReset={ () => write( 'scene.gap', '' ) }
				/>
				<CellField
					label={ __( 'Boxes padding', 'blicks' ) }
					value={ read( 'scene.padding' ) }
					placeholder="0"
					onCommit={ ( v ) => write( 'scene.padding', v.trim() ) }
					onReset={ () => write( 'scene.padding', '' ) }
				/>
			</div>

			<div className="grid2">
				<CellField
					label={ __( 'Box radius', 'blicks' ) }
					value={ read( 'scene.boxRadius' ) }
					placeholder="16px"
					onCommit={ ( v ) => write( 'scene.boxRadius', v.trim() ) }
					onReset={ () => write( 'scene.boxRadius', '' ) }
				/>
			</div>
		</div>
	);
}
