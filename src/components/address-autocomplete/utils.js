import { select as selectStore } from '@wordpress/data';
import { VALIDATION_STORE_KEY } from '@woocommerce/block-data';
import { settings } from '.';

// Correctly format street and building line for countries that use reversed order.
export function formatStreetLine (countryIso2, street, building)
{
	let a = street, b = building;
	if (settings.reverseStreetLineCountries.includes(countryIso2))
		[a, b] = [b, a];

	return `${a} ${b}`.trim();
}

export function validateStoreAddress(addressType)
{
	return ['address_1', 'city', 'postcode'].every((field) => {
		const error = selectStore(VALIDATION_STORE_KEY).getValidationError(`${addressType}_${field}`);
		return typeof error === 'undefined';
	});
}
