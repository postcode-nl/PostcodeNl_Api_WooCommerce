<?php

namespace PostcodeNl\AddressAutocomplete;


use PostcodeNl\AddressAutocomplete\Exception\Exception;

defined('ABSPATH') || exit;

class Main
{
	public const TEXT_DOMAIN = 'postcodenl-address-autocomplete';

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

		$this->_options = new Options();
		$this->_proxy = new Proxy($this->_options->apiKey, $this->_options->apiSecret);

		add_action('init', [$this, 'wordPressInit']);

		static::$_instance = $this;
	}

	public function wordPressInit(): void
	{
		add_filter('woocommerce_default_address_fields', [$this, 'addressFields']);

		add_action('wp_enqueue_scripts', [$this, 'enqueueScripts']);

		add_action('wp_ajax_' . Proxy::AJAX_AUTOCOMPLETE, [$this->_proxy, 'autocomplete']);
		add_action('wp_ajax_nopriv_' . Proxy::AJAX_AUTOCOMPLETE, [$this->_proxy, 'autocomplete']);

		add_action('wp_ajax_' . Proxy::AJAX_GET_DETAILS, [$this->_proxy, 'getDetails']);
		add_action('wp_ajax_nopriv_' . Proxy::AJAX_GET_DETAILS, [$this->_proxy, 'getDetails']);

		add_action('woocommerce_after_checkout_form', [$this, 'afterCheckoutForm']);
		add_action('woocommerce_after_edit_account_address_form', [$this, 'afterCheckoutForm']);

		add_action('admin_menu', [$this->_options, 'addPluginPage']);

		add_action('admin_notices', [$this, 'adminNotice']);
	}

	public function addressFields(array $fields): array
	{
		$fields['postcodeNl_address_autocomplete'] = [
			'type' => 'text',
			'label' => __('Autocomplete address', static::TEXT_DOMAIN),
			'placeholder' => __('Start typing the address', static::TEXT_DOMAIN),
			'required' => false,
			'class' => [
				'form-row-wide',
				'postcodenl-address-autocomplete',
			],
			'autocomplete' => 'off',
			'priority' => 45,
		];

		return $fields;
	}

	public function enqueueScripts(): void
	{
		wp_enqueue_style('postcodeNlAutocompleteAddress', plugins_url('../../../', __FILE__) . 'assets/libraries/autocomplete-address.css');
		wp_enqueue_style('postcodenl-address-autocomplete', plugins_url('../../../', __FILE__) . 'assets/css/style.css');

		wp_enqueue_script('postcodeNlAutocompleteAddress', plugins_url('../../../', __FILE__) . 'assets/libraries/AutocompleteAddress.js');
		wp_enqueue_script('postcodenl-address-autocomplete', plugins_url('../../../', __FILE__) . 'assets/js/main.js', ['postcodeNlAutocompleteAddress', 'jquery'], 0.1);
	}

	public function afterCheckoutForm(): void
	{
		$settings = [
			'autocomplete' => vsprintf('%s?action=%s&parameters=', [admin_url('admin-ajax.php'), Proxy::AJAX_AUTOCOMPLETE]),
			'getDetails' => vsprintf('%s?action=%s&parameters=', [admin_url('admin-ajax.php'), Proxy::AJAX_GET_DETAILS]),
			'supportedCountries' => $this->_options->getSupportedCountries(),
		];

		vprintf(
			'<script type="text/javascript">
				const PostcodeNlAddressAutocompleteSettings = %s;
			</script>',
			[json_encode($settings)]
		);
	}

	public function getOptions(): Options
	{
		return $this->_options;
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
					__('Postcode.nl Address Autocomplete requires WooCommerce', static::TEXT_DOMAIN),
					__('Postcode.nl Address Autocomplete requires the WooCommerce plugin to be activated to be able to add address autocomplete to the checkout form.', static::TEXT_DOMAIN),
				]
			);
		}

		if ($this->_options->hasKeyAndSecret())
		{
			return;
		}

		// Do not show the notice when the user is already on the options page
		$page = get_current_screen();
		if ($page !== null && $page->id === 'settings_page_' . Options::MENU_SLUG)
		{
			return;
		}

		vprintf(
			'<div class="notice notice-error">
				<h3>%s</h3>
				<p>%s</p>
			</div>',
			[
				__('Set your credentials for Postcode.nl Address Autocomplete', static::TEXT_DOMAIN),
				vsprintf(
					__('Please set your Postcode.nl API key and secret in <a href="%s">the options</a> to start using the Autocomplete in your WooCommerce checkout.', static::TEXT_DOMAIN),
					[menu_page_url(Options::MENU_SLUG, false)]
				),
			]
		);
	}

	public static function getInstance(): self
	{
		return static::$_instance;
	}
}