<?php

namespace PostcodeNl\AddressAutocomplete;

defined('ABSPATH') || exit;

use PostcodeNl\AddressAutocomplete\Exception\AuthenticationException;
use PostcodeNl\AddressAutocomplete\Exception\ClientException;
use PostcodeNl\AddressAutocomplete\Exception\Exception;
use PostcodeNl\AddressAutocomplete\Exception\ForbiddenException;
use PostcodeNl\AddressAutocomplete\Exception\InvalidSessionValueException;
use PostcodeNl\AddressAutocomplete\Exception\NotFoundException;
use PostcodeNl\AddressAutocomplete\Exception\ServerUnavailableException;
use PostcodeNl\AddressAutocomplete\Exception\TooManyRequestsException;
use PostcodeNl\AddressAutocomplete\Exception\UnexpectedException;

class Proxy
{
	public const AJAX_AUTOCOMPLETE = 'postcodenl_address_autocomplete';
	public const AJAX_GET_DETAILS = 'postcodenl_address_get_details';
	public const AJAX_DUTCH_ADDRESS_LOOKUP = 'postcodenl_address_dutch_address_lookup';
	public const AJAX_VALIDATE = 'postcodenl_address_validate';

	/** @var ApiClient */
	protected $_client;
	/** @var string|null */
	protected $_session;


	public function __construct(string $apiKey, string $apiSecret)
	{
		$this->_client = new ApiClient($apiKey, $apiSecret);
	}

	public function autocomplete(): void
	{
		$this->_populateSession();
		$context = sanitize_text_field(wp_unslash($_GET['context']));
		$term = base64_decode(sanitize_text_field(wp_unslash($_GET['term']))); // Base64 is used to preserve whitespace.

		try
		{
			$this->_outputJsonResponse(
				$this->_client->internationalAutocomplete(
					$context,
					$term,
					$this->_session,
					$this->_getLanguage())
			);
		}
		catch (ClientException $e)
		{
			$this->_errorResponse($this->_logException($e));
		}
	}

	public function getDetails(): void
	{
		$this->_populateSession();
		$context = sanitize_text_field(wp_unslash($_GET['context']));

		try
		{
			$result = $this->_client->internationalGetDetails($context, $this->_session);
			$result['streetLine'] = $this->_getStreetLine($result);
			$result['address']['postcode'] = wc_format_postcode($result['address']['postcode'], $result['country']['iso2Code']);
			$this->_outputJsonResponse($result);
		}
		catch (ClientException $e)
		{
			$this->_errorResponse($this->_logException($e));
		}
	}

	/**
	 * Get street line from an address details response.
	 *
	 * The result is to be used in the first street address field.
	 *
	 * @param array $addressDetails
	 * @return string - Street line formatted according to country.
	 */
	private function _getStreetLine(array $addressDetails): string
	{
		$address = $addressDetails['address'];
		$countryIso2 = $addressDetails['country']['iso2Code'];
		if ($countryIso2 === 'LU')
		{
			return $address['building'] . ', ' . $address['street'];
		}
		elseif ($countryIso2 === 'FR')
		{
			return trim($address['building'] . ' ' . $address['street']);
		}
		elseif ($countryIso2 === 'GB')
		{
			$building = $addressDetails['details']['gbrBuilding'];
			if ($address['street'] === '')
			{
				return $address['building'];
			}
			elseif ($building['number'] === null && $building['addition'] === null)
			{
				return $address['building'] . ', ' . $address['street'];
			}
			else
			{
				return $address['building'] . ' ' . $address['street'];
			}
		}

		return trim($address['street'] . ' ' . $address['building']);
	}

	public function dutchAddressLookup(): void
	{
		$postcode = sanitize_text_field(wp_unslash($_GET['postcode']));
		$houseNumberAndAddition = sanitize_text_field(wp_unslash($_GET['houseNumberAndAddition']));

		/** @var array $matches */
		preg_match('/^(?<houseNumber>\d{1,5})(?<addition>\D.*)?$/', $houseNumberAndAddition, $matches);
		$houseNumber = isset($matches['houseNumber']) ? (int)$matches['houseNumber'] : null;
		$houseNumberAddition = isset($matches['addition']) ? trim($matches['addition']) : null;
		$address = null;

		if ($houseNumber === null)
		{
			$this->_errorResponse($this->_logException(new Exception('Missing house number.')));
		}

		try
		{
			$address = $this->_client->dutchAddressByPostcode($postcode, (int)$houseNumber, $houseNumberAddition);
			$status = 'valid';

			if (
				(strcasecmp($address['houseNumberAddition'] ?? '', $houseNumberAddition ?? '') != 0)
				|| (!empty($address['houseNumberAdditions']) && is_null($address['houseNumberAddition']))
			)
			{
				$status = 'houseNumberAdditionIncorrect';
			}
		}
		catch (NotFoundException $e)
		{
			$status = 'notFound';
		}
		catch (ClientException $e)
		{
			$status = null;
			$this->_errorResponse($this->_logException($e));
		}

		$address['postcode'] = wc_format_postcode($address['postcode'], 'NL');

		$this->_outputJsonResponse([
			'status' => $status,
			'address' => $address,
		]);
	}

	public function validate(): void
	{
		$params = [];
		foreach (['country', 'postcode', 'locality', 'street', 'building', 'region', 'streetAndBuilding'] as $name)
		{
			if (isset($_GET[$name]))
			{
				$params[$name] = sanitize_text_field(wp_unslash($_GET[$name]));
			}
		}

		if (empty($params['country']))
		{
			$this->_errorResponse($this->_logException(new Exception('Country not specified.')));
		}

		try
		{
			$result = $this->_client->validate(...$params);
		}
		catch (ClientException $e)
		{
			$this->_errorResponse($this->_logException($e));
		}

		foreach ($result['matches'] as &$m)
		{
			if (in_array($m['status']['validationLevel'], ['Building', 'BuildingPartial'], true))
			{
				$m['streetLine'] = $this->_getStreetLine($m);
			}

			if (is_string($m['address']['postcode']))
			{
				$m['address']['postcode'] = wc_format_postcode($m['address']['postcode'], $result['country']['iso2Code']);
			}
		}

		$this->_outputJsonResponse($result);
	}

	public function getClient(): ApiClient
	{
		return $this->_client;
	}

	protected function _outputJsonResponse(array $response): void
	{
		// Repeat the cache control header from the API response if it is available
		$this->_repeatCacheControlHeader($this->_client->getApiCallResponseHeaders());

		// WordPress seems to be in the habit of setting the expires header to `Wed, 11 Jan 1984 05:00:00 GMT`, there is no need for that
		header_remove('Expires');
		// The response is JSON
		header('Content-type: application/json');
		// wp_die resets the cache control headers, so die regularly
		die(wp_json_encode($response));
	}

	protected function _repeatCacheControlHeader(array $apiResponseHeaders): void
	{
		if (!isset($apiResponseHeaders['cache-control']))
		{
			return;
		}

		header('Cache-Control: ' . $apiResponseHeaders['cache-control']);
	}

	protected function _populateSession(): void
	{
		$sessionHeaderKey = 'HTTP_' . str_replace('-', '_', strtoupper(ApiClient::SESSION_HEADER_KEY));
		if (!isset($_SERVER[$sessionHeaderKey]))
		{
			throw new Exception(sprintf('Missing HTTP session header `%s`.', ApiClient::SESSION_HEADER_KEY));
		}
		$this->_session = sanitize_text_field($_SERVER[$sessionHeaderKey]);
	}

	protected function _logException(\Exception $e): array
	{
		/** @var \WC_Logger $logger */
		$logger = wc_get_logger();

		$wooCommerceErrorContext = [
			'source' => 'PostcodeNl-WooCommerce-' . Main::VERSION,
			'exception' => get_class($e),
			'stackTrace' => $e->getTraceAsString(),
		];

		switch (get_class($e))
		{
			case AuthenticationException::class:
			case ForbiddenException::class:
				$logger->alert($e->getMessage(), $wooCommerceErrorContext);
				break;
			case InvalidSessionValueException::class:
			case NotFoundException::class:
				$logger->critical($e->getMessage(), $wooCommerceErrorContext);
				break;
			case TooManyRequestsException::class:
			case ServerUnavailableException::class:
			case UnexpectedException::class:
				$logger->error($e->getMessage(), $wooCommerceErrorContext);
				break;
			case Exception::class:
				$logger->warning($e->getMessage(), $wooCommerceErrorContext);
				break;
			default:
				// Throw any other exceptions
				throw $e;
		}

		return ['error' => true, 'message' => $e->getMessage()];
	}

	protected function _errorResponse(array $response): void
	{
		wp_die(wp_json_encode($response), 500);
	}

	protected function _getLanguage(): ?string
	{
		$locale = \get_locale();

		if (preg_match('~^\w{2}_\w{2}$~', $locale) === 1)
		{
			return str_replace('_', '-', $locale);
		}

		return null;
	}
}
