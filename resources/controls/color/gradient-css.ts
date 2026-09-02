/**
 * Gradient value ⇄ CSS, split out of `ColorControl` so it can be reused (and unit-tested) without
 * pulling in the React/WordPress editor bundle. The stored shape is the one the gradient editor
 * edits: `{ type, angle | shape | position, stops: [ { color, position } ] }`, or a bare preset
 * slug for a theme gradient token.
 */

export function clamp( value: number, min = 0, max = 100 ) {
	return Math.min( max, Math.max( min, value ) );
}

export function positionToNumber( position: string ) {
	const parsed = parseFloat( position );
	return Number.isFinite( parsed ) ? clamp( parsed ) : 0;
}

export function defaultGradient() {
	return {
		type: 'linear',
		angle: '90deg',
		stops: [
			{ color: '#6366f1', position: '0%' },
			{ color: '#ec4899', position: '100%' },
		],
	};
}

export function gradientStops( gradient: any ) {
	if ( Array.isArray( gradient?.stops ) && gradient.stops.length >= 2 ) {
		return gradient.stops.map( ( stop: any, index: number ) => ( {
			color: stop?.color || ( index === 0 ? '#6366f1' : '#ec4899' ),
			position: stop?.position || `${ Math.round( ( index / Math.max( gradient.stops.length - 1, 1 ) ) * 100 ) }%`,
		} ) );
	}

	return [
		{ color: gradient?.from || '#6366f1', position: gradient?.fromPos || '0%' },
		{ color: gradient?.to || '#ec4899', position: gradient?.toPos || '100%' },
	];
}

export function gradientCss( gradient: any ) {
	const next = { ...defaultGradient(), ...( gradient || {} ) };
	const stops = gradientStops( next )
		.slice()
		.sort( ( a: any, b: any ) => positionToNumber( a.position ) - positionToNumber( b.position ) )
		.map( ( stop: any ) => `${ stop.color } ${ stop.position }` )
		.join( ', ' );
	const position = typeof next.position === 'string' && next.position.trim() !== '' ? next.position.trim() : '';
	if ( next.type === 'radial' ) {
		const shape = next.shape || 'circle';
		const head = position ? `${ shape } at ${ position }` : shape;
		return `radial-gradient(${ head }, ${ stops })`;
	}
	if ( next.type === 'conic' ) {
		const angle = next.angle || '0deg';
		const head = position ? `from ${ angle } at ${ position }` : `from ${ angle }`;
		return `conic-gradient(${ head }, ${ stops })`;
	}
	return `linear-gradient(${ next.angle }, ${ stops })`;
}
