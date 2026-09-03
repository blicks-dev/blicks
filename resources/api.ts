/**
 * The public Blicks JavaScript API.
 *
 * This file is the contract. If a symbol is not re-exported here it is internal, and an addon
 * that reaches past this barrel should expect it to move without notice.
 *
 * It is published on `window.blicks` from the editor bundle (see `resources/editor.tsx`), which
 * WordPress registers as the `blicks-editor` script handle. An addon depends on that handle:
 *
 *   wp_enqueue_script( 'my-addon', $url, [ 'blicks-editor' ], $ver, true );
 *
 * Publishing from the editor bundle rather than a separate one is deliberate: a second bundle
 * would compile a second copy of the block factory, the value tree and the control registry, and
 * two registries fail silently rather than loudly.
 */

import { defineBlock } from '@/framework/define-block';
import { applyBlockIdentity } from '@/framework/identity';
import { getValue, setValue, hasOverrides } from '@/framework/values';
import { STATES, STATE_LABELS, stateSuffix } from '@/framework/states';
import { cleanAttributes, sanitizeCss, scopeCss } from '@/framework/sanitize';
import {
	STYLE_MAP,
	buildElementStyle,
	registerCssValueBuilder,
	cssValueForCategory,
} from '@/framework/css/vars';
import { Inspector } from '@/framework/inspector/Inspector';
import { Section } from '@/framework/inspector/Section';
import { ContextBar } from '@/framework/inspector/ContextBar';
import { DEFAULT_BREAKPOINTS } from '@/design-system/breakpoints';
import { TOKENS, isToken } from '@/design-system/tokens';
import { TYPE_ROLES, TYPE_ROLE_LABELS, TYPE_ROLE_GROUPS, isTypeRole } from '@/design-system/type-roles';
import {
	getIcon,
	hasIcon,
	listIcons,
	listCategories,
	registerIconLibrary,
	registerIconAlias,
	registerIconAliases,
	resolveIconName,
} from '@/framework/icons';
import {
	getFontLibrary,
	findFontFamily,
	onFontLibraryChange,
} from '@/controls/typography/font-library';

import { LayoutControl } from '@/controls/layout/LayoutControl';
import { SpacingControl } from '@/controls/spacing/SpacingControl';
import { BorderControl } from '@/controls/border/BorderControl';
import { ColorControl } from '@/controls/color/ColorControl';
import { TypographyControl } from '@/controls/typography/TypographyControl';
import { EffectsControl } from '@/controls/effects/EffectsControl';
import { AnimationControl } from '@/controls/animation/AnimationControl';
import { PositionControl } from '@/controls/position/PositionControl';
import { FillControl } from '@/controls/fill/FillControl';
import { GridControl } from '@/controls/grid/GridControl';
import { ColumnsControl } from '@/controls/columns/ColumnsControl';
import { GridChildControl } from '@/controls/grid-child/GridChildControl';
import { FlexChildControl } from '@/controls/flex-child/FlexChildControl';
import { DecorationControl } from '@/controls/decoration/DecorationControl';
import { StatesControl } from '@/controls/states/StatesControl';

/**
 * Bumped only on a breaking change to the shape below — deliberately separate from the plugin
 * version, which moves for reasons an addon does not care about. Addons feature-detect with
 * `window.blicks?.apiVersion >= n` and degrade rather than crash on a Blicks that predates them.
 */
export const apiVersion = 1;

/** Author a Blicks-native block: the factory supplies Edit, Save, the inspector and uniqueId. */
export const blocks = {
	defineBlock,
	applyBlockIdentity,
} as const;

/**
 * The `(state x breakpoint)` value tree every styling control reads and writes, addressed as
 * `attributes.blicks[controlId][state][breakpoint]`.
 */
export const values = {
	getValue,
	setValue,
	hasOverrides,
	STATES,
	STATE_LABELS,
	stateSuffix,
	BREAKPOINTS: DEFAULT_BREAKPOINTS,
} as const;

/**
 * The CSS engine. `STYLE_MAP` is the declarative table mapping a control id to the class and
 * custom property it emits; it is mirrored in PHP by `src/Style/ElementStyle.php`.
 *
 * Note the asymmetry: PHP exposes `ElementStyle::registerRule()` for adding a rule at runtime,
 * and the JS side has no equivalent — only `registerCssValueBuilder` for teaching the engine how
 * to serialise a new token category. An addon adding a whole new styled property needs both a
 * `STYLE_MAP` entry here and the PHP rule.
 */
export const style = {
	STYLE_MAP,
	buildElementStyle,
	registerCssValueBuilder,
	cssValueForCategory,
	sanitizeCss,
	scopeCss,
	cleanAttributes,
} as const;

/** The inspector shell and the control components that fill it. */
export const inspector = {
	Inspector,
	Section,
	ContextBar,
	controls: {
		LayoutControl,
		SpacingControl,
		BorderControl,
		ColorControl,
		TypographyControl,
		EffectsControl,
		AnimationControl,
		PositionControl,
		FillControl,
		GridControl,
		ColumnsControl,
		GridChildControl,
		FlexChildControl,
		DecorationControl,
		StatesControl,
	},
} as const;

/** Read-only view of what the site's design system resolves to, plus the two live registries. */
export const design = {
	TOKENS,
	isToken,
	TYPE_ROLES,
	TYPE_ROLE_LABELS,
	TYPE_ROLE_GROUPS,
	isTypeRole,
	BREAKPOINTS: DEFAULT_BREAKPOINTS,
	icons: {
		getIcon,
		hasIcon,
		listIcons,
		listCategories,
		resolveIconName,
		registerIconLibrary,
		registerIconAlias,
		registerIconAliases,
	},
	fonts: {
		getFontLibrary,
		findFontFamily,
		onFontLibraryChange,
	},
} as const;

export type {
	RenderCtx,
	BlockConfig,
	InnerBlocksConfig,
	RichTextOpts,
} from '@/framework/define-block';
export type { State } from '@/framework/states';
export type { Breakpoint, TokenCategory, TokenValues } from '@/framework/design-system';
export type { IconDef, IconLibrary } from '@/framework/icons';
export type { FontFamilyEntry } from '@/controls/typography/font-library';
