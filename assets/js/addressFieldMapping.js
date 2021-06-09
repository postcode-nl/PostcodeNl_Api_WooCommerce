const PostcodeNlAddressFieldMapping = {
	/**
	 * These constants define address parts which can be used to populate form fields.
	 * The values in PostcodeNlAddressFieldMapping.mapping can be any of the constants below.
	 */
	street:					'street',
	houseNumber:			'houseNumber',
	houseNumberAddition:	'houseNumberAddition',
	city:					'city',
	postcode:				'postcode',

	// A combination of street and house number (including house number addition)
	streetAndHouseNumber:	'streetAndHouseNumber',

	// A combination of house number and house number addition
	houseNumberAndAddition:	'houseNumberAndAddition',
};

/**
 * Mapping from field names (ending) to their address parts used in the address forms.
 * Change this mapping to accommodate your (checkout) forms address fields.
 *  - Keys: form field name endings (omit 'billing' in 'billing_address_1' to match both shipping and billing addresses),
 *  - Values: address parts placed in them on selecting an address.
 *  - Use a value of null to toggle the field without changing its value.
 */
PostcodeNlAddressFieldMapping.mapping = {
	_address_1:				PostcodeNlAddressFieldMapping.streetAndHouseNumber,
	_address_2:				null, // Address line 2
	_postcode:				PostcodeNlAddressFieldMapping.postcode,
	_city:					PostcodeNlAddressFieldMapping.city,
	_state:					null, // E.g. used for optional canton field for Switzerland.
	_street_name:			PostcodeNlAddressFieldMapping.street,
	_house_number:			PostcodeNlAddressFieldMapping.houseNumber,
	_house_number_suffix:	PostcodeNlAddressFieldMapping.houseNumberAddition
};
