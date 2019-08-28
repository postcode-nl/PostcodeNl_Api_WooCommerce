<?php


namespace PostcodeNl\AddressAutocomplete;

use PostcodeNl\InternationalAutocomplete\ClientException;

defined('ABSPATH') || exit;

class Options
{
	public const FORM_NAME_PREFIX = 'postcodenl_address_autocomplete_';
	public const MENU_SLUG = 'postcodenl-address-autocomplete';

	protected const OPTION_KEY = '_postcodenl_address_autocomplete_options';
	protected const REQUIRED_USER_CAPABILITY = 'activate_plugins';

	public $apiKey = '';
	public $apiSecret = '';

	/** @var array */
	protected $_supportedCountries;
	/** @var \DateTime */
	protected $_supportedCountriesExpiration;


	public function __construct()
	{
		$data = \get_option(static::OPTION_KEY, []);
		$this->apiKey = $data['apiKey'] ?? '';
		$this->apiSecret = $data['apiSecret'] ?? '';
		$this->_supportedCountries = json_decode($data['supportedCountries'] ?? 'NULL', true);
		$supportedCountriesExpiration = $data['supportedCountriesExpiration'] ?? '';
		$this->_supportedCountriesExpiration = $supportedCountriesExpiration === '' ? null : new \DateTime($supportedCountriesExpiration);
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
			__('The API key provided by Postcode.nl when you created your account, or you can request new credentials if you lost them. If you do not have an account yet you can <a href="https://www.postcode.nl/services/adresdata/api#abonnementen" target="_blank" rel="noopener">register one now</a>.', Main::TEXT_DOMAIN)
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
			'<p class="submit"><input type="submit" name="%ssubmit" id="submit" class="button button-primary" value="%s"></p>',
			[static::FORM_NAME_PREFIX, __('Save changes', Main::TEXT_DOMAIN)]
		);
		$markup .= '</form>';

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

	public function getSupportedCountries(): array
	{
		if ($this->_supportedCountriesExpiration === null || $this->_supportedCountriesExpiration < new \DateTime())
		{
			try
			{
				$this->_supportedCountries = Main::getInstance()->getProxy()->getClient()->getSupportedCountries();
				$this->_supportedCountriesExpiration = new \DateTime('+1 days');
				$this->save();
			}
			catch (ClientException $e)
			{
				// Continue using previous if exist, else use empty array
				if ($this->_supportedCountries === null)
				{
					$this->_supportedCountries = [];
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

		foreach ($options as $option => $value)
		{
			$postName = static::FORM_NAME_PREFIX . $option;

			if ($option === 'apiSecret' && ($_POST[$postName] ?? '') === '')
			{
				continue;
			}

			$options->{$option} = $_POST[$postName] ?? $value;
		}

		$options->save();
	}

	protected function _getData(): array
	{
		return [
			'apiKey' => $this->apiKey,
			'apiSecret' => $this->apiSecret,
			'supportedCountriesExpiration' => $this->_supportedCountriesExpiration === null ? '' : $this->_supportedCountriesExpiration->format('Y-m-d H:i:s'),
			'supportedCountries' => json_encode($this->_supportedCountries),
		];
	}
}