import { defineBlock } from '@/framework/define-block';
import { getValue, setValue, setValues, setValueSlots, hasOverrides } from '@/framework/values';
import { blockSelect, blockDispatch, setBlockRegistry } from '@/framework/block-store';
import { STATES, STATE_LABELS } from '@/framework/states';
import {
	registerContext,
	unregisterContext,
	hasAncestorOfName,
} from '@/framework/inspector/contexts';
import { DEFAULT_BREAKPOINTS } from '@/design-system/breakpoints';
import { engineApi } from '@/framework/engine-api';
import { UI_DARK_VARS, UI_VARS } from '@/framework/ui-chrome';
import { doAction } from '@wordpress/hooks';
import {
	getFieldType,
	getFieldTypes,
	registerFieldType,
	subscribeFieldTypes,
	unregisterFieldType,
} from '@/blocks/field/registry';
import { isKnownType } from '@/blocks/field/model';
import { ALLOWED_BLOCKS_FILTER } from '@/blocks/form/model';
import {
	SettingsCard,
	OptionCards,
	SegmentedSetting,
	FieldRow,
	HelpTip,
	useBlockHelp,
} from '@/blocks/shared/settings-ui';
import {
	Chips,
	Field,
	Icon,
	Note,
	Opts,
	SegIcons,
	SegText,
	Sec,
	Select,
	Slider,
	Steps,
	Sub,
	SubView,
	Swatches,
	Switch,
} from '@/framework/inspector-v2/kit';

/**
 * Blicks' public surface for other plugins, shaped like `wp.element` / `wp.data` / `wp.blocks`.
 *
 * A companion plugin cannot `import` from this build. Both plugins compile to IIFEs, and a module
 * shared between two entries is emitted into each and evaluated twice — the documented failure
 * this project already hit once. The house answer for a small shared thing is to duplicate it with
 * a drift test, which does not scale to a block framework. So the framework is published at
 * RUNTIME on `window.blicks`, exactly as `wp` publishes its own packages, and a companion reaches
 * it the same way it reaches `wp.blockEditor`.
 *
 * It is not the first thing on this global. `framework/icons/bootstrap` already publishes
 * `window.blicks.icons` ( `register`, `registerAlias`, `list`, `search` ) and `admin/registry.ts`
 * publishes `window.blicks.admin` from the admin bundle. All three coexist because every one of
 * them spreads over what is already there rather than assigning — whichever bundle a screen loads
 * second must not erase the first. A test covers that.
 *
 * Sits beside `window.blicks.admin`, which `admin/registry.ts` already publishes for admin views.
 * Same division of labour as that one: **PHP owns whether a thing exists** — `register_block_type`,
 * the capability, which screens get the script — and this owns what it does once it does exist.
 *
 * ## Using it from a companion plugin
 *
 * Declare `blicks-editor` as a script dependency so WordPress orders the bundles (the post editor
 * gets that handle; `blicks-block-library` loads only on Blicks' own admin pages); then:
 *
 * ```js
 * const blicks = window.blicks;
 * if ( ! blicks || blicks.version < 2 ) return;          // degrade, never throw
 * blicks.blocks.defineBlock( metadata, { … } );
 * ```
 *
 * ## The version is a contract, not decoration
 *
 * A companion ships separately and WILL be installed against an older free plugin. `version` is
 * an integer that goes up when something here is removed or changes meaning — never for an
 * addition. A companion needing 2 and finding 1 must show a notice and stop, not explode.
 *
 * ## What is deliberately NOT here
 *
 * **Control ids.** The style engine is a five-way contract — `css/vars.ts`, `Style/ElementStyle.php`,
 * `runtime.scss`, the `RUNTIME_PROPS` tables and the Inspector `SECTIONS` registry — held together
 * by drift tests. Registering an id at runtime would mean a JS registry, a PHP registry, CSS
 * generated for classes that do not exist at build time, and drift tests with nothing static to
 * compare against. A companion block uses the ids this plugin already ships and declares them in
 * its own `supports.blicks.controls`; a genuinely new id is a pull request here, not an API call.
 *
 * **The inspector internals.** `SECTIONS`, the facet registry and the individual control
 * components are not published (the v2 kit under `ui.v2` is the presentational layer only: it
 * draws a choice and reports it, and knows nothing of the engine). `defineBlock` already wires the whole inspector from a block's
 * manifest, so a companion gets it without being able to reach inside and break it.
 */

/**
 * Goes up only on a REMOVAL or a change of meaning. Additions do not move it.
 *
 * 2 — Blicks 2.0's clean break: Stack, Grid, Spacer and Divider are gone (Box covers them), the
 * dropped v1 control ids are gone, and `engine` and `constants.UI_VARS` are added. Matches
 * `BLICKS_API_VERSION` in `blicks.php`; the two move together.
 */
export const API_VERSION = 2;

/** Every namespace, as it will appear on `window.blicks`. Exported for the drift test. */
export const publicApi = {
	version: API_VERSION,

	/** Registering a block that behaves like a Blicks one. */
	blocks: Object.freeze( { defineBlock } ),

	/**
	 * Reading and writing the `blicks` attribute tree —
	 * `attributes.blicks[ controlId ][ state ][ breakpoint ]`.
	 *
	 * `setValues` / `setValueSlots` batch several ids into ONE write. That is not a convenience:
	 * writing them one at a time means each `setAttributes` reads an attribute object the previous
	 * call has already replaced, so the last write wins and the rest are lost. Measured here on a
	 * drag that set x and y separately — x was silently discarded on every frame.
	 */
	values: Object.freeze( { getValue, setValue, setValues, setValueSlots, hasOverrides } ),

	/**
	 * `core/block-editor`, through whichever registry is in force.
	 *
	 * Use these instead of importing `select`/`dispatch` from `@wordpress/data`. Those bind to the
	 * GLOBAL registry and ignore `RegistryProvider`, so inside a nested `BlockEditorProvider` they
	 * read and write the post instead of the tree being edited. Measured: with a nested provider
	 * holding three blocks, the global selector returned the post's one block.
	 */
	data: Object.freeze( { blockSelect, blockDispatch, setBlockRegistry } ),

	/**
	 * Teaching the inspector when a conditional section may show.
	 *
	 * A `SECTIONS` entry may declare a `context`, and the section appears only when that context
	 * is met. A context whose test is a block NAME belongs to whoever owns the block —
	 * `hasAncestorOfName` builds the usual predicate. An unregistered context is never met, so a
	 * section needing one stays hidden rather than appearing broken.
	 */
	inspector: Object.freeze( { registerContext, unregisterContext, hasAncestorOfName } ),

	/** The inspector's own primitives, so a companion's panels match the rest of the editor. */
	ui: Object.freeze( {
		SettingsCard,
		OptionCards,
		SegmentedSetting,
		FieldRow,
		HelpTip,
		useBlockHelp,
		/**
		 * The v2 inspector's kit, for a companion block's `panels: { Settings, Style }` in
		 * `defineBlock`: the same components, markup and classes the free blocks' v2 panels use, so
		 * they are styled by the same sheet. Added in version 1 (an addition does not move it).
		 *
		 * Options are `[ value, label, extra? ]` tuples; `extra` is an icon path where one is drawn.
		 * A panel receives `{ attributes, setAttributes, clientId }`.
		 */
		v2: Object.freeze( {
			Sec,
			Steps,
			SegIcons,
			SegText,
			Chips,
			Opts,
			Swatches,
			Switch,
			Field,
			Select,
			Slider,
			SubView,
			Note,
			Sub,
			Icon,
		} ),
	} ),

	/**
	 * The style engine, read-only: its description, a block's allow-list, and the validator Studio
	 * and the AI layer run before writing a style tree. See `framework/engine-api.ts`. Since 2.
	 */
	engine: engineApi,

	/**
	 * Shared vocabulary. `DEFAULT_BREAKPOINTS` is the same JSON `Style/Breakpoints.php` reads.
	 * `UI_VARS` / `UI_DARK_VARS` name the chrome variables a companion may paint with
	 * (`framework/ui-chrome.ts`). Since 2.
	 */
	constants: Object.freeze( { STATES, STATE_LABELS, DEFAULT_BREAKPOINTS, UI_VARS, UI_DARK_VARS } ),
} as const;

/**
 * `window.blicks.forms`: the Form's extension points for a companion plugin. Published beside the
 * namespaces above (its own contract, pinned by `field/registry.test.ts`).
 *
 * - `registerFieldType( { type, label, icon?, description?, group?, controls?, defaults? } )` →
 *   boolean; `unregisterFieldType( type )`; `getFieldType( type )`; `getFieldTypes()`;
 *   `subscribe( listener )` → unsubscribe; `isKnownType( type )`. See `blocks/field/registry.ts`.
 * - `filters.allowedBlocks` — the `@wordpress/hooks` filter name, `'blicks.form.allowedBlocks'`,
 *   that adds blocks a Form may hold directly.
 * - `events` — the DOM events the front-end behaviour dispatches on each `<form>` (form-core.ts).
 *
 * When it is published the `@wordpress/hooks` action `blicks.forms.ready` runs with it, so a
 * companion loaded earlier can wait: `wp.hooks.addAction( 'blicks.forms.ready', 'me', ( forms ) => … )`.
 */
export const formsApi = Object.freeze( {
	registerFieldType,
	unregisterFieldType,
	getFieldType,
	getFieldTypes,
	subscribe: subscribeFieldTypes,
	isKnownType,
	filters: Object.freeze( { allowedBlocks: ALLOWED_BLOCKS_FILTER } ),
	events: Object.freeze( {
		input: 'blicks:form-input',
		validate: 'blicks:form-validate',
		beforeSend: 'blicks:form-beforesend',
		sent: 'blicks:form-sent',
	} ),
} );

/**
 * Publish it, additively.
 *
 * Never clobbers: `admin/registry.ts` writes `window.blicks.admin` from a different entry, and
 * whichever bundle loads second must not erase the first. Same spread-over-existing shape it uses.
 */
export function exposePublicApi(): void {
	const scope = window as unknown as { blicks?: Record< string, unknown > };

	scope.blicks = { ...( scope.blicks ?? {} ), ...publicApi, forms: formsApi };
	doAction( 'blicks.forms.ready', formsApi );
}
