import { __ } from '@wordpress/i18n';
import { TOKENS, DEFAULT_BREAKPOINTS, TYPE_ROLES, fallbackValues, fallbackTypeRoles } from './constants';
import type { DesignSystemSnapshot, AdminSettingsSnapshot, DashboardSummary } from './types';

export const FALLBACK_SNAPSHOT: DesignSystemSnapshot = {
	mode: 'readOnly',
	source: {
		theme: 'active',
		themeJson: true,
		globalStyles: false,
	},
	tokens: TOKENS,
	baseValues: fallbackValues(),
	values: fallbackValues(),
	typeRoles: fallbackTypeRoles(),
	fontLibrary: [],
	overrides: {
		tokens: {},
		breakpoints: {},
		typeRoles: {},
	},
	breakpoints: [ ...DEFAULT_BREAKPOINTS ],
	counts: {
		colors: TOKENS.color.length,
		typography: TOKENS.fontSize.length + TOKENS.fontFamily.length,
		spacing: TOKENS.spacing.length,
		radius: TOKENS.radius.length,
		shadow: TOKENS.shadow.length,
		breakpoints: DEFAULT_BREAKPOINTS.length,
		typeRoles: TYPE_ROLES.length,
	},
};

export const FALLBACK_ADMIN_SETTINGS: AdminSettingsSnapshot = {
	defaultInspectorPanel: 'styles',
	helpVisibility: 'show',
	deleteDataOnUninstall: false,
	designSystem: {
		themeJsonSync: false,
		themeJsonSupported: false,
	},
};

export const FALLBACK_DASHBOARD_SUMMARY: DashboardSummary = {
	usage: {
		posts: 0,
	},
	blocks: {
		total: 0,
		interactive: 0,
	},
	activity: [],
};

