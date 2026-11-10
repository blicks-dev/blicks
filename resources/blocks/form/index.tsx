/**
 * Form block: a container for Field blocks and a Button set to Send form. Dynamic: `save()` keeps
 * only the inner blocks, and `src/Forms/FormRenderer.php` writes the `<form>` around them.
 */
import { useSelect } from '@wordpress/data';
import { addFilter } from '@wordpress/hooks';
import { __, sprintf } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock, type BlockPlaceholderPreset, type RenderCtx } from '@/framework/define-block';
import { cleanMarker, formAllowedBlocks, formClasses, cleanName, withErrorColour } from './model';
import { FormMotion, FormSettings, FormStyle, FormToolbar, problemLines } from './controls';
import { hasProblems, notePicked, useFormEdit, useFormProblems } from './editor';
import { TEMPLATES, templateBlocks, templateName } from './templates';

const formGlyph = (
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<rect x="3.5" y="4" width="17" height="16" rx="3" stroke="currentColor" strokeWidth="1.5" />
		<path d="M7 8.5h10M7 12h10M7 15.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
	</svg>
);

const PRESETS: BlockPlaceholderPreset[] = TEMPLATES.map( ( t ) => ( {
	label: t.name,
	skeleton: t.skeleton,
	create: () => {
		notePicked( t.key );
		return templateBlocks( t.key );
	},
} ) );

/**
 * On the canvas the Form is the same 6-column grid as on the page: the element holding the inner
 * blocks carries the style classes (gaps) and the look classes, so fields preview as they will
 * look. A `div`, not a `form`: Enter in a field must not submit the editor.
 */
function FormInPost( { attributes, blockProps, children, clientId }: RenderCtx ) {
	const problems = useFormProblems( clientId );
	const empty = useSelect( ( select: any ) => ! clientId || select( 'core/block-editor' ).getBlockCount( clientId ) === 0, [ clientId ] );
	// The form's own name when it has one, else its template's.
	const name = cleanName( attributes.name ) || templateName( attributes.template );
	// Wide and full as the page writes them (FormRenderer), whether or not the editor's align
	// support has already put the class on the wrapper.
	const align = attributes.align === 'wide' || attributes.align === 'full' ? `align${ attributes.align }` : '';
	const className = [
		blockProps.className,
		...formClasses( attributes ),
		`bl-form--marker-${ cleanMarker( attributes.marker ) }`,
		align && ! String( blockProps.className ?? '' ).split( ' ' ).includes( align ) ? align : '',
		'is-edit',
	]
		.filter( Boolean )
		.join( ' ' );
	const lines = problemLines( problems );

	return (
		<div { ...blockProps } className={ className } style={ withErrorColour( blockProps.style, attributes.errorColour ) }>
			<span className="bl-form__tag" contentEditable={ false } aria-hidden="true">
				{ name ? sprintf( /* translators: %s: template name, e.g. Contact */ __( 'Form · %s', 'blicks' ), name ) : __( 'Form', 'blicks' ) }
			</span>
			{ children }
			{ ! empty && hasProblems( problems ) && (
				<p className="bl-form__hint" contentEditable={ false } title={ lines.join( ' ' ) }>
					{ lines[ 0 ] }
				</p>
			) }
		</div>
	);
}

// The block type's own list, resolved as it registers (`blicks.form.allowedBlocks`, model.ts).
addFilter( 'blocks.registerBlockType', 'blicks/form/allowed-blocks', ( settings: any, name: string ) =>
	name === metadata.name ? { ...settings, allowedBlocks: formAllowedBlocks() } : settings
);

defineBlock( metadata, {
	dynamic: true,
	innerBlocks: {
		// A getter, so each draw re-reads the filter: a companion that adds it after this script ran
		// (on `blicks.forms.ready`) is still honoured.
		get allowedBlocks() {
			return formAllowedBlocks();
		},
		templateLock: false,
	},
	placeholder: {
		icon: formGlyph,
		title: __( 'Start this form', 'blicks' ),
		instructions: __( 'Pick a template. It adds ordinary blocks, so every field and button stays editable.', 'blicks' ),
		presets: PRESETS,
	},
	panels: {
		Settings: FormSettings,
		Style: FormStyle,
		Motion: FormMotion,
		describe: ( attributes ) => templateName( attributes.template ),
	},
	Toolbar: FormToolbar,
	useEdit: useFormEdit,
	render: ( ctx ) => <FormInPost { ...ctx } />,
} );
