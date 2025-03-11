import { registerBlockType } from '@wordpress/blocks';

import metadata from './block.json';

registerBlockType(metadata.name, {
	title: metadata.title,
	category: metadata.category,
	parent: metadata.parent,
	attributes: metadata.attributes,
});
