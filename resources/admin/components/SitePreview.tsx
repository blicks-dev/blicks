import { __, _n, sprintf } from '@wordpress/i18n';
import { TOKENS, TYPE_ROLE_LABELS } from '../constants';
import { titleCase } from '../data';

/** The sample's CSS variables, from the values being edited. */
export function siteVars( val: ( category: string, slug: string ) => string, roleVal: ( role: string, prop: string ) => string ): Record< string, string > {
	const vars: Record< string, string > = {};
	for ( const slug of TOKENS.color ) vars[ `--c-${ slug }` ] = val( 'color', slug );
	for ( const slug of [ 'xs', 'sm', 'md', 'lg', 'xl' ] ) vars[ `--s-${ slug }` ] = val( 'spacing', slug );
	for ( const slug of [ 'sm', 'md', 'lg', 'full' ] ) vars[ `--r-${ slug }` ] = val( 'radius', slug );
	for ( const slug of [ 'sm', 'md' ] ) vars[ `--sh-${ slug }` ] = val( 'shadow', slug );
	vars[ '--bw-hair' ] = val( 'borderWidth', 'hair' );
	vars[ '--g-brand' ] = val( 'gradient', 'brand' );
	vars[ '--tf-lift' ] = val( 'transform', 'lift' );
	vars[ '--ld-body' ] = val( 'leading', 'body' );
	// Button component tokens: empty until set, so the sample follows the primitives above.
	for ( const [ slug, short ] of [ [ 'radius', 'radius' ], [ 'height', 'height' ], [ 'padding-x', 'px' ], [ 'padding-y', 'py' ], [ 'font-size', 'fs' ], [ 'font-weight', 'fw' ], [ 'border-width', 'bw' ] ] ) {
		vars[ `--btn-${ short }` ] = val( 'button', slug );
	}
	vars[ '--f-sans' ] = val( 'fontFamily', 'sans' );
	for ( const role of [ 'h1', 'h4', 'lead', 'mono', 'body' ] ) {
		vars[ `--t-${ role }-size` ] = roleVal( role, 'fontSize' );
		vars[ `--t-${ role }-weight` ] = roleVal( role, 'fontWeight' );
		vars[ `--t-${ role }-lh` ] = roleVal( role, 'lineHeight' );
		vars[ `--t-${ role }-track` ] = roleVal( role, 'letterSpacing' );
		vars[ `--t-${ role }-transform` ] = roleVal( role, 'textTransform' );
		vars[ `--t-${ role }-family` ] = roleVal( role, 'fontFamily' );
	}
	// Empty values would leave `var()` unresolved and the sample blank; drop them so the CSS
	// fallbacks apply.
	for ( const key of Object.keys( vars ) ) {
		if ( ! vars[ key ] ) delete vars[ key ];
	}
	return vars;
}

/**
 * A small page of the person's own site, painted only from the values being edited — never from
 * the admin's chrome. Every element names the tokens it reads in `data-uses`; when a token is
 * pointed at in the editor, the elements that read it are outlined and labelled, the way the block
 * editor shows a selection.
 */
export function SitePreview( {
	val,
	roleVal,
	highlight,
	look = {},
	note,
}: {
	val: ( category: string, slug: string ) => string;
	roleVal: ( role: string, prop: string ) => string;
	highlight: string | null;
	/** The design language's variables, from `languageVars()`; they win over the token values. */
	look?: Record< string, string >;
	/** Said under the sample when nothing is pointed at, like which language is being tried. */
	note?: string;
} ): JSX.Element {
	const vars = { ...siteVars( val, roleVal ), ...look };

	let hits = 0;
	const uses = ( ids: string, cls = '' ): { className: string; 'data-uses': string; 'data-label'?: string } => {
		const on = !! highlight && ids.split( ' ' ).includes( highlight );
		if ( on ) hits++;
		return { className: [ cls, on ? 'hl' : '' ].filter( Boolean ).join( ' ' ), 'data-uses': ids, 'data-label': on ? highlight ?? undefined : undefined };
	};

	const sample = (
		<div className="site-in">
			<div { ...uses( 'color.border borderWidth.hair', 'site-nav' ) }>
				<span className="logo">Northwind</span>
				<span { ...uses( 'color.muted-foreground' ) }>{ __( 'Work', 'blicks' ) }</span>
				<span { ...uses( 'color.muted-foreground' ) }>{ __( 'Studio', 'blicks' ) }</span>
				<span { ...uses( 'color.muted-foreground' ) }>{ __( 'Journal', 'blicks' ) }</span>
			</div>
			<div { ...uses( 'color.background spacing.xl spacing.lg', 'site-hero' ) }>
				<span { ...uses( 'type.mono color.primary', 'eyebrow' ) }>{ __( 'New this season', 'blicks' ) }</span>
				<span { ...uses( 'type.h1 color.foreground fontFamily.sans', 'h' ) }>{ __( 'Furniture made to outlast the trend', 'blicks' ) }</span>
				<span { ...uses( 'type.lead color.muted-foreground', 'lead' ) }>{ __( 'Solid oak, hand-finished in small batches and shipped flat with every screw you need.', 'blicks' ) }</span>
				<span { ...uses( 'spacing.xs', 'btns' ) }>
					<span { ...uses( 'color.primary color.primary-foreground radius.md shadow.sm transform.lift color.ring spacing.md button.radius button.height button.padding-x button.padding-y button.font-size button.font-weight button.border-width', 'b p' ) }>{ __( 'Shop the range', 'blicks' ) }</span>
					<span { ...uses( 'color.secondary color.secondary-foreground radius.md button.radius button.height button.padding-x button.padding-y button.font-size button.font-weight button.border-width', 'b s' ) }>{ __( 'See the workshop', 'blicks' ) }</span>
				</span>
			</div>
			<div { ...uses( 'spacing.sm', 'site-grid' ) }>
				{ [ [ __( 'In stock', 'blicks' ), __( 'Oak dining chair', 'blicks' ), __( 'Steam-bent back, oiled finish.', 'blicks' ) ], [ __( '2 left', 'blicks' ), __( 'Low bench', 'blicks' ), __( 'Seats three, fits a hallway.', 'blicks' ) ] ].map( ( [ tag, title, text ] ) => (
					<div key={ title } { ...uses( 'color.card color.card-foreground color.border radius.lg shadow.md spacing.md leading.body', 'card' ) }>
						<span { ...uses( 'color.accent color.accent-foreground radius.full', 'tag' ) }>{ tag }</span>
						<span { ...uses( 'type.h4', 'h4' ) }>{ title }</span>
						<span { ...uses( 'color.muted-foreground', 'p' ) }>{ text }</span>
					</div>
				) ) }
			</div>
			<div { ...uses( 'gradient.brand radius.lg', 'grad' ) } />
			<div { ...uses( 'color.muted color.muted-foreground radius.lg', 'muted' ) }>
				<span { ...uses( 'color.input radius.sm', 'field' ) }>you@example.com</span>
				<span { ...uses( 'color.destructive', 'alert' ) }>{ __( 'Required', 'blicks' ) }</span>
			</div>
		</div>
	);

	const [ category, ...rest ] = ( highlight ?? '' ).split( '.' );
	const name = category === 'type' ? ( TYPE_ROLE_LABELS[ rest[ 0 ] ] ?? titleCase( rest[ 0 ] ?? '' ) ) : titleCase( rest.join( '.' ) );

	return (
		<aside className="pv" aria-label={ __( 'Live preview', 'blicks' ) }>
			<div className="pv-head">
				<h2>{ __( 'Your site, live', 'blicks' ) }</h2>
				<span className="hint">{ __( 'Point at a token to see where it’s used', 'blicks' ) }</span>
			</div>
			<div className={ `site${ hits > 0 ? ' dim' : '' }` } style={ vars as React.CSSProperties } aria-hidden="true">
				{ sample }
			</div>
			<p className="pv-note" role="status">
				{ ! highlight && note }
				{ highlight && ( hits > 0
					? sprintf( /* translators: 1: token name, 2: number of places. */ _n( '%1$s is used in %2$d place here.', '%1$s is used in %2$d places here.', hits, 'blicks' ), name, hits )
					: sprintf( /* translators: %s: token name. */ __( '%s isn’t on this sample page.', 'blicks' ), name ) ) }
			</p>
		</aside>
	);
}
