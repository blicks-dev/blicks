/**
 * Field types a companion plugin adds, published as `window.blicks.forms.registerFieldType()`.
 *
 * Free draws the types; it never knows what they are for. A registered type shows in the Field's
 * Type picker and the Form's "Add a field" list, under its `group` heading, and its `controls`
 * become an extra section of Field Settings. What the type renders, how it validates and how its
 * value reads in entries is the companion's PHP (`blicks_form_field_type_{type}`), not this.
 *
 * ```js
 * const forms = window.blicks?.forms;
 * forms?.registerFieldType( {
 *   type: 'rating',                 // [a-z][a-z0-9-]*, not a built-in type
 *   label: 'Rating',
 *   description: 'Stars from 1 to 5',
 *   icon: 'M12 3l2.9 6 6.1.9-4.5 4.3 1 6.3L12 17.6 6.5 20.5l1-6.3L3 9.9 9.1 9z',  // an SVG path, or an element
 *   group: 'Pro fields',            // the heading it is listed under
 *   controls: RatingSettings,       // ( { attributes, setAttributes } ) => element
 *   defaults: { label: 'Rate us', extensions: { pro: { stars: 5 } } },
 * } );
 * ```
 *
 * A type registered after the editor has drawn its pickers appears in them at once: the pickers
 * subscribe to this store. A saved Field whose type is not registered (its plugin is off) is kept
 * exactly as it is; the editor says so and the page shows nothing for it.
 *
 * Keep this module free of React and the block editor at run time: `model.ts` imports it.
 */
import type { ComponentType, ReactElement } from 'react';
import { isBuiltinType } from './model';

export interface FieldTypeControlsProps {
	attributes: Record< string, any >;
	setAttributes: ( attributes: Record< string, unknown > ) => void;
}

export interface FieldTypeDefinition {
	type: string;
	label: string;
	/** An SVG path (24×24 box), as the inspector's icons take, or an element. */
	icon?: string | ReactElement;
	description?: string;
	/** The heading the type is listed under. Types with no group join the built-in ones. */
	group?: string;
	/** An extra section of Field Settings for this type. */
	controls?: ComponentType< FieldTypeControlsProps >;
	/** The attributes a new Field of this type starts with (e.g. `extensions`). */
	defaults?: Record< string, unknown >;
}

export const FIELD_TYPE_PATTERN = /^[a-z][a-z0-9-]*$/;

let types: readonly FieldTypeDefinition[] = Object.freeze( [] );
const listeners = new Set< () => void >();

const notify = () => listeners.forEach( ( listener ) => listener() );

const warn = ( message: string ) => {
	if ( typeof console !== 'undefined' ) console.warn( `blicks.forms.registerFieldType: ${ message }` );
};

/** Why a definition is refused, or `''` when it is fine. */
export function definitionProblem( def: unknown ): string {
	if ( ! def || typeof def !== 'object' ) return 'pass an object.';
	const d = def as Record< string, unknown >;
	if ( typeof d.type !== 'string' || ! FIELD_TYPE_PATTERN.test( d.type ) ) return '`type` must match [a-z][a-z0-9-]*.';
	if ( isBuiltinType( d.type ) ) return `"${ d.type }" is a built-in type.`;
	if ( typeof d.label !== 'string' || ! d.label.trim() ) return '`label` must be a non-empty string.';
	if ( d.description !== undefined && typeof d.description !== 'string' ) return '`description` must be a string.';
	if ( d.group !== undefined && typeof d.group !== 'string' ) return '`group` must be a string.';
	if ( d.icon !== undefined && typeof d.icon !== 'string' && ( typeof d.icon !== 'object' || d.icon === null ) ) return '`icon` must be an SVG path or an element.';
	if ( d.controls !== undefined && typeof d.controls !== 'function' && ( typeof d.controls !== 'object' || d.controls === null ) ) return '`controls` must be a component.';
	if ( d.defaults !== undefined && ( ! d.defaults || typeof d.defaults !== 'object' || Array.isArray( d.defaults ) ) ) return '`defaults` must be an object.';
	return '';
}

/**
 * Add a field type. True when it was added; false (with a console warning, never a throw) when the
 * definition is refused. Registering a type again replaces it, in its place.
 */
export function registerFieldType( def: FieldTypeDefinition ): boolean {
	const problem = definitionProblem( def );
	if ( problem ) {
		warn( problem );
		return false;
	}
	const clean: FieldTypeDefinition = Object.freeze( {
		type: def.type,
		label: def.label.trim(),
		...( def.icon !== undefined ? { icon: def.icon } : {} ),
		...( def.description ? { description: def.description } : {} ),
		...( def.group?.trim() ? { group: def.group.trim() } : {} ),
		...( def.controls ? { controls: def.controls } : {} ),
		...( def.defaults ? { defaults: { ...def.defaults } } : {} ),
	} );
	const at = types.findIndex( ( t ) => t.type === clean.type );
	types = Object.freeze( at < 0 ? [ ...types, clean ] : types.map( ( t, i ) => ( i === at ? clean : t ) ) );
	notify();
	return true;
}

/** Remove a registered type. True when there was one. Saved Fields of that type are untouched. */
export function unregisterFieldType( type: string ): boolean {
	if ( ! types.some( ( t ) => t.type === type ) ) return false;
	types = Object.freeze( types.filter( ( t ) => t.type !== type ) );
	notify();
	return true;
}

export const getFieldType = ( type: string ): FieldTypeDefinition | undefined => types.find( ( t ) => t.type === type );

/** Every registered type, in the order they were registered. The same array until it changes. */
export const getFieldTypes = (): readonly FieldTypeDefinition[] => types;

/** Hear every change. Returns the function that stops listening. */
export function subscribeFieldTypes( listener: () => void ): () => void {
	listeners.add( listener );
	return () => {
		listeners.delete( listener );
	};
}

/** Whether any companion has put a type under a heading of its own. */
export const hasRegisteredGroups = ( list: readonly FieldTypeDefinition[] = types ): boolean => list.some( ( t ) => !! t.group );

/** For tests: forget every registered type. */
export function resetFieldTypes(): void {
	types = Object.freeze( [] );
	notify();
}
