/**
 * "+ New › Header": a name and a starting layout, and a header template part is created from it
 * and opened in the header mode. A new header is a template part from the first moment, so Save
 * header writes to it, and the Site Editor lists it under Header.
 */
import { Button, TextControl } from '@wordpress/components';
import { createBlocksFromInnerBlocksTemplate, serialize } from '@wordpress/blocks';
import { useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import { editorData, MODE, partRef, studio, type Block } from './host';
import { DESIGNS, LAYOUTS, PAGES_PATH, siteFrom, starterTemplate, type Starter, type Thumb } from './presets';
import { asHeader } from './storage';

export function slugify( value: string ): string {
	return (
		value
			.normalize( 'NFKD' )
			.replace( /[̀-ͯ]/g, '' )
			.toLowerCase()
			.replace( /[^a-z0-9]+/g, '-' )
			.replace( /^-+|-+$/g, '' )
			.slice( 0, 40 ) || 'header'
	);
}

/** A slug no header part of the theme has yet: `main-header`, `main-header-2`… */
export function freeSlug( base: string, taken: string[] ): string {
	let slug = base;
	for ( let n = 2; taken.includes( slug ); n++ ) slug = `${ base }-${ n }`;
	return slug;
}

type Choice = Starter | 'theme';

async function startBlocks( choice: Choice ): Promise< Block[] > {
	if ( 'theme' === choice ) {
		const host = studio();
		const theme = editorData().theme;
		const loaded = host ? await host.entity.load( partRef( `${ theme }//header` ) ).catch( () => ( { blocks: [] as Block[] } ) ) : { blocks: [] as Block[] };
		return ( await asHeader( loaded ) ).blocks;
	}
	const pages = ( await apiFetch( { path: PAGES_PATH } ).catch( () => [] ) ) as Parameters< typeof siteFrom >[ 0 ];
	return createBlocksFromInnerBlocksTemplate( [ starterTemplate( choice, siteFrom( pages ?? [] ) ) as never ] ) as unknown as Block[];
}

export async function createHeader( title: string, choice: Choice ): Promise< string > {
	const parts = ( await apiFetch( { path: '/wp/v2/template-parts?per_page=100&_fields=slug' } ) ) as { slug: string }[];
	const slug = freeSlug( slugify( title ), parts.map( ( p ) => p.slug ) );
	const blocks = await startBlocks( choice );
	const record = ( await apiFetch( {
		path: '/wp/v2/template-parts',
		method: 'POST',
		data: { slug, title, area: 'header', content: serialize( blocks as never ) },
	} ) ) as { id: string };
	return record.id;
}

export function NewHeaderPicker( { onCancel }: { onStart: unknown; onCancel: () => void } ): JSX.Element {
	const [ title, setTitle ] = useState< string >( __( 'Main header', 'blicks-pro' ) );
	const [ busy, setBusy ] = useState( '' );
	const [ problem, setProblem ] = useState( '' );
	const choices: { id: Choice; label: string; description: string; thumb: Thumb }[] = [
		...LAYOUTS.map( ( l ) => ( { ...l, thumb: l.id } ) ),
		...DESIGNS,
		{ id: 'theme', thumb: 'classic', label: __( 'From your theme’s header', 'blicks-pro' ), description: __( 'Its logo, title, menu and buttons, in a Classic header.', 'blicks-pro' ) },
	];

	const start = async ( choice: Choice ): Promise< void > => {
		setBusy( choice );
		setProblem( '' );
		try {
			const id = await createHeader( title.trim() || __( 'Header', 'blicks-pro' ), choice );
			onCancel();
			await studio()?.openRef( MODE, partRef( id ) );
		} catch ( failure ) {
			setProblem( ( failure as { message?: string } )?.message ?? __( 'The header could not be created.', 'blicks-pro' ) );
			setBusy( '' );
		}
	};

	return (
		<div className="bl-hs-new">
			<TextControl __next40pxDefaultSize __nextHasNoMarginBottom label={ __( 'Name', 'blicks-pro' ) } value={ title } onChange={ setTitle } />
			<p>{ __( 'Start from one of these. It is saved as a header template part; choose where it is used in the Site Editor.', 'blicks-pro' ) }</p>
			<ul>
				{ choices.map( ( c ) => (
					<li key={ c.id }>
						<button type="button" className="bl-hs-new__item" disabled={ '' !== busy } onClick={ () => void start( c.id ) }>
							<span className={ `bl-hs-new__thumb is-${ c.thumb }` } aria-hidden="true">
								<i />
								<i />
								<i />
							</span>
							<span>
								<b>{ c.label }</b>
								<small>{ busy === c.id ? __( 'Creating…', 'blicks-pro' ) : c.description }</small>
							</span>
						</button>
					</li>
				) ) }
			</ul>
			{ '' !== problem && (
				<p role="alert" className="bl-hs-new__problem">
					{ problem }
				</p>
			) }
			<Button variant="tertiary" onClick={ onCancel }>
				{ __( 'Cancel', 'blicks-pro' ) }
			</Button>
		</div>
	);
}
