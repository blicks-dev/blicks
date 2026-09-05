import { registerBlockType, createBlock } from '@wordpress/blocks';
import { useBlockProps, useInnerBlocksProps, InnerBlocks, Inserter, RichText, BlockControls, BlockPreview } from '@wordpress/block-editor';
import { Button, Disabled } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';
import { useContext, useEffect, useMemo } from '@wordpress/element';
import { Inspector } from '@/framework/inspector/Inspector';
import { buildElementStyle } from '@/framework/css/vars';
import { applyBlockIdentity } from '@/framework/identity';
import { cleanAttributes } from '@/framework/sanitize';

/** Options for an editable `RichText` field, supplied by a block's `render`. */
export interface RichTextOpts {
	/** The attribute key that stores the HTML string. */
	attr: string;
	/** The element to render (e.g. `'p'`, `'h2'`, `'figcaption'`). Default `'p'`. */
	tagName?: string;
	placeholder?: string;
	allowedFormats?: string[];
	/** Any extra props (e.g. the wrapper's `blockProps`) are spread onto the element. */
	[ key: string ]: any;
}

export interface RenderCtx {
	attributes: any;
	setAttributes: ( a: any ) => void;
	blockProps: any;
	isEdit: boolean;
	children: React.ReactNode | null;
	/**
	 * Only set when `innerBlocks.wrapperClassName` is configured: the full props object
	 * (including `children`) for the dedicated inner wrapper element. Spread it verbatim —
	 * `<div { ...innerBlocksProps } />` — instead of rendering `children`.
	 */
	innerBlocksProps?: any;
	/**
	 * Render an editable text field. The factory owns the edit/save branch — `RichText` in the
	 * editor, `RichText.Content` on save — so the two can't drift (the #1 block-validation bug).
	 * Spread `blockProps` via the extra props when the editable element *is* the block wrapper
	 * (Heading/Text); omit them when it's a child (Button label, Image caption).
	 */
	richText: ( opts: RichTextOpts ) => React.ReactElement;
	/** The block's clientId — editor only (undefined on save). */
	clientId?: string;
	/** Replace this block with new block(s) — editor only. Powers RichText slash/autocomplete
	 *  block insertion when forwarded to `richText({ onReplace })`. */
	onReplace?: ( blocks: any[] ) => void;
	/** WP block context (block.json `usesContext`) — editor only (undefined on save). */
	context?: Record< string, any >;
}

/** Inner-block configuration forwarded to `useInnerBlocksProps` / `<InnerBlocks.Content>`. */
export interface InnerBlocksConfig {
	template?: any[];
	/**
	 * Move the selection onto the first `template` block when the template seeds it — so a freshly
	 * inserted container drops the caret straight into its seeded child's RichText (writing flow
	 * focuses the first editable of the newly selected block) instead of leaving the wrapper selected.
	 */
	templateInsertUpdatesSelection?: boolean;
	templateLock?: 'all' | 'insert' | 'contentOnly' | false;
	allowedBlocks?: string[];
	orientation?: 'horizontal' | 'vertical' | ( ( attributes: any ) => 'horizontal' | 'vertical' );
	renderAppender?: any;
	/**
	 * Render the children inside a dedicated wrapper element with this className instead of the
	 * block wrapper itself (e.g. Section's `.bl-section__inner` content rail). The block's
	 * `render` must spread `ctx.innerBlocksProps` onto that element and ignore `ctx.children`.
	 */
	wrapperClassName?: string;
}

/**
 * Editor-only empty-state placeholder for an InnerBlocks container. Shown inside the block's
 * wrapper while it has zero children, so an empty block communicates what it is on insert.
 * Lives in the InnerBlocks appender — never in saved markup.
 */
/**
 * A lightweight wireframe row for a preset's skeleton thumbnail — a cheap, instantly-readable
 * stand-in for a live `BlockPreview` (which squishes a full layout into a microscopic, slow card).
 * `title` = a bold bar, `text`/`text-sm` = body lines, `buttons` = a pill row, `box`/`image` = a
 * filled/outlined block. Widths/alignment come from the row kind + the skeleton's `align`.
 */
export type PlaceholderSkeletonRow = 'title' | 'text' | 'text-sm' | 'button' | 'buttons' | 'box' | 'image';

export interface PlaceholderSkeleton {
	/** Cross-axis alignment of the rows — `center` for hero-style layouts. Default `start`. */
	align?: 'start' | 'center';
	rows: PlaceholderSkeletonRow[];
}

/**
 * A quick-start option shown in an empty container's placeholder. Clicking it replaces the
 * block's (empty) inner blocks with the result of `create()` — typically `createBlock()` calls.
 */
export interface BlockPlaceholderPreset {
	label: string;
	/** Returns the inner blocks to insert (e.g. `[ createBlock( 'blicks/button', {…} ) ]`). */
	create: () => any[];
	/** Compact wireframe thumbnail for this option (preferred over a live `preview`). */
	skeleton?: PlaceholderSkeleton;
}

export interface BlockPlaceholderConfig {
	icon?: React.ReactNode;
	title?: string;
	instructions?: string;
	/** Optional quick-start options rendered above the generic add-block appender. */
	presets?: BlockPlaceholderPreset[];
	/** When true, presets render as live `BlockPreview` thumbnails instead of plain label buttons. */
	preview?: boolean;
	/**
	 * Offer a "Blank" option that dismisses the placeholder and drops to the ghost add-slot — for a
	 * container that's valid empty but still wants curated starting layouts. Persists via the
	 * `blicksBlank` attribute, so a blank container stays blank across reloads (no Stack seeded).
	 */
	allowBlank?: boolean;
}

export interface BlockConfig {
	/** Block-specific inspector controls — rendered in the inspector's **Settings** tab. */
	Controls?: React.ComponentType< { attributes: any; setAttributes: ( a: any ) => void } >;
	/** Block-specific toolbar items — wrapped in `<BlockControls>` (editor only). */
	Toolbar?: React.ComponentType< { attributes: any; setAttributes: ( a: any ) => void } >;
	/** Block-specific controls for the inspector's **Advanced** tab (above the shared advanced panel). */
	Advanced?: React.ComponentType< { attributes: any; setAttributes: ( a: any ) => void } >;
	innerBlocks?: boolean | InnerBlocksConfig;
	dynamic?: boolean;
	/** Editor empty-state placeholder (InnerBlocks containers only). */
	placeholder?: BlockPlaceholderConfig;
	/**
	 * Opt a placeholder-less container into the ghost "add" slot (end-of-flow inserter) instead of
	 * WP's default corner appender — for free-form wrappers (e.g. Box) that are valid when empty and
	 * so shouldn't force a starting layout. The slot is editor-only, so an empty container stays
	 * empty in the saved output.
	 */
	appender?: 'ghost';
	/**
	 * Repeater ergonomics: a labelled "+ Add item" appender at the end of the inner blocks that
	 * inserts a seeded child — so authors add items in one click instead of digging through the
	 * inserter. Per-item move/duplicate/delete already come free from the WordPress block toolbar.
	 * (Shown only when the block has children; the empty state still uses `placeholder` if set.)
	 */
	repeater?: {
		/** Default child block to insert when `create` is omitted. */
		childBlock: string;
		/** Button label, e.g. "Add item" / "Add button". */
		addLabel?: string;
		/** Returns the block(s) to insert. Defaults to one `createBlock(childBlock)`. */
		create?: () => any[];
	};
	/**
	 * Optional block-specific editor effect, called once per edit render (it's a hook — use
	 * `useEffect`/`useSelect` inside). Runs whenever the block is mounted in the canvas, regardless
	 * of selection — unlike `Controls`/`Toolbar`, which only mount when selected. Use for one-time
	 * setup like seeding child blocks. Editor only.
	 */
	useEdit?: ( ctx: { attributes: any; setAttributes: ( a: any ) => void; clientId: string } ) => void;
	/**
	 * Block-type merge handler — combines two adjacent same-type blocks into one (Backspace at the
	 * start of a block / Delete at the end). Returns the merged attributes. Forwarded to
	 * `registerBlockType` so the editor's `mergeBlocks` action works (also moves the merged block's
	 * inner blocks). Used by list items.
	 */
	merge?: ( attributes: any, attributesToMerge: any ) => any;
	/**
	 * Earlier saved shapes of this block, newest first — WordPress tries each one when today's
	 * `save()` does not reproduce the stored markup, so existing posts migrate instead of showing
	 * "This block contains unexpected or invalid content".
	 *
	 * `save` is optional and defaults to the factory's own: most deprecations here are a change of
	 * *attribute metadata* (a default that used to be baked into the markup, an attribute that
	 * used to be sourced), where the old markup is exactly what today's `render` produces from the
	 * old attributes. Supply one only when the markup itself changed shape.
	 */
	deprecated?: Array< {
		attributes?: any;
		supports?: any;
		isEligible?: ( attributes: any, innerBlocks: any[] ) => boolean;
		migrate?: ( attributes: any, innerBlocks: any[] ) => any;
		save?: ( props: any ) => React.ReactElement | null;
	} >;
	render: ( ctx: RenderCtx ) => React.ReactElement | null;
}

/**
 * Build the InnerBlocks `renderAppender` for a block with a `placeholder`: a labelled empty-state
 * card while the block has no children, collapsing to a plain add-block button once it does.
 */
/**
 * Compact wireframe thumbnail for a preset — gray bars standing in for the layout shape. Far
 * cheaper and more legible than a live `BlockPreview` squished into a small card.
 */
function PresetSkeleton( { skeleton }: { skeleton: PlaceholderSkeleton } ) {
	return (
		<span className={ `bl-placeholder__skel is-${ skeleton.align ?? 'start' }` } aria-hidden="true">
			{ skeleton.rows.map( ( row, i ) =>
				row === 'buttons' || row === 'button' ? (
					<span key={ i } className="bl-skel-row bl-skel-row--buttons">
						<span className="bl-skel-pill" />
						{ row === 'buttons' && <span className="bl-skel-pill" /> }
					</span>
				) : (
					<span key={ i } className={ `bl-skel-row bl-skel-row--${ row }` } />
				)
			) }
		</span>
	);
}

/**
 * Preset gallery: each starting layout is a clickable card. Cards prefer a compact `skeleton`
 * wireframe; a preset without one falls back to a scaled live `BlockPreview` (built once — a
 * fresh set is minted again on pick so the inserted blocks are independent).
 */
function PlaceholderPresetGallery( {
	presets,
	onPick,
	onBlank,
}: {
	presets: BlockPlaceholderPreset[];
	onPick: ( preset: BlockPlaceholderPreset ) => void;
	onBlank?: () => void;
} ) {
	const cards = useMemo(
		() =>
			presets.map( ( preset ) => ( {
				preset,
				blocks: preset.skeleton ? null : preset.create(),
			} ) ),
		[ presets ]
	);
	return (
		<div className="bl-placeholder__gallery">
			{ onBlank && (
				<button
					type="button"
					key="__blank"
					className="bl-placeholder__card"
					onClick={ onBlank }
				>
					<PresetSkeleton skeleton={ { rows: [ 'box' ] } } />
					<span className="bl-placeholder__label">{ __( 'Blank', 'blicks' ) }</span>
				</button>
			) }
			{ cards.map( ( { preset, blocks } ) => (
				<button
					type="button"
					key={ preset.label }
					className="bl-placeholder__card"
					onClick={ () => onPick( preset ) }
				>
					{ preset.skeleton ? (
						<PresetSkeleton skeleton={ preset.skeleton } />
					) : (
						<span className="bl-placeholder__preview">
							{ /* Narrow viewport → larger scale so the thumbnail reads at card size
							     (1200 squished to a ~220px card is microscopic). */ }
							<BlockPreview blocks={ blocks } viewportWidth={ 560 } />
						</span>
					) }
					<span className="bl-placeholder__label">{ preset.label }</span>
				</button>
			) ) }
		</div>
	);
}

/**
 * Repeater appender — a labelled "+ Add item" button at the end of a parent block's inner blocks.
 * Inserts a seeded child (one click, no inserter digging) and selects it.
 */
function makeRepeaterAppender( clientId: string, repeater: NonNullable< BlockConfig[ 'repeater' ] > ) {
	return function RepeaterAppender() {
		// Skip in read-only previews (inserter/pattern thumbnails render inside `<Disabled>`); the
		// "add" slot is an editing affordance and would otherwise leak into the preview.
		const isPreview = useContext( Disabled.Context );
		const { insertBlocks } = useDispatch( 'core/block-editor' ) as any;
		const count = useSelect(
			( select: any ) => select( 'core/block-editor' ).getBlockCount( clientId ),
			[ clientId ]
		);
		if ( isPreview ) {
			return null;
		}
		const add = () => {
			const blocks = repeater.create ? repeater.create() : [ createBlock( repeater.childBlock ) ];
			insertBlocks( blocks, count, clientId, true );
		};
		const label = repeater.addLabel || __( 'Add item', 'blicks' );
		return (
			<button type="button" className="bl-appender" onClick={ add } aria-label={ label }>
				{ PLUS_ICON }
				<span className="bl-appender__label">{ label }</span>
			</button>
		);
	};
}

/**
 * Generic ghost appender for a non-repeater InnerBlocks container: an end-of-flow slot that opens
 * the block inserter (so it's always clear where the new block lands — no floating corner "+").
 */
function makeGhostAppender( clientId: string, isEmpty: boolean ) {
	return function GhostAppender() {
		// Skip in read-only previews (rendered inside `<Disabled>`) — editing affordance only.
		const isPreview = useContext( Disabled.Context );
		if ( isPreview ) {
			return null;
		}
		const label = __( 'Add block', 'blicks' );
		// Our own ghost button (full styling control) that opens the inserter at the end of the
		// container — instead of WP's fixed-size corner appender.
		//
		// The empty flag drives the one case the quiet-canvas rule must not hide (see
		// runtime.scss): a container with no children collapses to zero height, so hiding its slot
		// until it is selected leaves nothing on the canvas to select.
		return (
			<Inserter
				rootClientId={ clientId }
				position="bottom center"
				isAppender
				renderToggle={ ( { onToggle, disabled }: any ) => (
					<button
						type="button"
						className={ `bl-appender bl-appender--insert${ isEmpty ? ' bl-appender--empty' : '' }` }
						onClick={ onToggle }
						disabled={ disabled }
						aria-label={ label }
					>
						{ PLUS_ICON }
						<span className="bl-appender__label">{ label }</span>
					</button>
				) }
			/>
		);
	};
}

/** Plus glyph for the ghost "add" slot. */
const PLUS_ICON = (
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
		<path d="M12 5v14M5 12h14" />
	</svg>
);

function makePlaceholderAppender( clientId: string, placeholder: BlockPlaceholderConfig ) {
	return function PlaceholderAppender() {
		const { replaceInnerBlocks, updateBlockAttributes } = useDispatch( 'core/block-editor' ) as any;
		const presets = placeholder.presets ?? [];
		const pick = ( preset: BlockPlaceholderPreset ) =>
			replaceInnerBlocks( clientId, preset.create(), false );
		// "Blank" dismisses the placeholder (persisted) → the container stays empty with just the
		// ghost add-slot, no seeded Stack.
		const onBlank = placeholder.allowBlank
			? () => updateBlockAttributes( clientId, { blicksBlank: true } )
			: undefined;
		// Thumbnail gallery when presets carry skeletons (preferred) or opt into live previews.
		const asGallery = presets.length > 0 && ( placeholder.preview || presets.some( ( p ) => p.skeleton ) );
		return (
			<div className="bl-placeholder">
				{ placeholder.icon && (
					<span className="bl-placeholder__icon">{ placeholder.icon }</span>
				) }
				{ placeholder.title && (
					<span className="bl-placeholder__title">{ placeholder.title }</span>
				) }
				{ placeholder.instructions && (
					<span className="bl-placeholder__hint">{ placeholder.instructions }</span>
				) }
				{ asGallery && (
					<PlaceholderPresetGallery presets={ presets } onPick={ pick } onBlank={ onBlank } />
				) }
				{ presets.length > 0 && ! asGallery && (
					<span className="bl-placeholder__presets">
						{ presets.map( ( preset ) => (
							<Button
								key={ preset.label }
								variant="secondary"
								size="compact"
								onClick={ () => pick( preset ) }
							>
								{ preset.label }
							</Button>
						) ) }
					</span>
				) }
				{ presets.length === 0 && (
					<span className="bl-placeholder__add">
						<InnerBlocks.ButtonBlockAppender />
					</span>
				) }
			</div>
		);
	};
}

/** Build the `richText` helper bound to a block's attributes + edit/save mode. */
function makeRichText(
	attributes: any,
	setAttributes: ( a: any ) => void,
	isEdit: boolean
): ( opts: RichTextOpts ) => React.ReactElement {
	return function richText( {
		attr,
		tagName = 'p',
		placeholder,
		allowedFormats,
		...rest
	}: RichTextOpts ) {
		if ( isEdit ) {
			return (
				<RichText
					tagName={ tagName }
					value={ attributes[ attr ] }
					onChange={ ( value: any ) => setAttributes( { [ attr ]: value } ) }
					placeholder={ placeholder }
					allowedFormats={ allowedFormats }
					{ ...rest }
				/>
			);
		}
		// Strip editor-only RichText props so they never leak into the saved markup (they would
		// otherwise render as stray DOM attributes on the element and break block validation —
		// e.g. the slash-inserter's `identifier`/`autocompleters`/`onReplace`). Only DOM-safe props
		// (className, style, id, data-*, aria-*) should reach RichText.Content.
		const saveRest = { ...rest } as Record< string, any >;
		for ( const key of RICHTEXT_EDITOR_ONLY ) {
			delete saveRest[ key ];
		}
		return <RichText.Content tagName={ tagName } value={ attributes[ attr ] } { ...saveRest } />;
	};
}

/** RichText props that are meaningful only in the editor and must not be serialized into save(). */
const RICHTEXT_EDITOR_ONLY = [
	'identifier',
	'autocompleters',
	'onReplace',
	'onChange',
	'onSplit',
	'onMerge',
	'onRemove',
	'onSelectionChange',
	'keepPlaceholderOnFocus',
	'disableLineBreaks',
	'__unstableEmbedURLOnPaste',
	'__unstableAllowPrefixTransformations',
];

/** Custom attributes (sanitized) as a plain props object. Editor preview only — the front end is
 *  injected + validated server-side (Sanitize::attributes), so saved markup never carries them. */
function htmlAttributeProps( list: unknown ): Record< string, string > {
	return Object.fromEntries( cleanAttributes( list ).map( ( a ) => [ a.name, a.value ] ) );
}

function visibilityClasses( visibility: unknown, editor: boolean ): string[] {
	if ( ! visibility || typeof visibility !== 'object' ) return [];
	const prefix = editor ? 'bl-eh-' : 'bl-hide-';
	return Object.keys( visibility as Record< string, boolean > )
		.filter( ( id ) => ( visibility as Record< string, boolean > )[ id ] )
		.map( ( id ) => `${ prefix }${ id }` );
}

export function defineBlock( metadata: any, config: BlockConfig ): void {
	const settings = applyBlockIdentity( metadata );
	const manifest = settings?.supports?.blicks ?? {};
	const slug = String( settings.name ?? '' ).split( '/' )[ 1 ] ?? 'block';

	// Factory-level Advanced attributes — every block gets these (visibility + custom attributes).
	// Existing saved blocks default to empty, so no markup change / no validation break.
	settings.attributes = {
		...( settings.attributes ?? {} ),
		visibility: { type: 'object', default: {} },
		htmlAttributes: { type: 'array', default: [] },
		// Persisted "user chose Blank" flag — suppresses the empty-state placeholder so the container
		// stays empty (ghost add-slot only). Only meaningful for `placeholder.allowBlank` blocks.
		...( config.placeholder?.allowBlank ? { blicksBlank: { type: 'boolean', default: false } } : {} ),
	};

	const innerBlocksEnabled = !! config.innerBlocks;
	const innerBlocksProps: InnerBlocksConfig =
		typeof config.innerBlocks === 'object' ? config.innerBlocks : {};

	const innerWrapperClassName = innerBlocksProps.wrapperClassName;

	function resolveInnerBlocksProps( attributes: any ): any {
		const { wrapperClassName: _wrapperClassName, ...props } = innerBlocksProps;
		if ( typeof props.orientation === 'function' ) {
			props.orientation = props.orientation( attributes );
		}
		return props;
	}

	function buildProps( attributes: any, save: boolean ): { blockProps: any; scopedCss?: string[] } {
		const { classes, vars, scopedCss } = buildElementStyle( attributes.blicks, {
			uniqueId: attributes.uniqueId,
		} );
		const className = [
			`bl-${ slug }`,
			attributes.uniqueId ? `bl-${ attributes.uniqueId }` : '',
			...classes,
			...visibilityClasses( attributes.visibility, ! save ),
		]
			.filter( Boolean )
			.join( ' ' );
		const props = {
			className,
			style: vars as any,
			// Editor preview only; the front end is injected + validated server-side
			// (StyleServiceProvider + Sanitize::attributes), so saved markup stays attribute-free.
			...( save ? {} : htmlAttributeProps( attributes.htmlAttributes ) ),
		};
		return {
			blockProps: save ? useBlockProps.save( props ) : useBlockProps( props ),
			scopedCss,
		};
	}

	function saveBlock( { attributes }: any ) {
		if ( config.dynamic ) {
			return innerBlocksEnabled ? <InnerBlocks.Content /> : null;
		}
		const { blockProps } = buildProps( attributes, true );

		return config.render( {
			attributes,
			setAttributes: () => {},
			blockProps,
			isEdit: false,
			richText: makeRichText( attributes, () => {}, false ),
			children: innerBlocksEnabled && ! innerWrapperClassName ? <InnerBlocks.Content /> : null,
			innerBlocksProps:
				innerBlocksEnabled && innerWrapperClassName
					? { className: innerWrapperClassName, children: <InnerBlocks.Content /> }
					: null,
		} );
	}

	registerBlockType( settings.name, {
		...settings,
		...( config.merge ? { merge: config.merge } : {} ),
		...( config.deprecated
			? {
					deprecated: config.deprecated.map( ( entry ) => ( {
						// WordPress builds a deprecated block type by *removing* every
						// DEPRECATED_ENTRY_KEYS field from the current one and merging the entry
						// over it — and `apiVersion` is one of those keys. Leave it out and the
						// shim renders as API v1, which spreads block props differently, so its
						// markup never matches what v3 actually saved and the deprecation is
						// silently skipped. `supports` is stripped the same way.
						apiVersion: settings.apiVersion,
						supports: settings.supports,
						attributes: settings.attributes,
						...entry,
						save: entry.save ?? saveBlock,
					} ) ),
			  }
			: {} ),

		edit( { attributes, setAttributes, clientId, context }: any ) {
			useEffect( () => {
				if ( ! attributes.uniqueId ) {
					setAttributes( {
						uniqueId: String( clientId ).replace( /-/g, '' ).slice( 0, 8 ),
					} );
				}
			}, [] );

			const { blockProps, scopedCss } = buildProps( attributes, false );
			const previewCss = scopedCss ?? [];

			// Editor-only: lets a block swap itself out — powers RichText slash-inserter / autocomplete.
			const { replaceBlocks } = useDispatch( 'core/block-editor' ) as any;
			const onReplace = ( blocks: any[] ) => replaceBlocks( clientId, blocks );

			// Block-specific editor effect (always mounts with the block). `config.useEdit` is a
			// per-block-type constant, so this conditional hook call keeps a stable hook order.
			config.useEdit?.( { attributes, setAttributes, clientId } );

			// useInnerBlocksProps renders child blocks directly inside the styled element.
			// The legacy <InnerBlocks> component injects two editor-only wrapper divs
			// (.block-editor-inner-blocks > .block-editor-block-list__layout), so a flex/grid
			// container saw exactly one child — the wrapper — and its layout settings looked
			// dead in the canvas while the front end (InnerBlocks.Content, wrapper-free) was
			// fine. The conditional hook calls are safe: both flags are per-block-type
			// constants, so the hook order never changes between renders of one block.
			let wrapperProps = blockProps;
			let children: React.ReactNode = null;
			let innerWrap: any = null;
			if ( innerBlocksEnabled ) {
				const innerCfg = resolveInnerBlocksProps( attributes );
				if (
					( config.placeholder || config.repeater || config.appender === 'ghost' ) &&
					innerCfg.renderAppender == null
				) {
					// Empty → placeholder (if set). Otherwise → ghost "add" slot at the end of the group:
					// a seeded child for repeaters, or the inserter for any other opted-in container
					// (replacing WP's confusing corner "+"). All three flags are per-block-type
					// constants, so this hook order is stable.
					const isEmpty = useSelect(
						( select: any ) => select( 'core/block-editor' ).getBlockCount( clientId ) === 0,
						[ clientId ]
					);
					if ( isEmpty && config.placeholder && ! attributes.blicksBlank ) {
						innerCfg.renderAppender = makePlaceholderAppender( clientId, config.placeholder );
					} else if ( config.repeater ) {
						innerCfg.renderAppender = makeRepeaterAppender( clientId, config.repeater );
					} else {
						innerCfg.renderAppender = makeGhostAppender( clientId, isEmpty );
					}
				}
				if ( innerWrapperClassName ) {
					innerWrap = useInnerBlocksProps( { className: innerWrapperClassName }, innerCfg );
				} else {
					const { children: innerChildren, ...rest } = useInnerBlocksProps(
						blockProps,
						innerCfg
					);
					children = innerChildren;
					wrapperProps = rest;
				}
			}
			const { Toolbar } = config;

			return (
				<>
					{ previewCss.length > 0 && (
						// Editor preview of tier-3 scoped CSS (pseudo-elements / container queries /
						// @property / keyframes). The frontend enqueues the same rules via the
						// render_block filter (StyleServiceProvider), so editor == frontend.
						<style>{ previewCss.join( '' ) }</style>
					) }
					<Inspector
						attributes={ attributes }
						setAttributes={ setAttributes }
						manifest={ manifest }
						clientId={ clientId }
						Controls={ config.Controls }
						Advanced={ config.Advanced }
					/>
					{ Toolbar && (
						<BlockControls>
							<Toolbar attributes={ attributes } setAttributes={ setAttributes } />
						</BlockControls>
					) }
					{ config.render( {
						attributes,
						setAttributes,
						blockProps: wrapperProps,
						isEdit: true,
						richText: makeRichText( attributes, setAttributes, true ),
						children,
						innerBlocksProps: innerWrap,
						clientId,
						onReplace,
						context,
					} ) }
				</>
			);
		},

		save: saveBlock,
	} );
}
