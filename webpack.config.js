const path = require('path');
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const WooCommerceDependencyExtractionWebpackPlugin = require( '@woocommerce/dependency-extraction-webpack-plugin' );
const LiveReloadPlugin = require('webpack-livereload-plugin');

module.exports = {
	...defaultConfig,
	entry: {
		'shipping-address-autocomplete-index': path.resolve(process.cwd(), 'src', 'blocks', 'shipping-address-autocomplete', 'index.js'),
		'shipping-address-autocomplete-frontend': path.resolve(process.cwd(), 'src', 'blocks', 'shipping-address-autocomplete', 'frontend.js'),
		'billing-address-autocomplete-index': path.resolve(process.cwd(), 'src', 'blocks', 'billing-address-autocomplete', 'index.js'),
		'billing-address-autocomplete-frontend': path.resolve(process.cwd(), 'src', 'blocks', 'billing-address-autocomplete', 'frontend.js'),
	},
	plugins: [
		...defaultConfig.plugins.filter(
			(plugin) => plugin.constructor.name !== 'DependencyExtractionWebpackPlugin'
		),
		new WooCommerceDependencyExtractionWebpackPlugin(),
		new LiveReloadPlugin(),
	],
};
