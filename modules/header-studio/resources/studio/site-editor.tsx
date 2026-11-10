/**
 * "Edit in Header Studio", in the block toolbar wherever a header template part is at hand:
 *
 *  - on a Template Part block in the header area (a template that places the header);
 *  - on the top-level blocks while a header template part is open in the Site Editor, whatever
 *    they are (a theme's own header is a Group);
 *  - on a Header block in a template part.
 *
 * Each opens the Studio on the part (`studio.openRef( 'header', { kind: 'template-part', id } )`).
 * A Header block in a post is the Studio's own business: its toolbar already opens it there.
 */
import { BlockControls } from '@wordpress/block-editor';
import { ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useSelect } from '@wordpress/data';
import { addFilter } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';
import { editorData, MODE, partRef, studio } from './host';

interface EditProps {
	name: string;
	clientId: string;
	attributes: Record< string, unknown >;
	isSelected?: boolean;
}

/** The header part this block leads to, or ''. */
function usePart( { name, clientId, attributes }: EditProps ): string {
	return useSelect(
		( select: any ) => {
			if ( name === 'core/template-part' ) {
				const slug = String( attributes.slug ?? '' );
				const area = String( attributes.area ?? '' );
				const theme = String( attributes.theme ?? editorData().theme );
				return slug && ( 'header' === area || 'header' === slug ) ? `${ theme }//${ slug }` : '';
			}

			const editor = select( 'core/editor' );
			if ( editor?.getCurrentPostType?.() !== 'wp_template_part' ) return '';

			const id = String( editor.getCurrentPostId?.() ?? '' );
			const record = select( 'core' ).getEntityRecord( 'postType', 'wp_template_part', id ) as { area?: string } | undefined;
			if ( 'header' !== record?.area ) return '';

			const atTop = ! select( 'core/block-editor' ).getBlockRootClientId( clientId );
			return atTop || name === 'blicks/header' ? id : '';
		},
		[ name, clientId, attributes.slug, attributes.area, attributes.theme ]
	);
}

export const withHeaderStudioButton = createHigherOrderComponent(
	( BlockEdit: React.ComponentType< EditProps > ) =>
		function HeaderStudioButton( props: EditProps ) {
			const part = usePart( props );
			return (
				<>
					<BlockEdit { ...props } />
					{ part && props.isSelected && (
						<BlockControls group="other">
							<ToolbarGroup>
								<ToolbarButton onClick={ () => void studio()?.openRef( MODE, partRef( part ) ) }>{ __( 'Edit in Header Studio', 'blicks-pro' ) }</ToolbarButton>
							</ToolbarGroup>
						</BlockControls>
					) }
				</>
			);
		},
	'withHeaderStudioButton'
);

export function registerSiteEditorEntry(): void {
	if ( ! editorData().canManage ) return;
	addFilter( 'editor.BlockEdit', 'blicks-pro/header-studio', withHeaderStudioButton as never );
}
