<?php

namespace PostcodeNl\AddressAutocomplete;

use DateTime;
use PostcodeNl\AddressAutocomplete\Exception\AuthenticationException;
use PostcodeNl\AddressAutocomplete\Exception\ClientException;
use PostcodeNl\AddressAutocomplete\Exception\Exception;
use function get_option;
use function update_option;

defined('ABSPATH') || exit;

class Options
{
	public const FORM_NAME_PREFIX = 'postcodenl_address_autocomplete_';
	public const MENU_SLUG = 'postcode-eu-address-validation';

	protected const OPTION_KEY = '_postcodenl_address_autocomplete_options';
	protected const REQUIRED_USER_CAPABILITY = 'activate_plugins';

	protected const API_ACCOUNT_STATUS_NEW = 'new';
	protected const API_ACCOUNT_STATUS_INVALID_CREDENTIALS = 'invalidCredentials';
	protected const API_ACCOUNT_STATUS_INACTIVE = 'inactive';
	protected const API_ACCOUNT_STATUS_ACTIVE = 'active';

	protected const NETHERLANDS_MODE_DEFAULT = 'default';
	protected const NETHERLANDS_MODE_POSTCODE_ONLY = 'postcodeOnly';

	protected const DISPLAY_MODE_DEFAULT = 'default';
	protected const DISPLAY_MODE_SHOW_ON_ADDRESS = 'showOnAddress';
	protected const DISPLAY_MODE_SHOW_ALL = 'showAll';

	protected const FORM_ACTION_NAME = self::FORM_NAME_PREFIX . 'submit';
	protected const FORM_ACTION_NONCE_NAME = self::FORM_NAME_PREFIX . 'nonce';
	protected const FORM_PER_COUNTRY_NAME = 'enableCountry';

	protected const SUPPORTED_COUNTRY_LIST_EXPIRATION = '-1 day';

	public $apiKey = '';
	public $apiSecret = '';
	/**
	 * @var string With what kind of validation Dutch addresses should be validated,
 	 *      the options are the international API or legacy postcode and house number validation.
	 */
	public $displayMode = self::DISPLAY_MODE_DEFAULT;

	/** @var string The mode used for Dutch address validation.  */
	public $netherlandsMode;

	public $allowAutofillIntlBypass;

	/** @var array */
	protected $_supportedCountries;
	/** @var \DateTime|null The most recent date time Api account information was imported. */
	protected $_apiAccountInfoDateTime;
	/** @var string The status of the account since the last time the credentials changed */
	protected $_apiAccountStatus;
	/** @var string|null The Postcode.eu API account name associated with the configured credentials, or null if it has not been retrieved yet. */
	protected $_apiAccountName;
	/** @var string|null The Postcode.eu API account limit. */
	protected $_apiAccountLimit;
	/** @var string|null The Postcode.eu API account usage of the current subscription period. */
	protected $_apiAccountUsage;
	/** @var string|null The Postcode.eu API account subscription start period. */
	protected $_apiAccountStartDate;
	/** @var array List of country codes for which the autocomplete API is disabled, even though it is supported. */
	protected $_apiDisabledCountries;

	public function __construct()
	{
		$data = get_option(static::OPTION_KEY, []);
		$this->apiKey = $data['apiKey'] ?? '';
		$this->apiSecret = $data['apiSecret'] ?? '';
		// Convert legacy option to new mode
		if (isset($data['netherlandsPostcodeOnly']) && $data['netherlandsPostcodeOnly'])
		{
			$this->netherlandsMode = static::NETHERLANDS_MODE_DEFAULT;
		}
		else
		{
			$this->netherlandsMode = $data['netherlandsMode'] ?? static::NETHERLANDS_MODE_DEFAULT;
		}
		$this->displayMode = $data['displayMode'] ?? static::DISPLAY_MODE_DEFAULT;
		$this->allowAutofillIntlBypass = $data['allowAutofillIntlBypass'] ?? 'n';
		$this->_supportedCountries = json_decode($data['supportedCountries'] ?? 'NULL', true);
		$apiAccountInfoDateTime = $data['apiAccountInfoDateTime'] ?? '';
		$this->_apiAccountInfoDateTime = $apiAccountInfoDateTime === '' ? null : new DateTime($apiAccountInfoDateTime);
		$this->_apiAccountStatus = $data['apiAccountStatus'] ?? static::API_ACCOUNT_STATUS_NEW;
		$this->_apiAccountName = $data['apiAccountName'] ?? null;
		$this->_apiAccountLimit = $data['apiAccountLimit'] ?? null;
		$this->_apiAccountUsage = $data['apiAccountUsage'] ?? null;
		$this->_apiAccountStartDate = $data['apiAccountStartDate'] ?? null;
		$this->_apiDisabledCountries = $data['apiDisabledCountries'] ?? [];
	}

	public function show(): void
	{
		if (!current_user_can(static::REQUIRED_USER_CAPABILITY))
		{
			esc_html_e('Not accessible.', 'postcode-eu-address-validation');
			return;
		}

		if (
			isset($_POST[static::FORM_ACTION_NAME], $_POST[static::FORM_ACTION_NONCE_NAME])
			&& false !== check_admin_referer(static::FORM_ACTION_NAME, static::FORM_ACTION_NONCE_NAME)
		)
		{
			$this->_handleSubmit();
		}

		$markup = '<div class="wrap postcode-eu">';
		$markup .= vsprintf('<h2>%s</h2>', [esc_html__('Postcode.eu Address Autocomplete options', 'postcode-eu-address-validation')]);
		$markup .= '<form method="post" action="">';
		$markup .= wp_nonce_field(static::FORM_ACTION_NAME, static::FORM_ACTION_NONCE_NAME, true, false);

		$markup .= '<table class="form-table">';

		$markup .= $this->_getInputRow(
			esc_html__('API key', 'postcode-eu-address-validation'),
			'apiKey',
			$this->apiKey,
			'text',
			esc_html__(
				'The API key is provided by Postcode.eu after completing account registration. You can also request new credentials if you lost them.',
				'postcode-eu-address-validation'
			)
			. '<br/>' .
			sprintf(
				'<a href="%s" target="_blank" rel="noopener">%s</a>',
				esc_url(__('https://account.postcode.eu/', 'postcode-eu-address-validation')),
				esc_html__('Log into your Postcode.eu account', 'postcode-eu-address-validation')
			)
			. '<br/>' .
			sprintf(
				'<a href="%s" target="_blank" rel="noopener">%s</a>',
				esc_url(__('https://www.postcode.nl/en/services/adresdata/producten-overzicht', 'postcode-eu-address-validation')),
				esc_html__('Register a new Postcode.eu account', 'postcode-eu-address-validation')
			)
		);
		$markup .= $this->_getInputRow(
			esc_html__('API secret', 'postcode-eu-address-validation'),
			'apiSecret',
			'',
			'password',
			esc_html__('Your API secret as provided by Postcode.eu.', 'postcode-eu-address-validation')
		);
		$markup .= $this->_getInputRow(
			esc_html__('Address field display mode', 'postcode-eu-address-validation'),
			'displayMode',
			$this->displayMode,
			'select',
			esc_html__('How to display the address fields in the checkout form.', 'postcode-eu-address-validation'),
			$this->getDisplayModeDescriptions()
		);
		$markup .= $this->_getInputRow(
			esc_html__('Add manual entry link', 'postcode-eu-address-validation'),
			'allowAutofillIntlBypass',
			$this->allowAutofillIntlBypass,
			'select',
			esc_html__('Allows users to skip the autocomplete field and manually enter an address.', 'postcode-eu-address-validation'),
			['n' => esc_html__('No'), 'y' => esc_html__('Yes')]
		);
		$markup .= $this->_getInputRow(
			esc_html__('Dutch address lookup method', 'postcode-eu-address-validation'),
			'netherlandsMode',
			$this->netherlandsMode,
			'select',
			esc_html__(
				'Which method to use for Dutch address lookups. "Full lookup" allows searching through city and street names, the "Postcode and house number only" method only supports exact postcode and house number lookups but costs less per address.',
				'postcode-eu-address-validation'
			)
			. '<br/>' .
			sprintf(
				'<a href="%s" target="_blank" rel="noopener">%s</a>',
				esc_url(__('https://www.postcode.nl/en/services/adresdata/producten-overzicht', 'postcode-eu-address-validation')),
				esc_html__('Product pricing', 'postcode-eu-address-validation')
			),
			$this->getNetherlandsModeDescriptions()
		);

		if ($this->hasKeyAndSecret())
		{
			foreach ($this->getSupportedCountries() as $supportedCountry)
			{
				if ($supportedCountry['iso3'] === 'NLD' && $this->netherlandsMode === static::NETHERLANDS_MODE_POSTCODE_ONLY)
				{
					continue;
				}
				$markup .= $this->_getInputRow(
					$this->_getCountryName($supportedCountry),
					static::FORM_PER_COUNTRY_NAME . $supportedCountry['iso3'],
					isset($this->_apiDisabledCountries[$supportedCountry['iso3']]) ? 'disabled' : 'enabled',
					'select',
					sprintf(
						esc_html__('Use autocomplete input for the country %s.', 'postcode-eu-address-validation'),
						$this->_getCountryName($supportedCountry)
					),
					[
						'enabled' => esc_html__('Enabled', 'postcode-eu-address-validation'),
						'disabled' => esc_html__('Disabled', 'postcode-eu-address-validation'),
					]
				);
			}
		}

		$markup .= '</table>';
		$markup .= vsprintf(
			'<p class="submit"><input type="submit" name="%s" id="submit" class="button button-primary" value="%s"></p>',
			[static::FORM_ACTION_NAME, esc_html__('Save changes', 'postcode-eu-address-validation')]
		);
		$markup .= '</form>';

		$markup .= '<div class="postcode-eu-api-status">';
		$markup .= sprintf('<h3>%s</h3>', esc_html__('API connection', 'postcode-eu-address-validation'));
		$markup .= sprintf(
			'<dl><dt>%s</dt><dd><span class="subscription-status subscription-status-%s">%s</span></dd>',
			esc_html__('Subscription status', 'postcode-eu-address-validation'),
			$this->_apiAccountStatus, $this->getApiStatusDescription()
		);
		$markup .= sprintf(
			'<dl><dt>%s</dt><dd><span class="subscription-status-date">%s</span></dd>',
			esc_html__('Subscription status retrieved', 'postcode-eu-address-validation'),
			$this->_apiAccountInfoDateTime === null
				? esc_html__('Never', 'postcode-eu-address-validation')
				: wp_date(get_option('date_format') . ' ' . get_option('time_format'), $this->_apiAccountInfoDateTime->getTimestamp())
		);

		if ($this->_apiAccountName !== null)
		{
			$markup .= sprintf(
				'<dt>%s</dt><dd>%s</dd>',
				esc_html__('API account name', 'postcode-eu-address-validation'), $this->_apiAccountName
			);
		}
		if ($this->_apiAccountStartDate !== null)
		{
			$markup .= sprintf(
				'<dt>%s</dt><dd>%s</dd>',
				esc_html__('API subscription start date', 'postcode-eu-address-validation'),
				wp_date(get_option('date_format'), (new DateTime($this->_apiAccountStartDate))->getTimestamp())
			);
		}
		if ($this->_apiAccountLimit !== null && $this->_apiAccountUsage !== null)
		{
			$markup .= sprintf(
				'<dt>%s</dt><dd>%s / %s %s</dd>',
				esc_html__('API subscription usage', 'postcode-eu-address-validation'),
				$this->_apiAccountUsage,
				$this->_apiAccountLimit,
				esc_html__('euro', 'postcode-eu-address-validation')
			);
		}

		$markup .= '</dl>';

		$markup .= '</div></div>';

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
		update_option(static::OPTION_KEY, $this->_getData());
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
				return esc_html__('not connected', 'postcode-eu-address-validation');
			case static::API_ACCOUNT_STATUS_ACTIVE:
				return esc_html__('active', 'postcode-eu-address-validation');
			case static::API_ACCOUNT_STATUS_INVALID_CREDENTIALS:
				return esc_html__('invalid key and/or secret', 'postcode-eu-address-validation');
			case static::API_ACCOUNT_STATUS_INACTIVE:
				return esc_html__('inactive', 'postcode-eu-address-validation');
			default:
				throw new Exception('Invalid account status value.');
		}
	}

	public function getApiStatusHint(): string
	{
		switch ($this->_apiAccountStatus)
		{
			case static::API_ACCOUNT_STATUS_NEW:
			case static::API_ACCOUNT_STATUS_INVALID_CREDENTIALS:
				return
					esc_html__('Make sure you used the correct Postcode.eu API subscription key and secret in the options page.', 'postcode-eu-address-validation')
					. '<br/>' .
					sprintf(
						'<a href="%s">%s</a>',
						menu_page_url(static::MENU_SLUG, false),
						esc_html__('the options page', 'postcode-eu-address-validation')
					);
			case static::API_ACCOUNT_STATUS_ACTIVE:
				return esc_html__('The Postcode.eu API is successfully connected.', 'postcode-eu-address-validation');
			case static::API_ACCOUNT_STATUS_INACTIVE:
				return esc_html__('Your Postcode.eu API subscription is currently inactive, please login to your account and follow the steps to activate your account.', 'postcode-eu-address-validation');
			default:
				throw new Exception('Invalid account status value.');
		}
	}

	public function getSupportedCountries(): array
	{
		if ($this->_apiAccountInfoDateTime === null || $this->_apiAccountInfoDateTime < new DateTime(static::SUPPORTED_COUNTRY_LIST_EXPIRATION))
		{
			try
			{
				$this->_supportedCountries = Main::getInstance()->getProxy()->getClient()->internationalGetSupportedCountries();
				$this->_apiAccountInfoDateTime = new DateTime();
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

	protected function _getInputRow(string $label, string $name, string $value, string $inputType, ?string $description, array $options = []): string
	{
		$id = str_replace('_', '-', static::FORM_NAME_PREFIX . $name);
		if ($inputType === 'select')
		{
			$selectOptions = [];
			foreach ($options as $option => $optionLabel)
			{
				$selectOptions[] = sprintf('<option value="%s"%s>%s</option>', $option, $option === $value ? ' selected' : '', $optionLabel);
			}

			$formElement = sprintf(
				'<select id="%s" name="%s">%s</select>',
				$id,
				static::FORM_NAME_PREFIX . $name,
				implode("\n", $selectOptions)
			);
		}
		else
		{
			$formElement = sprintf(
				'<input type="%s" id="%s" value="%s" name="%s" />',
				$inputType,
				$id,
				htmlspecialchars($value, ENT_QUOTES, get_bloginfo('charset')),
				static::FORM_NAME_PREFIX . $name
			);
		}

		return sprintf(
			'<tr><th><label for="%s">%s</label></th><td class="forminp forminp-%s">%s%s</td></tr>',
			$id,
			$label,
			$inputType,
			$formElement,
			$description !== null ? vsprintf('<p class="description">%s</p>', [$description]) : ''
		);
	}

	protected function _handleSubmit(): void
	{
		// Nonce already verified at this point.
		$options = Main::getInstance()->getOptions();
		$existingKey = $options->apiKey;
		$existingSecret = $options->apiSecret;
		$this->_apiDisabledCountries = [];
		foreach (array_column($this->getSupportedCountries(), 'iso3') as $countryCode)
		{
			$name = static::FORM_NAME_PREFIX . static::FORM_PER_COUNTRY_NAME . $countryCode;
			if (($_POST[$name] ?? null) === 'disabled')
			{
				$this->_apiDisabledCountries[$countryCode] = $countryCode;
			}
		}

		$includedOptions = [
			'apiKey',
			'apiSecret',
			'displayMode',
			'allowAutofillIntlBypass',
			'netherlandsMode',
		];

		foreach ($options as $option => $value)
		{
			$postName = static::FORM_NAME_PREFIX . $option;
			// Only overwrite the API secret if anything has been set
			if ($option === 'apiSecret' && ($_POST[$postName] ?? '') === '')
			{
				continue;
			}

			if (!in_array($option, $includedOptions, true))
			{
				continue;
			}

			if ($option === 'netherlandsPostcodeMode')
			{
				if (isset($_POST[$postName]) && array_key_exists($_POST[$postName], $this->getNetherlandsModeDescriptions()))
				{
					$newValue = sanitize_text_field($_POST[$postName]);
				}
				else
				{
					$newValue = static::NETHERLANDS_MODE_DEFAULT;
				}
			}
			elseif ($option === 'displayMode')
			{
				if (isset($_POST[$postName]) && array_key_exists($_POST[$postName], $this->getDisplayModeDescriptions()))
				{
					$newValue = sanitize_text_field($_POST[$postName]);
				}
				else
				{
					$newValue = static::DISPLAY_MODE_DEFAULT;
				}
			}
			else
			{
				$newValue = sanitize_text_field($_POST[$postName] ?? $value);
			}

			$options->{$option} = $newValue;
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
					$this->_apiAccountInfoDateTime = new DateTime();
				}
				else
				{
					$this->_apiAccountStatus = static::API_ACCOUNT_STATUS_INACTIVE;
				}
				$this->_apiAccountName = $accountInformation['name'] ?? null;
				$this->_apiAccountLimit = $accountInformation['subscription']['limit'] ?? null;
				$this->_apiAccountUsage = $accountInformation['subscription']['usage'] ?? null;
				$this->_apiAccountStartDate = $accountInformation['subscription']['startDate'] ?? null;
			}
			catch (AuthenticationException $e)
			{
				$this->_apiAccountStatus = static::API_ACCOUNT_STATUS_INVALID_CREDENTIALS;
				$this->_apiAccountName = null;
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
			'displayMode' => $this->displayMode,
			'allowAutofillIntlBypass' => $this->allowAutofillIntlBypass,
			'netherlandsMode' => $this->netherlandsMode,
			'apiAccountInfoDateTime' => $this->_apiAccountInfoDateTime === null ? '' : $this->_apiAccountInfoDateTime->format('Y-m-d H:i:s'),
			'supportedCountries' => wp_json_encode($this->_supportedCountries),
			'apiAccountStatus' => $this->_apiAccountStatus,
			'apiAccountName' => $this->_apiAccountName,
			'apiAccountLimit' => $this->_apiAccountLimit,
			'apiAccountUsage' => $this->_apiAccountUsage,
			'apiAccountStartDate' => $this->_apiAccountStartDate,
			'apiDisabledCountries' => $this->_apiDisabledCountries,
		];
	}

	public function hasEditableAddressFields(): bool
	{
		return $this->displayMode === static::DISPLAY_MODE_SHOW_ALL;
	}

	public function isNlModePostcodeOnly(): bool
	{
		return $this->netherlandsMode === static::NETHERLANDS_MODE_POSTCODE_ONLY;
	}

	public function getEnabledCountries(): array
	{
		$enabledCountries = [];
		foreach ($this->getSupportedCountries() as $supportedCountry)
		{
			if (in_array($supportedCountry['iso3'], $this->_apiDisabledCountries, true))
			{
				continue;
			}
			$enabledCountries[] = $supportedCountry;
		}
		return $enabledCountries;
	}

	protected function _getCountryName(array $supportedCountry): string
	{
		return WC()->countries->get_countries()[$supportedCountry['iso2']] ?? $supportedCountry['name'];
	}

	protected function getDisplayModeDescriptions(): array
	{
		return [
			static::DISPLAY_MODE_DEFAULT => esc_html__('Hide fields and show a formatted address instead (default)', 'postcode-eu-address-validation'),
			static::DISPLAY_MODE_SHOW_ON_ADDRESS => esc_html__('Hide fields until an address is selected', 'postcode-eu-address-validation'),
			static::DISPLAY_MODE_SHOW_ALL => esc_html__('Show fields', 'postcode-eu-address-validation'),
		];
	}

	protected function getNetherlandsModeDescriptions(): array
	{
		return [
			static::NETHERLANDS_MODE_DEFAULT => esc_html__('Full lookup (default)', 'postcode-eu-address-validation'),
			static::NETHERLANDS_MODE_POSTCODE_ONLY => esc_html__('Postcode and house number only', 'postcode-eu-address-validation'),
		];
	}
}
