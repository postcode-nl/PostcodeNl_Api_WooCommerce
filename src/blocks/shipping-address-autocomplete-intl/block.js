import { useSelect, useDispatch } from '@wordpress/data';
import { CART_STORE_KEY } from '@woocommerce/block-data';
import AutocompleteContainer from '../../components/address-autocomplete-intl/container';

const Block = () => {
	const {shippingAddress} = useSelect(select => select(CART_STORE_KEY).getCustomerData(), []),
		{setShippingAddress} = useDispatch(CART_STORE_KEY);

	return (
		<AutocompleteContainer
			addressType="shipping"
			address={shippingAddress}
			setAddress={setShippingAddress}
		/>
	)

}

export default Block;
