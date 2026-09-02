import { createBlock } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock } from '@/framework/define-block';
import { SectionControls, cleanSectionDimension, cleanSectionSpace, cleanSectionSurface } from './controls';

const sectionGlyph = (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<rect x="3.5" y="5" width="17" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
		<path d="M7 9.5h10M7 13h10M7 16h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
	</svg>
);

/** A vertical content stack — the canonical inner block for a Section. */
function stack( attrs: Record< string, unknown >, inner: any[] = [] ) {
	return createBlock( 'blicks/stack', { orientation: 'vertical', gap: 'md', ...attrs }, inner );
}

function dimensionStyle( attributes: any ) {
	return {
		'--bl-section-width': cleanSectionDimension( attributes.sectionWidth, 'auto' ),
		'--bl-section-height': cleanSectionDimension( attributes.sectionHeight, 'auto' ),
		'--bl-section-content-width': cleanSectionDimension( attributes.contentWidth, '100%' ),
		'--bl-section-content-min-width': cleanSectionDimension( attributes.contentMinWidth, '0' ),
		'--bl-section-content-max-width': cleanSectionDimension( attributes.contentMaxWidth, 'var(--blicks-content-size, var(--wp--style--global--content-size, 1200px))' ),
	};
}

defineBlock( metadata, {
	dynamic: true,
	innerBlocks: {
		templateLock: false,
		wrapperClassName: 'bl-section__inner',
	},
	placeholder: {
		icon: sectionGlyph,
		title: __( 'Section', 'blicks' ),
		instructions: __( 'A full-width page band — pick a starting layout to begin.', 'blicks' ),
		allowBlank: true,
		presets: [
			{
				label: __( 'Heading + copy', 'blicks' ),
				skeleton: { align: 'start', rows: [ 'title', 'text', 'text-sm' ] },
				create: () => [
					stack( {}, [
						createBlock( 'blicks/heading', { level: 2, content: __( 'Section heading', 'blicks' ) } ),
						createBlock( 'blicks/text', { content: __( 'Describe this section in a sentence or two.', 'blicks' ) } ),
					] ),
				],
			},
			{
				label: __( 'Centered hero', 'blicks' ),
				skeleton: { align: 'center', rows: [ 'title', 'text', 'buttons' ] },
				create: () => [
					stack( { align: 'center', justify: 'center' }, [
						createBlock( 'blicks/heading', { level: 1, content: __( 'Build something great', 'blicks' ) } ),
						createBlock( 'blicks/text', { content: __( 'A short, punchy subheading that explains the value in one line.', 'blicks' ) } ),
						createBlock( 'blicks/buttons', { justify: 'center' }, [
							createBlock( 'blicks/button', { text: __( 'Get started', 'blicks' ), variant: 'default' } ),
							createBlock( 'blicks/button', { text: __( 'Learn more', 'blicks' ), variant: 'outline' } ),
						] ),
					] ),
				],
			},
		],
	},
	Controls: SectionControls,
	render( { attributes, blockProps, innerBlocksProps } ) {
		const className = [
			blockProps.className,
			`bl-section--surface-${ cleanSectionSurface( attributes.surface ) }`,
			`bl-section--space-${ cleanSectionSpace( attributes.sectionSpace ) }`,
		]
			.filter( Boolean )
			.join( ' ' );

		return (
			<section { ...blockProps } className={ className } style={ { ...blockProps.style, ...dimensionStyle( attributes ) } }>
				<div { ...innerBlocksProps } />
			</section>
		);
	},
} );
