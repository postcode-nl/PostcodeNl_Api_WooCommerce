<?php
/**
 * Plugin Name: Postcode.nl Address Autocomplete
 * Plugin URI: https://www.postcode.nl/en/services/adresdata/implementatie
 * Description: Reference implementation for Postcode.nl international address autocomplete for WooCommerce
 * Version: 2.1.2
 * Author: Postcode.nl
 * Author URI: https://www.postcode.nl
 * Text Domain: postcodenl-address-autocomplete
 * Requires at least: 5.2.0
 * Requires PHP: 7.3.0
 *
 * WC requires at least: 3.7.0
 * WC tested up to: 8.2.0
 */

use Automattic\WooCommerce\Utilities\FeaturesUtil;
use PostcodeNl\AddressAutocomplete\Main;

defined('ABSPATH') || exit;

spl_autoload_register(static function(string $className) {
	if (strpos($className, 'PostcodeNl\\Api\\') === 0)
	{
		$fileName = str_replace('\\', '/', $className) . '.php';
		$filePath = plugin_dir_path(__FILE__) . 'libraries/PostcodeNl_Api_Client/src/' . $fileName ;
		/** @noinspection PhpIncludeInspection */
		require_once $filePath;

		return;
	}

	if (strpos($className, 'PostcodeNl\\AddressAutocomplete\\') !== 0)
	{
		return;
	}

	/** @noinspection PhpIncludeInspection */
	require_once plugin_dir_path(__FILE__) . 'src/' . str_replace('\\', '/', $className) . '.php';
});

new Main();

/**
 * @see https://github.com/woocommerce/woocommerce/wiki/High-Performance-Order-Storage-Upgrade-Recipe-Book#declaring-extension-incompatibility
 */
add_action('before_woocommerce_init', function() {
	if (!class_exists('Automattic\\WooCommerce\\Utilities\\FeaturesUtil'))
	{
		return;
	}
	FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
});
