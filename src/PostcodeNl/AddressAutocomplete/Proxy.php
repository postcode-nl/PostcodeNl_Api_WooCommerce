<?php

namespace PostcodeNl\AddressAutocomplete;

defined('ABSPATH') || exit;

use PostcodeNl\AddressAutocomplete\Exception\Exception;
use PostcodeNl\InternationalAutocomplete\Client;
use function count;
use function explode;

class Proxy
{
	public const AJAX_AUTOCOMPLETE = 'postcodenl_address_autocomplete';
	public const AJAX_GET_DETAILS = 'postcodenl_address_get_details';

	/** @var Client */
	protected $_client;
	/** @var string|null */
	protected $_session;


	public function __construct(string $apiKey, string $apiSecret)
	{
		$this->_client = new Client($apiKey, $apiSecret, 'PostcodeNl-WooCommerce');

		$headers = getallheaders();
		foreach ($headers as $name => $value)
		{
			if (strcasecmp(Client::SESSION_HEADER_KEY, $name) !== 0)
			{
				continue;
			}

			$this->_session = $value;
			break;
		}
	}

	public function autocomplete(): void
	{
		[$context, $term] = $this->_getParameters(2);

		$result = $this->_client->internationalAutocomplete($context, $term, $this->_session);
		$this->_outputJsonResponse($result);
	}

	public function getDetails(): void
	{
		[$context] = $this->_getParameters(1);

		$result = $this->_client->internationalGetDetails($context, $this->_session);
		$this->_outputJsonResponse($result);
	}

	public function getClient(): Client
	{
		return $this->_client;
	}

	protected function _getParameters(int $expectedParameters): array
	{
		$parts = explode('/', \trim($_GET['parameters'] ?? '', '/'));
		if (count($parts) !== $expectedParameters)
		{
			throw new Exception('Invalid number of parameters provided.');
		}

		return $parts;
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
		die(json_encode($response));
	}

	protected function _repeatCacheControlHeader(array $apiResponseHeaders): void
	{
		if (!isset($apiResponseHeaders['cache-control']))
		{
			return;
		}

		header('Cache-Control: ' . implode(',', $apiResponseHeaders['cache-control']));
	}
}