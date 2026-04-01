<?php

namespace PostcodeNl\AddressAutocomplete\Exception;

defined('ABSPATH') || exit;

class ForbiddenException extends ClientException
{
	protected $code = 403;
}
