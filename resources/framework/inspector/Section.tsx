import { useState } from '@wordpress/element';

const CHEV_ICON = (
	<svg className="ico chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
		<path d="m6 9 6 6 6-6" />
	</svg>
);

/** Collapsible `.sec` accordion section (mockup vocabulary). */
export function Section( {
	title,
	defaultOpen = true,
	children,
}: {
	title: string;
	defaultOpen?: boolean;
	children: React.ReactNode;
} ) {
	const [ open, setOpen ] = useState( defaultOpen );
	return (
		<section className={ `sec ${ open ? '' : 'collapsed' }` }>
			<button
				type="button"
				className="sec-head"
				aria-expanded={ open }
				onClick={ () => setOpen( ( v ) => ! v ) }
			>
				<h3>{ title }</h3>
				{ CHEV_ICON }
			</button>
			<div className="sec-body">{ children }</div>
		</section>
	);
}
