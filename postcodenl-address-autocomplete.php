<?php
/**
 * Plugin Name: Postcode.nl Address Autocomplete
 * Plugin URI: https://www.postcode.nl/en/services/adresdata/implementatie
 * Description: Reference implementation for Postcode.nl international address autocomplete for WooCommerce
 * Version: 2.1.1
 * Author: Postcode.nl
 * Author URI: https://www.postcode.nl
 * Text Domain: postcodenl-address-autocomplete
 * Requires at least: 5.2.0
 * Requires PHP: 7.3.0
 *
 * WC requires at least: 3.7.0
 * WC tested up to: 7.5.0
 */

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
