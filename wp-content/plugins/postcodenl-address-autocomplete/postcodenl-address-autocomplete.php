<?php
/**
 * Plugin Name: Postcode.nl Address Autocomplete
 * Plugin URI: https://www.postcode.nl
 * Description: Reference implementation for Postcode.nl international address autocomplete for Woo
 * Version: 0.1
 * Author: Postcode.nl
 * Author URI: https://www.postcode.nl
 * Text Domain: postcodenl-address-autocomplete
 */

use PostcodeNl\AddressAutocomplete\Main;

defined('ABSPATH') || exit;

spl_autoload_register(static function(string $className) {
	if (strpos($className, 'PostcodeNl\\InternationalAutocomplete\\') === 0) {
		/** @noinspection PhpIncludeInspection */
		require_once plugin_dir_path(__FILE__) . 'libraries/' . str_replace('\\', '/', $className) . '.php';

		return;
	}

	if (strpos($className, 'PostcodeNl\\AddressAutocomplete\\') !== 0) {
		return;
	}

	/** @noinspection PhpIncludeInspection */
	require_once plugin_dir_path(__FILE__) . 'src/' . str_replace('\\', '/', $className) . '.php';
});

new Main();