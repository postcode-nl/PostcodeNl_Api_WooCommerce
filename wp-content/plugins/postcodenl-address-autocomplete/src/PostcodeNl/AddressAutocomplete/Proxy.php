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
		$this->_client = new Client($apiKey, $apiSecret);

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
		[$context, $term] = $this->getParameters(2);

		$result = $this->_client->internationalAutocomplete($context, $term, $this->_session);
		print(json_encode($result));
		/** @see https://developer.wordpress.org/plugins/javascript/enqueuing/#die */
		wp_die();
	}

	public function getDetails(): void
	{
		[$context] = $this->getParameters(1);

		$result = $this->_client->internationalGetDetails($context, $this->_session);
		print(json_encode($result));
		/** @see https://developer.wordpress.org/plugins/javascript/enqueuing/#die */
		wp_die();
	}

	public function getClient(): Client
	{
		return $this->_client;
	}

	protected function getParameters(int $expectedParameters): array
	{
		$parts = explode('/', \trim($_GET['parameters'] ?? '', '/'));
		if (count($parts) !== $expectedParameters)
		{
			throw new Exception('Invalid number of parameters provided.');
		}

		return $parts;
	}
}