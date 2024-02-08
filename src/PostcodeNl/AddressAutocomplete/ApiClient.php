<?php

namespace PostcodeNl\AddressAutocomplete;

use PostcodeNl\AddressAutocomplete\Exception\AuthenticationException;
use PostcodeNl\AddressAutocomplete\Exception\BadRequestException;
use PostcodeNl\AddressAutocomplete\Exception\ForbiddenException;
use PostcodeNl\AddressAutocomplete\Exception\InvalidJsonResponseException;
use PostcodeNl\AddressAutocomplete\Exception\InvalidPostcodeException;
use PostcodeNl\AddressAutocomplete\Exception\InvalidSessionValueException;
use PostcodeNl\AddressAutocomplete\Exception\NotFoundException;
use PostcodeNl\AddressAutocomplete\Exception\RemoteRequestException;
use PostcodeNl\AddressAutocomplete\Exception\ServerUnavailableException;
use PostcodeNl\AddressAutocomplete\Exception\TooManyRequestsException;
use PostcodeNl\AddressAutocomplete\Exception\UnexpectedException;

class ApiClient
{
	public const SESSION_HEADER_KEY = 'X-Autocomplete-Session';
	public const SESSION_HEADER_VALUE_VALIDATION = '/^[a-z\d\-_.]{8,64}$/i';

	protected const SERVER_URL = 'https://api.postcode.eu/';

	/** @var string The Postcode.nl API key, required for all requests. Provided when registering an account. */
	protected $_key;
	/** @var string The Postcode.nl API secret, required for all requests */
	protected $_secret;
	/** @var array Response headers received in the most recent API call. */
	protected $_mostRecentResponseHeaders = [];


	/**
	 * Client constructor.
	 * @param string $key The Postcode.nl API key, provided when registering an account.
	 * @param string $secret The Postcode.nl API secret, provided when registering an account.
	 */
	public function __construct(string $key, string $secret)
	{
		$this->_key = $key;
		$this->_secret = $secret;
	}

	/**
	 * @see https://api.postcode.nl/documentation/international/v1/Autocomplete/autocomplete
	 */
	public function internationalAutocomplete(string $context, string $term, string $session, string $language = null): array
	{
		$this->_validateSessionHeader($session);

		$params = [$context, $term];
		if (isset($language))
		{
			$params[] = $language;
		}

		$params = array_map('rawurlencode', $params);

		return $this->_performApiCall('international/v1/autocomplete/' . implode('/', $params), $session);
	}

	/**
	 * @see https://api.postcode.nl/documentation/international/v1/Autocomplete/getDetails
	 */
	public function internationalGetDetails(string $context, string $session): array
	{
		$this->_validateSessionHeader($session);

		return $this->_performApiCall('international/v1/address/' . rawurlencode($context), $session);
	}

	/**
	 * @see https://api.postcode.nl/documentation/international/v1/Autocomplete/getSupportedCountries
	 */
	public function internationalGetSupportedCountries(): array
	{
		return $this->_performApiCall('international/v1/supported-countries', null);
	}

	/**
	 * @see https://api.postcode.nl/documentation/nl/v1/Address/viewByPostcode
	 */
	public function dutchAddressByPostcode(string $postcode, int $houseNumber, ?string $houseNumberAddition = null): array
	{
		// Validate postcode format
		$postcode = trim($postcode);
		if (!$this->isValidDutchPostcodeFormat($postcode))
		{
			throw new InvalidPostcodeException(sprintf('Postcode `%s` has an invalid format, it should be in the format 1234AB.', $postcode));
		}

		// Use the regular validation function
		$urlParts = [
			'nl/v1/addresses/postcode',
			rawurlencode($postcode),
			$houseNumber,
		];
		if ($houseNumberAddition !== null)
		{
			$urlParts[] = rawurlencode($houseNumberAddition);
		}
		return $this->_performApiCall(implode('/', $urlParts), null);
	}

	/**
	 * @see https://api.postcode.nl/documentation/nl/v1/Address/matchExact
	 */
	public function dutchAddressExactMatch(string $city, string $street, int $houseNumber, string $houseNumberAddition = ''): array
	{
		$urlParts = [
			'nl/v1/addresses/exact',
			rawurlencode($city),
			rawurlencode($street),
			$houseNumber,
			rawurlencode($houseNumberAddition),
		];

		return $this->_performApiCall(implode('/', $urlParts), null);
	}

	/**
	 * @see https://api.postcode.nl/documentation/nl/v1/Address/viewByRd
	 */
	public function dutchAddressRD(float $rdX, float $rdY): array
	{
		$urlParts = [
			'nl/v1/addresses/rd',
			rawurlencode($rdX),
			rawurlencode($rdY),
		];

		return $this->_performApiCall(implode('/', $urlParts), null);
	}

	/**
	 * @see https://api.postcode.nl/documentation/nl/v1/Address/viewByLatLon
	 */
	public function dutchAddressLatLon(float $latitude, float $longitude): array
	{
		$urlParts = [
			'nl/v1/addresses/latlon',
			rawurlencode($latitude),
			rawurlencode($longitude),
		];

		return $this->_performApiCall(implode('/', $urlParts), null);
	}

	/**
	 * @see https://api.postcode.nl/documentation/nl/v1/Address/viewByBagNumberDesignationId
	 */
	public function dutchAddressBagNumberDesignation(string $bagNumberDesignationId): array
	{
		$urlParts = [
			'nl/v1/addresses/bag/number-designation',
			rawurlencode($bagNumberDesignationId),
		];

		return $this->_performApiCall(implode('/', $urlParts), null);
	}

	/**
	 * @see https://api.postcode.nl/documentation/nl/v1/Address/viewByBagAddressableObjectId
	 */
	public function dutchAddressBagAddressableObject(string $bagAddressableObjectId): array
	{
		$urlParts = [
			'nl/v1/addresses/bag/addressable-object',
			rawurlencode($bagAddressableObjectId),
		];

		return $this->_performApiCall(implode('/', $urlParts), null);
	}

	/**
	 * @see https://api.postcode.nl/documentation/nl/v1/PostcodeRange/viewByPostcode
	 */
	public function dutchAddressPostcodeRanges(string $postcode): array
	{
		// Validate postcode format
		$postcode = trim($postcode);
		if (!$this->isValidDutchPostcodeFormat($postcode))
		{
			throw new InvalidPostcodeException(sprintf('Postcode `%s` has an invalid format, it should be in the format `1234AB`.', $postcode));
		}

		$urlParts = [
			'nl/v1/postcode-ranges/postcode',
			rawurlencode($postcode),
		];

		return $this->_performApiCall(implode('/', $urlParts), null);
	}

	/**
	 * @see https://api.postcode.nl/documentation/account/v1/Account/getInfo
	 */
	public function accountInfo(): array
	{
		return $this->_performApiCall('account/v1/info', null);
	}

	/**
	 * @return array The response headers from the most recent API call.
	 */
	public function getApiCallResponseHeaders(): array
	{
		return $this->_mostRecentResponseHeaders;
	}

	/**
	 * Validate if string has a correct Dutch postcode format. First digit cannot be zero.
	 *
	 * @param string $postcode
	 * @return bool
	 */
	public function isValidDutchPostcodeFormat(string $postcode): bool
	{
		return (bool) preg_match('~^[1-9]\d{3}\s?[a-zA-Z]{2}$~', $postcode);
	}

	protected function _validateSessionHeader(string $session): void
	{
		if (preg_match(static::SESSION_HEADER_VALUE_VALIDATION, $session) === 0)
		{
			throw new InvalidSessionValueException(sprintf(
				'Session value `%s` does not conform to `%s`, please refer to the API documentation for further information.',
				$session,
				static::SESSION_HEADER_VALUE_VALIDATION
			));
		}
	}

	protected function _performApiCall(string $path, ?string $session): array
	{
		$url = static::SERVER_URL . $path;

		// @see https://developer.wordpress.org/reference/classes/WP_Http/request/
		$arguments = [
			'timeout' => 5,
			'user-agent' => $this->_getUserAgent(),
			'verify' => false,
			'verifyname' => false,
			'headers' => [
				'Authorization' => 'Basic ' . base64_encode($this->_key . ':' . $this->_secret),
			],
		];

		if (isset($_SERVER['HTTP_REFERER']))
		{
			$arguments['headers']['Referer'] = sanitize_url($_SERVER['HTTP_REFERER']);
		}

		if ($session !== null)
		{
			$arguments['headers'][static::SESSION_HEADER_KEY] = $session;
		}

		/**
		 * @var array|\WP_Error $response Array containing 'headers', 'body', 'response', 'cookies', 'filename'.
		 *                                A WP_Error instance upon error.
		 */
		$response = wp_remote_request($url, $arguments);

		if ($response instanceof \WP_Error)
		{
			throw new RemoteRequestException(sprintf('Connection error number `%s`: `%s`.', $response->get_error_code(), $response->get_error_message()));
		}

		$this->_mostRecentResponseHeaders = $response['headers']->getAll();

		$responseStatusCode = $response['response']['code'];

		// Parse the response as JSON, will be null if not parsable JSON.
		$jsonResponse = json_decode($response['body'], true);
		switch ($responseStatusCode)
		{
			case 200:
				if (!is_array($jsonResponse))
				{
					throw new InvalidJsonResponseException('Invalid JSON response from the server for request: ' . $url);
				}

				return $jsonResponse;
			case 400:
				throw new BadRequestException(vsprintf('Server response code 400, bad request for `%s`.', [$url]));
			case 401:
				throw new AuthenticationException('Could not authenticate your request, please make sure your API credentials are correct.');
			case 403:
				throw new ForbiddenException('Your account currently has no access to the international API, make sure you have an active subscription.');
			case 404:
				throw new NotFoundException('The requested address could not be found.');
			case 429:
				throw new TooManyRequestsException('Too many requests made, please slow down: ' . $response);
			case 503:
				throw new ServerUnavailableException('The international API server is currently not available: ' . $response);
			default:
				throw new UnexpectedException(vsprintf('Unexpected server response code `%s`.', [$responseStatusCode]));
		}
	}

	protected function _getUserAgent(): string
	{
		return sprintf(
			'WordPress/%s PostcodeNl-WooCommerce/%s PHP/%s',
			get_bloginfo('version'),
			Main::VERSION,
			PHP_VERSION
		);
	}
}