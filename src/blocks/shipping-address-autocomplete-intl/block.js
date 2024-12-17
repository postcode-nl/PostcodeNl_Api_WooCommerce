import { useSelect, useDispatch } from '@wordpress/data';
import { useEffect } from '@wordpress/element';
import { CART_STORE_KEY } from '@woocommerce/block-data';
import { CHECKOUT_STORE_KEY } from '@woocommerce/block-data';
import AutocompleteContainer from '../../components/address-autocomplete-intl/container';

const Block = () => {
	const useShippingAsBilling = useSelect(select => select(CHECKOUT_STORE_KEY).getUseShippingAsBilling(), []),
		{shippingAddress} = useSelect(select => select(CART_STORE_KEY).getCustomerData(), []),
		{setShippingAddress, setBillingAddress} = useDispatch(CART_STORE_KEY);

	useEffect(() => {
		if (useShippingAsBilling)
		{
			// Billing address needs to be synced with shipping address after calling `setShippingAddress`.
			setBillingAddress({...shippingAddress});
		}
	}, [shippingAddress]);

	return (
		<AutocompleteContainer
			addressType="shipping"
			address={shippingAddress}
			setAddress={setShippingAddress}
		/>
	)

}

export default Block;
