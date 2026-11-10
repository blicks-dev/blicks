/**
 * The dialog mode's canvas: the dialog framed over a dimmed page, at the width picked, so it is
 * seen where visitors will see it. The page is a sketch, never the site; the dialog is the real
 * `blicks/dialog` block, edited with core's own block list.
 *
 * The free block draws itself in an editor as a closed card with Edit. Here there is nothing else
 * to edit, so the canvas opens it and hides the card; the kind, side, place and phone form are the
 * block's own classes, which `canvas.css` places in the frame.
 */
import { BlockList, BlockTools, ObserveTyping, WritingFlow } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import { useEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import type { CanvasProps } from './host';
import { studio } from './host';

const WIDTH = { desktop: 1200, tablet: 782, phone: 390 } as const;

/** The root dialog's client id and attributes, as plain values. */
function useRoot(): { clientId: string; attributes: Record< string, unknown > } | null {
	return useSelect( ( select: any ) => {
		const [ root ] = select( 'core/block-editor' ).getBlocks() as { clientId: string; name: string; attributes: Record< string, unknown > }[];
		return root && 'blicks/dialog' === root.name ? { clientId: root.clientId, attributes: root.attributes } : null;
	}, [] );
}

export function DialogCanvas( { width, compact, focus }: CanvasProps ): JSX.Element {
	const root = useRoot();
	const frame = useRef< HTMLDivElement >( null );
	const attributes = root?.attributes ?? {};
	const modal = false !== attributes.modal;
	const backdrop = modal ? String( attributes.backdrop || 'dark' ) : 'none';

	// Open the block's in-place editor: its card is chrome for a post, not for this canvas.
	useEffect( () => {
		const toggle = frame.current?.querySelector< HTMLButtonElement >( '.bl-dialog.is-edit:not(.is-open) .bl-dialog__card-toggle' );
		toggle?.click();
	} );

	// Narrow the Studio to the dialog's content once, so Layers and the inserter speak about it.
	const clientId = root?.clientId ?? '';
	const title = String( attributes.title || '' );
	useEffect( () => {
		if ( clientId && ! focus ) {
			studio()?.focus( clientId, { label: title || __( 'Dialog', 'blicks-pro' ), exitLabel: __( 'The whole dialog', 'blicks-pro' ) } );
		}
		// Only when a different dialog is mounted: leaving the scope on purpose must stay left.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ clientId ] );

	return (
		<div className={ `bl-studio__sheet bl-ds-stage is-${ width }${ compact ? ' is-compact' : '' }` } style={ { width: `${ WIDTH[ width ] }px` } } ref={ frame }>
			<div className="bl-ds-page" aria-hidden="true">
				<div className="bl-ds-page__bar"><i /><span /><span /><span /></div>
				<div className="bl-ds-page__hero"><b /><span /><span /></div>
				<div className="bl-ds-page__cards"><span /><span /><span /></div>
			</div>
			{ 'none' !== backdrop && <div className={ `bl-ds-backdrop is-${ backdrop }${ attributes.blur ? ' is-blur' : '' }` } aria-hidden="true" /> }
			<div className={ `bl-ds-frame${ modal ? '' : ' is-nonmodal' }` }>
				<BlockTools>
					<WritingFlow>
						<ObserveTyping>
							<BlockList />
						</ObserveTyping>
					</WritingFlow>
				</BlockTools>
			</div>
		</div>
	);
}

/** Layers, in the dialog's words. */
export function dialogTree( blocks: { clientId?: string; name: string; attributes?: Record< string, unknown > }[] ): { clientId: string; label: string; note?: string }[] {
	const [ root ] = blocks;

	if ( ! root?.clientId || 'blicks/dialog' !== root.name ) {
		return [];
	}

	const kinds: Record< string, string > = {
		modal: __( 'Modal', 'blicks-pro' ),
		drawer: __( 'Drawer', 'blicks-pro' ),
		sheet: __( 'Bottom sheet', 'blicks-pro' ),
		full: __( 'Full screen', 'blicks-pro' ),
	};

	return [ { clientId: root.clientId, label: String( root.attributes?.title || __( 'Dialog', 'blicks-pro' ) ), note: kinds[ String( root.attributes?.kind || 'modal' ) ] ?? kinds.modal } ];
}
