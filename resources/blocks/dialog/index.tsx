import { useEffect, useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { addFilter } from '@wordpress/hooks';
import { __, _n, sprintf } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock, type RenderCtx } from '@/framework/define-block';
import { DialogMotion, DialogSettings, DialogStyle, DialogToolbar, KIND_OPTS, named } from './controls';
import { cleanFocus, cleanKind, dialogClasses, dialogId, slugify } from './model';
import { useOpenerCount, useTakenAnchors } from './editor';

/** What a dialog may not hold: page bands, Loops (their item dialog lives in the Loop) and dialogs. */
const NOT_INSIDE = [ 'blicks/section', 'blicks/loop', 'blicks/dialog' ];

addFilter(
	'blockEditor.__unstableCanInsertBlockType',
	'blicks/dialog-children',
	( canInsert: boolean, blockType: any, rootClientId: string | null, { getBlock, getBlockParentsByBlockName }: any ) => {
		if ( ! canInsert || ! rootClientId ) return canInsert;
		const inDialog = getBlock( rootClientId )?.name === 'blicks/dialog'
			|| getBlockParentsByBlockName( rootClientId, 'blicks/dialog' ).length > 0;
		return inDialog ? ! NOT_INSIDE.includes( typeof blockType === 'string' ? blockType : blockType?.name ) : canInsert;
	}
);

/** Gives a new dialog an address, from its name, unique among the post's dialogs. */
function useAnchor( { attributes, setAttributes, clientId }: { attributes: any; setAttributes: ( a: any ) => void; clientId: string } ) {
	const taken = useTakenAnchors( clientId );
	const { anchor: current, title } = attributes;
	useEffect( () => {
		const base = slugify( current ) || slugify( title ) || slugify( clientId.slice( 0, 8 ) );
		let anchor = base;
		const others = taken.split( ' ' );
		for ( let n = 2; others.includes( anchor ); n++ ) anchor = `${ base }-${ n }`;
		if ( anchor !== current ) setAttributes( { anchor } );
		// The title only names a dialog that has no address yet; renaming it later keeps the address.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ current, taken ] );
}

/**
 * The close button. Its cross is drawn in CSS: the saved markup holds no SVG, so nothing in it
 * depends on an account being allowed to save one.
 */
function CloseButton( { id, attributes }: { id: string; attributes: any } ) {
	const props: Record< string, unknown > = {
		type: 'button',
		className: 'bl-dialog__close',
		commandfor: id,
		command: 'close',
		// Not translated here: save() must write the same bytes in every locale. The label is an
		// attribute, edited in Settings, and its default is the English word.
		'aria-label': attributes.closeLabel || 'Close',
		...( cleanFocus( attributes.focus ) === 'close' ? { autofocus: '' } : {} ),
	};
	return <button { ...( props as any ) } />;
}

/**
 * In the editor a dialog is never drawn over the post: it is a card in the flow, with Edit to
 * open it in place, so the blocks around it stay where the author put them.
 */
function DialogInPost( { attributes, blockProps, children, clientId }: RenderCtx ) {
	const id = dialogId( attributes );
	const empty = useSelect( ( select: any ) => select( 'core/block-editor' ).getBlockCount( clientId ) === 0, [ clientId ] );
	const [ open, setOpen ] = useState( empty );
	const openers = useOpenerCount( id );
	const kind = named( KIND_OPTS, cleanKind( attributes.kind ) );
	const className = [ blockProps.className, ...dialogClasses( attributes ), 'is-edit', open ? 'is-open' : '' ].filter( Boolean ).join( ' ' );

	return (
		<div { ...blockProps } className={ className }>
			<div className="bl-dialog__card" contentEditable={ false }>
				<span className="bl-dialog__card-icon" aria-hidden="true" />
				<span className="bl-dialog__card-text">
					<b>{ attributes.title || __( 'Dialog', 'blicks' ) }</b>
					<small>
						{ [
							kind,
							openers
								? sprintf( /* translators: %d: number of buttons */ _n( 'opened by %d button here', 'opened by %d buttons here', openers, 'blicks' ), openers )
								: __( 'no button opens it yet', 'blicks' ),
							`#${ id }`,
						].join( ' · ' ) }
					</small>
				</span>
				<button type="button" className="bl-dialog__card-toggle" aria-expanded={ open } onClick={ () => setOpen( ! open ) }>
					{ open ? __( 'Done', 'blicks' ) : __( 'Edit', 'blicks' ) }
				</button>
			</div>
			{ open && attributes.closeButton !== false && <span className="bl-dialog__close" aria-hidden="true" /> }
			{ children }
		</div>
	);
}

defineBlock( metadata, {
	panels: {
		Settings: DialogSettings,
		Style: DialogStyle,
		Motion: DialogMotion,
		describe: ( attributes ) => String( attributes.title || named( KIND_OPTS, cleanKind( attributes.kind ) ) ),
	},
	Toolbar: DialogToolbar,
	innerBlocks: {
		templateLock: false,
		template: [
			[ 'blicks/heading', { level: 2 } ],
			[ 'blicks/text', {} ],
		],
	},
	useEdit: useAnchor,
	render( ctx ) {
		if ( ctx.isEdit ) return <DialogInPost { ...ctx } />;

		const { attributes, blockProps, children } = ctx;
		const id = dialogId( attributes );
		const className = [ blockProps.className, ...dialogClasses( attributes ) ].join( ' ' );
		// Saved after class and style, in this order, as the MCP serializer writes them (BlockShapes).
		const native: Record< string, unknown > = {
			id,
			closedby: attributes.outsideCloses === false ? 'closerequest' : 'any',
			...( attributes.label ? { 'aria-label': attributes.label } : {} ),
		};

		return (
			<dialog { ...blockProps } className={ className } { ...( native as any ) }>
				{ attributes.closeButton !== false && <CloseButton id={ id } attributes={ attributes } /> }
				{ children }
			</dialog>
		);
	},
} );
