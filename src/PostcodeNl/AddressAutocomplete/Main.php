<?php

namespace PostcodeNl\AddressAutocomplete;


use PostcodeNl\AddressAutocomplete\Exception\Exception;
use Automattic\WooCommerce\Blocks\Utils\CartCheckoutUtils;

defined('ABSPATH') || exit;

class Main
{
	/** @var string Name of the plugin */
	public const NAME = 'Postcode.eu Address Validation';

	/** @var string The version number of the plugin should be equal to the commented version number in ../../../postcode-eu-address-validation.php */
	public const VERSION = '2.6.2';

	/** @var string Script handle of the autocomplete library. */
	public const AUTOCOMPLETE_LIBRARY_HANDLE = 'postcode-eu-autocomplete-address-library';

	/** @var string Path to the plugin directory */
	public static $pluginDirPath;

	/** @var string Path to the plugin filename */
	public static $pluginFilePath;

	/** @var string URL to the plugin */
	public static $pluginUrl;

	private static bool $_isCheckoutBlockDefault = false;

	/** @var self Reference to own */
	protected static $_instance;
	/** @var Proxy The proxy object used to redirect requests to the Postcode.eu server */
	protected $_proxy;
	/** @var Options */
	protected $_options;


	public function __construct()
	{
		if (static::$_instance !== null)
		{
			throw new Exception('Instance already initialized use Main::getInstance() instead.');
		}

		$this->loadOptions();

		static::$_instance = $this;
		static::$pluginDirPath = plugin_dir_path(dirname(__DIR__, 2));
		static::$pluginFilePath = plugin_basename(static::$pluginDirPath . 'postcode-eu-address-validation.php');
		static::$pluginUrl = plugins_url(basename(static::$pluginDirPath));

		add_action('init', [$this, 'wordPressInit']);
	}

	public function wordPressInit(): void
	{
		add_action('woocommerce_init', function () {
			if (class_exists('Automattic\\WooCommerce\\Blocks\\Utils\\CartCheckoutUtils'))
			{
				static::$_isCheckoutBlockDefault = CartCheckoutUtils::is_checkout_block_default();
			}
		});

		add_filter('woocommerce_default_address_fields', [$this, 'addressFields']);
		add_filter('plugin_action_links_' . static::$pluginFilePath, [$this, 'pluginActionLinks']);

		add_action('admin_enqueue_scripts', [$this, 'enqueueAdminScripts']);

		add_action('wp_enqueue_scripts', [$this, 'enqueueScripts']);

		add_action('wp_ajax_' . Proxy::AJAX_AUTOCOMPLETE, [$this->_proxy, 'autocomplete']);
		add_action('wp_ajax_nopriv_' . Proxy::AJAX_AUTOCOMPLETE, [$this->_proxy, 'autocomplete']);

		add_action('wp_ajax_' . Proxy::AJAX_GET_DETAILS, [$this->_proxy, 'getDetails']);
		add_action('wp_ajax_nopriv_' . Proxy::AJAX_GET_DETAILS, [$this->_proxy, 'getDetails']);

		add_action('wp_ajax_' . Proxy::AJAX_DUTCH_ADDRESS_LOOKUP, [$this->_proxy, 'dutchAddressLookup']);
		add_action('wp_ajax_nopriv_' . Proxy::AJAX_DUTCH_ADDRESS_LOOKUP, [$this->_proxy, 'dutchAddressLookup']);

		add_action('wp_ajax_' . Proxy::AJAX_VALIDATE, [$this->_proxy, 'validate']);
		add_action('wp_ajax_nopriv_' . Proxy::AJAX_VALIDATE, [$this->_proxy, 'validate']);

		add_action('woocommerce_after_checkout_validation', [$this, 'afterCheckoutValidation'], 10, 2);

		add_action('admin_menu', [$this->_options, 'addPluginPage']);

		add_action('admin_notices', [$this, 'adminNotice']);

		add_action(
			'woocommerce_blocks_checkout_block_registration',
			function($integrationRegistry) { $integrationRegistry->register(new BlocksIntegration()); }
		);

		// Fix path for language files.
		load_plugin_textdomain('postcode-eu-address-validation', false, basename(static::$pluginDirPath) . '/languages');
	}

	public function addressFields(array $fields): array
	{
		if (!$this->_options->isApiActive())
		{
			return $fields;
		}

		$fields['postcodeEuAutofillIntl'] = [
			'type' => 'text',
			'label' => esc_html__('Start typing your address or zip/postal code', 'postcode-eu-address-validation'),
			'required' => false,
			'class' => [
				'form-row-wide',
				'postcode-eu-autofill',
				'postcode-eu-autofill-intl',
			],
			'autocomplete' => 'off',
			'priority' => 45,
		];

		$fields['postcodeEuAutofillNlPostcode'] = [
			'type' => 'text',
			'label' => esc_html__('Postcode', 'postcode-eu-address-validation'),
			'placeholder' => esc_html__('1234 AB', 'postcode-eu-address-validation'),
			'required' => false,
			'class' => [
				'form-row-first',
				'postcode-eu-autofill',
				'postcode-eu-autofill-nl',
				'postcode-eu-autofill-nl-postcode',
			],
			'autocomplete' => 'off',
			'priority' => 46,
		];

		$fields['postcodeEuAutofillNlHouseNumberWithAddition'] = [
			'type' => 'text',
			'label' => esc_html__('House number and addition', 'postcode-eu-address-validation'),
			'placeholder' => esc_html__('123 A', 'postcode-eu-address-validation'),
			'required' => false,
			'class' => [
				'form-row-last',
				'postcode-eu-autofill',
				'postcode-eu-autofill-nl',
				'postcode-eu-autofill-nl-house-number',
			],
			'autocomplete' => 'off',
			'priority' => 47,
		];

		$fields['postcodeEuAutofillNlHouseNumberSelect'] = [
			'type' => 'select',
			'label' => esc_html__('Which house number do you mean?', 'postcode-eu-address-validation'),
			'required' => false,
			'class' => [
				'form-row-wide',
				'postcode-eu-autofill',
				'postcode-eu-autofill-nl',
				'postcode-eu-autofill-nl-house-number-select',
			],
			'options' => [esc_html__('- Select house number -', 'postcode-eu-address-validation')],
			'priority' => 48,
		];

		return $fields;
	}

	public function pluginActionLinks(array $links): array
	{
		array_unshift(
			$links,
			sprintf(
				'<a href="%s">%s</a>',
				admin_url('options-general.php?page=' . Options::MENU_SLUG),
				esc_html__('Settings', 'postcode-eu-address-validation')
			),
			sprintf(
				'<a href="https://account.postcode.eu" target="_blank" rel="noopener">%s</a>',
				esc_html__('API account', 'postcode-eu-address-validation')
			)
		);

		return $links;
	}

	public function enqueueScripts(): void
	{
		if (!$this->_options->isApiActive())
		{
			return;
		}

		// CSS
		wp_enqueue_style(
			static::AUTOCOMPLETE_LIBRARY_HANDLE,
			static::$pluginUrl . '/assets/libraries/postcode-eu-autocomplete-address.css',
			[],
			static::VERSION
		);
		wp_enqueue_style(
			'postcode-eu-autofill',
			static::$pluginUrl . '/assets/css/style.css',
			[static::AUTOCOMPLETE_LIBRARY_HANDLE],
			static::VERSION
		);

		// Javascript
		wp_enqueue_script(
			static::AUTOCOMPLETE_LIBRARY_HANDLE,
			static::$pluginUrl . '/assets/libraries/postcode-eu-autocomplete-address.js',
			[],
			static::VERSION,
			true
		);
		wp_enqueue_script(
			'postcode-eu-autocomplete-state-mapping',
			static::$pluginUrl . '/assets/js/stateMapping.js',
			[],
			static::VERSION,
			true
		);

		// For Classic Checkout and My Account Page:
		if (!has_block('woocommerce/checkout') || has_block('woocommerce/classic-shortcode'))
		{
			wp_enqueue_script(
				'postcode-eu-autocomplete-address-field-mapping',
				static::$pluginUrl . '/assets/js/addressFieldMapping.js',
				[],
				static::VERSION,
				true
			);
			wp_enqueue_script(
				'postcode-eu-autofill',
				static::$pluginUrl . '/assets/js/postcode-eu-autofill.js',
				[
					static::AUTOCOMPLETE_LIBRARY_HANDLE,
					'postcode-eu-autocomplete-address-field-mapping',
					'postcode-eu-autocomplete-state-mapping',
					'wp-i18n',
				],
				static::VERSION,
				true
			);

			wp_add_inline_script(
				'postcode-eu-autofill',
				sprintf(
					'const PostcodeEuSettings = %s;',
					wp_json_encode($this->getSettings())
				),
				'before'
			);
		}

		wp_set_script_translations(
			'postcode-eu-autofill',
			'postcode-eu-address-validation',
			realpath(static::$pluginDirPath . 'languages')
		);
	}

	public function enqueueAdminScripts(): void
	{
		wp_enqueue_style('postcode-eu-autofill-admin', static::$pluginUrl . '/assets/css/admin.css', array(), static::VERSION);
	}

	public function getSettings(): array
	{
		return [
			'actions' => [
				'autocomplete' => vsprintf(
					'%s?action=%s&context=${context}&term=${term}',
					[admin_url('admin-ajax.php'), Proxy::AJAX_AUTOCOMPLETE]
				),
				'getDetails' => vsprintf(
					'%s?action=%s&context=${context}',
					[admin_url('admin-ajax.php'), Proxy::AJAX_GET_DETAILS]
				),
				'dutchAddressLookup' => vsprintf(
					'%s?action=%s&postcode=${postcode}&houseNumberAndAddition=${houseNumberAndAddition}',
					[admin_url('admin-ajax.php'), Proxy::AJAX_DUTCH_ADDRESS_LOOKUP]
				),
				'validate' => vsprintf(
					'%s?action=%s&country=${country}&postcode=${postcode}&locality=${locality}&streetAndBuilding=${streetAndBuilding}',
					[admin_url('admin-ajax.php'), Proxy::AJAX_VALIDATE]
				),
			],
			'enabledCountries' => $this->_options->getEnabledCountries(),
			'displayMode' => $this->_options->displayMode,
			'netherlandsMode' => $this->_options->netherlandsMode,
			'postcodeOnlyLabel' => esc_html__('Postcode and house number', 'postcode-eu-address-validation'),
			'postcodeOnlyPlaceholder' => '1234 AB',
			'postcodeOnlyInputHint' => esc_html__('Enter a postcode and house number.', 'postcode-eu-address-validation'),
			'houseNumberPlaceholder' => '123 A',
			'autofillIntlBypassLinkText' => esc_html__('Enter an address', 'postcode-eu-address-validation'),
			'allowAutofillIntlBypass' => $this->_options->allowAutofillIntlBypass,
		];
	}

	/**
	 * @param array $fields - posted data
	 * @param \WP_Error $errors - validation errors
	 */
	public function afterCheckoutValidation(array $fields, \WP_Error $errors): void
	{
		if (!$this->_options->isApiActive() || $this->_options->hasEditableAddressFields())
		{
			return;
		}

		$fieldNames = ['address_1', 'postcode', 'city'];
		$errorCodes = $errors->get_error_codes();

		if ($this->_isSupportedCountryIso2($fields['billing_country']))
		{
			$billingRequiredCodes = array_map(fn($name) => 'billing_' . $name . '_required', $fieldNames);

			if (count(array_intersect($errorCodes, $billingRequiredCodes)) > 0)
			{
				foreach ($billingRequiredCodes as $code)
				{
					$errors->remove($code);
				}

				if ($this->_options->isNlModePostcodeOnly() && $fields['billing_country'] === 'NL')
				{
					$errors->add('validation', '<strong>' . esc_html__('Please enter a postcode and house number for the billing address.', 'postcode-eu-address-validation') . '</strong>');
				}
				else
				{
					$errors->add('validation', '<strong>' . esc_html__('Please enter and select a billing address.', 'postcode-eu-address-validation') . '</strong>');
				}
			}
		}

		if ($this->_isSupportedCountryIso2($fields['shipping_country']))
		{
			$shippingRequiredCodes = array_map(fn($name) => 'shipping_' . $name . '_required', $fieldNames);

			if (count(array_intersect($errorCodes, $shippingRequiredCodes)) > 0)
			{
				foreach ($shippingRequiredCodes as $code)
				{
					$errors->remove($code);
				}

				if ($this->_options->isNlModePostcodeOnly() && $fields['shipping_country'] === 'NL')
				{
					$errors->add('validation', '<strong>' . esc_html__('Please enter a postcode and house number for the shipping address.', 'postcode-eu-address-validation') . '</strong>');
				}
				else
				{
					$errors->add('validation', '<strong>' . esc_html__('Please enter and select a shipping address.', 'postcode-eu-address-validation') . '</strong>');
				}
			}
		}
	}

	protected function _isSupportedCountryIso2($countryCode): bool
	{
		foreach ($this->_options->getSupportedCountries() as $country)
		{
			if ($countryCode === $country['iso2'])
			{
				return true;
			}
		}

		return false;
	}

	public function getOptions(): Options
	{
		return $this->_options;
	}

	public function loadOptions(): void
	{
		$this->_options = new Options();
		$this->_proxy = new Proxy($this->_options->apiKey, $this->_options->apiSecret);
	}

	public function getProxy(): Proxy
	{
		return $this->_proxy;
	}

	public function adminNotice(): void
	{
		if (!class_exists('WooCommerce'))
		{
			printf(
				'<div class="notice notice-error is-dismissible">
				<h3>%s: %s</h3>
				<p>%s</p>
			</div>',
				Main::NAME,
				esc_html__('WooCommerce is required', 'postcode-eu-address-validation'),
				sprintf(
					/* translators: %s is the plugin name. */
					esc_html__('%s requires the WooCommerce plugin to be activated to be able to add address autocomplete to the checkout form.', 'postcode-eu-address-validation'),
					Main::NAME
				)
			);
		}

		// Do not show the notices when the user is already on the options page
		$page = get_current_screen();
		if ($page !== null && $page->id === 'settings_page_' . Options::MENU_SLUG)
		{
			return;
		}

		if ($this->_options->isApiActive())
		{
			return;
		}

		printf(
			'<div class="notice notice-error">
				<h3>%s</h3>
				<p>%s</p>
				<p><a href="%s">Plugin settings</a></p>
			</div>',
			sprintf(
				/* translators: %1$s is the plugin name, %2$s is API account status. */
				esc_html__('%1$s status: %2$s', 'postcode-eu-address-validation'),
				Main::NAME,
				$this->_options->getApiStatusDescription()
			),
			$this->_options->getApiStatusHint(),
			menu_page_url(Options::MENU_SLUG, false)
		);
	}

	public static function getInstance(): self
	{
		return static::$_instance;
	}

	public static function isCheckoutBlockDefault(): bool
	{
		return static::$_isCheckoutBlockDefault;
	}
}
