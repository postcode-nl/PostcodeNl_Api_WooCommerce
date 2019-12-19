<?php


namespace PostcodeNl\InternationalAutocomplete;


use PostcodeNl\InternationalAutocomplete\Exception\AuthenticationException;
use PostcodeNl\InternationalAutocomplete\Exception\BadRequestException;
use PostcodeNl\InternationalAutocomplete\Exception\CurlException;
use PostcodeNl\InternationalAutocomplete\Exception\CurlNotLoadedException;
use PostcodeNl\InternationalAutocomplete\Exception\ForbiddenException;
use PostcodeNl\InternationalAutocomplete\Exception\InvalidJsonResponseException;
use PostcodeNl\InternationalAutocomplete\Exception\InvalidPostcodeException;
use PostcodeNl\InternationalAutocomplete\Exception\InvalidSessionValueException;
use PostcodeNl\InternationalAutocomplete\Exception\NotFoundException;
use PostcodeNl\InternationalAutocomplete\Exception\ServerUnavailableException;
use PostcodeNl\InternationalAutocomplete\Exception\TooManyRequestsException;
use PostcodeNl\InternationalAutocomplete\Exception\UnexpectedException;

class Client
{
	public const SESSION_HEADER_KEY = 'X-Autocomplete-Session';
	public const SESSION_HEADER_VALUE_VALIDATION = '/^[a-z\d\-_.]{8,64}$/i';

	protected const SERVER_URL = 'https://api.postcode.eu/';
	protected const VERSION = '1.0';

	/** @var string The Postcode.nl API key, required for all requests. Provided when registering an account. */
	protected $_key;
	/** @var string The Postcode.nl API secret, required for all requests */
	protected $_secret;
	/** @var string A platform identifier, a short description of the platform using the API client. */
	protected $_platform;
	/** @var resource */
	protected $_curlHandler;
	/** @var array Response headers received in the most recent API call. */
	protected $_mostRecentResponseHeaders = [];


	/**
	 * Client constructor.
	 * @param string $key The Postcode.nl API key, provided when registering an account.
	 * @param string $secret The Postcode.nl API secret, provided when registering an account.
	 * @param string $platform A platform identifier, a short description of the platform using the API client.
	 */
	public function __construct(string $key, string $secret, string $platform)
	{
		$this->_key = $key;
		$this->_secret = $secret;
		$this->_platform = $platform;

		if (!extension_loaded('curl'))
		{
			throw new CurlNotLoadedException('Cannot use Postcode.nl International Autocomplete client, the server needs to have the PHP `cURL` extension installed.');
		}

		$this->_curlHandler = curl_init();
		curl_setopt($this->_curlHandler, CURLOPT_CUSTOMREQUEST, 'GET');
		curl_setopt($this->_curlHandler, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($this->_curlHandler, CURLOPT_CONNECTTIMEOUT, 2);
		curl_setopt($this->_curlHandler, CURLOPT_TIMEOUT, 5);
		curl_setopt($this->_curlHandler, CURLOPT_USERAGENT, $this->_getUserAgent());

		if (isset($_SERVER['HTTP_REFERER']))
		{
			curl_setopt($this->_curlHandler, CURLOPT_REFERER, $_SERVER['HTTP_REFERER']);
		}
		curl_setopt($this->_curlHandler, CURLOPT_HEADERFUNCTION, function($curl, string $header) {
			$length = strlen($header);

			$headerParts = explode(':', $header, 2);
			// Ignore invalid headers
			if (count($headerParts) < 2)
			{
				return $length;
			}
			[$headerName, $headerValue] = $headerParts;
			$this->_mostRecentResponseHeaders[strtolower(trim($headerName))][] = trim($headerValue);

			return $length;
		});
	}

	/**
	 * @see https://api.postcode.nl/documentation/international/v1/Autocomplete/autocomplete
	 */
	public function internationalAutocomplete(string $context, string $term, string $session): array
	{
		$this->_validateSessionHeader($session);

		return $this->_performApiCall('international/v1/autocomplete/' . rawurlencode($context) . '/' . rawurlencode($term), $session);
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
	 * Look up an address by postcode and house number.
	 *
	 * @param string $postcode Dutch postcode in the '1234AB' format
	 * @param int $houseNumber House number
	 * @param string|null $houseNumberAddition House number addition, optional
	 * @return array
	 *
	 * @see https://api.postcode.nl/documentation
	 */
	public function dutchAddressByPostcode(string $postcode, int $houseNumber, ?string $houseNumberAddition = null): array
	{
		// Test postcode format
		$postcode = trim($postcode);
		if (!$this->_isValidDutchPostcodeFormat($postcode))
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
	 * Get Account information
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
	protected function _isValidDutchPostcodeFormat(string $postcode): bool
	{
		return (bool) preg_match('~^[1-9]\d{3}\s?[a-zA-Z]{2}$~', $postcode);
	}

	public function __destruct()
	{
		curl_close($this->_curlHandler);
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
		curl_setopt($this->_curlHandler, CURLOPT_URL, $url);
		curl_setopt($this->_curlHandler, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
		curl_setopt($this->_curlHandler, CURLOPT_USERPWD, $this->_key .':'. $this->_secret);
		if ($session !== null)
		{
			curl_setopt($this->_curlHandler, CURLOPT_HTTPHEADER, [
				static::SESSION_HEADER_KEY . ': ' . $session,
			]);
		}

		$this->_mostRecentResponseHeaders = [];
		$response = curl_exec($this->_curlHandler);

		$responseStatusCode = curl_getinfo($this->_curlHandler, CURLINFO_RESPONSE_CODE);
		$curlError = curl_error($this->_curlHandler);
		$curlErrorNr = curl_errno($this->_curlHandler);
		if ($curlError !== '')
		{
			throw new CurlException(vsprintf('Connection error number `%s`: `%s`.', [$curlErrorNr, $curlError]));
		}

		// Parse the response as JSON, will be null if not parsable JSON.
		$jsonResponse = json_decode($response, true);
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
			'%s %s/%s PHP/%s',
			$this->_platform,
			str_replace('\\', '_', static::class),
			static::VERSION,
			PHP_VERSION
		);
	}
}