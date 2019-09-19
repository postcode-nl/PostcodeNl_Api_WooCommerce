<?php


namespace PostcodeNl\InternationalAutocomplete;


use PostcodeNl\InternationalAutocomplete\Exception\AuthenticationException;
use PostcodeNl\InternationalAutocomplete\Exception\BadRequestException;
use PostcodeNl\InternationalAutocomplete\Exception\CurlException;
use PostcodeNl\InternationalAutocomplete\Exception\CurlNotLoadedException;
use PostcodeNl\InternationalAutocomplete\Exception\ForbiddenException;
use PostcodeNl\InternationalAutocomplete\Exception\InvalidJsonResponseException;
use PostcodeNl\InternationalAutocomplete\Exception\ServerUnavailableException;
use PostcodeNl\InternationalAutocomplete\Exception\TooManyRequestsException;
use PostcodeNl\InternationalAutocomplete\Exception\UnexpectedException;

class Client
{
	public const SESSION_HEADER_KEY = 'X-Autocomplete-Session';

	protected const SERVER_URL = 'https://api.postcode.eu/international/v1/';
	protected const VERSION = 0.1;

	/** @var string The Postcode.nl API key, required for all requests. Provided when registering an account. */
	protected $_key;
	/** @var string The Postcode.nl API secret, required for all requests */
	protected $_secret;
	/** @var resource */
	protected $_curlHandler;


	public function __construct(string $key, string $secret)
	{
		$this->_key = $key;
		$this->_secret = $secret;

		if (!extension_loaded('curl'))
		{
			throw new CurlNotLoadedException('Cannot use Postcode.nl International Autocomplete client, the server needs to have the PHP `cURL` extension installed.');
		}

		$this->_curlHandler = curl_init();
		curl_setopt($this->_curlHandler, CURLOPT_CUSTOMREQUEST, 'GET');
		curl_setopt($this->_curlHandler, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($this->_curlHandler, CURLOPT_CONNECTTIMEOUT, 2);
		curl_setopt($this->_curlHandler, CURLOPT_TIMEOUT, 5);
		curl_setopt($this->_curlHandler, CURLOPT_USERAGENT, static::class . '/' . static::VERSION .' PHP/'. PHP_VERSION);
	}

	/**
	 * @see https://api.postcode.nl/documentation/international/v1/Autocomplete/autocomplete
	 */
	public function autocomplete(string $context, string $term, ?string $session = null): array
	{
		return $this->performApiCall('autocomplete/' . rawurlencode($context) . '/' . rawurlencode($term), $session ?? $this->generateSessionString());
	}

	/**
	 * @see https://api.postcode.nl/documentation/international/v1/Autocomplete/getDetails
	 */
	public function getDetails(string $context, ?string $session = null): array
	{
		return $this->performApiCall('address/' . rawurlencode($context), $session ?? $this->generateSessionString());
	}

	/**
	 * @see https://api.postcode.nl/documentation/international/v1/Autocomplete/getSupportedCountries
	 */
	public function getSupportedCountries(): array
	{
		return $this->performApiCall('supported-countries', null);
	}

	public function __destruct()
	{
		curl_close($this->_curlHandler);
	}

	protected function generateSessionString(): string
	{
		return bin2hex(random_bytes(8));
	}

	protected function performApiCall(string $path, ?string $session): array
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
			case 429:
				throw new TooManyRequestsException('Too many requests made, please slow down: ' . $response);
			case 503:
				throw new ServerUnavailableException('The international API server is currently not available: ' . $response);
			default:
				throw new UnexpectedException(vsprintf('Unexpected server response code `%s`.', [$responseStatusCode]));
		}
	}
}