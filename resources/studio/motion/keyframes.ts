/**
 * Custom keyframes: the records the site's animation library holds, and what the Studio does with
 * them — draw them as CSS, edit them as poses, and carry them with a tree to another site.
 *
 * **The library is site-wide; a tree is not.** A block names its animation (`bl-anim-<slug>`), and
 * the `@keyframes` behind that name live in an option on this site. Copy the tree anywhere else
 * and it arrives pointing at a name nothing declares, which is a block that silently stops moving.
 * So a tree leaves the Studio with the records it names (`usedBy`), and arrives through
 * `reconcile`, which adds what is missing and renames what clashes rather than overwriting it.
 *
 * Pure: no WordPress, no DOM. The panel and the doors hold the state; this holds the rules.
 */
import type { BlockNode } from '../mount';

export interface KeyframeStep {
	/** Percent through the animation, 0–100. */
	offset: number;
	declarations: Record< string, string >;
}

/** One record in the site's library, as the REST route and the pattern meta both carry it. */
export interface Keyframes {
	slug: string;
	label: string;
	defaults?: Record< string, string >;
	steps: KeyframeStep[];
}

/** What the editor settings list: the built-ins (no steps) and the site's own (with steps). */
export interface LibraryAnimation {
	slug: string;
	/** The `animation-name` the block writes. */
	name: string;
	label: string;
	builtin: boolean;
	defaults?: Record< string, string >;
	steps?: KeyframeStep[];
}

/** The namespace custom keyframes live in — `Keyframes::PREFIX` on the PHP side. */
export const PREFIX = 'bl-anim-';

export const nameOf = ( slug: string ): string => `${ PREFIX }${ slug }`;

/** The slug behind a custom animation name, or null for a built-in or anything else. */
export function slugOf( name: string ): string | null {
	return name.startsWith( PREFIX ) && name.length > PREFIX.length ? name.slice( PREFIX.length ) : null;
}

/** Lowercase kebab, the shape `Animations::slug()` keeps. */
export function slugify( text: string ): string {
	return text
		.toLowerCase()
		.trim()
		.replace( /[^a-z0-9-]+/g, '-' )
		.replace( /-+/g, '-' )
		.replace( /^-|-$/g, '' )
		.slice( 0, 40 );
}

/**
 * Names the built-ins hold. A custom slug may not take one — the same refusal the server makes, so
 * a name the Studio offers is never one the save then rejects.
 */
export const RESERVED = [ 'spin', 'float', 'ping', 'rise', 'pan', 'marquee', 'fill' ];

/** `base`, else `base-2`, `base-3`… — the first one nothing has taken. */
export function freeSlug( base: string, taken: Iterable< string > ): string {
	const used = new Set( [ ...taken, ...RESERVED ] );
	const root = slugify( base ) || 'animation';

	if ( ! used.has( root ) ) {
		return root;
	}

	for ( let n = 2; ; n++ ) {
		const candidate = `${ root.slice( 0, 36 ) }-${ n }`;

		if ( ! used.has( candidate ) ) {
			return candidate;
		}
	}
}

/* ------------------------------------------------------------------ drawing them */

/**
 * A value that cannot leave its declaration. The server re-validates everything it stores; this is
 * for the preview, which is written into a live `<style>` before anything is saved.
 */
export function safeValue( value: string ): string {
	const v = String( value ).trim();

	return v === '' || /[;{}<>\\@]|url\s*\(|expression\s*\(/i.test( v ) || v.length > 200 ? '' : v;
}

/** `@keyframes` for each record, under its real name, keeping only `allowed` properties. */
export function keyframesCss( list: Keyframes[], allowed: readonly string[] ): string {
	const ok = new Set( allowed );

	return list
		.map( ( record ) => {
			const steps = [ ...record.steps ]
				.sort( ( a, b ) => a.offset - b.offset )
				.map( ( step ) => {
					const body = Object.entries( step.declarations )
						.filter( ( [ property ] ) => ok.has( property ) )
						.map( ( [ property, value ] ) => [ property, safeValue( value ) ] )
						.filter( ( [ , value ] ) => value !== '' )
						.map( ( [ property, value ] ) => `${ property }: ${ value };` )
						.join( ' ' );

					return body === '' ? '' : `${ clampOffset( step.offset ) }% { ${ body } }`;
				} )
				.filter( Boolean );

			return steps.length === 0 || ! /^[a-z0-9-]+$/.test( record.slug )
				? ''
				: `@keyframes ${ nameOf( record.slug ) } { ${ steps.join( ' ' ) } }`;
		} )
		.filter( Boolean )
		.join( '\n' );
}

const clampOffset = ( n: number ): number => Math.max( 0, Math.min( 100, Math.round( Number( n ) || 0 ) ) );

/** Same motion, whatever order the steps or declarations were written in. */
export function sameSteps( a: KeyframeStep[], b: KeyframeStep[] ): boolean {
	const norm = ( steps: KeyframeStep[] ): string =>
		JSON.stringify(
			[ ...steps ]
				.sort( ( x, y ) => x.offset - y.offset )
				.map( ( s ) => [ clampOffset( s.offset ), Object.entries( s.declarations ).map( ( [ k, v ] ) => [ k, String( v ).trim() ] ).sort() ] )
		);

	return norm( a ) === norm( b );
}

/* ------------------------------------------------------------------ poses */

/**
 * What the sliders edit: the handful of moves most motion is made of. Anything else a step sets
 * stays in `extra`, untouched, and is written back as it was.
 */
export interface Pose {
	x: number;
	y: number;
	scale: number;
	turn: number;
	show: number;
	blur: number;
}

export const REST_POSE: Pose = { x: 0, y: 0, scale: 1, turn: 0, show: 1, blur: 0 };

/** The transform the sliders write — and the only shape they read back. */
const TRANSFORM = /^translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s+scale\((-?[\d.]+)\)\s+rotate\((-?[\d.]+)deg\)$/;
const BLUR = /^blur\(([\d.]+)px\)$/;

export function readPose( declarations: Record< string, string > ): { pose: Pose; extra: Record< string, string > } {
	const pose: Pose = { ...REST_POSE };
	const extra: Record< string, string > = {};

	for ( const [ property, value ] of Object.entries( declarations ) ) {
		const v = String( value ).trim();
		const t = property === 'transform' ? TRANSFORM.exec( v ) : null;
		const b = property === 'filter' ? BLUR.exec( v ) : null;

		if ( t ) {
			pose.x = Number( t[ 1 ] );
			pose.y = Number( t[ 2 ] );
			pose.scale = Number( t[ 3 ] );
			pose.turn = Number( t[ 4 ] );
		} else if ( b ) {
			pose.blur = Number( b[ 1 ] );
		} else if ( property === 'opacity' && /^[\d.]+$/.test( v ) ) {
			pose.show = Number( v );
		} else {
			extra[ property ] = v;
		}
	}

	return { pose, extra };
}

/**
 * A pose back to declarations. A part left at rest is not written, so a step that only fades
 * does not also pin a transform — which would fight a transform the block already has.
 */
export function writePose( pose: Pose, extra: Record< string, string > = {} ): Record< string, string > {
	const out: Record< string, string > = { ...extra };
	const round = ( n: number ): number => Math.round( n * 100 ) / 100;

	delete out.transform;
	delete out.opacity;
	delete out.filter;

	if ( pose.x !== 0 || pose.y !== 0 || pose.scale !== 1 || pose.turn !== 0 ) {
		out.transform = `translate(${ round( pose.x ) }px, ${ round( pose.y ) }px) scale(${ round( pose.scale ) }) rotate(${ round( pose.turn ) }deg)`;
	}

	if ( pose.show !== 1 ) {
		out.opacity = String( round( pose.show ) );
	}

	if ( pose.blur !== 0 ) {
		out.filter = `blur(${ round( pose.blur ) }px)`;
	}

	// A transform or filter written by hand and not in the slider shape is kept as it was.
	for ( const property of [ 'transform', 'filter', 'opacity' ] ) {
		if ( extra[ property ] !== undefined && out[ property ] === undefined ) {
			out[ property ] = extra[ property ]!;
		}
	}

	return out;
}

/** A step the sliders can show: one that sets something, or the empty rest frame. */
export function stepAt( record: Keyframes, offset: number ): KeyframeStep | undefined {
	return record.steps.find( ( s ) => s.offset === offset );
}

/**
 * A new step between `offset` and the next one, posed as the one it was split from. Returns the
 * record unchanged when there is no room (adjacent whole percents).
 */
export function splitAfter( record: Keyframes, offset: number ): { record: Keyframes; offset: number } {
	const sorted = [ ...record.steps ].sort( ( a, b ) => a.offset - b.offset );
	const at = sorted.findIndex( ( s ) => s.offset === offset );
	const from = sorted[ at ];
	const next = sorted[ at + 1 ];
	const target = next ? Math.round( ( offset + next.offset ) / 2 ) : offset === 100 ? -1 : 100;

	if ( ! from || target < 0 || target === offset || sorted.some( ( s ) => s.offset === target ) ) {
		return { record, offset };
	}

	const steps = [ ...sorted, { offset: target, declarations: { ...from.declarations } } ].sort( ( a, b ) => a.offset - b.offset );

	return { record: { ...record, steps }, offset: target };
}

/* ------------------------------------------------------------------ trees */

type Tree = Record< string, Record< string, Record< string, unknown > > >;

const treeOf = ( node: BlockNode ): Tree | null => {
	const tree = ( node.attributes as { blicks?: unknown } | undefined )?.blicks;

	return tree && typeof tree === 'object' ? ( tree as Tree ) : null;
};

/** Every `animation-name` value anywhere in the tree: any state, breakpoint or part. */
function namesOf( tree: Tree ): string[] {
	const control = tree[ 'animation.name' ];

	if ( ! control || typeof control !== 'object' ) {
		return [];
	}

	return Object.values( control ).flatMap( ( byBp ) =>
		byBp && typeof byBp === 'object' ? Object.values( byBp ).filter( ( v ): v is string => typeof v === 'string' ) : []
	);
}

/** The custom slugs a tree names, in first-seen order. */
export function slugsIn( blocks: BlockNode[] ): string[] {
	const found = new Set< string >();
	const walk = ( nodes: BlockNode[] ): void =>
		nodes.forEach( ( node ) => {
			const tree = treeOf( node );

			if ( tree ) {
				namesOf( tree ).forEach( ( name ) => {
					const slug = slugOf( name );

					if ( slug ) {
						found.add( slug );
					}
				} );
			}

			walk( node.innerBlocks ?? [] );
		} );

	walk( blocks );

	return [ ...found ];
}

/** How many blocks in the tree name this slug. */
export function countUses( blocks: BlockNode[], slug: string ): number {
	const name = nameOf( slug );
	let count = 0;
	const walk = ( nodes: BlockNode[] ): void =>
		nodes.forEach( ( node ) => {
			const tree = treeOf( node );

			if ( tree && namesOf( tree ).includes( name ) ) {
				count++;
			}

			walk( node.innerBlocks ?? [] );
		} );

	walk( blocks );

	return count;
}

/** The tree with every use of one slug pointed at another. New nodes; the input is not touched. */
export function renameIn( blocks: BlockNode[], from: string, to: string ): BlockNode[] {
	const old = nameOf( from );
	const next = nameOf( to );

	return blocks.map( ( node ) => {
		const tree = treeOf( node );
		let attributes = node.attributes;

		if ( tree && namesOf( tree ).includes( old ) ) {
			const control = Object.fromEntries(
				Object.entries( tree[ 'animation.name' ]! ).map( ( [ slot, byBp ] ) => [
					slot,
					Object.fromEntries( Object.entries( byBp ).map( ( [ bp, v ] ) => [ bp, v === old ? next : v ] ) ),
				] )
			);

			attributes = { ...node.attributes, blicks: { ...tree, 'animation.name': control } };
		}

		return {
			...node,
			attributes,
			...( node.innerBlocks ? { innerBlocks: renameIn( node.innerBlocks, from, to ) } : {} ),
		};
	} );
}

/** The records a tree names, from whatever holds them (the library, then the session's drafts). */
export function usedBy( blocks: BlockNode[], known: Keyframes[] ): Keyframes[] {
	const bySlug = new Map( known.map( ( k ) => [ k.slug, k ] ) );

	return slugsIn( blocks ).flatMap( ( slug ) => {
		const record = bySlug.get( slug );

		return record ? [ { slug: record.slug, label: record.label, ...( record.defaults ? { defaults: record.defaults } : {} ), steps: record.steps } ] : [];
	} );
}

/* ------------------------------------------------------------------ arriving */

export type ArrivalKind = 'new' | 'same' | 'renamed';

export interface Arrival {
	kind: ArrivalKind;
	/** The record as it will be used here — renamed, when it clashed. */
	keyframes: Keyframes;
	/** The slug it arrived under, when that differs. */
	from?: string;
}

/**
 * Bring a tree's keyframes onto this site.
 *
 * - **new** — nothing here has that slug: it joins the session's drafts.
 * - **same** — this site already has it, step for step: the tree uses this site's.
 * - **renamed** — this site has a different animation under that slug. Neither is overwritten:
 *   theirs gets the next free slug and the tree is pointed at it. "Keep both" is the default
 *   because it is the only choice that loses nothing; the panel offers "use mine" to undo it.
 *
 * Records the tree does not name are dropped — a pattern carries only what it uses.
 */
export function reconcile( blocks: BlockNode[], incoming: Keyframes[], here: Keyframes[] ): { blocks: BlockNode[]; arrivals: Arrival[] } {
	const named = new Set( slugsIn( blocks ) );
	const bySlug = new Map( here.map( ( k ) => [ k.slug, k ] ) );
	const taken = new Set( here.map( ( k ) => k.slug ) );
	const arrivals: Arrival[] = [];
	let tree = blocks;

	for ( const record of incoming ) {
		if ( ! named.has( record.slug ) || RESERVED.includes( record.slug ) ) {
			continue;
		}

		const mine = bySlug.get( record.slug );

		if ( ! mine ) {
			arrivals.push( { kind: 'new', keyframes: record } );
			taken.add( record.slug );
			continue;
		}

		if ( sameSteps( mine.steps, record.steps ) ) {
			arrivals.push( { kind: 'same', keyframes: mine } );
			continue;
		}

		const slug = freeSlug( record.slug, taken );

		taken.add( slug );
		tree = renameIn( tree, record.slug, slug );
		arrivals.push( { kind: 'renamed', keyframes: { ...record, slug }, from: record.slug } );
	}

	return { blocks: tree, arrivals };
}
