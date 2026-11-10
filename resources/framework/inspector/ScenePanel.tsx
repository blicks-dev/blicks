import { __ } from '@wordpress/i18n';
import type { ReactNode } from 'react';
import type { StyleSection } from './Inspector';
import './scene-panel.scss';

/**
 * The Style tab for a block sitting on a scene.
 *
 * A scene item is composed, not laid out: you drag it somewhere on a stage and then adjust how it
 * looks. That is a different job from styling a block in a document flow, and the facet rail is
 * built for the second one — pick a facet, see one panel, pick another. Composing means moving
 * between position, size, type and colour constantly, and the rail makes every one of those a
 * click plus a re-orientation.
 *
 * So for scene children the rail is replaced by one continuous panel with every group open. It is
 * the same controls in the same order a designer expects to find them, and nothing is hidden behind
 * a click.
 *
 * **Nothing here re-implements a control.** Every group renders the facet's own `Control`, with the
 * facet's own `controlIds` deciding whether the group appears at all. That is deliberate and is the
 * whole reason this file is short: a second implementation of the typography fields would be a
 * second place for them to drift from `STYLE_MAP`, and the inspector registry's drift test would
 * not see it. This panel changes the arrangement and nothing else.
 */

/** Props every facet `Control` takes — the same set `Inspector` passes when it renders one. */
export interface ControlProps {
	attributes: any;
	setAttributes: ( a: any ) => void;
	state: string;
	breakpoint: string;
	isAllowed: ( controlId: string ) => boolean;
	states: string[];
	setState: ( s: string ) => void;
	query?: string;
}

/**
 * The groups, in the order a scene item is actually composed.
 *
 * Position first because it is what you reach for after dropping an item; type and colour last
 * because they are adjustments to something already placed. Several facets share a group — Fill and
 * Border are one heading here, as they are one concern when you are looking at a shape.
 */
const GROUPS: Array< { title: string; facets: string[]; fields?: string[] } > = [
	{
		// The STAGE's own settings, not an item's. First because a Scene block shows only this
		// one — a facet absent from every group is silently dropped, and that is exactly what
		// happened when the Scene opted into the flat panel: no tabs, and nothing under them.
		title: __( 'Grid', 'blicks' ),
		facets: [ 'scene' ],
	},
	{
		title: __( 'Position & Transform', 'blicks' ),
		facets: [ 'sceneChild' ],
	},
	{
		// The other placement model: what sits INSIDE a box, placed freely as a share of it. A
		// block matches this or `sceneChild`, never both — a box is on the grid, its contents are
		// in the box — so the two groups coexist and only one is ever present.
		//
		// Listed here for the same reason `Grid` is: this panel replaces the facet rail for
		// anything inside a Scene, so a facet in none of its groups is silently dropped. Both
		// scene facets were invisible until they were named here, with no error anywhere.
		title: __( 'Place in box', 'blicks' ),
		facets: [ 'sceneItem' ],
	},
	{
		title: __( 'Layout & Size', 'blicks' ),
		facets: [ 'layout' ],
		// A stage item is placed, not laid out. Display, overflow, scroll-snap and the flex/grid
		// settings all describe how a box arranges *its own* children in a document flow, which is
		// not the job here — and margin is worse than useless on an absolutely-positioned item.
		fields: [ 'layout.width', 'layout.height', 'layout.aspectRatio', 'layout.objectFit' ],
	},
	{
		title: __( 'Animation', 'blicks' ),
		facets: [ 'animation' ],
		fields: [
			'animation.name',
			'animation.duration',
			'animation.delay',
			'animation.iteration',
			'animation.easing',
		],
	},
	{
		title: __( 'Text / Font', 'blicks' ),
		facets: [ 'typography' ],
		fields: [
			'typography.fontFamily',
			'typography.fontSize',
			'typography.fontWeight',
			'typography.fontStyle',
			'typography.lineHeight',
			'typography.letterSpacing',
			'typography.textAlign',
			'typography.textTransform',
			'colors.text',
		],
	},
	{
		title: __( 'Fill & Border', 'blicks' ),
		facets: [ 'background', 'borders' ],
		fields: [
			'colors.background',
			'background.gradient',
			'background.image',
			'border.width',
			'border.style',
			'border.color',
			'border.radius',
		],
	},
	{
		title: __( 'Visual Effects', 'blicks' ),
		facets: [ 'effects' ],
		fields: [
			'effects.opacity',
			'effects.blendMode',
			'effects.boxShadow',
			'effects.filter',
			'effects.backdropFilter',
		],
	},
];

export function ScenePanel( {
	sections,
	blockLabel,
	controlProps,
	facetHasValue,
	resetFacet,
	lead,
	tail,
}: {
	/** The registry, passed in rather than imported — importing `Inspector` from here is a cycle. */
	sections: StyleSection[];
	/** What the block calls itself, for the header chip. */
	blockLabel: string;
	controlProps: ControlProps;
	facetHasValue: ( controlIds: string[] ) => boolean;
	resetFacet: ( controlIds: string[] ) => void;
	/** Rendered under the chip, above the style groups — a flat panel's own settings. */
	lead?: ReactNode;
	/** Rendered last, after every group. */
	tail?: ReactNode;
} ) {
	const byId = new Map( sections.map( ( section ) => [ section.id, section ] ) );

	return (
		<div className="bl-scene-panel">
			<p className="bl-scene-panel__who">
				<span>{ __( 'Selected', 'blicks' ) }</span>
				<span className="bl-scene-panel__chip">{ blockLabel }</span>
			</p>

			{ lead }

			{ GROUPS.map( ( group ) => {
				// A facet the block does not allow is absent from `sections` already — the caller
				// filters on the same allow-list the rail uses, so a scene image never shows
				// typography and a scene text never shows object-fit.
				const present = group.facets
					.map( ( id ) => byId.get( id ) )
					.filter( ( section ): section is StyleSection => Boolean( section ) );

				if ( present.length === 0 ) {
					return null;
				}

				const ids = present.flatMap( ( section ) => section.controlIds );

				// Curation happens through the facets' own `isAllowed`, not by reimplementing their
				// bodies. Every field in Layout, Typography, Animation, Effects and Border is already
				// gated on it — 39 call sites in Layout alone — so narrowing the predicate hides the
				// rest without touching a control. The block's own allow-list still applies on top:
				// this can only take fields away, never add one the block does not support.
				const groupAllows = group.fields
					? ( controlId: string ) =>
						controlProps.isAllowed( controlId ) && group.fields!.includes( controlId )
					: controlProps.isAllowed;

				// Reset clears what this group shows, not every id its facets own — a Reset that
				// silently cleared a hidden field would be a value the author cannot see and cannot
				// get back.
				const shown = ids.filter( groupAllows );

				return (
					<section className="bl-scene-panel__group" key={ group.title }>
						<h3 className="bl-scene-panel__title">
							<span>{ group.title }</span>
							{ facetHasValue( shown ) && (
								<button
									type="button"
									className="bl-scene-panel__reset"
									onClick={ () => resetFacet( shown ) }
								>
									{ __( 'Reset', 'blicks' ) }
								</button>
							) }
						</h3>

						{ present.map( ( section ) => {
							const Control = section.Control;

							return (
								<div className="bl-scene-panel__body" key={ section.id }>
									<Control { ...controlProps } isAllowed={ groupAllows } />
								</div>
							);
						} ) }
					</section>
				);
			} ) }

			{ tail }
		</div>
	);
}
