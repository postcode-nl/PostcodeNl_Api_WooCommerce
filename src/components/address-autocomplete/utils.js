import { select as selectStore } from '@wordpress/data';
import { VALIDATION_STORE_KEY } from '@woocommerce/block-data';
import { settings } from '.';
import { validate as validateAddress } from './intl/api';

export function validateStoreAddress(addressType)
{
	return ['address_1', 'city', 'postcode'].every((field) => {
		const error = selectStore(VALIDATION_STORE_KEY).getValidationError(`${addressType}_${field}`);
		return typeof error === 'undefined';
	});
}

export function getValidatedAddress({country, address_1, address_2, postcode, city})
{
	const countryIso3 = settings.enabledCountries[country].iso3;
	return validateAddress(countryIso3, `${address_1} ${address_2}`.trim(), postcode, city)
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
		.catch((error) => console.error(error));
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
