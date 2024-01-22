<?php
/**
 * Plugin Name: Postcode.eu Address Validation
 * Plugin URI: https://www.postcode.nl/en/services/adresdata/implementatie
 * Description: Address autocomplete and validation using the Postcode.eu API.
 * Version: 2.1.3
 * Author: Postcode.nl
 * Author URI: https://www.postcode.nl
 * Text Domain: postcodenl-address-autocomplete
 * Requires at least: 5.2
 * Tested up to: 6.4
 * Requires PHP: 7.4
 * WC requires at least: 4.0
 * WC tested up to: 8.2
 */

use Automattic\WooCommerce\Utilities\FeaturesUtil;
use PostcodeNl\AddressAutocomplete\Main;

defined('ABSPATH') || exit;

spl_autoload_register(static function(string $className) {
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
