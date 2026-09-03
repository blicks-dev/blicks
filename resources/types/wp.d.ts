// Ambient shims for @wordpress packages that don't ship TypeScript types.
// Keeps the build/typecheck unblocked; these surfaces are loosely typed on purpose.
declare module '@wordpress/block-editor';
declare module '@wordpress/data';
declare module '@wordpress/api-fetch';
declare module '@wordpress/plugins';
declare module '@wordpress/editor';
declare module '@wordpress/format-library';
declare module '@wordpress/rich-text';

interface Window {
	blicksAdminSettings?: {
		buildBaseUrl?: string;
		blockBaseUrl?: string;
		cssVariables?: string;
	};
	blicksEditorSettings?: {
		helpBaseUrl?: string;
		fontLibrary?: unknown;
		colorPalette?: unknown;
		tokenCatalogue?: unknown;
	};
	blicks?: {
		fontLibrary?: Array< {
			slug: string;
			name: string;
			fontFamily: string;
			source: string;
		} >;
		icons?: {
			register: ( lib: {
				id: string;
				label: string;
				priority: number;
				icons: Record< string, {
					label: string;
					svg: string;
					category?: string;
					keywords?: string[];
				} >;
			} ) => void;
			registerAlias: ( alias: string, target: string ) => void;
			list: () => unknown[];
			search: ( query: string ) => unknown[];
		};
		// The public addon API, published by `resources/publish-api.ts` from the editor bundle.
		// Typed off the barrel itself so this declaration cannot drift from what actually ships.
		apiVersion?: number;
		blocks?: typeof import('@/api').blocks;
		values?: typeof import('@/api').values;
		style?: typeof import('@/api').style;
		inspector?: typeof import('@/api').inspector;
		design?: typeof import('@/api').design;
	};
}
