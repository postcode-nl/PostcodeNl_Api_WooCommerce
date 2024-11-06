import { useSelect, useDispatch } from '@wordpress/data';
import { CART_STORE_KEY, CHECKOUT_STORE_KEY } from '@woocommerce/block-data';
import AutocompleteContainer from '../../components/address-autocomplete-intl/container';

const Block = () => {
	const useShippingAsBilling = useSelect(select => select(CHECKOUT_STORE_KEY).getUseShippingAsBilling() , []),
		{billingAddress} = useSelect(select => select(CART_STORE_KEY).getCustomerData(), []),
		{setBillingAddress} = useDispatch(CART_STORE_KEY);

	return useShippingAsBilling ? null : (
		<AutocompleteContainer
			addressType="billing"
			address={billingAddress}
			setAddress={setBillingAddress}
		/>
	)
}

export default Block;
