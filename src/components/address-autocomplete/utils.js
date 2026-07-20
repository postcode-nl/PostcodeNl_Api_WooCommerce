import { select as selectStore } from '@wordpress/data';
import { VALIDATION_STORE_KEY } from '@woocommerce/block-data';
import { getSetting } from '@woocommerce/settings';
import { settings } from '.';
import { validate as validateAddress } from './intl/api';

export function validateStoreAddress(addressType)
{
	return ['address_1', 'city', 'postcode'].every((field) => {
		const error = selectStore(VALIDATION_STORE_KEY).getValidationError(`${addressType}_${field}`);
		return typeof error === 'undefined';
	});
}

export function getValidatedAddress(storeAddress)
{
	const countryIso3 = settings.enabledCountries[storeAddress.country].iso3,
		{streetAndHouseNumber, postcode, city} = getMappedAddressValues(storeAddress);

	return validateAddress(countryIso3, streetAndHouseNumber, postcode, city)
		.then((response) => {
			const top = response.matches[0];
			if (
				top?.status
				&& !top.status.isAmbiguous
				&& top.status.grade < 'C'
				&& ['Building', 'BuildingPartial'].includes(top.status.validationLevel)
			)
			{
				return top;
			}

			return null;
		})
		.catch((error) => {
			console.error(error);
			return null;
		});
}

export function extractHouseNumber(streetLine)
{
	const matches = [...streetLine.matchAll(/[1-9]\d{0,4}\D*/g)];

	if (matches[0]?.index === 0)
	{
		matches.shift(); // Discard leading number as a valid house number.
	}

	if (matches.length === 1) // Single match is most likely the house number.
	{
		return matches[0][0].trim();
	}

	return null; // No match or ambiguous (i.e. multiple numbers found).

}

export function validatePoBox(addressType)
{
	return settings.allowPoBoxShipping === 'y' || !(addressType === 'shipping' || getSetting('forcedBillingAddress'));
}

/**
 * @param {Object} storeAddress
 * @return {Object} Store-address values keyed according to fields mapping
 */
export function getMappedAddressValues(storeAddress)
{
	// Get values according to field mapping. Mapped key must exist in store address.
	const values = {};
	for (const [key, prop] of Object.entries(settings.addressFieldMapping))
	{
		if (prop && key in storeAddress)
		{
			values[prop] = storeAddress[key];
		}
	}

	// Check for separate street and house number fields, fill combined fields.
	if ('street' in values)
	{
		if ('houseNumber' in values)
		{
			values.houseNumberAndAddition = [values.houseNumber, values.houseNumberAddition ?? ''].join(' ').trim();
		}

		if ('houseNumberAndAddition' in values)
		{
			values.streetAndHouseNumber = [values.street, values.houseNumberAndAddition].join(' ');
		}
	}

	return values;
}
