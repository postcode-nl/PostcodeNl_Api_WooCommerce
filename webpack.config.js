const path = require('path');
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const WooCommerceDependencyExtractionWebpackPlugin = require( '@woocommerce/dependency-extraction-webpack-plugin' );
const LiveReloadPlugin = require('webpack-livereload-plugin');

module.exports = {
	...defaultConfig,
	entry: {
		'shipping-address-autocomplete-intl-index': path.resolve(process.cwd(), 'src', 'blocks', 'shipping-address-autocomplete-intl', 'index.js'),
		'shipping-address-autocomplete-intl-frontend': path.resolve(process.cwd(), 'src', 'blocks', 'shipping-address-autocomplete-intl', 'frontend.js'),
		'billing-address-autocomplete-intl-index': path.resolve(process.cwd(), 'src', 'blocks', 'billing-address-autocomplete-intl', 'index.js'),
		'billing-address-autocomplete-intl-frontend': path.resolve(process.cwd(), 'src', 'blocks', 'billing-address-autocomplete-intl', 'frontend.js'),
	},
	plugins: [
		...defaultConfig.plugins.filter(
			(plugin) => plugin.constructor.name !== 'DependencyExtractionWebpackPlugin'
		),
		new WooCommerceDependencyExtractionWebpackPlugin(),
		new LiveReloadPlugin(),
	],
};
