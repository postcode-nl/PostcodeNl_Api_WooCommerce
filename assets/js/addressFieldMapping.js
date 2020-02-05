const PostcodeNlAddressFieldMapping = {};

/**
 * These constants define address parts which can be used to populate form fields.
 * The values in PostcodeNlAddressFieldMapping.mapping can be any of the constants below.
 */
PostcodeNlAddressFieldMapping.street = 'street';
PostcodeNlAddressFieldMapping.houseNumber = 'houseNumber';
PostcodeNlAddressFieldMapping.houseNumberAddition = 'houseNumberAddition';
PostcodeNlAddressFieldMapping.street = 'street';
PostcodeNlAddressFieldMapping.city = 'city';
PostcodeNlAddressFieldMapping.postcode = 'postcode';
// A combination of street and house number (including house number addition)
PostcodeNlAddressFieldMapping.streetAndHouseNumber = 'streetAndHouseNumber';
// A combination of house number and house number addition
PostcodeNlAddressFieldMapping.houseNumberAndAddition = 'houseNumberAndAddition';

/**
 * End of address part constants
 */

/**
 * Mapping from field names (ending) to their address parts used in the address forms.
 * Change this mapping to accommodate your (checkout) forms address fields.
 * The first values are form field name endings (omit 'billing' in 'billing_address_1' to match both shipping and billing addresses),
 * the second are address parts placed in them on selecting an address.
 */
PostcodeNlAddressFieldMapping.mapping = {
	'_address_1': PostcodeNlAddressFieldMapping.streetAndHouseNumber,
	'_postcode': PostcodeNlAddressFieldMapping.postcode,
	'_city': PostcodeNlAddressFieldMapping.city,
	'_street_name': PostcodeNlAddressFieldMapping.street,
	'_house_number': PostcodeNlAddressFieldMapping.houseNumber,
	'_house_number_suffix': PostcodeNlAddressFieldMapping.houseNumberAddition
};