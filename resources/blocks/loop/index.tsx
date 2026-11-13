import { __, sprintf, _n } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { LoopCanvas, loopLayout } from './canvas';
import { LoopSettings, LoopToolbar } from './controls';
import { loopSource } from '@/framework/loop-sources';

const LAYOUT_NAMES: Record< string, string > = { grid: __( 'Grid', 'blicks' ), bento: __( 'Bento', 'blicks' ), list: __( 'List', 'blicks' ) };
const SOURCE_NAMES: Record< string, string > = { json: __( 'Pasted', 'blicks' ), endpoint: __( 'Feed', 'blicks' ), query: __( 'WordPress', 'blicks' ), item: __( 'List above', 'blicks' ) };

/**
 * The Loop: repeats its inner blocks — the card — once per item, rendered on the server
 * (render.php → src/Data/LoopRenderer.php). In the editor the first item is the card itself,
 * editable; the others are previews of the same blocks with their own item's values.
 */
defineBlock( metadata, {
	dynamic: true,
	innerBlocks: {
		templateLock: false,
		// The live card sits on the first list item; dynamic blocks save only their inner blocks,
		// so this element never reaches saved markup.
		wrapperClassName: 'bl-loop__template',
		template: [
			[ 'blicks/box', { kind: 'card', tag: 'article' }, [
				[ 'blicks/heading', { level: 3, content: __( 'Item title', 'blicks' ) } ],
				[ 'blicks/text', { content: __( 'A line about this item.', 'blicks' ) } ],
			] ],
		],
	},
	Toolbar: LoopToolbar,
	panels: {
		Settings: LoopSettings,
		describe: ( attributes ) => sprintf(
			/* translators: 1: layout (Grid, Bento, List), 2: source (Pasted, Feed, WordPress), 3: item limit */
			_n( '%1$s · %2$s · %3$d item', '%1$s · %2$s · %3$d items', Number( attributes.limit ) || 0, 'blicks' ),
			LAYOUT_NAMES[ loopLayout( attributes ) ],
			SOURCE_NAMES[ attributes.source ] ?? loopSource( attributes.source )?.label ?? SOURCE_NAMES.json,
			Number( attributes.limit ) || 0
		),
	},
	render( { attributes, blockProps, innerBlocksProps, clientId, isEdit } ) {
		if ( isEdit && clientId ) {
			return <LoopCanvas attributes={ attributes } blockProps={ blockProps } innerBlocksProps={ innerBlocksProps } clientId={ clientId } />;
		}
		return <div { ...blockProps }><div { ...innerBlocksProps } /></div>;
	},
} );
