import { settings } from '..';

export const getAddress = (postcode, houseNumber) => {
	const url = settings.actions.dutchAddressLookup
		.replace('${postcode}', encodeURIComponent(postcode))
		.replace('${houseNumberAndAddition}', encodeURIComponent(houseNumber));

	return fetch(url, {headers: {'X-WC-Checkout-Type': 'blocks'}}).then((response) => {
		if (response.ok)
		{
			return response.json();
		}

		throw new Error(response.statusText);
	});
};
