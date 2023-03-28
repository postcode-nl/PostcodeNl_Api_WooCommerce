const PostcodeNlAddressFieldMapping = {
	/**
	 * These constants define address parts which can be used to populate form fields.
	 * The values in PostcodeNlAddressFieldMapping.mapping can be any of the constants below.
	 */
	street:                 'street',
	houseNumber:            'houseNumber',
	houseNumberAddition:    'houseNumberAddition',
	city:                   'city',
	streetAndHouseNumber:   'streetAndHouseNumber',

	// A combination of street and house number (including house number addition)
	postcode:               'postcode',

	// A combination of house number and house number addition
	houseNumberAndAddition: 'houseNumberAndAddition',

	/**
	 *  Contains the province or similar administrative level for specific countries:
	 *    Spain - Province
	 *    Switzerland - Canton
	 */
	province:               'province',
};

/**
 * Mapping from field names (ending) to their address parts used in the address forms.
 * Change this mapping to accommodate your (checkout) forms address fields.
 *  - Keys: form field name endings (omit 'billing' in 'billing_address_1' to match both shipping and billing addresses),
 *  - Values: address parts placed in them on selecting an address.
 *  - Use a value of null to toggle the field without changing its value.
 */
PostcodeNlAddressFieldMapping.mapping = {
	_address_1:           PostcodeNlAddressFieldMapping.streetAndHouseNumber,
	_address_2:           null, // Address line 2
	_postcode:            PostcodeNlAddressFieldMapping.postcode,
	_city:                PostcodeNlAddressFieldMapping.city,
	_state:               PostcodeNlAddressFieldMapping.province,
	_street_name:         PostcodeNlAddressFieldMapping.street,
	_house_number:        PostcodeNlAddressFieldMapping.houseNumber,
	_house_number_suffix: PostcodeNlAddressFieldMapping.houseNumberAddition
};
