<?php


namespace PostcodeNl\AddressAutocomplete;

use PostcodeNl\AddressAutocomplete\Exception\Exception;
use PostcodeNl\InternationalAutocomplete\Exception\ClientException;

defined('ABSPATH') || exit;

class Options
{
	public const FORM_NAME_PREFIX = 'postcodenl_address_autocomplete_';
	public const MENU_SLUG = 'postcodenl-address-autocomplete';

	protected const OPTION_KEY = '_postcodenl_address_autocomplete_options';
	protected const REQUIRED_USER_CAPABILITY = 'activate_plugins';

	protected const API_ACCOUNT_STATUS_NEW = 'new';
	protected const API_ACCOUNT_STATUS_INACTIVE = 'inactive';
	protected const API_ACCOUNT_STATUS_ACTIVE = 'active';

	public $apiKey = '';
	public $apiSecret = '';

	/** @var array */
	protected $_supportedCountries;
	/** @var \DateTime */
	protected $_supportedCountriesExpiration;
	/** @var string The status of the account since the last time the credentials changed */
	protected $_apiAccountStatus;
	/** @var string|null The Postcode.nl API account name associated with the configured credentials, or null if it has not been retrieved yet. */
	protected $_apiAccountName;


	public function __construct()
	{
		$data = \get_option(static::OPTION_KEY, []);
		$this->apiKey = $data['apiKey'] ?? '';
		$this->apiSecret = $data['apiSecret'] ?? '';
		$this->_supportedCountries = json_decode($data['supportedCountries'] ?? 'NULL', true);
		$supportedCountriesExpiration = $data['supportedCountriesExpiration'] ?? '';
		$this->_supportedCountriesExpiration = $supportedCountriesExpiration === '' ? null : new \DateTime($supportedCountriesExpiration);
		$this->_apiAccountStatus = $data['apiAccountStatus'] ?? self::API_ACCOUNT_STATUS_NEW;
		$this->_apiAccountName = $data['apiAccountName'] ?? null;
	}

	public function show(): void
	{
		if (!current_user_can(static::REQUIRED_USER_CAPABILITY))
		{
			_e('Not accessible.', Main::TEXT_DOMAIN);
			return;
		}

		$submitName = static::FORM_NAME_PREFIX . 'submit';
		if (isset($_POST[$submitName]))
		{
			$this->_handleSubmit();
		}

		$markup = '<div class="wrap">';
		$markup .= vsprintf('<h2>%s</h2>', [__('Postcode.nl Address Autocomplete options', Main::TEXT_DOMAIN)]);
		$markup .= '<form method="post" action="">';
		$markup .= '<table class="form-table">';

		$markup .= $this->_getInput(
			__('API key', Main::TEXT_DOMAIN),
			'apiKey',
			$this->apiKey,
			'text',
			__('The API key provided by Postcode.nl when you created your account, or you can request new credentials if you lost them. <a href="https://account.postcode.nl/" target="_blank" rel="noopener">Log into your Postcode.nl API account</a> or if you do not have an account yet you can <a href="https://www.postcode.nl/en/services/adresdata/producten-overzicht" target="_blank" rel="noopener">register one now</a>.', Main::TEXT_DOMAIN)
		);
		$markup .= $this->_getInput(
			__('API Secret', Main::TEXT_DOMAIN),
			'apiSecret',
			'',
			'password',
			__('You API secret as provided by Postcode.nl, only fill in this field if you want to set your secret, leave empty otherwise.', Main::TEXT_DOMAIN)
		);
		$markup .= '</table>';
		$markup .= vsprintf(
			'<p class="submit"><input type="submit" name="%s" id="submit" class="button button-primary" value="%s"></p>',
			[$submitName, __('Save changes', Main::TEXT_DOMAIN)]
		);
		$markup .= '</form>';

		$markup .= sprintf('<h3>%s</h3>', __('API connection', Main::TEXT_DOMAIN));
		$markup .= sprintf('<p>%s: %s</p>', __('Subscription', Main::TEXT_DOMAIN), $this->getApiStatusDescription());
		if ($this->_apiAccountName !== null)
		{
			$markup .= sprintf('<p>%s: %s</p>', __('API account name', Main::TEXT_DOMAIN), $this->_apiAccountName);
		}

		if ($this->hasKeyAndSecret())
		{
			$countryNames = array_column($this->getSupportedCountries(), 'name');

			if (count($countryNames) > 0)
			{
				sort($countryNames);
				$markup .= vsprintf('<h3>%s</h3>', [__('Postcode.nl Address Autocomplete supports', Main::TEXT_DOMAIN)]);
				$markup .= vsprintf('<ul><li>%s</li></ul>', [implode('</li><li>', $countryNames)]);
			}
		}

		$markup .= '</div>';

		print($markup);
	}

	public function addPluginPage(): void
	{
		add_options_page(
			'PostcodeNl Address Autocomplete',
			'Address Autocomplete',
			static::REQUIRED_USER_CAPABILITY,
			static::MENU_SLUG,
			[$this, 'show']
		);
	}

	public function save(): void
	{
		\update_option(static::OPTION_KEY, $this->_getData());
	}

	public function hasKeyAndSecret(): bool
	{
		return $this->apiKey !== '' && $this->apiSecret !== '';
	}

	public function isApiActive(): bool
	{
		return $this->_apiAccountStatus === static::API_ACCOUNT_STATUS_ACTIVE;
	}

	public function getApiStatusDescription(): string
	{
		switch ($this->_apiAccountStatus)
		{
			case static::API_ACCOUNT_STATUS_NEW:
				return __('not connected', Main::TEXT_DOMAIN);
			case static::API_ACCOUNT_STATUS_ACTIVE:
				return __('active', Main::TEXT_DOMAIN);
			case static::API_ACCOUNT_STATUS_INACTIVE:
				return __('inactive', Main::TEXT_DOMAIN);
			default:
				throw new Exception('Invalid account status value.');
		}
	}

	public function getApiStatusHint(): string
	{
		switch ($this->_apiAccountStatus)
		{
			case static::API_ACCOUNT_STATUS_NEW:
				return sprintf(__('Make sure you used the correct Postcode.nl API subscription key and secret in <a href="%s">the options page</a>.', Main::TEXT_DOMAIN), menu_page_url(static::MENU_SLUG, false));
			case static::API_ACCOUNT_STATUS_ACTIVE:
				return __('The Postcode.nl API is successfully connected.', Main::TEXT_DOMAIN);
			case static::API_ACCOUNT_STATUS_INACTIVE:
				return __('Your Postcode.nl API subscription is currently inactive, please login to your account and follow the steps to activate your account.', Main::TEXT_DOMAIN);
			default:
				throw new Exception('Invalid account status value.');
		}
	}

	public function getSupportedCountries(): array
	{
		if ($this->_supportedCountriesExpiration === null || $this->_supportedCountriesExpiration < new \DateTime())
		{
			try
			{
				$this->_supportedCountries = Main::getInstance()->getProxy()->getClient()->internationalGetSupportedCountries();
				$this->_supportedCountriesExpiration = new \DateTime('+1 days');
				$this->save();
			}
			catch (ClientException $e)
			{
				// Continue using previous, if none exists throw the exception
				if ($this->_supportedCountries === null)
				{
					throw $e;
				}
			}
		}

		return $this->_supportedCountries;
	}

	protected function _getInput(string $label, string $name, string $value, string $inputType, ?string $description): string
	{
		$id = \str_replace('_', '-', static::FORM_NAME_PREFIX . $name);
		return \vsprintf(
			'<tr><th><label for="%s">%s</label></th><td><input type="%s" id="%s" value="%s" name="%s" />%s</td></tr>',
			[
				$id,
				$label,
				$inputType,
				$id,
				\htmlspecialchars($value, ENT_QUOTES, get_bloginfo('charset')),
				static::FORM_NAME_PREFIX . $name,
				$description !== null ? vsprintf('<p class="description">%s</p>', [$description]) : '',
			]
		);
	}

	protected function _handleSubmit(): void
	{
		$options = Main::getInstance()->getOptions();
		$existingKey = $options->apiKey;
		$existingSecret = $options->apiSecret;

		foreach ($options as $option => $value)
		{
			$postName = static::FORM_NAME_PREFIX . $option;
			// Only overwrite the API secret if anything has been set
			if ($option === 'apiSecret' && ($_POST[$postName] ?? '') === '')
			{
				continue;
			}

			$options->{$option} = $_POST[$postName] ?? $value;
		}

		if ($options->apiKey !== $existingKey || $options->apiSecret !== $existingSecret)
		{
			$this->_apiAccountStatus = static::API_ACCOUNT_STATUS_NEW;
			$this->_apiAccountName = null;
		}

		$options->save();
		Main::getInstance()->loadOptions();

		// Retrieve account information after updating the options
		if ($this->hasKeyAndSecret())
		{
			try
			{
				$accountInformation = Main::getInstance()->getProxy()->getClient()->accountInfo();
				if ($accountInformation['hasAccess'] ?? false)
				{
					$this->_apiAccountStatus = static::API_ACCOUNT_STATUS_ACTIVE;
				}
				else
				{
					$this->_apiAccountStatus = static::API_ACCOUNT_STATUS_INACTIVE;
				}
				$this->_apiAccountName = $accountInformation['name'] ?? null;
			}
			catch (ClientException $e)
			{
				// Set account status to off
				$this->_apiAccountStatus = static::API_ACCOUNT_STATUS_NEW;
				$this->_apiAccountName = null;
			}
			$options->save();
		}
	}

	protected function _getData(): array
	{
		return [
			'apiKey' => $this->apiKey,
			'apiSecret' => $this->apiSecret,
			'supportedCountriesExpiration' => $this->_supportedCountriesExpiration === null ? '' : $this->_supportedCountriesExpiration->format('Y-m-d H:i:s'),
			'supportedCountries' => json_encode($this->_supportedCountries),
			'apiAccountStatus' => $this->_apiAccountStatus,
			'apiAccountName' => $this->_apiAccountName,
		];
	}
}