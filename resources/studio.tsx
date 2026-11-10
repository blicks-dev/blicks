/**
 * The Studio's editor entry: the ways in, and where Insert lands.
 *
 * Two pieces, deliberately apart.
 *
 * **The toolbar item signals.** It appears on any Blicks block, asks which ancestor to mount, and
 * opens a session. It hosts nothing: a `BlockControls` fill renders only while its block is
 * selected and only while that block exists, so a Studio rendered inside one is destroyed by
 * clicking something else in the post or by deleting the block it came from. Both were reproduced
 * before this split — removing the origin took the session with it, mid-edit.
 *
 * **One always-mounted root renders.** Registered as a plugin, so it outlives any block, and it
 * sits in the post's own registry — which is where both pickers belong. Everything inside `<Studio>`
 * renders under a `BlockEditorProvider`, so `useSelect( 'core/block-editor' )` there resolves to the
 * *mounted* tree; a target picker drawn in there would show the author an outline of the thing they
 * are editing instead of the post they are inserting into, and would read exactly right while being
 * entirely wrong.
 *
 * Its own Vite entry, importing nothing from `editor.tsx` or `admin.tsx`. The bundles are IIFEs and
 * a module shared between two entries is emitted into both and evaluated twice.
 */

import { addFilter } from '@wordpress/hooks';
import { registerPlugin } from '@wordpress/plugins';
import { PluginMoreMenuItem } from '@wordpress/editor';
import { BlockControls } from '@wordpress/block-editor';
import { Button, Fill, ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { createBlock, parse, serialize } from '@wordpress/blocks';
import { useDispatch, useRegistry, useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { createPortal, useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { Studio } from './studio/Studio';
import { LibraryScreen } from './studio/LibraryScreen';
import { AncestorPicker } from './studio/AncestorPicker';
import { InsertPicker } from './studio/InsertPicker';
import { blicksAncestors, mountBlank, mountSelection, mountSelectionAt, type BlockNode } from './studio/mount';
import { decideInsert, requiredWrapper, type InsertTarget } from './studio/insert';
import { LIBRARY, findByUniqueId, keepStudioParam, readRefParam, readStudioParam, studioParam, withStudioParam } from './studio/url';
import { focus, unfocus } from './studio/scope';
import { openRef } from './studio/open-ref';
import { entityPersist } from './studio/entity';
import {
	awaitTarget,
	clearTarget,
	closeSession,
	getSession,
	openLibrary,
	openSession,
	subscribe,
	useSession,
	type Session,
} from './studio/session';
import apiFetch from '@wordpress/api-fetch';
import { modes, panels, sources, studioApi, type StudioPanelProps } from './studio/registry';
import { marketplaceSource } from './studio/marketplace';
import { cardDesignsApi } from './studio/card-designs';
import { SECTION_MODE } from './studio/section';
import { MotionPanel } from './studio/motion/MotionPanel';
import * as motion from './studio/motion/session';
import { blicksMarkIcon } from './framework/brand';
import './studio/studio.css';

/*
 * The Studio's registries on the published framework surface — modes, "+ New" items, patterns and
 * rail panels — and the one mode the free Studio ships, the Section. See `studio/registry.ts`.
 *
 * Spread over what is there, the shape `exposePublicApi()` and `admin/registry.ts` use, so no
 * bundle erases another's namespace whichever loads first. A companion that declares
 * `blicks-studio` as a script dependency finds it there.
 */
{
	const host = window as unknown as { blicks?: Record< string, unknown > };
	// `cardDesigns` is what the Loop's "Card design" section lists (studio/card-designs.ts).
	const cardDesigns = cardDesignsApi( apiFetch as never, ( content ) => parse( content ) as BlockNode[] );
	/*
	 * Since API 3: focus scopes, opening a stored tree, and the load/save pair for entities the
	 * server's `Blicks\Studio\EntityRef` stores (template parts, posts of a registered type).
	 */
	const entity = entityPersist(
		apiFetch as never,
		( content ) => parse( content ) as BlockNode[],
		( blocks ) => serialize( blocks as never ),
		/* translators: %d: how many templates or pages use a stored header or dialog */
		( count ) => sprintf( _n( 'Used on %d page', 'Used on %d pages', count, 'blicks' ), count )
	);
	host.blicks = { ...( host.blicks ?? {} ), studio: { ...studioApi, openBlock, cardDesigns, focus, unfocus, openRef, entity } };
	modes.register( SECTION_MODE );
	// The Marketplace shelf: the first source registered through the API every companion uses.
	sources.register( marketplaceSource( apiFetch as never, ( content ) => parse( content ) as BlockNode[] ) );
	// The free Studio's own rail tab, through the same registry a companion uses.
	panels.register( {
		id: 'motion',
		label: __( 'Motion', 'blicks' ),
		render: ( { blocks, applyBurst }: StudioPanelProps ) => <MotionPanel blocks={ blocks } applyBurst={ applyBurst } />,
	} );
}

/**
 * Open the Studio on one block of the post — the post editor's "Edit in Studio".
 *
 * Mounts the block's outermost Blicks ancestor (the section it is in, as the toolbar's picker
 * defaults to) and selects the block inside the copy. Returns the block's client id in the mount,
 * for the design panel to open on, or null when a session is already open or the block is gone.
 *
 * Reads the post through the registry `StudioRoot` lends it, never the global `select`: that one
 * ignores providers (see `framework/block-store.test.ts`).
 */
function openBlock( clientId: string ): string | null {
	if ( getSession() || ! postRegistry ) {
		return null;
	}

	const store = postRegistry.select( blockEditorStore ) as unknown as {
		getBlock: ( id: string ) => BlockNode | undefined;
		getBlockRootClientId: ( id: string ) => string | null;
		getBlockName: ( id: string ) => string | undefined;
	};
	const ancestors = blicksAncestors( clientId, ( id ) => store.getBlockRootClientId( id ), ( id ) => store.getBlockName( id ) );
	const root = store.getBlock( ancestors[ ancestors.length - 1 ] ?? clientId );

	if ( ! root ) {
		return null;
	}

	const mount = mountSelectionAt( root, clientId, ( root.name ?? '' ).replace( /^blicks\//, '' ) );
	openSession( mount );

	return mount.select ?? null;
}

/** The post's registry, lent by `StudioRoot` while it is mounted, for `openBlock`. */
let postRegistry: ReturnType< typeof useRegistry > | null = null;

/*
 * The Studio named in the address (`studio/url.ts`), read as the script loads: the editor rewrites
 * the address while it starts. Until `StudioRoot` has reopened it, that rewrite keeps it too.
 */
const wanted = readStudioParam( window.location.search );
let addressValue: string | null = wanted;

keepStudioParam( window.history, () => addressValue );

/** Add the toolbar item to Blicks blocks only. */
const withStudioButton = ( BlockEdit: never ) =>
	function StudioButton( props: { name: string; clientId: string } ): JSX.Element {
		const Edit = BlockEdit as unknown as React.ComponentType< typeof props >;

		if ( ! props.name?.startsWith( 'blicks/' ) ) {
			return <Edit { ...props } />;
		}

		return (
			<>
				<Edit { ...props } />
				<BlockControls group="other">
					<ToolbarGroup>
						<StudioButtonInner clientId={ props.clientId } />
					</ToolbarGroup>
				</BlockControls>
			</>
		);
	};

/**
 * The button, and the ancestor picker it opens.
 *
 * The picker stays here rather than at the root: it anchors to the toolbar, and it is short-lived
 * enough that losing it on deselect is the right behaviour rather than a bug.
 */
function StudioButtonInner( { clientId }: { clientId: string } ): JSX.Element | null {
	const [ picking, setPicking ] = useState( false );
	const session = useSession();

	const store = useSelect(
		( select: never ) =>
			( select as unknown as ( s: string ) => never )( 'core/block-editor' ) as unknown as {
				getBlock: ( id: string ) => BlockNode | undefined;
				getBlockRootClientId: ( id: string ) => string | null;
				getBlockName: ( id: string ) => string | undefined;
			},
		[]
	);

	const mountBlock = ( target: string ): void => {
		const block = store.getBlock( target );

		setPicking( false );

		if ( block ) {
			openSession( mountSelection( block, ( block.name ?? '' ).replace( /^blicks\//, '' ) ) );
		}
	};

	/** Skip the picker when there is one answer — a dialog offering one option should not open. */
	const open = (): void => {
		const ancestors = blicksAncestors(
			clientId,
			( id ) => store.getBlockRootClientId( id ),
			( id ) => store.getBlockName( id )
		);

		if ( ancestors.length === 0 ) {
			mountBlock( clientId );
			return;
		}

		setPicking( true );
	};

	/*
	 * Gone while a session is open.
	 *
	 * This filter runs for every Blicks block's `BlockEdit`, and the Studio renders Blicks blocks —
	 * so the item appeared on the blocks inside the Studio as well, offering to open a Studio from
	 * within one. There is nothing for it to do there: the tree is already mounted, and the post
	 * editor it would read from is behind a full-screen surface.
	 */
	if ( session ) {
		return null;
	}

	return (
		<>
			<ToolbarButton onClick={ open }>{ __( 'Open in Studio', 'blicks' ) }</ToolbarButton>

			{ picking && (
				<AncestorPicker
					clientId={ clientId }
					onPick={ mountBlock }
					onCancel={ () => setPicking( false ) }
				/>
			) }
		</>
	);
}

/** Always mounted, so a session outlives the block it was opened from. */
function StudioRoot(): JSX.Element | null {
	const [ session, setSession ] = useState< Session | null >( () => getSession() );

	useEffect( () => subscribe( setSession ), [] );

	const origin = session?.mount?.origin ?? null;

	/**
	 * Reactive, and returning primitives.
	 *
	 * The first version of this returned the store's selector functions. That subscribes to nothing
	 * — the mapping result never changes, so the component never re-renders — and the cost was not
	 * a stale label but a wrong decision: delete the origin in the post, hit Insert, and the stale
	 * `originExists` still said true, so it took the no-question path and called `replaceBlocks` on
	 * an id that was gone. That is a silent no-op, so the Studio closed having written nothing.
	 *
	 * Two calls rather than one returning an object: `useSelect` compares the mapped value by
	 * identity, and a fresh object literal each run is never equal to the last.
	 */
	const originExists = useSelect(
		( select: never ) =>
			!! origin &&
			!! (
				( select as unknown as ( s: string ) => never )( 'core/block-editor' ) as unknown as {
					getBlock: ( id: string ) => BlockNode | undefined;
				}
			 ).getBlock( origin ),
		[ origin ]
	);

	const selected: string | null = useSelect(
		( select: never ) =>
			(
				( select as unknown as ( s: string ) => never )( 'core/block-editor' ) as unknown as {
					getSelectedBlockClientId: () => string | null;
				}
			 ).getSelectedBlockClientId(),
		[]
	);

	/** Imperative reads at the moment of writing, which is when they have to be right. */
	const registry = useRegistry();
	const { replaceBlocks, insertBlocks } = useDispatch( blockEditorStore );

	useEffect( () => {
		postRegistry = registry;
		return () => {
			postRegistry = null;
		};
	}, [ registry ] );

	/*
	 * Reopen what the address names (`studio/url.ts`), once the post's blocks are in. Until that has
	 * been tried the address is left alone: the session starts closed, and writing that would drop
	 * the parameter before it was read.
	 */
	const [ restored, setRestored ] = useState( ! wanted );
	const editorReady: boolean = useSelect( ( select: never ) => {
		const editor = ( select as unknown as ( s: string ) => { __unstableIsEditorReady?: () => boolean } | undefined )( 'core/editor' );
		return editor?.__unstableIsEditorReady ? editor.__unstableIsEditorReady() : true;
	}, [] );

	useEffect( () => {
		if ( restored || ! editorReady || ! wanted ) {
			return;
		}

		const stored = readRefParam( wanted );

		if ( stored && ! getSession() ) {
			// A stored tree: its mode loads it. Modes register as their scripts run, which is before
			// the editor is ready, so the mode is there by now if it is coming at all.
			void openRef( stored.mode, stored.ref );
		} else if ( ! getSession() ) {
			const blocks = ( registry.select( blockEditorStore ) as unknown as { getBlocks: () => BlockNode[] } ).getBlocks();
			const block = wanted === LIBRARY ? null : findByUniqueId( blocks, wanted );

			if ( wanted === LIBRARY ) {
				openLibrary();
			} else if ( block ) {
				openSession( mountSelection( block, ( block.name ?? '' ).replace( /^blicks\//, '' ) ) );
			}
		}

		setRestored( true );
	}, [ restored, editorReady, registry ] );

	// Keep the address in step: replaced, not pushed, so Back still leaves the editor.
	useEffect( () => {
		if ( ! restored ) {
			return;
		}

		const uniqueId = origin
			? ( registry.select( blockEditorStore ) as unknown as { getBlockAttributes: ( id: string ) => Record< string, unknown > | null } ).getBlockAttributes( origin )?.uniqueId
			: null;
		addressValue = studioParam( session, typeof uniqueId === 'string' ? uniqueId : null );
		const next = withStudioParam( window.location.href, addressValue );

		if ( next !== window.location.href ) {
			window.history.replaceState( window.history.state, '', next );
		}
	}, [ session, origin, restored, registry ] );

	if ( ! session ) {
		return null;
	}

	const store = registry.select( 'core/block-editor' ) as unknown as {
		getBlock: ( id: string ) => BlockNode | undefined;
		getBlockIndex: ( id: string ) => number;
		getBlockRootClientId: ( id: string ) => string | null;
	};

	const decision = decideInsert( { origin, originExists, selected } );

	/**
	 * Write the tree into the post.
	 *
	 * The wrapper is applied here rather than inside the Studio because it is a fact about the
	 * destination, not the composition: the same tree is valid pasted into a Scene and invalid at
	 * post root.
	 */
	const apply = ( target: InsertTarget, blocks: BlockNode[], wrapper: string | null ): void => {
		const payload = wrapper
			? [ createBlock( wrapper, {}, blocks as never ) as unknown as BlockNode ]
			: blocks;

		switch ( target.kind ) {
			case 'replace-origin':
			case 'replace':
				replaceBlocks( target.clientId, payload as never );
				break;
			case 'after':
				insertBlocks(
					payload as never,
					store.getBlockIndex( target.clientId ) + 1,
					store.getBlockRootClientId( target.clientId ) ?? undefined
				);
				break;
			case 'end':
				insertBlocks( payload as never );
				break;
		}

		closeSession();
	};

	const onInsert = ( blocks: BlockNode[] ): void => {
		if ( decision.asks ) {
			awaitTarget( blocks );
			return;
		}

		apply( decision.target, blocks, requiredWrapper( blocks ) );
	};

	const picker =
		null !== session.pending &&
		createPortal(
			<InsertPicker
				decision={ decision }
				blocks={ session.pending }
				onConfirm={ ( target, wrapper ) => apply( target, session.pending as BlockNode[], wrapper ) }
				onCancel={ clearTarget }
			/>,
			document.body
		);

	// Nothing mounted: the library IS the Studio in that state, not a separate screen.
	if ( ! session.mount ) {
		return (
			<>
			{ picker }
			<LibraryScreen
				onMount={ openSession }
				onAdd={ ( mount ) => {
					/*
					 * Straight into the post, with no Studio to hold drafts: the keyframes the
					 * pattern carries are brought in and saved now, then the (possibly renamed) tree
					 * lands. A site that cannot save them still gets the blocks — still, not moving.
					 */
					const tree = motion.begin( mount.blocks, mount.keyframes ?? [] );

					void motion
						.commit( apiFetch as never )
						.catch( ( failure ) => {
							console.error( 'blicks: the pattern’s animations could not be added to this site.', failure );
						} )
						.finally( () => {
							motion.end();
							onInsert( tree );
						} );
				} }
				onBlank={ () => openSession( mountBlank( 'section' ) ) }
				onMountSelection={
					selected
						? () => {
								const block = store.getBlock( selected );

								if ( block ) {
									openSession(
										mountSelection( block, ( block.name ?? '' ).replace( /^blicks\//, '' ) )
									);
								}
						  }
						: null
				}
				onClose={ closeSession }
			/>
			</>
		);
	}

	return (
		<>
			<Studio mount={ session.mount } onClose={ closeSession } onInsert={ onInsert } />

			{ picker }
		</>
	);
}

/**
 * The ways in with nothing selected — the toolbar item needs a block; opening the library does not.
 *
 * **The header button** is the one people see. It fills `PinnedItems/core`, the slot beside
 * Settings where a plugin's pinned sidebar icon sits: a stable slot name rather than a portal into
 * header markup that changes between releases. WordPress hides that slot on narrow screens and
 * with text labels on, so it is never the only way in.
 *
 * **The options-menu item** is that fallback, where people look for "a thing this plugin adds",
 * and **the command palette** (⌘K) reaches it from anywhere — registered through the store so the
 * bundle takes no hard dependency on `wp-commands`, which an older editor may not load.
 */
function StudioEntryPoints(): JSX.Element {
	const open = useSession() !== null;
	const registry = useRegistry();

	useEffect( () => {
		try {
			( registry.dispatch( 'core/commands' ) as unknown as { registerCommand?: ( c: object ) => void } )?.registerCommand?.( {
				name: 'blicks/open-studio',
				label: __( 'Open Blicks Studio', 'blicks' ),
				icon: blicksMarkIcon,
				callback: ( { close }: { close: () => void } ) => {
					close();
					openLibrary();
				},
			} );
		} catch {
			// No command palette in this editor; the header button and the menu item still open it.
		}
	}, [ registry ] );

	return (
		<>
			<Fill name="PinnedItems/core">
				<Button
					icon={ blicksMarkIcon }
					label={ __( 'Blicks Studio', 'blicks' ) }
					isPressed={ open }
					aria-expanded={ open }
					size="compact"
					onClick={ openLibrary }
				/>
			</Fill>
			<PluginMoreMenuItem icon={ blicksMarkIcon } onClick={ openLibrary }>
				{ __( 'Blicks Studio', 'blicks' ) }
			</PluginMoreMenuItem>
		</>
	);
}

addFilter( 'editor.BlockEdit', 'blicks/studio', withStudioButton as never );
registerPlugin( 'blicks-studio', {
	render: () => (
		<>
			<StudioEntryPoints />
			<StudioRoot />
		</>
	),
} );
