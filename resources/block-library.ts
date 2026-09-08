// Shared block-registration entry. The editor and admin Pattern Library both need the
// Blicks block types registered before serialized pattern markup can be parsed for preview.
import '@wordpress/format-library';
import './formats/text-style';
import './formats/inline-code';
import './framework/icons/bootstrap';
import './blocks/box';
import './blocks/section';
import './blocks/stack';
import './blocks/grid';
import './blocks/heading';
import './blocks/text';
import './blocks/button';
import './blocks/buttons';
import './blocks/image';
import './blocks/icon';
import './blocks/spacer';
import './blocks/divider';
import { registerBootPresets } from './framework/presets/register';

// Blocks are registered by the imports above (each `defineBlock` runs `registerBlockType` at import).
// Now re-register every user-saved preset as a block variation on those types.
registerBootPresets();
