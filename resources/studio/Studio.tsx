/**
 * The Studio shell: mount, build, leave.
 *
 * Full screen over the editor, holding a **detached** block tree. The isolation is not ours to
 * build — `BlockEditorProvider` is already wrapped in `withRegistryProvider`, which creates a child
 * registry whose parent is the outer one and registers a fresh `core/block-editor` into it. Only
 * that store is shadowed; `core/blocks`, `core/notices` and the rest fall through. So every
 * component below reads and writes the mounted tree without knowing it, and the post is untouched.
 *
 * What that costs is undo, and the cost is not obvious: post history lives in `core/editor`, which
 * the child registry does NOT shadow, so the sub-registry has no `undo` action at all. ⌘Z inside a
 * mount changes nothing in either direction. `history.ts` is the answer, wired here.
 *
 * Rendered through a portal into the admin document rather than in place. The editor canvas is an
 * iframe, and `position: fixed` inside it is fixed to the iframe — a full-screen surface mounted
 * there covers the canvas and nothing else.
 *
 * **Chrome floats; it is not a bar.** The world fills the whole surface and three toolbars float
 * over its top edge. The outer two are also the sidebars: opening one grows that toolbar downward
 * into the tree or the inspector, one surface rather than a panel appearing beside a bar. Nothing
 * is docked, so opening or closing a sidebar never re-lays-out the work — the canvas is only told
 * what the chrome now covers, and frames the composition in what is left.
 */

import {
	Component,
	Fragment,
	createPortal,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import type { ReactNode } from 'react';
import {
	BlockEditorProvider,
	BlockInspector,
	Inserter,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { useDispatch, useSelect } from '@wordpress/data';
import { SlotFillProvider } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { Glyph } from './Glyph';
import { Layers, layerKeys } from './Layers';
import type { BlockNode, Mount } from './mount';
import { getBlockType } from '@wordpress/blocks';
import { onlyIdentity, toPortableJson } from './mount';
import apiFetch from '@wordpress/api-fetch';
import { usedBy } from './motion/keyframes';
import * as motion from './motion/session';
import {
	amend,
	canRedo,
	canUndo,
	commit,
	createHistory,
	current,
	redo,
	undo,
	type History,
} from './history';
import { WIDTHS, type WidthId } from './modes/FlowMode';
import { StudioCanvas, type Frame } from './StudioCanvas';
import { resolveKey, shouldClaim } from './keys';
import { SavePatternSheet } from './SavePatternSheet';
import { LeaveSheet } from './LeaveSheet';
import { KeysSheet } from './KeysSheet';
import { INSPECTOR_TAB, modeFor, modeTree, modes, panelShows, panels as panelRegistry, type FocusScope, type StudioMode, type StudioPanel, type StudioPanelProps, type StudioRef } from './registry';
import { unfocus, useFocus } from './scope';
import { crumbsOf, dimCss, findBlock } from './focus-model';
import { SECTION_MODE } from './section';
import { LANGUAGES, factsOf, languageById, nameOf, scopeCss, setLens, useLanguages } from './languages';
import './studio.css';

interface Props {
	mount: Mount;
	/** Takes the finished tree to the post. The shell does not know where it lands. */
	onInsert: ( blocks: BlockNode[] ) => void;
	onClose: () => void;
}

/** Coarse on purpose: this is a view control, not a precision instrument. */
const ZOOMS = [ 50, 65, 80, 100, 125, 150 ];

const tabClass = ( on: boolean ): string =>
	on ? 'bl-studio__tab bl-studio__tab--on' : 'bl-studio__tab';

type Side = 'left' | 'right';

/**
 * Whether a sidebar starts open: what this viewer last chose, else open when there is room for it.
 *
 * Per viewer and per side, in `localStorage` — a preference about this screen, not about the work.
 * Storage can be missing or throw (a private window, blocked site data), and then the width decides.
 */
const SIDE_KEY = ( side: Side ): string => `blicks.studio.sidebar.${ side }`;

function initialOpen( side: Side ): boolean {
	try {
		const stored = window.localStorage.getItem( SIDE_KEY( side ) );

		if ( '1' === stored || '0' === stored ) {
			return '1' === stored;
		}
	} catch {
		// Fall through to the width.
	}

	return window.innerWidth >= 1024;
}

/**
 * Below this width two open sidebars leave the work a strip down the middle, so only one is open
 * at a time: opening one closes the other. The inspector wins when both would start open.
 */
const SIDEBARS_TOGETHER = '(width >= 1280px)';

const roomForBoth = (): boolean => window.matchMedia?.( SIDEBARS_TOGETHER ).matches ?? true;

function rememberOpen( side: Side, open: boolean ): void {
	try {
		window.localStorage.setItem( SIDE_KEY( side ), open ? '1' : '0' );
	} catch {
		// Not remembered; still toggled.
	}
}

const NO_FRAME: Frame = { top: 0, right: 0, bottom: 0, left: 0 };

const sameFrame = ( a: Frame, b: Frame ): boolean =>
	a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;

const dockClass = ( side: Side, open: boolean ): string =>
	`bl-studio__dock bl-studio__dock--${ side }${ open ? ' bl-studio__dock--open' : '' }`;

/** The sidebar a toggle opens, drawn on the side it opens. */
const SIDEBAR_GLYPH: Record< Side, string > = {
	left: 'M4 5h16v14H4zM9.5 5v14',
	right: 'M4 5h16v14H4zM14.5 5v14',
};

/** Desktop, tablet, phone — shown in place of the labels when the centre toolbar is short of room. */
const WIDTH_GLYPH: Record< WidthId, string > = {
	desktop: 'M3 5h18v11H3zM9 20h6M12 16v4',
	tablet: 'M6 3h12v18H6zM11 18h2',
	phone: 'M8 3h8v18H8zM11 18h2',
};

export function Studio( { mount, onInsert, onClose }: Props ): JSX.Element {
	/*
	 * The motion session opens with the tree: keyframes the mount carried are brought in, and a
	 * clash with this site's library renames theirs in the tree before it is ever mounted — so the
	 * first history step is the tree as it will actually be used here.
	 */
	const [ history, setHistory ] = useState< History< BlockNode[] > >( () =>
		createHistory( motion.begin( mount.blocks, mount.keyframes ?? [] ) )
	);

	/** Why the last door could not be taken, or empty. */
	const [ doorProblem, setDoorProblem ] = useState( '' );

	/*
	 * Insert writes the session's keyframes to the library FIRST. A tree that lands naming an
	 * animation the site has not saved is a block that silently stops moving; refusing the door and
	 * saying why leaves the work in hand.
	 */
	const insert = useCallback(
		async ( tree: BlockNode[] ): Promise< void > => {
			setDoorProblem( '' );

			try {
				await motion.commit( apiFetch as never );
			} catch ( failure ) {
				setDoorProblem( failure instanceof Error ? failure.message : String( ( failure as { message?: unknown } )?.message ?? failure ) );
				return;
			}

			onInsert( tree );
		},
		[ onInsert ]
	);
	const [ copied, setCopied ] = useState( false );
	const [ saving, setSaving ] = useState( false );
	const [ width, setWidth ] = useState< WidthId >( 'desktop' );
	// Opens at 100%; the canvas only positions the work, it never resizes it.
	const [ zoom, setZoom ] = useState( 100 );
	/** Bumped by the zoom readout to put the work back at 100%, centred. */
	const [ recentred, setRecentred ] = useState( 0 );
	const [ leaving, setLeaving ] = useState( false );
	const [ playing, setPlaying ] = useState( 0 );
	const play = useMemo( () => ( { count: playing, replay: () => setPlaying( ( n ) => n + 1 ) } ), [ playing ] );
	const [ keys, setKeys ] = useState( false );
	const [ tab, setTab ] = useState< string >( INSPECTOR_TAB );
	const [ rightOpen, setRightOpen ] = useState( () => initialOpen( 'right' ) );
	const [ leftOpen, setLeftOpen ] = useState( () => initialOpen( 'left' ) && ! ( rightOpen && ! roomForBoth() ) );
	const [ frame, setFrame ] = useState< Frame >( NO_FRAME );
	const [ zoomedBy, setZoomedBy ] = useState( 0 );

	const toggle = useCallback( ( side: Side ) => {
		const open = 'left' === side ? leftOpen : rightOpen;

		rememberOpen( side, ! open );
		( 'left' === side ? setLeftOpen : setRightOpen )( ! open );

		// Not remembered: on a wide screen the other one should come back as it was.
		if ( ! open && ! roomForBoth() ) {
			( 'left' === side ? setRightOpen : setLeftOpen )( false );
		}
	}, [ leftOpen, rightOpen ] );

	const [ wide, setWide ] = useState( roomForBoth );

	useEffect( () => {
		const query = window.matchMedia?.( SIDEBARS_TOGETHER );

		if ( ! query ) {
			return;
		}

		const onChange = (): void => setWide( query.matches );

		query.addEventListener( 'change', onChange );

		return () => query.removeEventListener( 'change', onChange );
	}, [] );

	/*
	 * Something asked the design panel for a tab — the Button toolbar's Quick button — so the
	 * inspector has to be on screen to show it. Opened the way the toggle opens it, and back on the
	 * inspector tab if a companion's panel was showing. `DESIGN_TAB_EVENT` in
	 * `framework/inspector-v2/design-focus.ts`; the editor bundle cannot be imported from here.
	 */
	useEffect( () => {
		const onTab = (): void => {
			setTab( INSPECTOR_TAB );
			rememberOpen( 'right', true );
			setRightOpen( true );

			if ( ! roomForBoth() ) {
				setLeftOpen( false );
			}
		};

		window.addEventListener( 'blicks:design-panel-tab', onTab );

		return () => window.removeEventListener( 'blicks:design-panel-tab', onTab );
	}, [] );

	// The window narrowed past the point where both fit: keep the inspector, close the tree.
	useEffect( () => {
		if ( ! wide && leftOpen && rightOpen ) {
			setLeftOpen( false );
		}
	}, [ wide, leftOpen, rightOpen ] );

	const blocks = current( history );
	const { site, lens } = useLanguages();

	/*
	 * The focus scope, if its block is still in the tree. A scope whose block went away (deleted,
	 * or undone out of existence) is dropped rather than left pointing at nothing.
	 */
	const wantedScope = useFocus();
	const scopeNode = wantedScope ? findBlock( blocks, wantedScope.clientId ) : null;
	const focus: FocusScope | null = scopeNode ? wantedScope : null;
	const focused = null !== focus;

	useEffect( () => {
		if ( wantedScope && ! scopeNode ) {
			unfocus();
		}
	}, [ wantedScope, scopeNode ] );

	/*
	 * The tree as it was last written back, for a mode that persists. Leaving asks only when the
	 * tree has moved on from it, which after a save is not the same as "has undo steps".
	 */
	const [ saved, setSaved ] = useState< BlockNode[] >( () => current( history ) );
	const [ justSaved, setJustSaved ] = useState( false );

	/*
	 * The mode this tree was mounted in, from the registry. A companion's mode that has since been
	 * unregistered falls back to whatever now accepts the tree, and finally to the Section.
	 */
	const allModes = modes.use();
	const mode: StudioMode =
		allModes.find( ( m ) => m.id === mount.mode ) ?? modeFor( blocks ) ?? SECTION_MODE;
	const Canvas = mode.Canvas;

	/** The mode's own names for its blocks, for Layers and the breadcrumb. */
	const names = useMemo( () => modeTree( mode, blocks ), [ mode, blocks ] );

	/** Set when the tree is stored somewhere other than the post: its door saves there. */
	const persist = mount.ref ? mode.persist : undefined;

	/*
	 * Save, for a mode that persists: keyframes first for the same reason as Insert, then the
	 * mode's own `save`. The Studio stays open; the tree just saved is what leaving compares with.
	 */
	const save = useCallback(
		async ( tree: BlockNode[] ): Promise< boolean > => {
			if ( ! persist || ! mount.ref ) {
				return false;
			}

			setDoorProblem( '' );

			try {
				await motion.commit( apiFetch as never );
				await persist.save( tree, mount.ref );
			} catch ( failure ) {
				setDoorProblem( failure instanceof Error ? failure.message : String( ( failure as { message?: unknown } )?.message ?? failure ) );
				return false;
			}

			setSaved( tree );
			setJustSaved( true );
			window.setTimeout( () => setJustSaved( false ), 2_000 );

			return true;
		},
		[ persist, mount.ref ]
	);

	/** The filled door: the mode's save when it persists, else Insert. */
	const door = useCallback(
		( tree: BlockNode[] ): void => {
			if ( persist ) {
				void save( tree );
			} else {
				void insert( tree );
			}
		},
		[ persist, save, insert ]
	);

	/** What the mode reports about the tree, for rail panels: a board's grid size, say. */
	const context = useMemo( () => {
		try {
			return mode.context?.( blocks ) ?? {};
		} catch {
			return {};
		}
	}, [ blocks, mode ] );

	/*
	 * What the floating chrome covers, measured, for the canvas to fit inside.
	 *
	 * Measured rather than written down because none of it is fixed: the right toolbar is as wide
	 * as its labels are in this language, and the centre toolbar drops to the bottom edge on a
	 * narrow screen. Only the toolbars are read, never the docks' height — that is mid-animation
	 * whenever a sidebar toggles, and an open sidebar covers its whole side anyway, so its width
	 * and whether it is open are the whole story.
	 *
	 * The dock widths also go to the stylesheet, which centres the middle toolbar in the gap
	 * between them rather than in the window.
	 */
	const root = useRef< HTMLDivElement | null >( null );
	const leftBar = useRef< HTMLDivElement | null >( null );
	const rightBar = useRef< HTMLDivElement | null >( null );
	const centreBar = useRef< HTMLDivElement | null >( null );
	const focusBar = useRef< HTMLDivElement | null >( null );
	const [ docks, setDocks ] = useState( { left: 0, right: 0 } );

	useLayoutEffect( () => {
		const measure = (): void => {
			const box = root.current?.getBoundingClientRect();
			const left = leftBar.current?.getBoundingClientRect();
			const right = rightBar.current?.getBoundingClientRect();
			const centre = centreBar.current?.getBoundingClientRect();
			const scopeBar = focusBar.current?.getBoundingClientRect();

			if ( ! box || ! left || ! right ) {
				return;
			}

			const leftEdge = Math.ceil( left.right - box.left );
			const rightEdge = Math.ceil( box.right - right.left );
			let top = Math.ceil( Math.max( left.bottom, right.bottom ) - box.top );
			let bottom = 0;

			if ( centre && centre.width > 0 ) {
				if ( centre.top - box.top > box.height / 2 ) {
					bottom = Math.ceil( box.bottom - centre.top );
				} else {
					top = Math.max( top, Math.ceil( centre.bottom - box.top ) );
				}
			}

			// The focus bar hangs under the centre toolbar while a scope is set.
			if ( scopeBar && scopeBar.height > 0 ) {
				top = Math.max( top, Math.ceil( scopeBar.bottom - box.top ) );
			}

			setDocks( ( d ) => ( d.left === leftEdge && d.right === rightEdge ? d : { left: leftEdge, right: rightEdge } ) );

			const next: Frame = {
				top,
				bottom,
				left: leftOpen ? leftEdge : 0,
				right: rightOpen ? rightEdge : 0,
			};

			setFrame( ( f ) => ( sameFrame( f, next ) ? f : next ) );
		};

		measure();

		const observer = new ResizeObserver( measure );

		[ root, leftBar, rightBar, centreBar, focusBar ].forEach( ( ref ) => ref.current && observer.observe( ref.current ) );
		window.addEventListener( 'resize', measure );

		return () => {
			observer.disconnect();
			window.removeEventListener( 'resize', measure );
		};
	}, [ leftOpen, rightOpen, focused ] );

	/**
	 * `onChange` is a persistent edit, `onInput` a transient one — typing, mostly.
	 *
	 * Mapping them straight onto committed and coalesced steps is what gives typing its "one step
	 * per pause" behaviour for free: every keystroke arrives as `onInput` under the same key, and
	 * `commit` folds them until the author stops.
	 */
	/**
	 * Set while an Apply is writing, so its whole burst folds into one history step.
	 *
	 * `commit` coalesces on a matching key inside its window, and the writes an Apply makes all
	 * land in the same tick — so marking them is enough, with no batching API to reach for. Eleven
	 * changes that cost eleven ⌘Zs to take back is not a proposal anyone accepts casually, which
	 * would cost the assistant the one thing that makes it safe to try.
	 *
	 * Cleared on a timer AND on the next press, whichever comes first. The timer alone would leave
	 * a window where a fast human edit folds into the assistant's step; a press is the thing that
	 * produces such an edit, so clearing on it closes the case rather than narrowing it.
	 */
	const burst = useRef< { key: string; label: string } | null >( null );

	/** What a block type keeps in step itself (`supports.blicks.derived`), which is never a step. */
	const derivedOf = ( name: string ): readonly string[] => {
		const list = ( getBlockType( name ) as { supports?: { blicks?: { derived?: unknown } } } | undefined )?.supports?.blicks?.derived;
		return Array.isArray( list ) ? ( list as string[] ) : [];
	};

	const onChange = useCallback( ( next: BlockNode[] ) => {
		setHistory( ( h ) =>
			// A block that just landed filling in its own id is part of landing, not a step.
			onlyIdentity( current( h ), next, derivedOf ) ? amend( h, next ) : commit( h, next, {
				label: burst.current ? burst.current.label : __( 'Edited', 'blicks' ),
				...( burst.current ? { coalesceKey: burst.current.key } : {} ),
			} )
		);
	}, [] );

	const onApplyBurst = useCallback( ( label: string, run: () => void ) => {
		const key = `panel:${ Date.now() }`;
		burst.current = { key, label };

		const clear = (): void => {
			if ( burst.current?.key === key ) {
				burst.current = null;
			}

			document.removeEventListener( 'pointerdown', clear, true );
			document.removeEventListener( 'keydown', clear, true );
		};

		document.addEventListener( 'pointerdown', clear, true );
		document.addEventListener( 'keydown', clear, true );
		window.setTimeout( clear, 400 );

		run();
	}, [] );

	const onInput = useCallback( ( next: BlockNode[] ) => {
		setHistory( ( h ) =>
			commit( h, next, { label: __( 'Typed', 'blicks' ), coalesceKey: 'input' } )
		);
	}, [] );

	/**
	 * Closing is a request once there is work in the Studio.
	 *
	 * Nothing here has been written to the post, so closing is the one action that destroys
	 * something — and it is reached by the key people press to dismiss things they did not mean to
	 * open. With nothing done it closes outright: a confirmation met when nothing has changed is one
	 * people learn to dismiss unread, which is how the one that matters gets dismissed too.
	 */
	const requestLeave = useCallback( () => {
		if ( persist ? blocks !== saved : canUndo( history ) ) {
			setLeaving( true );
			return;
		}

		onClose();
	}, [ history, onClose, persist, blocks, saved ] );

	const copy = useCallback( () => {
		void navigator.clipboard?.writeText( toPortableJson( blocks, usedBy( blocks, motion.known() ) ) ).then( () => {
			setCopied( true );
			window.setTimeout( () => setCopied( false ), 2_000 );
		} );
	}, [ blocks ] );

	/**
	 * `hasFixedToolbar: false` on purpose, and it is not a preference.
	 *
	 * Fixed means the block toolbar renders into the EDITOR HEADER's slot — which the Studio does
	 * not have, so the toolbar went nowhere at all and the canvas had no block actions: no
	 * duplicate, no move, no transform. Contextual renders it over the selected block, inside this
	 * surface, which is also the only version that makes sense once Stage arrives and a block can
	 * be anywhere on a canvas rather than in a column.
	 */
	// `blicksStudio` lets block panels offer Studio-only tools (Decorations) without importing Studio.
	const settings = useMemo( () => ( { hasFixedToolbar: false, blicksStudio: true } ), [] );

	/**
	 * Claim the Studio's own shortcuts, on the way DOWN.
	 *
	 * The post editor registers ⌘Z globally and the Studio's history is not core's, so without
	 * this, undo inside a mount walks the POST's history — the surface looking isolated while a
	 * keystroke edits the document behind it. Capture phase and `stopPropagation` are both load
	 * bearing: core's handler is bound higher up, so merely listening is not enough to win, and
	 * letting the event continue means both histories answer the same press.
	 *
	 * Bound to the document rather than the Studio's own node because the canvas renders through a
	 * portal and focus legitimately sits in places the shell does not contain.
	 */
	const latest = useRef( { blocks, onInsert: door, toggle } );
	latest.current = { blocks, onInsert: door, toggle };

	useEffect( () => {
		const onKeyDown = ( event: KeyboardEvent ): void => {
			const action = resolveKey( event );

			if ( ! action ) {
				return;
			}

			const target = event.target as HTMLElement | null;

			if ( ! shouldClaim( action, target?.tagName ?? '', !! target?.isContentEditable ) ) {
				return;
			}

			// Escape runs its own ladder, in the bubble phase, so a popover or a field that
			// wants it gets it first. See `EscapeLadder`.
			if ( 'escape' === action ) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();

			switch ( action ) {
				case 'undo':
					setHistory( undo );
					break;
				case 'redo':
					setHistory( redo );
					break;
				case 'insert':
					latest.current.onInsert( latest.current.blocks );
					break;
				case 'toggle-left':
				case 'toggle-right':
					latest.current.toggle( 'toggle-left' === action ? 'left' : 'right' );
					break;
				case 'group':
				case 'ungroup':
					layerKeys.run?.( action );
					break;
				case 'cycle-width':
					setWidth( ( current ) => {
						const at = WIDTHS.findIndex( ( w ) => w.id === current );

						return WIDTHS[ ( at + 1 ) % WIDTHS.length ]!.id;
					} );
					break;
			}
		};

		document.addEventListener( 'keydown', onKeyDown, true );

		return () => document.removeEventListener( 'keydown', onKeyDown, true );
	}, [] );

	/*
	 * To the next stop in that direction. A fit lands between stops (53%, say), so stepping from the
	 * current index would send + to 50%: the nearest stop past where it is, not the next in a list.
	 */
	const stepZoom = ( by: number ): void => {
		const next = by > 0 ? ZOOMS.find( ( z ) => z > zoom ) : [ ...ZOOMS ].reverse().find( ( z ) => z < zoom );

		setZoom( next ?? zoom );
		setZoomedBy( ( n ) => n + 1 );
	};


	return createPortal(
		<div
			ref={ root }
			className={ focus ? 'bl-studio bl-studio--focused' : 'bl-studio' }
			onPointerDownCapture={ focus ? ( event ) => leaveOnDimmed( event, focus.clientId ) : undefined }
			role="dialog"
			aria-label={ __( 'Blicks Studio', 'blicks' ) }
			style={ {
				[ '--bl-studio-dock-left' as string ]: `${ docks.left }px`,
				[ '--bl-studio-dock-right' as string ]: `${ docks.right }px`,
			} }
		>
			{ /*
			 * The language being viewed, on the work only. The chrome keeps its own look, and the
			 * site's language stays what an inserted tree will actually wear.
			 */ }
			{ lens !== site && (
				<style>{ scopeCss( languageById( lens )?.css ?? '', '.bl-studio__viewport' ) }</style>
			) }
			{ /*
			 * **Its own slot registry, or the inspector renders twice.**
			 *
			 * The post editor is still mounted behind this surface, with its own selected block
			 * still pushing `InspectorControls` fills. Those fills are matched to a Slot through
			 * React context, and a portal does not escape context — so without this the Studio's
			 * `BlockInspector` collects the post's fills alongside the mount's, and every panel,
			 * tab and control appears twice. Both sets are live, and they edit different trees.
			 *
			 * This is the same class of mistake as reaching for the global block store: the
			 * surface looks isolated because it covers the screen, while React still has it inside
			 * the editor it came from.
			 */ }
			<SlotFillProvider>
			<BlockEditorProvider
				value={ blocks as never }
				onChange={ onChange as never }
				onInput={ onInput as never }
				settings={ settings as never }
			>
				{ /*
				 * The world first and full-bleed: everything after it floats over it. Panning works
				 * anywhere the chrome is not, because anywhere the chrome is not IS the world.
				 */ }
				{ mount.select && <SelectOnOpen clientId={ mount.select } /> }
				<FocusEffects scope={ focus?.clientId ?? null } />
				<StudioCanvas
					zoom={ zoom }
					onZoom={ setZoom }
					fitKey={ `${ mount.label }:${ mode.id }:${ width }:${ recentred }` }
					frame={ frame }
					zoomedBy={ zoomedBy }
				>
					<Canvas width={ width } zoom={ zoom } playing={ playing } compact={ 'phone' === width } focus={ focus } />
				</StudioCanvas>

				{ /*
				 * **The left toolbar is the left sidebar.** Closed, it is the bar alone; open, the
				 * same surface grows down into the tree. One surface, so the eye follows a thing
				 * opening rather than looking for where a panel appeared.
				 */ }
				<div className={ dockClass( 'left', leftOpen ) }>
					<div ref={ leftBar } className="bl-studio__bar">
						<button
							type="button"
							className="bl-studio__iconbtn"
							onClick={ requestLeave }
							aria-label={ __( 'Close the Studio', 'blicks' ) }
						>
							<Glyph path="M6 6l12 12M18 6L6 18" size={ 20 } />
						</button>
						<button
							type="button"
							className={ leftOpen ? 'bl-studio__iconbtn bl-studio__iconbtn--on' : 'bl-studio__iconbtn' }
							onClick={ () => toggle( 'left' ) }
							aria-expanded={ leftOpen }
							aria-controls="blicks-studio-mounted"
							aria-label={ __( 'Show or hide Layers', 'blicks' ) }
							title={ __( 'Layers (⌥⌘[)', 'blicks' ) }
						>
							<Glyph path={ SIDEBAR_GLYPH.left } size={ 20 } />
						</button>
						<span className="bl-studio__name">{ __( 'Studio', 'blicks' ) }</span>
						{ '' !== mount.label && (
							<span className="bl-studio__chip" title={ mount.note ? `${ mount.label } · ${ mount.note }` : mount.label }>{ mount.label }</span>
						) }
					</div>
					<aside
						id="blicks-studio-mounted"
						className="bl-studio__rail"
						aria-label={ __( 'Layers', 'blicks' ) }
					>
						{ focus && (
							<div className="bl-studio__scopehead">
								<button type="button" className="bl-studio__scopeback" onClick={ unfocus }>
									<Glyph path="M15 6l-6 6 6 6" size={ 16 } />
									{ focus.exitLabel }
								</button>
							</div>
						) }
						<div className="bl-studio__railhead">
							<span className="bl-studio__railtitle">
								{ focus ? focus.label : __( 'Layers', 'blicks' ) }
							</span>
							{ /*
							 * Core's inserter rather than a list of our own. It already knows what
							 * each block allows as a child, which patterns are registered and what
							 * the current selection can accept — all of which a hand-rolled row of
							 * buttons would have to re-derive and then get wrong the first time a
							 * block declares `parent`.
							 *
							 * In the rail head rather than a toolbar, because what it adds lands in
							 * the tree this rail is showing.
							 */ }
							{ /* In a scope, what the scope's block allows, added into it. */ }
							<Inserter
								position="bottom right"
								rootClientId={ focus?.clientId }
								toggleProps={ { className: 'bl-studio__addbtn' } }
							/>
						</div>
						<Layers blocks={ focus ? scopeNode?.innerBlocks ?? [] : blocks } names={ names } />
					</aside>
				</div>

				{ /*
				 * The view: what the work is, how wide and how near, and the history. Centred in the
				 * gap between the side toolbars rather than in the window, which is where the eye
				 * looks for it; on a narrow screen it drops to the bottom edge.
				 */ }
				<div className="bl-studio__centre">
					<div ref={ centreBar } className="bl-studio__bar bl-studio__bar--centre">
						{ /*
						 * No mode segment here: it only reported the mode, never chose it, and the
						 * chip beside the tree and the inspector's overview already name it. The
						 * centre bar keeps what is actually pressed.
						 */ }
						{ /* Width belongs beside the mode: it is what a Section means by a viewport. */ }
						{ false !== mode.widths && (
							<div className="bl-studio__widths">
								{ WIDTHS.map( ( option ) => (
									<button
										key={ option.id }
										type="button"
										aria-pressed={ option.id === width }
										aria-label={ option.label }
										title={ `${ option.label } · ${ option.px }px` }
										className={
											option.id === width
												? 'bl-studio__pill bl-studio__pill--on'
												: 'bl-studio__pill'
										}
										onClick={ () => setWidth( option.id ) }
									>
										<Glyph path={ WIDTH_GLYPH[ option.id ] } size={ 18 } />
									</button>
								) ) }
							</div>
						) }

						{ LANGUAGES.length > 1 && (
							<label className="bl-studio__lens">
								<select
									value={ lens }
									aria-label={ __( 'View in', 'blicks' ) }
									onChange={ ( event ) => setLens( event.target.value ) }
								>
									{ LANGUAGES.map( ( language ) => (
										<option key={ language.id } value={ language.id }>
											{ language.id === site
												? /* translators: %s: a design language */ __( '%s (site)', 'blicks' ).replace( '%s', language.name )
												: language.name }
										</option>
									) ) }
								</select>
							</label>
						) }

						{ ( mode.play || mode.zoom ) && <span className="bl-studio__divider" /> }
						{ /*
						 * Play exists because an entrance cannot be judged from a still.
						 *
						 * Authoring deliberately holds every entrance at its finished state, because an
						 * animation that runs while you are placing things makes the canvas unusable. So
						 * there has to be one way to watch them actually run.
						 */ }
						{ mode.play && (
							<button
								type="button"
								className="bl-studio__textbtn"
								onClick={ () => setPlaying( ( n ) => n + 1 ) }
							>
								{ __( 'Play', 'blicks' ) }
							</button>
						) }
						{ mode.zoom && (
							<div className="bl-studio__zoom">
								<button
									type="button"
									className="bl-studio__iconbtn"
									aria-label={ __( 'Zoom out', 'blicks' ) }
									onClick={ () => stepZoom( -1 ) }
								>
									<Glyph path="M5 12h14" size={ 20 } />
								</button>
								<button
									type="button"
									className="bl-studio__zoomreset bl-studio__mono"
									aria-label={ __( 'Reset zoom to 100% and center the work', 'blicks' ) }
									title={ __( 'Back to 100%', 'blicks' ) }
									onClick={ () => {
										setZoom( 100 );
										setRecentred( ( n ) => n + 1 );
									} }
								>
									{ zoom }%
								</button>
								<button
									type="button"
									className="bl-studio__iconbtn"
									aria-label={ __( 'Zoom in', 'blicks' ) }
									onClick={ () => stepZoom( 1 ) }
								>
									<Glyph path="M12 5v14M5 12h14" size={ 20 } />
								</button>
							</div>
						) }

						<span className="bl-studio__divider" />

						<button
							type="button"
							className="bl-studio__iconbtn"
							aria-label={ __( 'Undo', 'blicks' ) }
							disabled={ ! canUndo( history ) }
							onClick={ () => setHistory( undo ) }
						>
							<Glyph path="M9 7 4 12l5 5M4 12h11a5 5 0 0 1 0 10h-1" size={ 20 } />
						</button>
						<button
							type="button"
							className="bl-studio__iconbtn"
							aria-label={ __( 'Redo', 'blicks' ) }
							disabled={ ! canRedo( history ) }
							onClick={ () => setHistory( redo ) }
						>
							<Glyph path="m15 7 5 5-5 5M20 12H9a5 5 0 0 0 0 10h1" size={ 20 } />
						</button>
						<button
							type="button"
							className="bl-studio__iconbtn bl-studio__keysbtn"
							onClick={ () => setKeys( true ) }
							aria-label={ __( 'Keyboard shortcuts', 'blicks' ) }
						>
							<Glyph path="M4 7h16v10H4zM7 11h.01M11 11h.01M15 11h.01M8 14h8" size={ 20 } />
						</button>
					</div>
					{ focus && (
						<div ref={ focusBar } className="bl-studio__bar bl-studio__bar--focus">
							<FocusBar blocks={ blocks } scope={ focus } names={ names } />
						</div>
					) }
				</div>

				{ /* The right toolbar is the inspector, the same way the left one is the tree. */ }
				<div className={ dockClass( 'right', rightOpen ) }>
					<div ref={ rightBar } className="bl-studio__bar">
						{ /*
						 * The three doors, in the order they cost. Copy takes nothing, Save writes a
						 * pattern, Insert writes the post — so Insert is the only filled one.
						 */ }
						<button type="button" className="bl-studio__textbtn" onClick={ copy }>
							{ copied ? __( 'Copied', 'blicks' ) : __( 'Copy JSON', 'blicks' ) }
						</button>
						<button
							type="button"
							className="bl-studio__btn"
							onClick={ () => setSaving( true ) }
						>
							{ __( 'Save as pattern', 'blicks' ) }
						</button>
						<button
							type="button"
							className="bl-studio__btn bl-studio__btn--filled"
							onClick={ () => door( blocks ) }
						>
							{ persist ? ( justSaved ? __( 'Saved', 'blicks' ) : persist.label ) : __( 'Insert', 'blicks' ) }
						</button>
						<button
							type="button"
							className={ rightOpen ? 'bl-studio__iconbtn bl-studio__iconbtn--on' : 'bl-studio__iconbtn' }
							onClick={ () => toggle( 'right' ) }
							aria-expanded={ rightOpen }
							aria-controls="blicks-studio-inspector"
							aria-label={ __( 'Show or hide the inspector', 'blicks' ) }
							title={ __( 'Inspector (⌥⌘])', 'blicks' ) }
						>
							<Glyph path={ SIDEBAR_GLYPH.right } size={ 20 } />
						</button>
					</div>
					{ '' !== doorProblem && (
						<p className="bl-studio__doorproblem" role="alert">
							{ doorProblem }
						</p>
					) }
					<InspectorRail
						tab={ tab }
						setTab={ setTab }
						blocks={ blocks }
						context={ context }
						onApplyBurst={ onApplyBurst }
						about={ { mode: mode.label, steps: history.index, site, lens } }
						play={ play }
						mode={ mode.id }
						entity={ mount.ref ?? null }
					/>
				</div>

				<EscapeLadder blocked={ saving || leaving || keys } focused={ !! focus } onLeave={ requestLeave } />

				{ saving && (
					<SavePatternSheet
						blocks={ blocks }
						suggestion={ mount.label }
						onClose={ () => setSaving( false ) }
					/>
				) }

				{ keys && <KeysSheet onClose={ () => setKeys( false ) } /> }

				{ leaving && (
					<LeaveSheet
						label={ mount.label }
						steps={ history.index }
						door={ persist?.label }
						onInsert={ () => {
							setLeaving( false );

							if ( persist ) {
								void save( blocks ).then( ( ok ) => ok && onClose() );
							} else {
								void insert( blocks );
							}
						} }
						onSave={ () => {
							setLeaving( false );
							setSaving( true );
						} }
						onCopy={ () => {
							copy();
							setLeaving( false );
						} }
						onDiscard={ onClose }
						onCancel={ () => setLeaving( false ) }
					/>
				) }
			</BlockEditorProvider>
			</SlotFillProvider>
		</div>,
		document.body
	);
}

/**
 * Select one block as the Studio opens — the one the post editor's "Edit in Studio" was on.
 *
 * Inside the provider, so it selects in the mount's own store. Selection is not an edit, so it
 * adds no history step.
 */
function SelectOnOpen( { clientId }: { clientId: string } ): null {
	const { selectBlock } = useDispatch( 'core/block-editor' ) as unknown as { selectBlock: ( id: string ) => void };

	useEffect( () => {
		selectBlock( clientId );
		// Once, on open: the author may select something else straight after.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [] );

	return null;
}

/**
 * The mounted tree, as a list.
 *
 * Rendered from the blocks the shell already holds rather than from the store, so it stays correct
 * while the canvas is scrolled away — and it is the only view that always shows everything, which
 * is why it never collapses entirely on a narrow screen.
 *
 * Selection goes through the store, because that is what `BlockInspector` reads. It is inside the
 * provider, so `useDispatch` resolves to the mount's own `core/block-editor` and not the post's.
 */
/**
 * The right rail, as a component of its own so its hooks run inside the provider.
 *
 * `Studio` RENDERS `BlockEditorProvider`, so its own hooks run outside it and `useSelect` there
 * would read the post's registry rather than the mounted tree's — the same trap the published
 * API's `data` namespace exists to warn about. A child reads the right one by being a child.
 *
 * Panels a companion registers (see `panels.ts`) share it as tabs beside the inspector. With none
 * registered there is one tab, so the tab row is not drawn at all.
 */
function InspectorRail( {
	tab,
	setTab,
	blocks,
	context,
	onApplyBurst,
	about,
	play,
	mode,
	entity,
}: {
	tab: string;
	setTab: ( tab: string ) => void;
	blocks: BlockNode[];
	context: Record< string, unknown >;
	onApplyBurst: ( label: string, run: () => void ) => void;
	about: About;
	play: StudioPanelProps[ 'play' ];
	mode: string;
	entity: StudioRef | null;
} ): JSX.Element {
	const registered = panelRegistry.use();
	// Only the tabs that belong to this mode (`StudioPanel.modes`).
	const panels = useMemo( () => registered.filter( ( panel ) => panelShows( panel, mode ) ), [ registered, mode ] );
	// A panel unregistered while it was the open tab hands the rail back to the inspector.
	const active = panels.some( ( panel ) => panel.id === tab ) ? tab : INSPECTOR_TAB;

	/*
	 * Subscribed as a plain string, never as the block object.
	 *
	 * An object's identity changes on every keystroke anywhere in the tree, and `useSelect`
	 * shallow-compares what it is given — so returning the block would re-render this rail, and
	 * the whole inspector inside it, on every character typed into a Text.
	 */
	const selectedType: string = useSelect( ( select: never ) => {
		const editor = ( select as unknown as ( s: string ) => never )(
			'core/block-editor'
		) as unknown as {
			getSelectedBlockClientId: () => string | null;
			getBlockName: ( id: string ) => string | undefined;
		};
		const id = editor.getSelectedBlockClientId();

		return id ? editor.getBlockName( id ) ?? '' : '';
	}, [] );

	return (
		<aside
			id="blicks-studio-inspector"
			aria-label={ __( 'Inspector', 'blicks' ) }
			className="bl-studio__rail bl-studio__rail--right"
			/*
			 * The selected block's name, so the stylesheet can speak about it.
			 *
			 * Core renders its own chrome inside `BlockInspector` — a block card, an Advanced
			 * panel and a skip link — and a block that draws its whole panel itself wants none of
			 * it. None of that is ours to not-render, so the rail says what is selected and the
			 * CSS decides, per block, which of core's parts belong on screen.
			 */
			data-selected-type={ selectedType }
		>
			{ panels.length > 0 && (
				<div className="bl-studio__railhead bl-studio__railhead--tabs">
					<button
						type="button"
						className={ tabClass( INSPECTOR_TAB === active ) }
						aria-pressed={ INSPECTOR_TAB === active }
						onClick={ () => setTab( INSPECTOR_TAB ) }
					>
						{ __( 'Selected', 'blicks' ) }
					</button>
					{ panels.map( ( panel ) => (
						<button
							key={ panel.id }
							type="button"
							className={ tabClass( panel.id === active ) }
							aria-pressed={ panel.id === active }
							onClick={ () => setTab( panel.id ) }
						>
							{ panel.label }
						</button>
					) ) }
				</div>
			) }
			<div className="bl-studio__railbody" hidden={ INSPECTOR_TAB !== active }>
				{ '' === selectedType ? <Overview blocks={ blocks } about={ about } /> : <BlockInspector /> }
			</div>
			{ panels.map( ( panel ) => (
				<div key={ panel.id } className="bl-studio__railbody" hidden={ panel.id !== active }>
					<PanelBody panel={ panel } blocks={ blocks } context={ context } onApplyBurst={ onApplyBurst } play={ play } mode={ mode } entity={ entity } />
				</div>
			) ) }
			<div className="bl-studio__railfoot">
				{ __( 'Nothing is written until you leave by a door', 'blicks' ) }
			</div>
		</aside>
	);
}

interface About {
	/** The mode's name: Section, Board. */
	mode: string;
	/** Undo steps taken since mounting. */
	steps: number;
	site: string;
	lens: string;
}

/**
 * How many colours in the tree are literals rather than palette tokens.
 *
 * A token is stored as a bare slug (`primary`); anything a person typed or picked is a hex, an
 * `rgb()` or a `var()`. Told apart by shape rather than against the token catalogue, which this
 * entry cannot import without sharing a chunk with the editor bundle.
 */
function literalColours( nodes: BlockNode[] ): number {
	let found = 0;

	for ( const node of nodes ) {
		const tree = ( node.attributes as { blicks?: Record< string, Record< string, Record< string, unknown > > > } | undefined )?.blicks ?? {};

		for ( const [ id, slots ] of Object.entries( tree ) ) {
			if ( ! id.startsWith( 'colors.' ) ) {
				continue;
			}

			for ( const byBreakpoint of Object.values( slots ?? {} ) ) {
				for ( const value of Object.values( byBreakpoint ?? {} ) ) {
					if ( typeof value === 'string' && /[#(]/.test( value ) ) {
						found++;
					}
				}
			}
		}

		found += literalColours( node.innerBlocks ?? [] );
	}

	return found;
}

const countBlocks = ( nodes: BlockNode[] ): number =>
	nodes.reduce( ( n, node ) => n + 1 + countBlocks( node.innerBlocks ?? [] ), 0 );

/**
 * The inspector with nothing selected: how to start, and what is on the canvas.
 *
 * Core's own empty state is one line that says what is missing. This says how to get it, then
 * the two facts that otherwise take a hunt: what language the work is drawn in (and whether that
 * is the site's), and whether the tree will follow a language change at all — a literal colour is
 * the one thing that will not.
 */
function Overview( { blocks, about }: { blocks: BlockNode[]; about: About } ): JSX.Element {
	const facts = factsOf( languageById( about.lens )?.css ?? '' );
	const literals = literalColours( blocks );

	return (
		<div className="bl-studio__overview">
			<div className="bl-studio__overgroup">
				<p className="bl-studio__overlead">{ __( 'No block selected.', 'blicks' ) }</p>
				<p className="bl-studio__overtext">
					{ __( 'Click a block on the canvas or in Layers to edit it.', 'blicks' ) }
				</p>
			</div>
			{ LANGUAGES.length > 0 && (
				<div className="bl-studio__overgroup">
					<h3 className="bl-studio__overhead">{ __( 'Design language', 'blicks' ) }</h3>
					<dl className="bl-studio__facts">
						<dt>{ __( 'Viewing', 'blicks' ) }</dt>
						<dd>{ nameOf( about.lens ) }</dd>
						<dt>{ __( 'Site', 'blicks' ) }</dt>
						<dd>{ nameOf( about.site ) }</dd>
						{ '' !== facts.corners && (
							<>
								<dt>{ __( 'Corners', 'blicks' ) }</dt>
								<dd className="bl-studio__mono">{ facts.corners }</dd>
							</>
						) }
						{ '' !== facts.headings && (
							<>
								<dt>{ __( 'Headings', 'blicks' ) }</dt>
								<dd className="bl-studio__mono">{ facts.headings }</dd>
							</>
						) }
					</dl>
				</div>
			) }
			<div className="bl-studio__overgroup">
				<h3 className="bl-studio__overhead">{ __( 'Mounted', 'blicks' ) }</h3>
				<dl className="bl-studio__facts">
					<dt>{ __( 'Blocks', 'blicks' ) }</dt>
					<dd>{ countBlocks( blocks ) }</dd>
					<dt>{ __( 'Kind', 'blicks' ) }</dt>
					<dd>{ about.mode }</dd>
					<dt>{ __( 'Steps', 'blicks' ) }</dt>
					<dd>{ about.steps }</dd>
					<dt>{ __( 'Colors', 'blicks' ) }</dt>
					<dd>
						{ 0 === literals
							? __( 'All tokens', 'blicks' )
							: /* translators: %d: how many colours are fixed values rather than palette tokens */
							  __( '%d fixed', 'blicks' ).replace( '%d', String( literals ) ) }
					</dd>
				</dl>
			</div>
		</div>
	);
}

/**
 * One registered panel. Its own component so a panel that throws takes out its tab, not the rail —
 * the inspector beside it is the one thing the Studio cannot work without.
 */
function PanelBody( {
	panel,
	blocks,
	context,
	onApplyBurst,
	play,
	mode,
	entity,
}: {
	panel: StudioPanel;
	blocks: BlockNode[];
	context: Record< string, unknown >;
	onApplyBurst: ( label: string, run: () => void ) => void;
	play: StudioPanelProps[ 'play' ];
	mode: string;
	entity: StudioRef | null;
} ): JSX.Element | null {
	const applyBurst = useCallback( ( run: () => void ) => onApplyBurst( panel.label, run ), [ onApplyBurst, panel.label ] );
	// Read through the ambient registry, so it is the mounted tree's selection, never the post's.
	const selection = useSelect( ( select: ( store: unknown ) => unknown ) => {
		const store = select( blockEditorStore ) as { getSelectedBlock: () => { clientId: string; name: string } | null };
		const block = store.getSelectedBlock();
		return block ? `${ block.clientId }|${ block.name }` : '';
	}, [] );
	const selected = useMemo( () => {
		const [ clientId, name ] = selection.split( '|' );
		return clientId ? { clientId, name: name ?? '' } : null;
	}, [ selection ] );

	return (
		<PanelBoundary label={ panel.label }>
			{ panel.render( { blocks, context, applyBurst, selection: selected, play, mode, ref: entity } ) }
		</PanelBoundary>
	);
}

class PanelBoundary extends Component< { label: string; children: ReactNode }, { failed: boolean } > {
	state = { failed: false };

	static getDerivedStateFromError(): { failed: boolean } {
		return { failed: true };
	}

	componentDidCatch( error: unknown ): void {
		console.error( `blicks: the Studio panel "${ this.props.label }" failed to render.`, error );
	}

	render(): ReactNode {
		if ( this.state.failed ) {
			return (
				<p className="bl-studio__empty">
					{ /* translators: %s: the name of a panel another plugin added to the Studio */
					  __( '%s could not be shown.', 'blicks' ).replace( '%s', this.props.label ) }
				</p>
			);
		}

		return this.props.children;
	}
}


/**
 * Escape, one level at a time.
 *
 * In the BUBBLE phase, unlike every other shortcut the Studio claims: Escape is the key a popover,
 * a dropdown or a field uses to dismiss itself, and those are nearer the user's intent than the
 * Studio is. Claiming it on the way down would close the whole surface when someone meant to close
 * a colour picker.
 *
 * Inside the provider, so the selection it clears is the MOUNT's. Read from outside, the hook would
 * resolve to the post's store and Escape would silently deselect a block in the document behind.
 */
function EscapeLadder( { blocked, focused, onLeave }: { blocked: boolean; focused: boolean; onLeave: () => void } ): null {
	const { clearSelectedBlock } = useDispatch( blockEditorStore );
	const selected: string = useSelect(
		( select: never ) =>
			(
				( select as unknown as ( s: string ) => never )( 'core/block-editor' ) as unknown as {
					getSelectedBlockClientId: () => string | null;
				}
			 ).getSelectedBlockClientId() ?? '',
		[]
	);

	const latest = useRef( { blocked, focused, selected, onLeave, clearSelectedBlock } );
	latest.current = { blocked, focused, selected, onLeave, clearSelectedBlock };

	useEffect( () => {
		const onKeyDown = ( event: KeyboardEvent ): void => {
			if ( 'Escape' !== event.key || event.defaultPrevented ) {
				return;
			}

			// A sheet is up and owns the key. It closes itself; the ladder does not reach past it.
			if ( latest.current.blocked ) {
				return;
			}

			event.preventDefault();

			// Up a level first: a selected block is a level, and letting Escape step out of it is
			// what makes the key safe to press without thinking.
			if ( latest.current.selected ) {
				latest.current.clearSelectedBlock();
				return;
			}

			// Then out of a focus scope, before out of the Studio.
			if ( latest.current.focused ) {
				unfocus();
				return;
			}

			latest.current.onLeave();
		};

		document.addEventListener( 'keydown', onKeyDown );

		return () => document.removeEventListener( 'keydown', onKeyDown );
	}, [] );

	return null;
}


/**
 * A press on the dimmed part of the canvas leaves the scope.
 *
 * Captured on the way down, so the press does not also select the block it landed on: everything
 * outside the scope is in the `disabled` editing mode, and a press there means "out", not "this".
 * Only presses on blocks in the canvas count — chrome, popovers and the empty world do not.
 */
function leaveOnDimmed( event: React.PointerEvent, scope: string ): void {
	const target = event.target as Element | null;

	if ( ! target?.closest?.( '.bl-studio__viewport' ) || ! target.closest( '[data-block]' ) ) {
		return;
	}

	if ( target.closest( `[data-block="${ scope.replace( /["\\]/g, '' ) }"]` ) ) {
		return;
	}

	event.preventDefault();
	event.stopPropagation();
	unfocus();
}

/**
 * What a focus scope does to the mount's block editor.
 *
 * Inside the provider, so it acts on the mount's store. The whole tree goes into core's `disabled`
 * editing mode and the scope back into `default`, which its inner blocks inherit: nothing outside
 * can be selected, typed into or inserted into, and core's own appenders and inserter keep to the
 * scope's `allowedBlocks`. A mode is not an edit, so none of this is a history step. The scope is
 * selected on entry, so the inspector opens on it.
 */
function FocusEffects( { scope }: { scope: string | null } ): JSX.Element | null {
	const { setBlockEditingMode, unsetBlockEditingMode, selectBlock } = useDispatch( blockEditorStore ) as unknown as {
		setBlockEditingMode: ( id: string, mode: string ) => void;
		unsetBlockEditingMode: ( id: string ) => void;
		selectBlock: ( id: string ) => void;
	};

	useEffect( () => {
		if ( ! scope ) {
			return;
		}

		setBlockEditingMode( '', 'disabled' );
		setBlockEditingMode( scope, 'default' );
		selectBlock( scope );

		return () => {
			unsetBlockEditingMode( scope );
			unsetBlockEditingMode( '' );
		};
	}, [ scope, setBlockEditingMode, unsetBlockEditingMode, selectBlock ] );

	return scope ? <style>{ dimCss( scope, '.bl-studio__viewport' ) }</style> : null;
}

/**
 * Under the centre toolbar while focused: where the scope is, and the way back.
 *
 * Crumbs above the scope leave it and select that block; the scope's own crumb selects the scope;
 * crumbs below it select inside. Inside the provider, so the selection it reads is the mount's.
 */
function FocusBar( {
	blocks,
	scope,
	names,
}: {
	blocks: BlockNode[];
	scope: FocusScope;
	names: ReadonlyMap< string, { label: string; note: string } >;
} ): JSX.Element {
	const { selectBlock } = useDispatch( blockEditorStore ) as unknown as { selectBlock: ( id: string ) => void };
	const selected: string = useSelect(
		( select: never ) =>
			(
				( select as unknown as ( s: string ) => never )( 'core/block-editor' ) as unknown as {
					getSelectedBlockClientId: () => string | null;
				}
			 ).getSelectedBlockClientId() ?? '',
		[]
	);
	const types = useSelect(
		( select: never ) =>
			( select as unknown as ( s: string ) => never )( 'core/blocks' ) as unknown as {
				getBlockType: ( name: string ) => { title?: string } | undefined;
			},
		[]
	);

	const name = ( node: BlockNode ): string => {
		const own = ( node.attributes?.metadata as { name?: unknown } | undefined )?.name;

		return 'string' === typeof own && '' !== own ? own : names.get( node.clientId ?? '' )?.label ?? types.getBlockType( node.name )?.title ?? node.name;
	};

	const crumbs = crumbsOf( blocks, scope, selected || null, name );

	return (
		<>
			<nav className="bl-studio__crumbs" aria-label={ __( 'Where you are', 'blicks' ) }>
				{ crumbs.map( ( crumb, at ) => (
					<Fragment key={ crumb.clientId }>
						{ at > 0 && <Glyph path="M9 6l6 6-6 6" size={ 14 } /> }
						<button
							type="button"
							className={ 'scope' === crumb.where ? 'bl-studio__crumb bl-studio__crumb--scope' : 'bl-studio__crumb' }
							aria-current={ at === crumbs.length - 1 ? 'location' : undefined }
							onClick={ () => {
								if ( 'outside' === crumb.where ) {
									unfocus();
								}

								selectBlock( crumb.clientId );
							} }
						>
							{ crumb.label }
						</button>
					</Fragment>
				) ) }
			</nav>
			<button type="button" className="bl-studio__textbtn" onClick={ unfocus }>
				{ scope.exitLabel }
			</button>
		</>
	);
}
