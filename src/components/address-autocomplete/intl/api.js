import { settings } from '..';

export const validate = (country, streetAndBuilding, postcode, locality) => {
	const url = settings.actions.validate
		.replace('${country}', encodeURIComponent(country ?? ''))
		.replace('${streetAndBuilding}', encodeURIComponent(streetAndBuilding ?? ''))
		.replace('${postcode}', encodeURIComponent(postcode ?? ''))
		.replace('${locality}', encodeURIComponent(locality ?? ''));

	return fetch(url, {headers: {'X-WC-Checkout-Type': 'blocks'}}).then((response) => {
		if (response.ok)
		{
			return response.json();
		}

		throw new Error(response.statusText);
	});
};
