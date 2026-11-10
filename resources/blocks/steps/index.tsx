import { useEffect } from 'react';
import { useDispatch, useSelect } from '@wordpress/data';
import { __, sprintf } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { getIcon } from '@/framework/icons';
import { iconMaskUrl } from '@/blocks/list/model';
import { StepsMotion, StepsSettings, StepsStyle, StepsToolbar } from './controls';
import { cleanCurrent, cleanLayout, cleanMarker, stepState, stepsClasses, stepsVars } from './model';

const STEP = 'blicks/step';

/** What the status line says for a step, or '' when the Steps block shows none. */
export function statusText( state: string, position: number, total: number ): string {
	if ( state === 'done' ) return __( 'Done', 'blicks' );
	if ( state === 'next' ) return __( 'Upcoming', 'blicks' );
	/* translators: 1: the current step's number, 2: how many steps there are */
	return state === 'cur' ? sprintf( __( 'Step %1$d of %2$d', 'blicks' ), position, total ) : '';
}


/**
 * Each Step saves its own state and status line, so the page needs no script and a screen reader
 * hears `aria-current="step"`. They follow from the current step and the step's place, so they are
 * kept in step here as steps are added, moved or the current one changes — not an undo step.
 */
function useStepStates( { attributes, clientId }: { attributes: any; setAttributes: ( a: any ) => void; clientId: string } ) {
	// A string, so the selector returns an equal value until something it reads changes.
	const key = useSelect( ( select: any ) => {
		const store = select( 'core/block-editor' );
		return JSON.stringify( store.getBlockOrder( clientId ).map( ( id: string ) => [ id, store.getBlockAttributes( id )?.state ?? '', store.getBlockAttributes( id )?.status ?? '' ] ) );
	}, [ clientId ] );
	const { updateBlockAttributes, __unstableMarkNextChangeAsNotPersistent: notPersistent } = useDispatch( 'core/block-editor' ) as any;
	const current = cleanCurrent( attributes.current );
	const showStatus = !! attributes.status;
	useEffect( () => {
		const children: Array< [ string, string, string ] > = JSON.parse( key );
		children.forEach( ( [ id, had, hadStatus ], i ) => {
			const state = stepState( i, current );
			const status = showStatus ? statusText( state, i + 1, children.length ) : '';
			if ( had !== state || hadStatus !== status ) {
				notPersistent?.();
				updateBlockAttributes( id, { state, status } );
			}
		} );
	}, [ key, current, showStatus, updateBlockAttributes, notPersistent ] );
}

defineBlock( metadata, {
	innerBlocks: {
		allowedBlocks: [ STEP ],
		template: [ [ STEP ], [ STEP ], [ STEP ] ],
		templateLock: false,
		orientation: ( attributes ) => ( cleanLayout( attributes.layout ) === 'across' ? 'horizontal' : 'vertical' ),
	},
	repeater: { childBlock: STEP, addLabel: __( 'Add step', 'blicks' ) },
	panels: {
		Settings: StepsSettings,
		Style: StepsStyle,
		Motion: StepsMotion,
		describe: ( attributes ) => {
			const current = cleanCurrent( attributes.current );
			return current ? sprintf( /* translators: %d: step number */ __( 'On step %d', 'blicks' ), current ) : ( cleanLayout( attributes.layout ) === 'down' ? __( 'Down', 'blicks' ) : __( 'Across', 'blicks' ) );
		},
	},
	Toolbar: StepsToolbar,
	useEdit: useStepStates,
	render( { attributes, blockProps, children, isEdit } ) {
		const style: Record< string, string > = { ...stepsVars( attributes ), ...( blockProps.style ?? {} ) };
		// The page gets one rule per icon used (StyleServiceProvider); the editor draws it inline.
		if ( isEdit && cleanMarker( attributes.marker ) === 'icons' ) {
			const svg = getIcon( attributes.icon || 'check' )?.svg;
			if ( svg ) style[ '--bl-li-icon' ] = iconMaskUrl( svg );
		}
		return (
			<ol
				{ ...blockProps }
				className={ [ blockProps.className, ...stepsClasses( attributes ) ].filter( Boolean ).join( ' ' ) }
				style={ Object.keys( style ).length ? style : undefined }
			>
				{ children }
			</ol>
		);
	},
} );
