import { select as selectStore } from '@wordpress/data';
import { VALIDATION_STORE_KEY } from '@woocommerce/block-data';

export function validateStoreAddress(addressType)
{
	return ['address_1', 'city', 'postcode'].every((field) => {
		const error = selectStore(VALIDATION_STORE_KEY).getValidationError(`${addressType}_${field}`);
		return typeof error === 'undefined';
	});
}
