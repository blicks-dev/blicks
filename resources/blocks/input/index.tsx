/**
 * Input: the control of a Field — the box, list or choices a visitor fills in. What it asks for
 * (type, name, options, rules) is the Field's, read through block context; its own settings are
 * only what is drawn inside the control (an icon). Its style tree styles the control itself.
 *
 * Dynamic — `save()` is null and `src/Forms/FieldRenderer.php::input()` writes the control. The
 * editor draws an inert copy of the same markup with the same classes. Where the page wraps the
 * control (an icon, a stepper, a slider's numbers, the choices row) the wrap is the block's
 * element here, and the style classes go where the page puts them: on the control, or on each
 * option of a group of choices.
 */
import { useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { defineBlock, type RenderCtx } from '@/framework/define-block';
import { renderIcon } from '@/framework/icons/render';
import { cleanAppearance, cleanType } from '@/blocks/field/model';
import { rangeBounds, rangeText } from '@/blocks/field/create';
import { InputSettings, InputStyle, InputToolbar, takesIcon } from './controls';

/** What the Field tells its Input, from block context. */
export function inputContext( context: Record< string, any > | undefined ) {
	const c = context ?? {};
	const type = cleanType( c[ 'blicks/fieldType' ] );
	const options = ( Array.isArray( c[ 'blicks/fieldOptions' ] ) ? c[ 'blicks/fieldOptions' ] : [] ).map( String ) as string[];
	const notes = ( Array.isArray( c[ 'blicks/fieldOptionNotes' ] ) ? c[ 'blicks/fieldOptionNotes' ] : [] ).map( String ) as string[];
	// Empty options are dropped, as the server drops them, each note with its option.
	const kept = options.map( ( label, i ) => ( { label, note: notes[ i ] ?? '' } ) ).filter( ( o ) => o.label );
	const maxLength = Math.max( 0, Math.floor( Number( c[ 'blicks/fieldMaxLength' ] ) || 0 ) );
	return {
		type,
		placeholder: String( c[ 'blicks/fieldPlaceholder' ] ?? '' ),
		options: kept.map( ( o ) => o.label ),
		notes: kept.map( ( o ) => o.note ),
		multiple: !! c[ 'blicks/fieldMultiple' ],
		appearance: cleanAppearance( type, c[ 'blicks/fieldAppearance' ] ),
		maxLength,
		min: String( c[ 'blicks/fieldMin' ] ?? '' ),
		max: String( c[ 'blicks/fieldMax' ] ?? '' ),
		step: String( c[ 'blicks/fieldStep' ] ?? '' ),
		defaultValue: String( c[ 'blicks/fieldDefault' ] ?? '' ),
		prefix: String( c[ 'blicks/fieldPrefix' ] ?? '' ),
		suffix: String( c[ 'blicks/fieldSuffix' ] ?? '' ),
	};
}

/**
 * The block's classes split in two: the style engine's (`bl-*`: the block, its uid and its style
 * classes), which go where the page puts them, and the editor's own (selection, block list), which
 * stay on the block's element.
 */
export function splitClasses( className: unknown ): { style: string; editor: string } {
	const tokens = String( className ?? '' ).split( /\s+/ ).filter( Boolean );
	return {
		style: tokens.filter( ( t ) => t.startsWith( 'bl-' ) ).join( ' ' ),
		editor: tokens.filter( ( t ) => ! t.startsWith( 'bl-' ) ).join( ' ' ),
	};
}

const join = ( ...list: string[] ) => list.filter( Boolean ).join( ' ' );

function InputPreview( { attributes, blockProps, context, clientId }: RenderCtx ) {
	const { selectBlock } = useDispatch( 'core/block-editor' ) as any;
	const field = inputContext( context );
	const { type, placeholder, options, notes, multiple, appearance, maxLength } = field;
	// Drawn as on the page, but a click selects the block instead of typing or opening a picker.
	const select = ( e: any ) => {
		e.preventDefault();
		if ( clientId ) selectBlock( clientId );
	};
	const inert = { onMouseDown: select, onChange: () => {}, readOnly: true, tabIndex: -1 };
	const split = splitClasses( blockProps.className );
	const { className: _className, style: vars, ...shellProps } = blockProps;
	/** The block's element when it wraps the control: the editor's classes, none of the style. */
	const shell = ( cls: string ) => ( { ...shellProps, className: join( split.editor, cls ), onMouseDown: select } );
	/** The control's style classes and vars, as the page writes them. */
	const styled = ( cls: string ) => ( { className: join( split.style, cls ), style: vars } );
	const icon = attributes.icon && takesIcon( type, appearance ) ? renderIcon( attributes.icon, { className: 'bl-input__icon', strokeWidth: 2 } ) : null;

	if ( type === 'hidden' ) return <span { ...blockProps } />;

	if ( type === 'choice' ) {
		const list = options.length ? options : [ __( 'Option 1', 'blicks' ), __( 'Option 2', 'blicks' ) ];
		return (
			<div { ...shell( 'bl-field__choices' ) }>
				{ list.map( ( o, i ) => (
					<label { ...styled( 'bl-field__choice' ) } key={ i }>
						<input type={ multiple ? 'checkbox' : 'radio' } tabIndex={ -1 } aria-hidden readOnly checked={ false } onChange={ inert.onChange } />
						<span className="bl-field__choice-text">
							<span className="bl-field__choice-label">{ o }</span>
							{ notes[ i ] && <span className="bl-field__choice-note">{ notes[ i ] }</span> }
						</span>
					</label>
				) ) }
			</div>
		);
	}

	if ( type === 'consent' ) {
		return <input { ...blockProps } { ...inert } className={ join( blockProps.className, 'bl-field__check' ) } type="checkbox" role={ appearance === 'switch' ? 'switch' : undefined } checked={ false } />;
	}

	if ( type === 'textarea' ) {
		const textarea = ( props: Record< string, unknown > ) => (
			<textarea { ...props } { ...inert } rows={ 5 } maxLength={ maxLength || undefined } placeholder={ placeholder || undefined } value="" />
		);
		if ( ! maxLength ) return textarea( { ...blockProps, className: join( blockProps.className, 'bl-field__control' ) } );
		// The page writes the counter after the control, in the Field; here it sits in the block.
		return (
			<div { ...shell( 'bl-input-shell' ) }>
				{ textarea( styled( 'bl-field__control' ) ) }
				<p className="bl-field__count">
					<span className="bl-field__count-n">0</span>
					{ ` / ${ maxLength }` }
				</p>
			</div>
		);
	}

	if ( type === 'range' ) {
		const range = rangeBounds( field );
		const words = ( n: number ) => rangeText( n, field );
		return (
			<div { ...shell( 'bl-range' ) }>
				<input
					{ ...styled( 'bl-field__control' ) }
					{ ...inert }
					type="range"
					min={ range.min }
					max={ range.max }
					step={ range.step }
					value={ range.value }
					aria-valuetext={ words( range.value ) }
				/>
				<output className="bl-range__value">{ words( range.value ) }</output>
				<span className="bl-range__min">{ words( range.min ) }</span>
				<span className="bl-range__max">{ words( range.max ) }</span>
			</div>
		);
	}

	const control = ( props: Record< string, unknown > ) =>
		type === 'select' ? (
			<select { ...props } onMouseDown={ select } onChange={ inert.onChange } tabIndex={ -1 } value="">
				<option value="">{ placeholder || __( 'Choose one', 'blicks' ) }</option>
				{ options.map( ( o, i ) => <option key={ i } value={ o }>{ o }</option> ) }
			</select>
		) : (
			<input { ...props } { ...inert } type={ type } placeholder={ placeholder || undefined } maxLength={ maxLength || undefined } value="" />
		);

	if ( type === 'number' && appearance === 'stepper' ) {
		return (
			<span { ...shell( 'bl-stepper' ) }>
				<button type="button" className="bl-stepper__btn" tabIndex={ -1 } aria-label={ __( 'Decrease', 'blicks' ) }>
					−
				</button>
				{ control( styled( 'bl-field__control' ) ) }
				<button type="button" className="bl-stepper__btn" tabIndex={ -1 } aria-label={ __( 'Increase', 'blicks' ) }>
					+
				</button>
			</span>
		);
	}

	if ( icon ) {
		return (
			<span { ...shell( 'bl-input-wrap has-icon' ) }>
				{ icon }
				{ control( styled( 'bl-field__control' ) ) }
			</span>
		);
	}

	return control( { ...blockProps, className: join( blockProps.className, 'bl-field__control' ) } );
}

defineBlock( metadata, {
	dynamic: true,
	panels: {
		Settings: InputSettings,
		Style: InputStyle,
		describe: () => __( 'Input', 'blicks' ),
	},
	Toolbar: InputToolbar,
	render: ( ctx ) => <InputPreview { ...ctx } />,
} );
