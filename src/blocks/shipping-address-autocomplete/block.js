import { useSelect, useDispatch } from '@wordpress/data';
import { useCallback } from '@wordpress/element';
import { CART_STORE_KEY, CHECKOUT_STORE_KEY } from '@woocommerce/block-data';
import AutocompleteContainer from '../../components/address-autocomplete/container';

const Block = () => {
	const { getUseShippingAsBilling, getEditingShippingAddress } = useSelect(select => select(CHECKOUT_STORE_KEY), []),
		{shippingAddress} = useSelect(select => select(CART_STORE_KEY).getCustomerData(), []),
		{setShippingAddress, setBillingAddress} = useDispatch(CART_STORE_KEY);

	const setAddress = useCallback(
		(values) => {
			setShippingAddress(values);

			if (getUseShippingAsBilling())
			{
				// Billing address needs to be synced with shipping address after calling `setShippingAddress`.
				setBillingAddress({...values});
			}
		},
		[getUseShippingAsBilling, setShippingAddress, setBillingAddress]
	);

	return getEditingShippingAddress() ? (
		<AutocompleteContainer
			addressType="shipping"
			address={shippingAddress}
			setAddress={setAddress}
		/>
	) : null

}

export default Block;
