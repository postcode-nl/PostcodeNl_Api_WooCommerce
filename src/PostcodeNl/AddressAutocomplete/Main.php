<?php

namespace PostcodeNl\AddressAutocomplete;


use PostcodeNl\AddressAutocomplete\Exception\Exception;

defined('ABSPATH') || exit;

class Main
{
	/** @var string The version number of the plugin should be equal to the commented version number in ../../../postcodenl-address-autocomplete.php */
	public const VERSION = '2.0.1';

	/** @var self Reference to own */
	protected static $_instance;
	/** @var Proxy The proxy object used to redirect requests to the Postcode.nl server */
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
		add_filter('plugin_action_links_' . $this->getPluginFileAndPath(), [$this, 'pluginActionLinks']);

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

		add_action('admin_menu', [$this->_options, 'addPluginPage']);

		add_action('admin_notices', [$this, 'adminNotice']);

		// Fix path for language files.
		load_plugin_textdomain('postcodenl-address-autocomplete', false, basename(dirname(__FILE__, 4)) . '/languages');
	}

	public function addressFields(array $fields): array
	{
		if (!$this->_options->hasKeyAndSecret())
		{
			return $fields;
		}

		$fields['postcodeEuAutofillIntl'] = [
			'type' => 'text',
			'label' => __('Start typing your address or zip/postal code', 'postcodenl-address-autocomplete'),
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
			'label' => __('Postcode', 'postcodenl-address-autocomplete'),
			'placeholder' => __('1234 AB', 'postcodenl-address-autocomplete'),
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
			'label' => __('House number and addition', 'postcodenl-address-autocomplete'),
			'placeholder' => __('123 A', 'postcodenl-address-autocomplete'),
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
			'label' => __('Which house number do you mean?', 'postcodenl-address-autocomplete'),
			'required' => false,
			'class' => [
				'form-row-wide',
				'postcode-eu-autofill',
				'postcode-eu-autofill-nl',
				'postcode-eu-autofill-nl-house-number-select',
			],
			'options' => [__('- Select house number -', 'postcodenl-address-autocomplete')],
			'priority' => 48,
		];

		return $fields;
	}

	public function pluginActionLinks(array $links): array
	{
		array_unshift(
			$links,
			sprintf('<a href="%s">%s</a>', admin_url('options-general.php?page=' . Options::MENU_SLUG), __('Settings', 'postcodenl-address-autocomplete')),
			sprintf('<a href="https://account.postcode.nl" target="_blank" rel="noopener">%s</a>', __('API account', 'postcodenl-address-autocomplete'))
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
			'postcode-eu-autofill',
			$pluginsUrl . '/assets/js/postcode-eu-autofill.js',
			['postcode-eu-autocomplete-address-library', 'postcode-eu-autocomplete-address-field-mapping', 'wp-i18n'],
			static::VERSION,
			true
		);
		wp_set_script_translations(
			'postcode-eu-autofill',
			'postcodenl-address-autocomplete',
			realpath(dirname(__FILE__, 4) . '/languages')
		);
	}

	public function enqueueAdminScripts(): void
	{
		wp_enqueue_style('postcode-eu-autofill-admin', plugins_url(basename(dirname(__FILE__, 4))) . '/assets/css/admin.css', array(), static::VERSION);
	}

	public function afterCheckoutForm(): void
	{
		if (!$this->_options->hasKeyAndSecret())
		{
			return;
		}

		$settings = [
			'autocomplete' => vsprintf('%s?action=%s&parameters=', [admin_url('admin-ajax.php'), Proxy::AJAX_AUTOCOMPLETE]),
			'getDetails' => vsprintf('%s?action=%s&parameters=', [admin_url('admin-ajax.php'), Proxy::AJAX_GET_DETAILS]),
			'dutchAddressLookup' => vsprintf('%s?action=%s&parameters=', [admin_url('admin-ajax.php'), Proxy::AJAX_DUTCH_ADDRESS_LOOKUP]),
			'supportedCountries' => $this->_options->getSupportedCountries(),
			'displayMode' => $this->_options->displayMode,
			'netherlandsMode' => $this->_options->netherlandsMode,
			'postcodeOnlyLabel' => __('Postcode and house number', 'postcodenl-address-autocomplete'),
			'postcodeOnlyPlaceholder' => '1234 AB',
			'postcodeOnlyInputHint' => __('Enter a postcode and house number.', 'postcodenl-address-autocomplete'),
			'houseNumberPlaceholder' => '123 A',
		];

		printf(
			'<script type="text/javascript">
				const PostcodeEuSettings = %s;
			</script>',
			json_encode($settings)
		);
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
			vprintf(
				'<div class="notice notice-error is-dismissible">
				<h3>%s</h3>
				<p>%s</p>
			</div>',
				[
					__('Postcode.eu Address Autocomplete: WooCommerce is required', 'postcodenl-address-autocomplete'),
					__('Postcode.eu Address Autocomplete requires the WooCommerce plugin to be activated to be able to add address autocomplete to the checkout form.', 'postcodenl-address-autocomplete'),
				]
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
			</div>',
				[
					__('Postcode.eu Address Autocomplete: Set your credentials', 'postcodenl-address-autocomplete'),
					vsprintf(
						/* translators: %s: options URL */
						__('Please set your Postcode.eu API key and secret in <a href="%s">the options</a> to start using the Autocomplete in your WooCommerce checkout.', 'postcodenl-address-autocomplete'),
						[menu_page_url(Options::MENU_SLUG, false)]
					),
				]
			);

			return;
		}

		if ($this->_options->isApiActive())
		{
			return;
		}

		vprintf(
			'<div class="notice notice-error">
				<h3>%s</h3>
				<p>%s</p>
			</div>',
			[
				sprintf(
					/* translators: %s: API account status. */
					__('Postcode.eu Address Autocomplete: Your API account is %s', 'postcodenl-address-autocomplete'),
					$this->_options->getApiStatusDescription()
				),
				$this->_options->getApiStatusHint(),
			]
		);
	}

	public static function getInstance(): self
	{
		return static::$_instance;
	}

	protected function getPluginFileAndPath(): string
	{
		return plugin_basename(dirname(__FILE__, 4) . '/postcodenl-address-autocomplete.php');
	}
}
