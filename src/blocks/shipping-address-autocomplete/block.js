import { useSelect, useDispatch } from '@wordpress/data';
import { useCallback, useRef } from '@wordpress/element';
import { CART_STORE_KEY, CHECKOUT_STORE_KEY } from '@woocommerce/block-data';
import AutocompleteBlock from '../../components/address-autocomplete/block';

const Block = () => {
	const {isUseShippingAsBilling, isEditingAddress} = useSelect((select) => ({
			isUseShippingAsBilling: select(CHECKOUT_STORE_KEY).getUseShippingAsBilling(),
			isEditingAddress: select(CHECKOUT_STORE_KEY).getEditingShippingAddress(),
		}), []),
		{setEditingShippingAddress} = useDispatch(CHECKOUT_STORE_KEY),
		{shippingAddress} = useSelect(select => select(CART_STORE_KEY).getCustomerData(), []),
		{setShippingAddress, setBillingAddress} = useDispatch(CART_STORE_KEY),
		isUseShippingAsBillingRef = useRef();

	isUseShippingAsBillingRef.current = isUseShippingAsBilling;

	const setAddress = useCallback((values) => {
		setShippingAddress(values);

		if (isUseShippingAsBillingRef.current)
		{
			// Billing address needs to be synced with shipping address after calling `setShippingAddress`.
			setBillingAddress({...values});
		}
	}, [
		setShippingAddress,
		setBillingAddress,
	]);

	return (
		<AutocompleteBlock
			addressType='shipping'
			address={shippingAddress}
			setAddress={setAddress}
			isEditingAddress={isEditingAddress}
			setIsEditingAddress={setEditingShippingAddress}
		/>
	);
};

export default Block;
