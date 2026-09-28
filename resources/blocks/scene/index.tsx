import { createBlock } from '@wordpress/blocks';
import { ToolbarButton } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { SceneSurface } from '@/blocks/scene-shared/SceneSurface';
import { sceneMarqueeProps } from '@/blocks/scene-shared/scene-marquee';
import { setSceneEditorOpen, useSceneEditorOpen } from '@/blocks/scene-shared/editor-state';
import { SceneControls, cleanDesignSize, cleanGrid } from './controls';

const sceneGlyph = (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
		<rect x="6.3" y="7.3" width="6.4" height="4.4" rx="1" stroke="currentColor" strokeWidth="1.5" />
		<rect x="12.6" y="13" width="5.4" height="3.8" rx="1" fill="currentColor" />
	</svg>
);

/**
 * A scene item seeded by a placeholder preset. Coordinates are design pixels against the default
 * 1440×800 stage, so a preset lands where its thumbnail says it will.
 */
function item( block: string, attrs: Record< string, unknown >, x: string, y: string, anchor?: string ) {
	const blicks: Record< string, unknown > = {
		'sceneChild.x': { default: { base: x } },
		'sceneChild.y': { default: { base: y } },
	};
	if ( anchor ) blicks[ 'sceneChild.anchor' ] = { default: { base: anchor } };
	return createBlock( block, { ...attrs, blicks } );
}

function stageVars( attributes: any ): Record< string, string > {
	const width = cleanDesignSize( attributes.designWidth, 1440 );
	const height = cleanDesignSize( attributes.designHeight, 800 );
	return {
		'--bl-scene-w': `${ width }px`,
		'--bl-scene-h': `${ height }px`,
		// Unitless twins of the two above. `aspect-ratio` takes numbers, and the wrapper has to
		// reserve the stage's flow height before the (scaled, and so height-less) stage lays out.
		'--bl-scene-wn': String( width ),
		'--bl-scene-hn': String( height ),
		// Published for the boxes inside to divide by. Custom properties inherit, so a box needs
		// no context and no copy of the grid size — see `boxVars` in scene-box.
		'--bl-scene-cols': String( cleanGrid( attributes.cols ) ),
		'--bl-scene-rows': String( cleanGrid( attributes.rows ) ),
	};
}

defineBlock( metadata, {
	innerBlocks: {
		// Only scene-aware children: an ordinary block dropped here would sit in flow inside a
		// stage that gives it no room, and its inspector would offer no way to place it.
		// Only boxes. An item has to belong to a region of the grid, because that region is
		// what its coordinates are measured against.
		allowedBlocks: [ 'blicks/scene-box' ],
		templateLock: false,
		wrapperClassName: 'bl-scene__stage',
	},
	placeholder: {
		icon: sceneGlyph,
		title: __( 'Scene', 'blicks' ),
		instructions: __( 'A stage where items are placed freely and animate on their own — pick a starting composition.', 'blicks' ),
		allowBlank: true,
		presets: [
			{
				label: __( 'Headline', 'blicks' ),
				skeleton: { align: 'start', rows: [ 'title', 'text' ] },
				create: () => [
					item( 'blicks/scene-text', { content: __( 'We make things move', 'blicks' ), tag: 'h2' }, '120px', '260px' ),
					item( 'blicks/scene-text', { content: __( 'A short line of supporting copy.', 'blicks' ) }, '120px', '440px' ),
				],
			},
			{
				label: __( 'Headline + image', 'blicks' ),
				skeleton: { align: 'start', rows: [ 'title', 'image' ] },
				create: () => [
					item( 'blicks/scene-text', { content: __( 'We make things move', 'blicks' ), tag: 'h2' }, '120px', '300px' ),
					item( 'blicks/scene-image', {}, '1320px', '400px', 'center-right' ),
				],
			},
			{
				label: __( 'Centred', 'blicks' ),
				skeleton: { align: 'center', rows: [ 'title', 'text' ] },
				create: () => [
					item( 'blicks/scene-text', { content: __( 'Centre stage', 'blicks' ), tag: 'h2' }, '50%', '45%', 'center' ),
					item( 'blicks/scene-text', { content: __( 'One line beneath it.', 'blicks' ) }, '50%', '58%', 'center' ),
				],
			},
		],
	},
	Controls: SceneControls,
	Toolbar: SceneToolbar,
	render( { attributes, blockProps, innerBlocksProps, isEdit, clientId } ) {
		const className = [
			blockProps.className,
			attributes.upscale === false ? 'bl-scene--fixed' : '',
		]
			.filter( Boolean )
			.join( ' ' );

		const style = { ...blockProps.style, ...stageVars( attributes ) };

		// `SceneStage` is a component rather than an inline branch because it owns hooks, and
		// `render` is shared with the save path where hooks are illegal. On save `isEdit` is false
		// and the plain stage below is all that is emitted.
		if ( isEdit && clientId ) {
			return (
				<SceneStage
					clientId={ clientId }
					attributes={ attributes }
					blockProps={ blockProps }
					className={ className }
					style={ style }
					innerBlocksProps={ innerBlocksProps }
				/>
			);
		}

		return (
			<div { ...blockProps } className={ className } style={ style }>
				<div { ...innerBlocksProps } />
			</div>
		);
	},
} );


/** Opens the full-screen editor. A Scene is composed, not written into, so this is its main verb. */
function SceneToolbar( { clientId }: { attributes: any; setAttributes: ( a: any ) => void; clientId?: string } ) {
	if ( ! clientId ) return null;
	return (
		<ToolbarButton
			icon={ <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg> }
			label={ __( 'Edit scene', 'blicks' ) }
			onClick={ () => setSceneEditorOpen( clientId, true ) }
		>
			{ __( 'Edit scene', 'blicks' ) }
		</ToolbarButton>
	);
}

/**
 * The stage in the canvas, plus the full-screen surface when it is open.
 *
 * Only one of the two mounts `innerBlocksProps` at a time. Mounting it twice would put the same
 * blocks on screen in two places, and every click would be ambiguous.
 */
function SceneStage( {
	clientId,
	attributes,
	blockProps,
	className,
	style,
	innerBlocksProps,
}: {
	clientId: string;
	attributes: any;
	blockProps: any;
	className: string;
	style: Record< string, unknown >;
	innerBlocksProps: any;
} ) {
	const open = useSceneEditorOpen( clientId );

	if ( open ) {
		return (
			<div { ...blockProps } className={ className } style={ style }>
				{ /* A placeholder holds the block's place in the canvas while its contents are
				     being edited elsewhere, so the page does not collapse behind the surface. */ }
				<div className="bl-scene__away">{ __( 'Editing in the Scene editor…', 'blicks' ) }</div>
				<SceneSurface
					clientId={ clientId }
					designWidth={ cleanDesignSize( attributes.designWidth, 1440 ) }
					designHeight={ cleanDesignSize( attributes.designHeight, 800 ) }
					innerBlocksProps={ innerBlocksProps }
					className={ className }
					style={ style }
				/>
			</div>
		);
	}

	return (
		<div { ...blockProps } className={ className } style={ style }>
			<div { ...innerBlocksProps } { ...sceneMarqueeProps( { clientId, isEdit: true } ) } />
		</div>
	);
}
