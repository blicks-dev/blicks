import { getBlockTypes, createBlock } from '@wordpress/blocks';
import { BlockIcon } from '@wordpress/block-editor';

/**
 * A RichText autocompleter (trigger `/`) that lists ONLY Blicks blocks — the in-flow inserter
 * core gives the paragraph, scoped to our library. Selecting an option replaces the current block
 * with the chosen one (requires `onReplace` to be forwarded to the RichText). Excludes child-only
 * blocks (e.g. Button, which must live inside Buttons) and the AI builder block.
 */
export const blicksBlockCompleter = {
	name: 'blicks/blocks',
	className: 'bl-slash-completer',
	triggerPrefix: '/',
	options() {
		return getBlockTypes().filter(
			( block: any ) =>
				typeof block.name === 'string' &&
				block.name.startsWith( 'blicks/' ) &&
				! block.parent
		);
	},
	getOptionKeywords( block: any ) {
		return [ block.title, ...( block.keywords || [] ) ];
	},
	getOptionLabel( block: any ) {
		return [ <BlockIcon key="icon" icon={ block.icon } />, block.title ];
	},
	getOptionCompletion( block: any ) {
		return { action: 'replace', value: createBlock( block.name ) };
	},
};
