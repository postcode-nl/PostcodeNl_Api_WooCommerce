import { useEffect, useCallback, useRef } from '@wordpress/element';
import { settings } from '.';
import AutocompleteContainer from './container';
import { useStoredAddress } from './hooks';
import { getValidatedAddress, extractHouseNumber } from './utils';
import { getAddress as getNlAddress } from './nl/api';

const AutocompleteBlock = ({isEditingAddress, setIsEditingAddress, setAddress, ...props}) => {
	const storedAddress = useStoredAddress(props.addressType),
		addressRef = useRef(),
		isEditingAddressRef = useRef();

	addressRef.current = props.address;
	isEditingAddressRef.current = isEditingAddress;

	const setAddressWithStorage = useCallback((values, mailLines = null) => {
		if (['address_1', 'city', 'postcode'].some((name) => values[name] === ''))
		{
			storedAddress.clear();
		}
		else
		{
			storedAddress.set(values, mailLines);
		}

		setAddress(values);
	}, [
		storedAddress,
		setAddress,
	]);

	useEffect(() => {
		const country = settings.enabledCountries[addressRef.current.country];
		if (
			!country
			|| isEditingAddressRef.current
			|| (!storedAddress.isExpired() && storedAddress.isEqual(addressRef.current))
		)
		{
			return;
		}

		// Address is assumed to have values at this point, otherwise it would be in editing mode.

		// Clear the currently stored address, because it's expired and/or different from the current address.
		storedAddress.clear();

		if (country.iso2 === 'NL' && settings.netherlandsMode === 'postcodeOnly')
		{
			const {address_1, address_2, postcode} = addressRef.current,
				houseNumber = extractHouseNumber(`${address_1} ${address_2}`);

			// If house number is unambiguous, validate using NL API. Otherwise fall back to Validate API.
			if (houseNumber !== null)
			{
				getNlAddress(postcode, houseNumber)
					.then((response) => {
						const {status, address} = response;
						if (status === 'valid')
						{
							const house = `${address.houseNumber} ${address.houseNumberAddition ?? ''}`.trim();
							setAddressWithStorage(
								{
									...addressRef.current,
									address_1: `${address.street} ${house}`,
									city: address.city,
									postcode: address.postcode,
								},
								[`${address.street} ${house}`, `${address.postcode} ${address.city}`]
							);
						}
						else
						{
							setIsEditingAddress(true);
						}
					})
					.catch((error) => console.error(error));

				return;
			}
		}

		// Using Validate API:
		getValidatedAddress(addressRef.current)
			.then((result) => {
				if (result === null)
				{
					setIsEditingAddress(true);
					setAddressWithStorage({...addressRef.current, address_1: '', city: '', postcode: ''});
				}
				else
				{
					const {address} = result;
					setAddressWithStorage(
						{
							...addressRef.current,
							address_1: `${address.street} ${address.building}`,
							city: address.locality,
							postcode: address.postcode,
						},
						result.mailLines
					);
				}
			});
	}, [
		storedAddress,
		setIsEditingAddress,
		setAddressWithStorage,
	]);

	return isEditingAddress ? <AutocompleteContainer {...props} setAddress={setAddressWithStorage} /> : null;
}

export default AutocompleteBlock;
