import { __ } from '@wordpress/i18n';
import { useSelect, useDispatch } from '@wordpress/data';
import { useEffect, useRef, useState } from '@wordpress/element';

interface Props {
	clientId: string;
}

interface Layer {
	clientId: string;
	name: string;
	label: string;
	hidden: boolean;
	/** True when the label is the author's own name rather than one derived from content. */
	named: boolean;
	/** 0 for a box, 1 for an item inside one. */
	depth: number;
	/** The client id the reorder actions operate within. */
	parentId?: string;
}

const ITEM_ICON: Record< string, JSX.Element > = {
	'blicks/scene-box': <><rect x="3" y="4" width="18" height="16" rx="1" /><rect x="6.5" y="7.5" width="8" height="6" rx="1" /></>,
	'blicks/scene-text': <><path d="M4 7h16M4 12h11M4 17h7" /></>,
	'blicks/scene-image': <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.3" /><path d="M5 17l4.5-4.5 3 3 2-2L19 17" /></>,
};

const icon = ( name: string ) => (
	<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		{ ITEM_ICON[ name ] ?? <rect x="4" y="4" width="16" height="16" rx="2" /> }
	</svg>
);

/**
 * A readable name for a layer row.
 *
 * Authors name things implicitly by typing into them, so the item's own content is the best label
 * available before anyone sets one explicitly — a headline row that reads "We make things move"
 * locates itself instantly, where "Scene text 3" never does.
 */
function layerLabel( block: any, index: number ): string {
	const explicit = String( block.attributes?.metadata?.name ?? '' ).trim();
	if ( explicit ) return explicit;

	const content = String( block.attributes?.content ?? '' )
		.replace( /<[^>]*>/g, '' )
		.trim();
	if ( content ) return content.length > 34 ? `${ content.slice( 0, 34 ) }…` : content;

	const alt = String( block.attributes?.alt ?? '' ).trim();
	if ( alt ) return alt;

	if ( block.name === 'blicks/scene-image' ) {
		const url = String( block.attributes?.url ?? '' );
		const file = url.split( '/' ).pop()?.split( '?' )[ 0 ];
		if ( file ) return file;
		return __( 'Empty image', 'blicks' );
	}

	// A box without a name says what it IS — where it sits on the grid — which is the only thing
	// that distinguishes two empty boxes from each other.
	if ( block.name === 'blicks/scene-box' ) {
		const a = block.attributes ?? {};
		return `${ __( 'Box', 'blicks' ) } ${ a.col ?? 0 },${ a.row ?? 0 } · ${ a.colSpan ?? 4 }\u00d7${ a.rowSpan ?? 4 }`;
	}

	return `${ __( 'Item', 'blicks' ) } ${ index + 1 }`;
}

/**
 * The layers panel.
 *
 * Order is deliberately REVERSED against document order. Items later in the document paint on top,
 * so a list that reads top-down as front-to-back matches what the author sees on the stage — the
 * convention every canvas tool uses, and the opposite of a block list.
 */
export function SceneLayers( { clientId }: Props ) {
	const { blocks, selected } = useSelect(
		( select: any ) => {
			const store = select( 'core/block-editor' );
			return {
				blocks: store.getBlocks( clientId ) ?? [],
				selected: store.getSelectedBlockClientId(),
			};
		},
		[ clientId ]
	);

	const { selectBlock, moveBlocksDown, moveBlocksUp, removeBlock, updateBlockAttributes } =
		useDispatch( 'core/block-editor' ) as any;

	const [ renaming, setRenaming ] = useState< string | null >( null );
	const [ draft, setDraft ] = useState( '' );
	const input = useRef< HTMLInputElement | null >( null );

	useEffect( () => {
		if ( renaming ) input.current?.select();
	}, [ renaming ] );

	/**
	 * Names go in `metadata.name`, the attribute WordPress itself uses for block renaming — so a
	 * name set here is the same one the List View shows, rather than a second parallel label.
	 */
	const commitRename = ( layer: Layer ) => {
		const name = draft.trim();
		updateBlockAttributes( layer.clientId, { metadata: name ? { name } : undefined } );
		setRenaming( null );
	};

	const startRename = ( layer: Layer ) => {
		setDraft( layer.named ? layer.label : '' );
		setRenaming( layer.clientId );
	};

	const toLayer = ( block: any, index: number, depth: number ): Layer => ( {
		clientId: block.clientId,
		name: block.name,
		label: layerLabel( block, index ),
		// Reuses the factory-level Advanced ▸ Visibility attribute rather than inventing a second
		// hidden flag, so the panel toggle and the inspector control stay one setting.
		hidden: Boolean( block.attributes?.visibility?.base ),
		named: Boolean( String( block.attributes?.metadata?.name ?? '' ).trim() ),
		depth,
		parentId: depth === 0 ? clientId : undefined,
	} );

	// Boxes front-to-back, each followed by ITS items front-to-back. Reversing at both levels keeps
	// the whole tree reading top-down as nearest-to-furthest, which is what a canvas author expects
	// and the opposite of document order.
	const front: Layer[] = [];
	for ( const box of [ ...blocks ].reverse() ) {
		front.push( toLayer( box, blocks.indexOf( box ), 0 ) );
		const kids = box.innerBlocks ?? [];
		for ( const kid of [ ...kids ].reverse() ) {
			front.push( { ...toLayer( kid, kids.indexOf( kid ), 1 ), parentId: box.clientId } );
		}
	}

	const toggleHidden = ( layer: Layer ) => {
		const block = blocks.find( ( b: any ) => b.clientId === layer.clientId );
		const visibility = { ...( block?.attributes?.visibility ?? {} ) };
		if ( layer.hidden ) delete visibility.base;
		else visibility.base = true;
		updateBlockAttributes( layer.clientId, { visibility } );
	};

	return (
		<div className="bl-scene-layers">
			<div className="bl-scene-layers__head">{ __( 'Layers', 'blicks' ) }</div>

			{ front.length === 0 && (
				<p className="bl-scene-layers__empty">
					{ __(
						'Boxes appear here as you add them, nearest the front at the top. Drag one over another on the stage and this is where you sort out which sits on top.',
						'blicks'
					) }
				</p>
			) }

			<ul className="bl-scene-layers__list">
				{ front.map( ( layer ) => (
					<li
						key={ layer.clientId }
						className={ [
							'bl-scene-layers__row',
							`is-depth-${ layer.depth }`,
							layer.clientId === selected ? 'is-selected' : '',
							layer.hidden ? 'is-hidden' : '',
						].filter( Boolean ).join( ' ' ) }
					>
						{ renaming === layer.clientId ? (
							<input
								ref={ input }
								className="bl-scene-layers__rename"
								value={ draft }
								placeholder={ __( 'Name this layer', 'blicks' ) }
								onChange={ ( e ) => setDraft( e.target.value ) }
								onBlur={ () => commitRename( layer ) }
								onKeyDown={ ( e ) => {
									if ( e.key === 'Enter' ) commitRename( layer );
									// Escape abandons the edit rather than committing a half-typed name.
									if ( e.key === 'Escape' ) setRenaming( null );
									e.stopPropagation();
								} }
							/>
						) : (
							<button
								type="button"
								className="bl-scene-layers__pick"
								onClick={ () => selectBlock( layer.clientId ) }
								onDoubleClick={ () => startRename( layer ) }
							>
								<span className="bl-scene-layers__icon">{ icon( layer.name ) }</span>
								<span className={ `bl-scene-layers__label${ layer.named ? '' : ' is-derived' }` }>
									{ layer.label }
								</span>
							</button>
						) }

						<span className="bl-scene-layers__actions">
							<button
								type="button"
								onClick={ () => startRename( layer ) }
								aria-label={ __( 'Rename', 'blicks' ) }
								title={ __( 'Rename', 'blicks' ) }
							>
								<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" /></svg>
							</button>
							{ /* Later in the document paints ON TOP, so "backward" moves toward index 0 —
							     i.e. `moveBlocksUp`. The two verbs are inverted against the block
							     list's own up/down, which is why they are spelled out here. */ }
							<button
								type="button"
								onClick={ () => moveBlocksUp( [ layer.clientId ], layer.parentId ) }
								aria-label={ __( 'Send backward', 'blicks' ) }
								title={ __( 'Send backward', 'blicks' ) }
							>
								<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14m0 0-5-5m5 5 5-5" /></svg>
							</button>
							<button
								type="button"
								onClick={ () => moveBlocksDown( [ layer.clientId ], layer.parentId ) }
								aria-label={ __( 'Bring forward', 'blicks' ) }
								title={ __( 'Bring forward', 'blicks' ) }
							>
								<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5m0 0-5 5m5-5 5 5" /></svg>
							</button>
							<button
								type="button"
								onClick={ () => toggleHidden( layer ) }
								aria-label={ layer.hidden ? __( 'Show', 'blicks' ) : __( 'Hide', 'blicks' ) }
								title={ layer.hidden ? __( 'Show', 'blicks' ) : __( 'Hide', 'blicks' ) }
							>
								{ layer.hidden ? (
									<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.2A9.6 9.6 0 0112 5c5 0 9 4.5 9 7a11 11 0 01-2.3 3.4M6.2 6.6A11.6 11.6 0 003 12c0 2.5 4 7 9 7a9.5 9.5 0 003.5-.7" /></svg>
								) : (
									<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7Z" /><circle cx="12" cy="12" r="2.5" /></svg>
								) }
							</button>
							<button
								type="button"
								onClick={ () => removeBlock( layer.clientId ) }
								aria-label={ __( 'Delete', 'blicks' ) }
								title={ __( 'Delete', 'blicks' ) }
							>
								<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" /></svg>
							</button>
						</span>
					</li>
				) ) }
			</ul>
		</div>
	);
}
