<?php

namespace PostcodeNl\AddressAutocomplete;

defined('ABSPATH') || exit;

use PostcodeNl\AddressAutocomplete\Exception\Exception;
use PostcodeNl\Api\Client;
use PostcodeNl\Api\Exception\AuthenticationException;
use PostcodeNl\Api\Exception\ClientException;
use PostcodeNl\Api\Exception\CurlNotLoadedException;
use PostcodeNl\Api\Exception\ForbiddenException;
use PostcodeNl\Api\Exception\InvalidSessionValueException;
use PostcodeNl\Api\Exception\NotFoundException;
use PostcodeNl\Api\Exception\ServerUnavailableException;
use PostcodeNl\Api\Exception\TooManyRequestsException;
use PostcodeNl\Api\Exception\UnexpectedException;

class Proxy
{
	public const AJAX_AUTOCOMPLETE = 'postcodenl_address_autocomplete';
	public const AJAX_GET_DETAILS = 'postcodenl_address_get_details';
	public const AJAX_DUTCH_ADDRESS_LOOKUP = 'postcodenl_address_dutch_address_lookup';

	/** @var Client */
	protected $_client;
	/** @var string|null */
	protected $_session;


	public function __construct(string $apiKey, string $apiSecret)
	{
		$identifiers = [
			'WordPress/' . get_bloginfo('version'),
			'PostcodeNl-WooCommerce/' . Main::VERSION,
		];
		$this->_client = new Client($apiKey, $apiSecret, implode(' ', $identifiers));
	}

	public function autocomplete(): void
	{
		$this->_populateSession();
		[$context, $term] = $this->_getParameters(2);

		try
		{
			$result = $this->_client->internationalAutocomplete($context, $term, $this->_session, $this->_getLanguage());
		}
		catch (ClientException $e)
		{
			$this->_errorResponse($this->_logException($e));
		}
		$this->_outputJsonResponse($result);
	}

	public function getDetails(): void
	{
		$this->_populateSession();
		[$context] = $this->_getParameters(1);

		try
		{
			$result = $this->_client->internationalGetDetails($context, $this->_session);
		}
		catch (ClientException $e)
		{
			$this->_errorResponse($this->_logException($e));
		}
		$this->_outputJsonResponse($result);
	}

	public function dutchAddressLookup(): void
	{
		[$postcode, $houseNumberAndAddition] = $this->_getParameters(2);
		if (!preg_match('/(?<houseNumber>\d+)\s?(?<addition>.*)/', $houseNumberAndAddition, $matches))
		{
			$this->_errorResponse($this->_logException(new Exception('House number could not be parsed.')));
		}
		$houseNumber = $matches['houseNumber'] ?? null;
		if ($houseNumber === null)
		{
			$this->_errorResponse($this->_logException(new Exception('Missing house number.')));
		}
		$houseNumberAddition = $matches['addition'] ?? null;

		try
		{
			$this->_outputJsonResponse($this->_client->dutchAddressByPostcode($postcode, (int) $houseNumber, $houseNumberAddition));
		}
		catch (NotFoundException $e)
		{
			$this->_errorResponse(['error' => true, 'message' => __('Unknown postcode and house number combination, make sure your input is correct.', 'postcodenl-address-autocomplete')]);
		}
		catch (ClientException $e)
		{
			$this->_errorResponse($this->_logException($e));
		}
	}

	public function getClient(): Client
	{
		return $this->_client;
	}

	/**
	 * Get parsed parameters.
	 *
	 * @param int $expectedParameters The expected number of GET parameters, an error is thrown if this is not equal to the actual number.
	 * @return array An array of parsed parameters, stripped of added slashes.
	 */
	protected function _getParameters(int $expectedParameters): array
	{
		$parts = explode('/', \trim($_GET['parameters'] ?? '', '/'));
		if (count($parts) !== $expectedParameters)
		{
			throw new Exception('Invalid number of parameters provided.');
		}

		$parts = array_map('stripslashes', $parts);
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

	protected function _populateSession(): void
	{
		$sessionHeaderKey = 'HTTP_' . str_replace('-', '_', strtoupper(Client::SESSION_HEADER_KEY));
		if (!isset($_SERVER[$sessionHeaderKey]))
		{
			throw new Exception(sprintf('Missing HTTP session header `%s`.', Client::SESSION_HEADER_KEY));
		}
		$this->_session = $_SERVER[$sessionHeaderKey];
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
			case CurlNotLoadedException::class:
				$logger->emergency($e->getMessage(), $wooCommerceErrorContext);
				break;
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
		wp_die(json_encode($response), 500);
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