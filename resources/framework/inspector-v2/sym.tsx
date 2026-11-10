import { SYMBOLS } from './symbols.gen';

/** A Material Symbols Rounded glyph. Decorative unless it is given a label. */
export function Sym( { name, label, className }: { name: string; label?: string; className?: string } ) {
	const glyph = SYMBOLS[ name ];
	if ( ! glyph ) return null;
	return (
		<svg className={ `bui-ms${ className ? ` ${ className }` : '' }` } viewBox={ glyph[ 0 ] } aria-hidden={ label ? undefined : true } role={ label ? 'img' : undefined } aria-label={ label } focusable="false">
			{ label && <title>{ label }</title> }
			<path d={ glyph[ 1 ] } />
		</svg>
	);
}
