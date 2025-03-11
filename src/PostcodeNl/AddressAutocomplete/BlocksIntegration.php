<?php

namespace PostcodeNl\AddressAutocomplete;

defined('ABSPATH') || exit;

use Automattic\WooCommerce\Blocks\Integrations\IntegrationInterface;

class BlocksIntegration implements IntegrationInterface
{
	const BLOCK_NAMES = [
		'shipping-address-autocomplete',
		'billing-address-autocomplete',
	];

	/**
	 * The name of the integration.
	 *
	 * @return string
	 */
	public function get_name(): string
	{
		return 'postcode-eu-address-validation';
	}

	/**
	 * When called invokes any initialization/setup for the integration.
	 */
	public function initialize(): void
	{
		$this->_register_block_frontend_scripts();
		$this->_register_block_main_integration();
	}

	private function _register_block_frontend_scripts(): void
	{
		foreach (self::BLOCK_NAMES as $name)
		{
			$handle = $name . '-frontend';
			$scriptAsset = require(Main::$pluginDirPath . 'build/' . $name . '-frontend.asset.php');
			wp_register_script(
				$handle,
				Main::$pluginUrl . '/build/' . $name . '-frontend.js',
				array_merge($scriptAsset['dependencies'], [Main::AUTOCOMPLETE_LIBRARY_HANDLE]),
				$scriptAsset['version'],
				true
			);

			wp_set_script_translations(
				$handle,
				'postcode-eu-address-validation',
				realpath(Main::$pluginDirPath . 'languages')
			);
		}
	}

	private function _register_block_main_integration(): void
	{
		foreach (self::BLOCK_NAMES as $name)
		{
			$handle = $name . '-index';
			$scriptAsset = require(Main::$pluginDirPath . 'build/' . $name . '-index.asset.php');
			wp_register_script(
				$handle,
				Main::$pluginUrl . '/build/' . $name . '-index.js',
				$scriptAsset['dependencies'],
				$scriptAsset['version'],
				true
			);

			wp_set_script_translations(
				$handle,
				'postcode-eu-address-validation',
				realpath(Main::$pluginDirPath . 'languages')
			);
		}
	}

	/**
	 * Returns an array of script handles to enqueue in the frontend context.
	 *
	 * @return string[]
	 */
	public function get_script_handles(): array
	{
		// NB. paths to entries are configured in Webpack config.
		$result = [];
		foreach (self::BLOCK_NAMES as $name)
		{
			$result[] = $name . '-index';
			$result[] = $name . '-frontend';
		}

		return $result;
	}

	/**
	 * Returns an array of script handles to enqueue in the editor context.
	 *
	 * @return string[]
	 */
	public function get_editor_script_handles(): array
	{
		// NB. paths to entries are configured in Webpack config.
		$result = [];
		foreach (self::BLOCK_NAMES as $name)
		{
			$result[] = $name . '-index';
		}

		return $result;
	}

	/**
	 * An array of key, value pairs of data made available to the block on the client side.
	 *
	 * Usage in Javascript:
	 * `import { getSetting } from '@woocommerce/settings';`
	 * `const settings = getSetting('postcode-eu-address-validation_data');`
	 *
	 * @return array
	 */
	public function get_script_data(): array
	{
		return Main::getInstance()->getSettings();
	}
}
