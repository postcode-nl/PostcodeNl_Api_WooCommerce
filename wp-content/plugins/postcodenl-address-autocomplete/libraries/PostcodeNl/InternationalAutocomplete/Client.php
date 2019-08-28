<?php


namespace PostcodeNl\InternationalAutocomplete;


class Client
{
	public const SESSION_HEADER_KEY = 'X-Autocomplete-Session';

	protected const SERVER_URL = 'https://serve-a-lot.office.react.nl/~bastiaan/PostcodeNl_Api-master/international/v1/';
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
			throw new ClientException('Cannot use Postcode.nl International Autocomplete client, the server needs to have the PHP `cURL` extension installed.');
		}

		$this->_curlHandler = curl_init();
		curl_setopt($this->_curlHandler, CURLOPT_CUSTOMREQUEST, 'GET');
		curl_setopt($this->_curlHandler, CURLOPT_RETURNTRANSFER, true);
		curl_setopt($this->_curlHandler, CURLOPT_CONNECTTIMEOUT, 2);
		curl_setopt($this->_curlHandler, CURLOPT_TIMEOUT, 5);
		curl_setopt($this->_curlHandler, CURLOPT_USERAGENT, static::class . '/' . static::VERSION .' PHP/'. PHP_VERSION);
	}

	public function autocomplete(string $context, string $term, ?string $session = null): array
	{
		return $this->performApiCall('autocomplete/' . rawurlencode($context) . '/' . rawurlencode($term), $session ?? $this->generateSessionString());
	}

	public function getDetails(string $context, ?string $session = null): array
	{
		return $this->performApiCall('address/' . rawurlencode($context), $session ?? $this->generateSessionString());
	}

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

		$responseStatusCode = curl_getinfo($this->_curlHandler, CURLINFO_HTTP_CODE);
		$curlError = curl_error($this->_curlHandler);
		$curlErrorNr = curl_errno($this->_curlHandler);
		if ($curlError)
		{
			throw new ClientException('Connection error `'. $curlErrorNr .'`: `'. $curlError .'`', $curlErrorNr);
		}

		// Parse the response as JSON, will be null if not parsable JSON.
		$jsonResponse = json_decode($response, true);
		switch ($responseStatusCode)
		{
			case 200:
				if (!is_array($jsonResponse))
				{
					throw new ClientException('Invalid JSON response from the server: ' . $url);
				}

				return $jsonResponse;
			case 400:
				throw new ClientException('Bad request: ' . $url);
			case 404:
				throw new ClientException('Could not find the requested resource at: ' . $url);
			case 500:
				throw new ClientException('API server gave server error: ' . $response);
			default:
				throw new ClientException(vsprintf('The error code `%s` is not yet handled.', [$responseStatusCode]));
		}
	}
}