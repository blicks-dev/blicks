/**
 * The header mode's canvas: the real header blocks at the top of a sketched page, at the width
 * picked. Where the header uses its drawer at that width (its `drawerAt`, against the Studio's
 * tablet and phone widths), the canvas draws the phone form: the bar with a menu button, and the
 * menu as an open drawer beside it, so the drawer is edited where visitors will see it.
 *
 * The page is a sketch, never the site.
 */
import { BlockList, BlockTools, ObserveTyping, WritingFlow } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import type { CanvasProps } from './host';

const WIDTH = { desktop: 1200, tablet: 782, phone: 390 } as const;

/** Whether a header with this `drawerAt` shows its drawer at a Studio width. */
export function drawerAt( setting: unknown, width: CanvasProps[ 'width' ] ): boolean {
	switch ( setting ) {
		case 'always':
			return true;
		case 'never':
			return false;
		case 'mobile':
			return width === 'phone';
		default:
			return width !== 'desktop';
	}
}

export function HeaderCanvas( { width }: CanvasProps ): JSX.Element {
	const { setting, drill } = useSelect( ( select: any ) => {
		const [ root ] = select( 'core/block-editor' ).getBlocks() as { name: string; attributes: Record< string, unknown > }[];
		const own = root?.name === 'blicks/header';
		return { setting: own ? root.attributes.drawerAt : 'tablet', drill: ! own || root.attributes.mobile !== 'accordion' };
	}, [] );
	const drawer = drawerAt( setting, width );

	return (
		<div className={ `bl-studio__sheet bl-hs-stage is-${ width }${ drawer ? ' is-drawer' : '' }${ drawer && drill ? ' is-drill' : '' }` } style={ { width: `${ WIDTH[ width ] }px` } }>
			<BlockTools>
				<WritingFlow>
					<ObserveTyping>
						<BlockList />
					</ObserveTyping>
				</WritingFlow>
			</BlockTools>
			{ drawer && (
				<p className="bl-hs-stage__drawer-note" aria-hidden="true">
					{ __( 'Phone drawer, shown open', 'blicks-pro' ) }
				</p>
			) }
			<div className="bl-hs-page" aria-hidden="true">
				<div className="bl-hs-page__hero">
					<b />
					<span />
					<span />
				</div>
				<div className="bl-hs-page__cards">
					<span />
					<span />
					<span />
				</div>
			</div>
		</div>
	);
}
