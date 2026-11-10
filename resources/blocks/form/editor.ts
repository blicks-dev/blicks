/**
 * The Form's editor helpers: what is wrong with the blocks inside it, unique field names, and
 * which template the placeholder picked.
 */
import { useDispatch, useSelect } from '@wordpress/data';
import { useEffect, useMemo, useRef } from '@wordpress/element';
import { uniqueName } from '@/blocks/field/model';
import { templateAttributes, type TemplateKey } from './templates';

export interface FormProblems {
	/** No Button inside is set to Send form. */
	noSubmit: boolean;
	/** Names two or more fields share. */
	duplicates: string[];
	/** Fields with no name: the server skips them. */
	unnamed: number;
}

interface FieldRef {
	clientId: string;
	name: string;
}

/** The Field blocks in a form's inner blocks, depth-first. A form inside the form is its own. */
export function formFields( blocks: any[] ): FieldRef[] {
	const out: FieldRef[] = [];
	const walk = ( list: any[] ) => {
		for ( const block of list ?? [] ) {
			if ( block?.name === 'blicks/form' ) continue;
			if ( block?.name === 'blicks/field' ) {
				out.push( { clientId: block.clientId, name: typeof block.attributes?.name === 'string' ? block.attributes.name : '' } );
			}
			walk( block?.innerBlocks );
		}
	};
	walk( blocks );
	return out;
}

/** True when a Button set to Send form sits anywhere inside (but not in a nested form). */
function hasSubmit( blocks: any[] ): boolean {
	return ( blocks ?? [] ).some(
		( block ) => block?.name !== 'blicks/form' && ( ( block?.name === 'blicks/button' && block.attributes?.action === 'submit' ) || hasSubmit( block?.innerBlocks ) )
	);
}

export function findProblems( blocks: any[] ): FormProblems {
	const fields = formFields( blocks );
	const counts = new Map< string, number >();
	let unnamed = 0;
	for ( const { name } of fields ) {
		if ( ! name ) unnamed++;
		else counts.set( name, ( counts.get( name ) ?? 0 ) + 1 );
	}
	return {
		noSubmit: ! hasSubmit( blocks ),
		duplicates: [ ...counts ].filter( ( [ , n ] ) => n > 1 ).map( ( [ name ] ) => name ),
		unnamed,
	};
}

export const hasProblems = ( p: FormProblems ) => p.noSubmit || p.duplicates.length > 0 || p.unnamed > 0;

/** The form's inner blocks (a stable array from the store) and what is wrong with them. */
export function useFormProblems( clientId: string | undefined ): FormProblems {
	const blocks = useSelect( ( select: any ) => ( clientId ? select( 'core/block-editor' ).getBlocks( clientId ) : [] ), [ clientId ] );
	return useMemo( () => findProblems( blocks ), [ blocks ] );
}

/**
 * Renames for fields that just arrived (inserted, pasted, duplicated) with a name another field
 * already has: `email` → `email_2`. `known` is the fields seen with a name before; it is updated.
 * A field the author renames into a clash is never renamed back: the inspector warns instead.
 */
export function renamesFor( fields: FieldRef[], known: Set< string > ): Array< { clientId: string; name: string } > {
	const taken = fields.filter( ( f ) => known.has( f.clientId ) && f.name ).map( ( f ) => f.name );
	const renames: Array< { clientId: string; name: string } > = [];
	for ( const f of fields ) {
		if ( known.has( f.clientId ) || ! f.name ) continue;
		const name = uniqueName( f.name, taken );
		if ( name !== f.name ) renames.push( { clientId: f.clientId, name } );
		taken.push( name );
		known.add( f.clientId );
	}
	return renames;
}

/**
 * The template the placeholder last picked. The framework's placeholder only replaces the inner
 * blocks; a preset's `create()` notes its key here, and the form whose blocks just appeared takes it.
 */
let picked: TemplateKey | null = null;
export const notePicked = ( key: TemplateKey ) => {
	picked = key;
};

/** The Form's always-on editor effects: unique names for new fields, and the picked template. */
export function useFormEdit( { attributes, setAttributes, clientId }: { attributes: any; setAttributes: ( a: any ) => void; clientId: string } ) {
	const blocks = useSelect( ( select: any ) => select( 'core/block-editor' ).getBlocks( clientId ), [ clientId ] );
	const { updateBlockAttributes, __unstableMarkNextChangeAsNotPersistent: notPersistent } = useDispatch( 'core/block-editor' ) as any;
	const known = useRef< Set< string > | null >( null );
	const count = useRef< number >( blocks.length );

	useEffect( () => {
		const fields = formFields( blocks );
		if ( ! known.current ) {
			// What the form already holds is the author's: only later arrivals are renamed.
			known.current = new Set( fields.filter( ( f ) => f.name ).map( ( f ) => f.clientId ) );
		} else {
			for ( const { clientId: id, name } of renamesFor( fields, known.current ) ) {
				notPersistent?.();
				updateBlockAttributes( id, { name } );
			}
		}

		if ( count.current === 0 && blocks.length > 0 && picked ) {
			const key = picked;
			picked = null;
			notPersistent?.();
			setAttributes( templateAttributes( key, attributes.after ) );
		}
		count.current = blocks.length;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ blocks ] );
}
