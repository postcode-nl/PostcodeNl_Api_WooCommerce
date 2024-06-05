<?php

namespace PostcodeNl\AddressAutocomplete;


use PostcodeNl\AddressAutocomplete\Exception\Exception;

defined('ABSPATH') || exit;

class Main
{
	/** @var string The version number of the plugin should be equal to the commented version number in ../../../postcode-eu-address-validation.php */
	public const VERSION = '2.3.2';

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

		add_action('init', [$this, 'wordPressInit']);
		static::$_instance = $this;
	}

	public function wordPressInit(): void
	{
		add_filter('woocommerce_default_address_fields', [$this, 'addressFields']);
		add_filter('plugin_action_links_' . $this->_getPluginFileAndPath(), [$this, 'pluginActionLinks']);

		add_action('admin_enqueue_scripts', [$this, 'enqueueAdminScripts']);

		add_action('wp_enqueue_scripts', [$this, 'enqueueScripts']);

		add_action('wp_ajax_' . Proxy::AJAX_AUTOCOMPLETE, [$this->_proxy, 'autocomplete']);
		add_action('wp_ajax_nopriv_' . Proxy::AJAX_AUTOCOMPLETE, [$this->_proxy, 'autocomplete']);

		add_action('wp_ajax_' . Proxy::AJAX_GET_DETAILS, [$this->_proxy, 'getDetails']);
		add_action('wp_ajax_nopriv_' . Proxy::AJAX_GET_DETAILS, [$this->_proxy, 'getDetails']);

		add_action('wp_ajax_' . Proxy::AJAX_DUTCH_ADDRESS_LOOKUP, [$this->_proxy, 'dutchAddressLookup']);
		add_action('wp_ajax_nopriv_' . Proxy::AJAX_DUTCH_ADDRESS_LOOKUP, [$this->_proxy, 'dutchAddressLookup']);

		add_action('woocommerce_after_checkout_form', [$this, 'afterCheckoutForm']);
		add_action('woocommerce_after_edit_account_address_form', [$this, 'afterCheckoutForm']);
		add_action('woocommerce_after_checkout_validation', [$this, 'afterCheckoutValidation'], 10, 2);

		add_action('admin_menu', [$this->_options, 'addPluginPage']);

		add_action('admin_notices', [$this, 'adminNotice']);

		// Fix path for language files.
		load_plugin_textdomain('postcode-eu-address-validation', false, basename(dirname(__FILE__, 4)) . '/languages');
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
		$pluginsUrl = plugins_url(basename(dirname(__FILE__, 4)));

		// CSS
		wp_enqueue_style(
			'postcode-eu-autocomplete-address-library',
			$pluginsUrl . '/assets/libraries/postcode-eu-autocomplete-address.css',
			[],
			static::VERSION
		);
		wp_enqueue_style(
			'postcode-eu-autofill',
			$pluginsUrl . '/assets/css/style.css',
			['postcode-eu-autocomplete-address-library'],
			static::VERSION
		);

		// Javascript
		wp_enqueue_script(
			'postcode-eu-autocomplete-address-library',
			$pluginsUrl . '/assets/libraries/postcode-eu-autocomplete-address.js',
			[],
			static::VERSION,
			true
		);
		wp_enqueue_script(
			'postcode-eu-autocomplete-address-field-mapping',
			$pluginsUrl . '/assets/js/addressFieldMapping.js',
			[],
			static::VERSION,
			true
		);
		wp_enqueue_script(
			'postcode-eu-autocomplete-state-mapping',
			$pluginsUrl . '/assets/js/stateMapping.js',
			[],
			static::VERSION,
			true
		);
		wp_enqueue_script(
			'postcode-eu-autofill',
			$pluginsUrl . '/assets/js/postcode-eu-autofill.js',
			[
				'postcode-eu-autocomplete-address-library',
				'postcode-eu-autocomplete-address-field-mapping',
				'postcode-eu-autocomplete-state-mapping',
				'wp-i18n',
			],
			static::VERSION,
			true
		);
		wp_set_script_translations(
			'postcode-eu-autofill',
			'postcode-eu-address-validation',
			realpath(dirname(__FILE__, 4) . '/languages')
		);
	}

	public function enqueueAdminScripts(): void
	{
		wp_enqueue_style('postcode-eu-autofill-admin', plugins_url(basename(dirname(__FILE__, 4))) . '/assets/css/admin.css', array(), static::VERSION);
	}

	public function afterCheckoutForm(): void
	{
		if (!$this->_options->isApiActive())
		{
			return;
		}

		$settings = [
			'autocomplete' => vsprintf('%s?action=%s&context=${context}&term=${term}', [admin_url('admin-ajax.php'), Proxy::AJAX_AUTOCOMPLETE]),
			'getDetails' => vsprintf('%s?action=%s&context=${context}', [admin_url('admin-ajax.php'), Proxy::AJAX_GET_DETAILS]),
			'dutchAddressLookup' => vsprintf('%s?action=%s&postcode=${postcode}&houseNumberAndAddition=${houseNumberAndAddition}', [admin_url('admin-ajax.php'), Proxy::AJAX_DUTCH_ADDRESS_LOOKUP]),
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

		wp_add_inline_script(
			'postcode-eu-autofill',
			sprintf(
				'const PostcodeEuSettings = %s;',
				wp_json_encode($settings)
			),
			'before'
		);
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
				<h3>%s</h3>
				<p>%s</p>
			</div>',
				esc_html__('Postcode.eu Address Autocomplete: WooCommerce is required', 'postcode-eu-address-validation'),
				esc_html__('Postcode.eu Address Autocomplete requires the WooCommerce plugin to be activated to be able to add address autocomplete to the checkout form.', 'postcode-eu-address-validation'),
			);
		}

		// Do not show the notices when the user is already on the options page
		$page = get_current_screen();
		if ($page !== null && $page->id === 'settings_page_' . Options::MENU_SLUG)
		{
			return;
		}

		if (!$this->_options->hasKeyAndSecret())
		{
			vprintf(
				'<div class="notice notice-error">
				<h3>%s</h3>
				<p>%s</p>
				<a href="%s">%s</a>
			</div>',
				[
					esc_html__('Postcode.eu Address Autocomplete: Set your credentials', 'postcode-eu-address-validation'),
					esc_html__('Please set your Postcode.eu API key and secret in the options to start using the Autocomplete in your WooCommerce checkout.', 'postcode-eu-address-validation'),
					menu_page_url(Options::MENU_SLUG, false),
					esc_html__('Options', 'postcode-eu-address-validation'),
				]
			);

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
			</div>',
			sprintf(
				/* translators: %s: API account status. */
				esc_html__('Postcode.eu Address Autocomplete: Your API account is %s', 'postcode-eu-address-validation'),
				$this->_options->getApiStatusDescription()
			),
			$this->_options->getApiStatusHint(),
		);
	}

	public static function getInstance(): self
	{
		return static::$_instance;
	}

	protected function _getPluginFileAndPath(): string
	{
		return plugin_basename(dirname(__FILE__, 4) . '/postcode-eu-address-validation.php');
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

}
