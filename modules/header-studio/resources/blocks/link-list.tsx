import apiFetch from '@wordpress/api-fetch';
import { FormTokenField } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import metadata from '../../blocks/link-list/block.json';
import { kit, type Option, type PanelProps } from '../blicks';
import type { Define } from './types';

const SOURCE_OPTS: Option< 'menu' | 'pages' >[] = [
	[ 'menu', __( 'A WordPress menu', 'blicks-pro' ) ],
	[ 'pages', __( 'Pages I choose', 'blicks-pro' ) ],
];

interface Rec { id: number; title?: { rendered?: string; raw?: string } | string; name?: string; parent?: number; menus?: number }

const titleOf = ( r: Rec ): string => ( typeof r.title === 'string' ? r.title : r.title?.raw || r.title?.rendered || r.name || `#${ r.id }` ).replace( /<[^>]*>/g, '' );

/** Menus and pages, through core-data: classic menus, block-theme Navigation menus, and the items under a classic menu. */
function useSources( menu: string ): { classic: Rec[]; navigation: Rec[]; items: Rec[]; pages: Rec[] } {
	const classicId = /^classic:(\d+)/.exec( menu )?.[ 1 ];
	return useSelect(
		( select: any ) => {
			const core = select( 'core' );
			return {
				classic: ( core.getEntityRecords( 'root', 'menu', { per_page: -1 } ) ?? [] ) as Rec[],
				navigation: ( core.getEntityRecords( 'postType', 'wp_navigation', { per_page: -1, status: 'publish' } ) ?? [] ) as Rec[],
				items: ( classicId ? core.getEntityRecords( 'root', 'menuItem', { menus: Number( classicId ), per_page: -1 } ) ?? [] : [] ) as Rec[],
				pages: ( core.getEntityRecords( 'postType', 'page', { per_page: 100, status: 'publish' } ) ?? [] ) as Rec[],
			};
		},
		[ classicId ]
	);
}

function Settings( { attributes, setAttributes }: PanelProps ) {
	const { Sec, SegText, Select, Sub, Note } = kit();
	const { classic, navigation, items, pages } = useSources( String( attributes.menu || '' ) );
	const menu = String( attributes.menu || '' );
	const sub = /^(classic:\d+)(?::(\d+))?$/.exec( menu );
	const base = sub ? sub[ 1 ] : menu;
	const under = sub?.[ 2 ] ?? '';
	const parents = items.filter( ( item ) => items.some( ( child ) => child.parent === item.id ) );
	const chosen = ( ( attributes.pages ?? [] ) as number[] ).map( ( id ) => titleOf( pages.find( ( p ) => p.id === id ) ?? { id } ) );
	const source = attributes.source === 'pages' ? 'pages' : 'menu';

	return (
		<Sec title={ __( 'Links', 'blicks-pro' ) }>
			<Sub>{ __( 'Links from', 'blicks-pro' ) }</Sub>
			<SegText options={ SOURCE_OPTS } value={ source } onChange={ ( v ) => setAttributes( { source: v } ) } />
			{ source === 'pages' ? (
				<FormTokenField
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ __( 'Pages', 'blicks-pro' ) }
					value={ chosen }
					suggestions={ pages.map( titleOf ) }
					onChange={ ( tokens: any[] ) =>
						setAttributes( {
							pages: tokens
								.map( ( t ) => pages.find( ( p ) => titleOf( p ) === ( typeof t === 'string' ? t : t.value ) )?.id )
								.filter( ( id ): id is number => typeof id === 'number' ),
						} )
					}
				/>
			) : (
				<>
					<Sub>{ __( 'Menu', 'blicks-pro' ) }</Sub>
					<Select
						label={ __( 'Menu', 'blicks-pro' ) }
						value={ base }
						options={ [
							[ '', __( 'Choose a menu', 'blicks-pro' ) ],
							...navigation.map( ( r ): Option => [ `nav:${ r.id }`, titleOf( r ) ] ),
							...classic.map( ( r ): Option => [ `classic:${ r.id }`, titleOf( r ) ] ),
						] }
						onChange={ ( next ) => setAttributes( { menu: next } ) }
					/>
					{ parents.length > 0 && (
						<>
							<Sub>{ __( 'Only the items under', 'blicks-pro' ) }</Sub>
							<Select
								label={ __( 'Only the items under', 'blicks-pro' ) }
								value={ under }
								options={ [ [ '', __( 'The whole menu', 'blicks-pro' ) ], ...parents.map( ( r ): Option => [ String( r.id ), titleOf( r ) ] ) ] }
								onChange={ ( id ) => setAttributes( { menu: id ? `${ base }:${ id }` : base } ) }
							/>
						</>
					) }
					<Note>{ __( 'Kept in step with the menu: an item added there shows here.', 'blicks-pro' ) }</Note>
				</>
			) }
		</Sec>
	);
}

/** The server's rendering of the list, so the editor shows what the page will. */
function Preview( { attributes }: { attributes: Record< string, unknown > } ) {
	const [ html, setHtml ] = useState< string | null >( null );
	const key = JSON.stringify( { source: attributes.source, menu: attributes.menu, pages: attributes.pages, uniqueId: attributes.uniqueId } );
	useEffect( () => {
		let live = true;
		apiFetch( {
			path: '/wp/v2/block-renderer/blicks/link-list?context=edit',
			method: 'POST',
			data: { attributes: JSON.parse( key ) },
		} )
			.then( ( r: any ) => live && setHtml( String( r?.rendered ?? '' ) ) )
			.catch( () => live && setHtml( '' ) );
		return () => {
			live = false;
		};
	}, [ key ] );

	if ( html === null ) return <p className="bl-link-list__note">{ __( 'Loading links…', 'blicks-pro' ) }</p>;
	if ( html === '' ) return <p className="bl-link-list__note">{ __( 'No links yet. Choose a menu or pages in the settings.', 'blicks-pro' ) }</p>;
	return <div className="bl-link-list__preview" dangerouslySetInnerHTML={ { __html: html } } />;
}

/** Links from a WordPress menu or chosen pages. Dynamic: nothing is saved but its settings. */
export const linkList: Define = ( defineBlock, panels ) =>
	defineBlock( metadata, {
		...panels( { Settings, describe: ( a ) => ( a.source === 'pages' ? __( 'Pages', 'blicks-pro' ) : __( 'From a menu', 'blicks-pro' ) ) } ),
		dynamic: true,
		render( { attributes, blockProps, isEdit }: any ) {
			if ( ! isEdit ) return null;
			return (
				<div { ...blockProps }>
					<Preview attributes={ attributes } />
				</div>
			);
		},
	} );
