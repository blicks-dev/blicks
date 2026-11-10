// Shared block-registration entry. The editor and admin Pattern Library both need the
// Blicks block types registered before serialized pattern markup can be parsed for preview.
// Publish the framework on `window.blicks` BEFORE any block registers. A companion plugin
// declaring this bundle as a dependency runs after it, and must find the surface already there.
import { exposePublicApi } from './framework/public-api';

exposePublicApi();

import '@wordpress/format-library';
import './formats/text-style';
import './formats/inline-code';
import './framework/icons/bootstrap';
import './blocks/box';
import './blocks/section';
import './blocks/heading';
import './blocks/text';
import './blocks/list';
import './blocks/list-item';
import './blocks/steps';
import './blocks/step';
import './blocks/button';
import './blocks/buttons';
import './blocks/image';
import './blocks/icon';
import './blocks/loop';
import './blocks/dialog';
import './blocks/form';
import './blocks/field';
import './blocks/input';
import './blocks/menu-link';
