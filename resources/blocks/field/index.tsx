/**
 * Field: one question in a Form. A container: its label and help are Text blocks and its control
 * an Input block, so each is styled on its own. The Field keeps the semantic attributes (type, name,
 * label, rules) the server reads, and its own style tree styles the wrapper.
 *
 * Dynamic — `save()` is just the inner blocks and `src/Forms/FieldRenderer.php` writes the wrapper,
 * turns the label Text into the `<label>` (a `<legend>` for choices) and wires up ids.
 */
import { useEffect, useRef } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { createHigherOrderComponent } from '@wordpress/compose';
import { addFilter } from '@wordpress/hooks';
import { __, sprintf } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock, type RenderCtx } from '@/framework/define-block';
import { FieldSettings, FieldStyle, FieldToolbar } from './controls';
import { cleanAppearance, cleanType, cleanWidth, isKnownType, toFieldName, typeInfo, uniqueName } from './model';
import { useFieldTypes } from './controls';
import { cleanMarker } from '@/blocks/form/model';
import { FIELD_CHILDREN, INPUT, TEXT, fieldChildSpecs, findRole, hasParts, labelAfter, plainText, specToBlock } from './create';

const FORM = 'blicks/form';
const FIELD = 'blicks/field';
const EDITOR = 'core/block-editor';

/** At most one Input in a Field: a second one, inserted, pasted or duplicated, is refused. */
addFilter(
	'blockEditor.__unstableCanInsertBlockType',
	'blicks/field/one-input',
	( canInsert: boolean, blockType: any, rootClientId: string | null, { getBlock }: any ) => {
		const name = typeof blockType === 'string' ? blockType : blockType?.name;
		if ( name !== INPUT || ! rootClientId || ! canInsert ) return canInsert;
		const root = getBlock?.( rootClientId );
		if ( root?.name !== FIELD ) return canInsert;
		return ! ( root.innerBlocks ?? [] ).some( ( b: any ) => b.name === INPUT );
	}
);

/**
 * The label and help Texts inside a Field carry the classes the page gives them
 * (`bl-field__label`, `bl-field__help`), so the editor draws them as the page does.
 */
function RoleText( { BlockListBlock, role, ...props }: any ) {
	const inField = useSelect(
		( select: any ) => {
			const store = select( EDITOR );
			return store.getBlockName( store.getBlockRootClientId( props.clientId ) ) === FIELD;
		},
		[ props.clientId ]
	);
	if ( ! inField ) return <BlockListBlock { ...props } />;
	return <BlockListBlock { ...props } className={ [ props.className, `bl-field__${ role }` ].filter( Boolean ).join( ' ' ) } />;
}

addFilter(
	'editor.BlockListBlock',
	'blicks/field/part-classes',
	createHigherOrderComponent(
		( BlockListBlock: any ) => ( props: any ) => {
			const role = props.name === TEXT ? props.attributes?.metadata?.blicksRole : null;
			if ( role !== 'label' && role !== 'help' ) return <BlockListBlock { ...props } />;
			return <RoleText { ...props } BlockListBlock={ BlockListBlock } role={ role } />;
		},
		'withFieldPartClasses'
	)
);

/**
 * The names of the other Fields in this block's Form, split into those before it (in page order)
 * and those after. A Form nested in it is its own and is skipped. Returned as a string so the
 * selector's result compares by value.
 */
function useSiblingNames( clientId: string ): { before: string[]; all: string[]; form: string } {
	const key = useSelect(
		( select: any ) => {
			const editor = select( EDITOR );
			const forms: string[] = editor.getBlockParentsByBlockName( clientId, FORM ) ?? [];
			const form = forms[ forms.length - 1 ];
			if ( ! form ) return '';
			const before: string[] = [];
			const after: string[] = [];
			let seen = false;
			const walk = ( id: string ) => {
				for ( const child of editor.getBlockOrder( id ) as string[] ) {
					const name = editor.getBlockName( child );
					if ( name === FORM ) continue;
					if ( child === clientId ) seen = true;
					else if ( name === FIELD ) {
						const fieldName = String( editor.getBlockAttributes( child )?.name || '' );
						if ( fieldName ) ( seen ? after : before ).push( fieldName );
					}
					walk( child );
				}
			};
			walk( form );
			return JSON.stringify( [ form, before, after ] );
		},
		[ clientId ]
	);
	if ( ! key ) return { before: [], all: [], form: '' };
	const [ form, before, after ] = JSON.parse( key ) as [ string, string[], string[] ];
	return { before, all: [ ...before, ...after ], form };
}

type EditCtx = { attributes: any; setAttributes: ( a: any ) => void; clientId: string };

/**
 * Names a field from its label, and keeps names unique within the Form.
 *
 * - A field with no name takes one from its label. While the author is still writing that label
 *   (the block stays selected and the name is untouched) the name follows it; after that it is
 *   fixed, so renaming the label of a saved field never moves its column in entries.
 * - A field pasted or moved into a Form where an earlier field already has its name is renamed
 *   `name_2`, `name_3`… The earlier one keeps its name, so two copies never both rename.
 */
function useFieldName( { attributes, setAttributes, clientId }: EditCtx ) {
	const { before, all, form } = useSiblingNames( clientId );
	// The label is typed in its Text block, so "still writing it" is the Field or a part selected.
	const selected = useSelect(
		( select: any ) => {
			const store = select( EDITOR );
			return store.isBlockSelected( clientId ) || store.hasSelectedInnerBlock( clientId, true );
		},
		[ clientId ]
	);
	const { __unstableMarkNextChangeAsNotPersistent: notPersistent } = useDispatch( EDITOR ) as any;
	const following = useRef< string | null >( null );
	const { name = '', label = '' } = attributes;

	useEffect( () => {
		if ( ! selected ) following.current = null;
	}, [ selected ] );

	useEffect( () => {
		const fromLabel = toFieldName( label );
		if ( ! fromLabel ) return;
		if ( ! name || ( following.current !== null && name === following.current ) ) {
			const next = uniqueName( fromLabel, all );
			// Only a label being typed now is followed; one set by a template or a paste is not.
			following.current = selected ? next : null;
			if ( next !== name ) {
				// Derived from the label: one undo step takes back the typing and the name together.
				notPersistent?.();
				setAttributes( { name: next } );
			}
		} else if ( name !== following.current ) {
			following.current = null;
		}
		// The label drives this; the sibling list is read as it is when the label changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ label ] );

	useEffect( () => {
		if ( ! name || ! before.includes( name ) ) return;
		notPersistent?.();
		setAttributes( { name: uniqueName( name, all ) } );
		// On insert, paste or a move into another Form — not on every keystroke in the Name box.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ form ] );
}

/**
 * The Field's parts, kept in step with it:
 *
 * - A Field with no parts (inserted bare, pasted, written by an agent) gets its label, Input and
 *   help once, on mount — not as an undo step of its own.
 * - `label` and `help` follow the text of the label and help blocks: they are what entries, emails
 *   and screen readers use. Derived, so they add no undo steps.
 */
function useFieldParts( { attributes, setAttributes, clientId }: EditCtx ) {
	const { __unstableMarkNextChangeAsNotPersistent: notPersistent, replaceInnerBlocks } = useDispatch( EDITOR ) as any;
	const count = useSelect( ( select: any ) => select( EDITOR ).getBlockCount( clientId ), [ clientId ] );
	const texts = useSelect(
		( select: any ) => {
			const children = select( EDITOR ).getBlocks( clientId ) as any[];
			const label = findRole( children, 'label' );
			const help = findRole( children, 'help' );
			return JSON.stringify( [ label ? String( label.attributes.content ?? '' ) : null, help ? String( help.attributes.content ?? '' ) : null ] );
		},
		[ clientId ]
	);

	useEffect( () => {
		// A type whose plugin is off is left exactly as it was saved, parts and all.
		if ( count > 0 || ! hasParts( cleanType( attributes.type ) ) || ! isKnownType( cleanType( attributes.type ) ) ) return;
		notPersistent?.();
		replaceInnerBlocks( clientId, fieldChildSpecs( attributes ).map( specToBlock ), false );
		// Once, on mount: a later empty Field is the author's choice (hidden, or emptied on purpose).
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [] );

	useEffect( () => {
		const [ labelHtml, helpHtml ] = JSON.parse( texts ) as [ string | null, string | null ];
		const next: Record< string, string > = {};
		if ( labelHtml !== null && plainText( labelHtml ) !== String( attributes.label || '' ) ) next.label = plainText( labelHtml );
		if ( helpHtml !== null && plainText( helpHtml ) !== String( attributes.help || '' ) ) next.help = plainText( helpHtml );
		if ( ! Object.keys( next ).length ) return;
		notPersistent?.();
		setAttributes( next );
		// The parts' text drives this.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ texts ] );
}

function useFieldEdit( ctx: EditCtx ) {
	useFieldParts( ctx );
	useFieldName( ctx );
}

/** The editor's Field: the wrapper the page draws, its parts inside as blocks. */
function FieldEdit( { attributes, blockProps, children, context }: RenderCtx ) {
	const type = cleanType( attributes.type );
	// Re-drawn when a companion registers its types after this Field was first drawn.
	useFieldTypes();
	const width = type === 'consent' ? 'full' : cleanWidth( attributes.width );
	const marker = cleanMarker( context?.[ 'blicks/formMarker' ] );
	const appearance = cleanAppearance( type, attributes.appearance );
	const className = [
		blockProps.className,
		`bl-field--${ type }`,
		`bl-field--w-${ width }`,
		attributes.required && type !== 'hidden' ? 'is-required' : '',
		attributes.multiple && type === 'choice' ? 'is-multiple' : '',
		appearance ? `bl-field--a-${ appearance }` : '',
		// The default marker has no class of its own, as on the page.
		marker !== 'optional' ? `bl-field--marker-${ marker }` : '',
		'bl-field--blocks',
		'is-edit',
		attributes.name ? '' : 'is-nameless',
	]
		.filter( Boolean )
		.join( ' ' );

	if ( type === 'hidden' ) {
		return (
			<div { ...blockProps } className={ className }>
				<span className="bl-field__tag">
					<b>{ __( 'Hidden', 'blicks' ) }</b>
					{ ` ${ attributes.name || __( 'no name', 'blicks' ) }` }
					{ attributes.defaultValue ? ` = ${ attributes.defaultValue }` : '' }
				</span>
				{ children }
			</div>
		);
	}

	if ( ! isKnownType( type ) ) {
		return (
			<div { ...blockProps } className={ `${ className } is-unknown` }>
				<span className="bl-field__tag">
					{ sprintf(
						/* translators: %s: the field's type, e.g. rating */
						__( 'This field’s type, %s, comes from a plugin that is not active. It is not shown on the page.', 'blicks' ),
						type
					) }
				</span>
				{ children }
			</div>
		);
	}

	const Tag = type === 'choice' ? 'fieldset' : 'div';
	// The page writes the Form's marker inside the label ("(optional)", "Optional", a red "*");
	// the editor draws the same words after the label Text (style.scss reads the marker class).
	const optional = marker === 'both' ? __( 'Optional', 'blicks' ) : ' ' + __( '(optional)', 'blicks' );
	const style = { ...blockProps.style, '--bl-field-opt': JSON.stringify( optional ) };
	return (
		<Tag { ...blockProps } className={ className } style={ style }>
			{ children }
		</Tag>
	);
}

defineBlock( metadata, {
	dynamic: true,
	panels: {
		Settings: FieldSettings,
		Style: FieldStyle,
		describe: ( attributes ) => String( attributes.label || typeInfo( cleanType( attributes.type ) ).label ),
	},
	Toolbar: FieldToolbar,
	innerBlocks: {
		allowedBlocks: FIELD_CHILDREN,
		templateLock: false,
		renderAppender: false,
		orientation: ( attributes ) => ( labelAfter( cleanType( attributes.type ) ) ? 'horizontal' : 'vertical' ),
	},
	useEdit: useFieldEdit,
	render: ( ctx ) => <FieldEdit { ...ctx } />,
} );
