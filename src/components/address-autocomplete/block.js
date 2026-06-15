import { useEffect, useCallback, useRef, useState } from '@wordpress/element';
import { settings } from '.';
import AutocompleteContainer from './container';
import { useStoredAddress } from './hooks';
import { getValidatedAddress, extractHouseNumber, validatePoBox } from './utils';
import { getAddress as getNlAddress } from './nl/api';

const AutocompleteBlock = ({isEditingAddress, setIsEditingAddress, setAddress, ...props}) => {
	const storedAddress = useStoredAddress(props.addressType),
		addressRef = useRef(),
		isEditingAddressRef = useRef(),
		[isApiDown, setIsApiDown] = useState(false);

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
						if (status === 'valid' && (address.addressType !== 'PO box' || validatePoBox(props.addressType)))
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
							storedAddress.clear();
							setIsEditingAddress(true);
						}
					})
					.catch((error) => {
						console.error(error);
						storedAddress.clear();
						setIsEditingAddress(true);
					});

				return;
			}
		}

		// Using Validate API:
		getValidatedAddress(addressRef.current)
			.then((result) => {
				if (result === null || (result.isPoBox && !validatePoBox(props.addressType)))
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
							address_1: `${result.streetLine}`,
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
		props.addressType,
		setAddressWithStorage,
	]);

	if (isEditingAddress)
	{
		return <AutocompleteContainer
			{...props}
			setAddress={setAddressWithStorage}
			isApiDown={isApiDown}
			setIsApiDown={setIsApiDown}
		/>;
	}

	return null;
};

export default AutocompleteBlock;
