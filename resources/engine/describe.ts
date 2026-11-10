import {
	BP_KEY,
	BP_MAX,
	CONTROL_FLAGS,
	CONTROL_VALUES,
	PART_CONTROLS,
	PARTS,
	RELATIONS,
	RULES,
	SECTION_CONTROLS,
	STATE_CONTROLS,
	STATE_KEY,
	TYPE_ROLES,
	VALUE_SHAPES,
	VALUE_TREE,
	type RelationKind,
} from './schema.gen';

/**
 * The style engine, described for code outside it: Blicks Pro, Studio and the AI validator.
 *
 * This is a read-only projection of `resources/engine/schema.json`, not the generated tables
 * themselves. Those (`RULES`, `PART_PROPS`, the SCSS maps) are emission details — class letters,
 * var names, guards — and stay free to change between releases. What a caller needs is smaller and
 * steadier: which control ids exist, what a value of each looks like, which slots (state, part,
 * breakpoint) it may be written in, and how controls bear on one another. Committing to that is what
 * lets the tables keep evolving.
 *
 * The PHP mirror is `Blicks\Style\EngineSchema::describe()`, which returns the same shape from the
 * same generated source. Both are pinned against `schema.json` by their tests.
 *
 * `version` is the format of THIS object. It goes up when a key is removed or changes meaning; a
 * new control, state or key does not move it.
 */
export const ENGINE_SCHEMA_VERSION = 1;

/** How a stored value is laid out: four sides, four corners, or one value. */
export type EngineValueShape = 'sides' | 'corners' | 'scalar';

export interface EngineControl {
	id: string;
	/** The inspector section that owns it. */
	section: string | null;
	valueShape: EngineValueShape;
	/** Token family its slugs resolve against (`spacing`, `color`, …), or null for none. */
	category: string | null;
	/** Emits per-instance scoped CSS (a real selector) rather than a class and an inline var. */
	scoped: boolean;
	/** May be written on a part slot (`before`, `after:hover`). */
	parts: boolean;
	/** Renders ONLY on a part; a value in an element slot emits nothing. */
	partOnly: boolean;
	/** `caution`: works but deserves a warning. `niche`: sits behind search. */
	flag: 'caution' | 'niche' | null;
	/** The value's shape name (a key of `valueShapes`), token scale and, for an enum, its names. */
	value: { shape: string; tokens?: string; values?: readonly string[]; property?: string; note?: string };
}

export interface EngineDescription {
	version: number;
	controls: readonly EngineControl[];
	/** Every state, in schema order. `default` has an empty key. */
	states: ReadonlyArray< { id: string; key: string } >;
	/** States limited to a subset of controls. A state absent here styles every control. */
	stateControls: Readonly< Record< string, readonly string[] > >;
	/** Widest first. `maxWidth` is null for the base breakpoint. */
	breakpoints: ReadonlyArray< { id: string; key: string; maxWidth: string | null } >;
	/** Part ids besides the implicit `element`. */
	parts: readonly string[];
	sections: ReadonlyArray< { id: string; controls: readonly string[] } >;
	relations: ReadonlyArray< { kind: RelationKind; from: string; to: readonly string[]; note: string } >;
	/** JSON Schema per value shape name. */
	valueShapes: Readonly< Record< string, Record< string, unknown > > >;
	/** How values are stored around a value: per slot, then per breakpoint. */
	valueTree: Readonly< Record< string, unknown > >;
	typeRoles: readonly string[];
}

const SHAPE: Record< string, EngineValueShape > = { sides: 'sides', inset: 'sides', corners: 'corners' };

function deepFreeze< T >( value: T ): T {
	if ( value && typeof value === 'object' && ! Object.isFrozen( value ) ) {
		Object.values( value as Record< string, unknown > ).forEach( deepFreeze );
		Object.freeze( value );
	}
	return value;
}

let cached: EngineDescription | null = null;

/**
 * The engine description. Built once and deep-frozen: the generated tables cannot change at runtime
 * (control ids are not registerable from JS), and a caller must not be able to mutate what the
 * inspector and validator read. Values are structured copies, so freezing never reaches the tables.
 */
export function describeEngine(): EngineDescription {
	if ( cached ) return cached;

	const sectionOf: Record< string, string > = {};
	for ( const [ section, ids ] of Object.entries( SECTION_CONTROLS ) ) {
		for ( const id of ids ) sectionOf[ id ] ??= section;
	}
	const partable = new Set( PART_CONTROLS );

	const controls: EngineControl[] = RULES.map( ( rule ) => ( {
		id: rule.attr,
		section: sectionOf[ rule.attr ] ?? null,
		valueShape: SHAPE[ rule.kind ] ?? 'scalar',
		category: rule.category ?? null,
		scoped: rule.selectorSuffix !== undefined,
		parts: partable.has( rule.attr ),
		partOnly: rule.partOnly === true,
		flag: CONTROL_FLAGS[ rule.attr ] ?? null,
		value: structuredClone( CONTROL_VALUES[ rule.attr ] ),
	} ) );

	cached = deepFreeze( {
		version: ENGINE_SCHEMA_VERSION,
		controls,
		states: Object.entries( STATE_KEY ).map( ( [ id, key ] ) => ( { id, key } ) ),
		stateControls: structuredClone( STATE_CONTROLS ),
		breakpoints: Object.entries( BP_KEY ).map( ( [ id, key ] ) => ( { id, key, maxWidth: BP_MAX[ key ] || null } ) ),
		parts: Object.keys( PARTS ),
		sections: Object.entries( SECTION_CONTROLS ).map( ( [ id, ids ] ) => ( { id, controls: [ ...ids ] } ) ),
		relations: structuredClone( RELATIONS ) as EngineDescription[ 'relations' ],
		valueShapes: structuredClone( VALUE_SHAPES ),
		valueTree: structuredClone( VALUE_TREE ),
		typeRoles: [ ...TYPE_ROLES ],
	} );

	return cached;
}

/** One control's description, or null for an id the engine does not ship. */
export function describeControl( id: string ): EngineControl | null {
	return describeEngine().controls.find( ( c ) => c.id === id ) ?? null;
}
