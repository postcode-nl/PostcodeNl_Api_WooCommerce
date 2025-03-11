import { registerCheckoutBlock } from '@woocommerce/blocks-checkout';
import metadata from './block.json';
import Block from './block.js';

registerCheckoutBlock({
	metadata: metadata,
	component: Block,
});
