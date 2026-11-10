import { useEffect, useMemo } from 'react';
import { RichText } from '@wordpress/block-editor';
import { ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { ToolbarChoice, outlineGlyph } from '@/blocks/shared/toolbar';
import { createBlock } from '@wordpress/blocks';
import { useRegistry, useSelect } from '@wordpress/data';
import { concat, create, slice, toHTMLString } from '@wordpress/rich-text';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { getIcon } from '@/framework/icons';
import { blicksBlockCompleter } from '@/blocks/shared/blicks-block-completer';
import { cleanState, iconMaskUrl, itemClasses, itemVars } from '@/blocks/list/model';
import { ITEM, LIST, canIndent, canOutdent, indent, mergeUp, outdent, pastedLines, stepOut, type ListActions, type ListMakers, type ListStore } from './editing';
import { ListItemSettings, ListItemStyle, STATES } from './controls';

export const ICON_OUTDENT = 'M21 6H11M21 12H11M21 18H11M7 9l-3 3 3 3';
export const ICON_INDENT = 'M21 6H11M21 12H11M21 18H11M3 9l3 3-3 3';

const makers: ListMakers = {
	list: ( attributes, innerBlocks = [] ) => createBlock( LIST, attributes, innerBlocks ),
	text: () => createBlock( 'blicks/text' ),
};

/** Plain characters in an item's words, the way the caret counts them. */
export const textLength = ( html: string ) => create( { html } ).text.length;

/** The caret's offset in an editable, or -1 when there is a selection rather than a caret. */
function caretOffset( el: HTMLElement ): number {
	const selection = el.ownerDocument.defaultView?.getSelection();
	if ( ! selection || ! selection.rangeCount || ! selection.isCollapsed ) return -1;
	const range = selection.getRangeAt( 0 );
	if ( ! el.contains( range.startContainer ) ) return -1;
	const before = range.cloneRange();
	before.selectNodeContents( el );
	before.setEnd( range.startContainer, range.startOffset );
	return before.toString().length;
}

/** The block editor, as the typing operations read and write it. */
function useListEditor() {
	const registry = useRegistry();
	return useMemo( () => ( {
		store: () => registry.select( 'core/block-editor' ) as unknown as ListStore & Record< string, any >,
		actions: () => registry.dispatch( 'core/block-editor' ) as unknown as ListActions & Record< string, any >,
		batch: ( fn: () => void ) => ( registry as any ).batch( fn ),
	} ), [ registry ] );
}

/**
 * The typing contract (see editing.ts), on the item's own element. Listening in the capture phase
 * runs before the editable's own keys, so Enter on an empty item never also splits it, and Tab
 * never leaves the item. Keys typed in an inner item belong to that item's own listener.
 */
function useListKeys( { clientId }: { attributes: any; setAttributes: ( a: any ) => void; clientId: string } ) {
	const editor = useListEditor();
	useEffect( () => {
		const canvas = ( document.querySelector( 'iframe[name="editor-canvas"]' ) as HTMLIFrameElement | null )?.contentDocument ?? document;
		const el = canvas.getElementById( `block-${ clientId }` ) ?? document.getElementById( `block-${ clientId }` );
		if ( ! el ) return;

		const onKey = ( event: KeyboardEvent ) => {
			if ( event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey ) return;
			const target = event.target as HTMLElement;
			if ( ! target.isContentEditable || target.closest( '[data-block]' )?.getAttribute( 'data-block' ) !== clientId ) return;
			const s = editor.store();
			/* The line of detail is one line: Enter does nothing there, and Backspace at its start
			   goes back to the end of the title rather than joining items. */
			if ( target.closest( '.bl-list-item__desc' ) ) {
				if ( event.key === 'Enter' ) { event.preventDefault(); event.stopPropagation(); }
				if ( event.key === 'Backspace' && caretOffset( target ) === 0 ) {
					event.preventDefault();
					event.stopPropagation();
					const end = textLength( String( s.getBlockAttributes( clientId )?.content ?? '' ) );
					editor.actions().selectionChange( clientId, 'content', end, end );
				}
				return;
			}
			const a = editor.actions();
			const take = () => { event.preventDefault(); event.stopPropagation(); };

			if ( event.key === 'Tab' ) {
				take();
				const at = Math.max( 0, caretOffset( target ) );
				let moved = false;
				editor.batch( () => { moved = ( event.shiftKey ? outdent : indent )( s, a, makers, clientId ); } );
				if ( moved ) a.selectionChange( clientId, 'content', at, at );
				return;
			}
			if ( event.key === 'Enter' && ! event.shiftKey ) {
				if ( textLength( String( s.getBlockAttributes( clientId )?.content ?? '' ) ) > 0 ) return;
				take();
				let next: string | null = null;
				editor.batch( () => { next = stepOut( s, a, makers, clientId ); } );
				if ( next === clientId ) a.selectionChange( clientId, 'content', 0, 0 );
				else if ( next ) ( a as any ).selectBlock( next, 0 );
				return;
			}
			if ( event.key === 'Backspace' && caretOffset( target ) === 0 ) {
				let merged = false;
				editor.batch( () => { merged = mergeUp( s, a, makers, clientId, textLength ); } );
				if ( merged ) take();
			}
		};
		/* Several lines pasted into an item become items: the first joins this one at the caret, the
		   rest follow it, and the words after the caret end up at the end of the last. */
		const onPaste = ( event: ClipboardEvent ) => {
			const target = event.target as HTMLElement;
			if ( ! target.isContentEditable || target.closest( '[data-block]' )?.getAttribute( 'data-block' ) !== clientId || target.closest( '.bl-list-item__desc' ) ) return;
			const lines = pastedLines( event.clipboardData?.getData( 'text/plain' ) ?? '' );
			const at = caretOffset( target );
			if ( ! lines.length || at < 0 ) return;
			event.preventDefault();
			event.stopPropagation();
			const s = editor.store();
			const a = editor.actions();
			const value = create( { html: String( s.getBlockAttributes( clientId )?.content ?? '' ) } );
			// `slice` returns the whole value unless both ends are given.
			const tail = slice( value, at, value.text.length );
			const html = ( v: any ) => toHTMLString( { value: v } );
			const items = lines.slice( 1 ).map( ( line, i ) => createBlock( ITEM, {
				content: html( i === lines.length - 2 ? concat( create( { text: line } ), tail ) : create( { text: line } ) ),
			} ) );
			const list = s.getBlockRootClientId( clientId );
			const index = s.getBlockOrder( list ).indexOf( clientId );
			editor.batch( () => {
				a.updateBlockAttributes( clientId, { content: html( concat( slice( value, 0, at ), create( { text: lines[ 0 ] } ) ) ) } );
				( a as any ).insertBlocks( items, index + 1, list, false );
			} );
			const last = items[ items.length - 1 ];
			const end = lines[ lines.length - 1 ].length;
			a.selectionChange( last.clientId, 'content', end, end );
		};
		el.addEventListener( 'keydown', onKey, true );
		el.addEventListener( 'paste', onPaste, true );
		return () => {
			el.removeEventListener( 'keydown', onKey, true );
			el.removeEventListener( 'paste', onPaste, true );
		};
	}, [ clientId, editor ] );
}

function ListItemToolbar( { attributes, setAttributes, clientId }: { attributes: any; setAttributes: ( a: any ) => void; clientId?: string } ) {
	const editor = useListEditor();
	const { indentable, outdentable } = useSelect( ( select: any ) => {
		const s = select( 'core/block-editor' );
		return { indentable: !! clientId && canIndent( s, clientId ), outdentable: !! clientId && canOutdent( s, clientId ) };
	}, [ clientId ] );
	if ( ! clientId ) return null;
	const run = ( op: typeof indent ) => editor.batch( () => op( editor.store(), editor.actions(), makers, clientId ) );
	return (
		<>
			<ToolbarGroup>
			<ToolbarButton icon={ outlineGlyph( ICON_OUTDENT ) } label={ __( 'Outdent', 'blicks' ) } shortcut="Shift+Tab" disabled={ ! outdentable } onClick={ () => run( outdent ) } />
			<ToolbarButton icon={ outlineGlyph( ICON_INDENT ) } label={ __( 'Indent', 'blicks' ) } shortcut="Tab" disabled={ ! indentable } onClick={ () => run( indent ) } />
			</ToolbarGroup>
			<ToolbarGroup>
				<ToolbarChoice label={ __( 'This item', 'blicks' ) } value={ cleanState( attributes.state ) } options={ STATES } onChange={ ( state ) => setAttributes( { state } ) } />
			</ToolbarGroup>
		</>
	);
}

defineBlock( metadata, {
	innerBlocks: {
		// An item holds its words and, below them, one inner list.
		allowedBlocks: [ LIST ],
		templateLock: false,
		renderAppender: false,
	},
	panels: {
		Settings: ListItemSettings,
		Style: ListItemStyle,
		describe: ( attributes ) => {
			const words = create( { html: String( attributes.content ?? '' ) } ).text.trim();
			return words ? ( words.length > 28 ? `${ words.slice( 0, 28 ) }…` : words ) : __( 'Empty', 'blicks' );
		},
	},
	Toolbar: ListItemToolbar,
	useEdit: useListKeys,
	/** Backspace at the start of an item that follows another joins their words. */
	merge: ( attributes, attributesToMerge ) => ( {
		...attributes,
		content: String( attributes.content ?? '' ) + String( attributesToMerge.content ?? '' ),
	} ),
	render( { attributes, blockProps, richText, children, isEdit, onReplace, context } ) {
		const titled = isEdit ? context?.[ 'blicks/listContent' ] === 'titled' : false;
		const desc = String( attributes.desc ?? '' );
		const style: Record< string, string > = { ...itemVars( attributes ), ...( blockProps.style ?? {} ) };
		if ( isEdit && attributes.icon ) {
			const svg = getIcon( attributes.icon )?.svg;
			if ( svg ) style[ '--bl-li-icon' ] = iconMaskUrl( svg );
		}
		return (
			<li
				{ ...blockProps }
				className={ [ blockProps.className, ...itemClasses( attributes ) ].filter( Boolean ).join( ' ' ) }
				style={ Object.keys( style ).length ? style : undefined }
			>
				{ isEdit
					? richText( {
						attr: 'content',
						tagName: 'div',
						className: 'bl-list-item__text',
						placeholder: __( 'List item', 'blicks' ),
						allowedFormats: [ 'core/bold', 'core/italic', 'core/link', 'blicks/text-style', 'blicks/inline-code', 'core/strikethrough', 'core/subscript', 'core/superscript' ],
						identifier: 'content',
						onReplace,
						autocompleters: [ blicksBlockCompleter ],
					} )
					: <RichText.Content value={ attributes.content } /> }
				{ /* The line of detail is saved only when written, so a plain list stays plain. */ }
				{ isEdit && ( titled || desc )
					? richText( {
						attr: 'desc',
						tagName: 'div',
						className: 'bl-list-item__desc',
						placeholder: __( 'Add a line of detail', 'blicks' ),
						allowedFormats: [ 'core/bold', 'core/italic', 'core/link', 'blicks/text-style', 'blicks/inline-code' ],
						identifier: 'desc',
					} )
					: ! isEdit && desc && <RichText.Content tagName="span" className="bl-list-item__desc" value={ desc } /> }
				{ children }
			</li>
		);
	},
} );
