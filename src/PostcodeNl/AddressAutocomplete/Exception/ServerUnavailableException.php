<?php

namespace PostcodeNl\AddressAutocomplete\Exception;

defined('ABSPATH') || exit;

class ServerUnavailableException extends ClientException
{
	protected $code = 503;
}
