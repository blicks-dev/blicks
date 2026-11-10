/**
 * "Mount which?" — the question the toolbar button has to ask.
 *
 * The block someone clicks is almost never what they mean by "open this in the Studio". They clicked
 * a paragraph; they mean the section it sits in. So the picker walks up, offers each Blicks ancestor
 * by name and size, and defaults to the **outermost** — which is what "this section" means in
 * practice.
 *
 * Skipped entirely when the selected block has no Blicks ancestor, because then there is only one
 * answer and a dialog offering one option is a dialog that should not have opened.
 *
 * Ordered outermost first, matching the default. A list whose first row is not what Enter does is a
 * list that teaches people to read carefully, every time.
 */

import { Popover } from '@wordpress/components';
import { useRegistry } from '@wordpress/data';
import { __, sprintf, _n } from '@wordpress/i18n';
import { blicksAncestors } from './mount';

interface Props {
	/** The block that was selected when the toolbar item was hit. */
	clientId: string;
	onPick: ( clientId: string ) => void;
	onCancel: () => void;
}

interface Row {
	clientId: string;
	title: string;
	note: string;
	tag: string;
	isDefault: boolean;
}

export function AncestorPicker( { clientId, onPick, onCancel }: Props ): JSX.Element | null {
	/**
	 * Read once, not subscribed.
	 *
	 * `useSelect` compares its mapped value by identity, and this builds a fresh array every run —
	 * which makes it warn, re-render on every store tick, and subscribe to a question whose answer
	 * cannot change while it is on screen. The picker is open for one click, over a post nobody is
	 * editing behind it; if the tree did change underneath, re-opening is a keystroke.
	 */
	const registry = useRegistry();

	const rows: Row[] = ( () => {
		const store = registry.select( 'core/block-editor' ) as unknown as {
			getBlockRootClientId: ( id: string ) => string | null;
			getBlockName: ( id: string ) => string | undefined;
			getClientIdsOfDescendants: ( ids: string[] ) => string[];
		};
		const types = registry.select( 'core/blocks' ) as unknown as {
			getBlockType: ( name: string ) => { title?: string } | undefined;
		};

		const ancestors = blicksAncestors(
			clientId,
			( id ) => store.getBlockRootClientId( id ),
			( id ) => store.getBlockName( id )
		);

		if ( ancestors.length === 0 ) {
			return [];
		}

		const label = ( id: string ): string => {
			const name = store.getBlockName( id ) ?? '';

			return types.getBlockType( name )?.title ?? name;
		};

		const describe = ( id: string ): string => {
			const descendants = store.getClientIdsOfDescendants( [ id ] ).length;

			return descendants === 0
				? __( 'on its own', 'blicks' )
				: sprintf(
					/* translators: %d: how many blocks are inside this one. */
					_n( '%d block inside', '%d blocks inside', descendants, 'blicks' ),
					descendants
				);
		};

		// Outermost first, matching the default. A list whose first row is not what Enter does is a
		// list that teaches people to read carefully, every time.
		const ordered = [ ...ancestors ].reverse();

		return [
			...ordered.map( ( id, index ) => ( {
				clientId: id,
				title: label( id ),
				note: describe( id ),
				tag: index === 0 ? __( 'Default', 'blicks' ) : __( 'Ancestor', 'blicks' ),
				isDefault: index === 0,
			} ) ),
			{
				clientId,
				title: label( clientId ),
				note: __( 'the block you clicked', 'blicks' ),
				tag: __( 'Selected', 'blicks' ),
				isDefault: false,
			},
		];
	} )();

	// No Blicks ancestor: there is nothing to choose between, so the caller mounts the block itself.
	if ( rows.length === 0 ) {
		return null;
	}

	return (
		<Popover
			placement="bottom-start"
			onClose={ onCancel }
			focusOnMount="firstElement"
			className="bl-studio-picker"
		>
			<div className="bl-studio-picker__body">
				<p className="bl-studio-picker__head">{ __( 'Mount which?', 'blicks' ) }</p>

				{ rows.map( ( row ) => (
					<button
						key={ row.clientId }
						type="button"
						className={
							row.isDefault
								? 'bl-studio-picker__row bl-studio-picker__row--on'
								: 'bl-studio-picker__row'
						}
						onClick={ () => onPick( row.clientId ) }
					>
						<span className="bl-studio-picker__title">{ row.title }</span>
						<span className="bl-studio-picker__note">{ row.note }</span>
						<span className="bl-studio-picker__tag">{ row.tag }</span>
					</button>
				) ) }

				<p className="bl-studio-picker__foot">
					{ __(
						'Defaults to the outermost Blicks block — what people mean by “this section”.',
						'blicks'
					) }
				</p>
			</div>
		</Popover>
	);
}
