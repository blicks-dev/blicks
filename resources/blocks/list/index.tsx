import { useEffect } from 'react';
import { useDispatch, useSelect } from '@wordpress/data';
import { createBlock } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { getIcon } from '@/framework/icons';
import { ITEM, LIST, outerList } from '@/blocks/list-item/editing';
import { ListMotion, ListSettings, ListStyle, ListToolbar } from './controls';
import { cleanArrange, cleanKind, iconMaskUrl, listClasses, listTag, listVars } from './model';

/**
 * An inner list is marked `nested` and takes the outer list's kind, so it saves the right tag
 * (`<ol>` inside a numbered list) and none of the outer list's classes. Kept in step here, as
 * neither change is the author's own: they do not make an undo step.
 */
function useInnerListSync( { attributes, setAttributes, clientId }: { attributes: any; setAttributes: ( a: any ) => void; clientId: string } ) {
	const { nested, outerKind, outerContent } = useSelect( ( select: any ) => {
		const store = select( 'core/block-editor' );
		const parent = store.getBlockRootClientId( clientId );
		const isNested = !! parent && store.getBlockName( parent ) === ITEM;
		const outer = isNested ? outerList( store, parent ) : null;
		const o = outer ? store.getBlockAttributes( outer ) : null;
		return { nested: isNested, outerKind: o?.kind ?? null, outerContent: o?.content ?? '' };
	}, [ clientId ] );
	const { __unstableMarkNextChangeAsNotPersistent: notPersistent } = useDispatch( 'core/block-editor' ) as any;
	useEffect( () => {
		const patch: Record< string, unknown > = {};
		if ( !! attributes.nested !== nested ) patch.nested = nested;
		if ( nested && outerKind && attributes.kind !== outerKind ) patch.kind = outerKind;
		// Inner lists pass the outer list's "title and a line" on to their items, through context.
		if ( nested && ( attributes.content ?? '' ) !== outerContent ) patch.content = outerContent;
		if ( Object.keys( patch ).length ) {
			notPersistent?.();
			setAttributes( patch );
		}
	}, [ nested, outerKind, outerContent, attributes.nested, attributes.kind, attributes.content, notPersistent, setAttributes ] );
}

/** Every item's words in document order, inner lists included. */
function flatten( blocks: any[] ): string[] {
	return blocks.flatMap( ( b ) => [ String( b.attributes?.content ?? '' ), ...b.innerBlocks.flatMap( ( l: any ) => flatten( l.innerBlocks ?? [] ) ) ] );
}

/** A core List (and its inner lists) as a Blicks one. */
function fromCore( attributes: any, innerBlocks: any[], nested = false ): any {
	return createBlock(
		LIST,
		nested ? { nested: true, kind: attributes.ordered ? 'numbers' : 'bullets' } : { kind: attributes.ordered ? 'numbers' : 'bullets', start: attributes.start, reversed: !! attributes.reversed },
		innerBlocks.map( ( li ) => createBlock(
			ITEM,
			{ content: String( li.attributes?.content ?? '' ) },
			( li.innerBlocks ?? [] ).filter( ( b: any ) => b.name === 'core/list' ).map( ( l: any ) => fromCore( { ...l.attributes, ordered: attributes.ordered }, l.innerBlocks ?? [], true ) )
		) )
	);
}

const listOf = ( kind: string, content: string ) => createBlock( LIST, { kind }, [ createBlock( ITEM, { content } ) ] );

defineBlock( metadata, {
	innerBlocks: {
		allowedBlocks: [ ITEM ],
		// A list is never empty: it starts with one item, and the caret lands in it.
		template: [ [ ITEM ] ],
		templateInsertUpdatesSelection: true,
		templateLock: false,
		// Enter makes the next item; there is no "add" button, as in every word processor.
		renderAppender: false,
		orientation: ( attributes ) => ( cleanArrange( attributes.arrange ) === 'row' ? 'horizontal' : 'vertical' ),
	},
	panels: {
		Settings: ListSettings,
		Style: ListStyle,
		Motion: ListMotion,
		describe: ( attributes ) => ( attributes.nested ? __( 'Inner list', 'blicks' ) : { bullets: __( 'Bullets', 'blicks' ), numbers: __( 'Numbers', 'blicks' ), icons: __( 'Icons', 'blicks' ), plain: __( 'Plain', 'blicks' ) }[ cleanKind( attributes.kind ) ] ),
	},
	Toolbar: ListToolbar,
	useEdit: useInnerListSync,
	transforms: {
		from: [
			// Typing "- ", "* " or "1. " at the start of a Text (the Text allows prefix transforms).
			{ type: 'prefix', prefix: '-', transform: ( content: string ) => listOf( 'bullets', content ) },
			{ type: 'prefix', prefix: '*', transform: ( content: string ) => listOf( 'bullets', content ) },
			{ type: 'prefix', prefix: '1.', transform: ( content: string ) => listOf( 'numbers', content ) },
			{
				type: 'block',
				blocks: [ 'blicks/text' ],
				isMultiBlock: true,
				transform: ( texts: any[] ) => createBlock( LIST, {}, texts.map( ( t ) => createBlock( ITEM, { content: String( t.content ?? '' ) } ) ) ),
			},
			{ type: 'block', blocks: [ 'core/list' ], transform: ( attributes: any, innerBlocks: any[] ) => fromCore( attributes, innerBlocks ) },
		],
		to: [
			{
				type: 'block',
				blocks: [ 'blicks/text' ],
				transform: ( _attributes: any, innerBlocks: any[] ) => flatten( innerBlocks ).map( ( content ) => createBlock( 'blicks/text', { content } ) ),
			},
		],
	},
	render( { attributes, blockProps, children, isEdit } ) {
		const Tag = listTag( attributes );
		const kind = cleanKind( attributes.kind );
		const style: Record< string, string > = { ...listVars( attributes ), ...( blockProps.style ?? {} ) };
		// The page gets one rule per icon used (StyleServiceProvider); the editor draws it inline.
		if ( isEdit && kind === 'icons' && ! attributes.nested ) {
			const svg = getIcon( attributes.icon || 'check' )?.svg;
			if ( svg ) style[ '--bl-li-icon' ] = iconMaskUrl( svg );
		}
		const numbered = Tag === 'ol' && ! attributes.nested;
		return (
			<Tag
				{ ...blockProps }
				className={ [ blockProps.className, ...listClasses( attributes ) ].filter( Boolean ).join( ' ' ) }
				style={ Object.keys( style ).length ? style : undefined }
				start={ numbered && typeof attributes.start === 'number' ? attributes.start : undefined }
				reversed={ numbered && attributes.reversed ? true : undefined }
			>
				{ children }
			</Tag>
		);
	},
} );

