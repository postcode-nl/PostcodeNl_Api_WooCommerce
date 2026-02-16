import { useSelect, useDispatch } from '@wordpress/data';
import { CART_STORE_KEY, CHECKOUT_STORE_KEY } from '@woocommerce/block-data';
import AutocompleteBlock from '../../components/address-autocomplete/block';

const Block = () => {
	const {isEditingAddress} = useSelect((select) => ({
			isEditingAddress: select(CHECKOUT_STORE_KEY).getEditingBillingAddress(),
		}), []),
		{setEditingBillingAddress} = useDispatch(CHECKOUT_STORE_KEY),
		{billingAddress} = useSelect(select => select(CART_STORE_KEY).getCustomerData(), []),
		{setBillingAddress} = useDispatch(CART_STORE_KEY);

	return (
		<AutocompleteBlock
			addressType='billing'
			address={billingAddress}
			setAddress={setBillingAddress}
			isEditingAddress={isEditingAddress}
			setIsEditingAddress={setEditingBillingAddress}
		/>
	);
};

export default Block;
