import { useEffect, useCallback, useRef, useState } from '@wordpress/element';
import { settings } from '.';
import AutocompleteContainer from './container';
import { useStoredAddress } from './hooks';
import { getValidatedAddress, extractHouseNumber, validatePoBox, getMappedAddressValues } from './utils';
import { getAddress as getNlAddress } from './nl/api';

const AutocompleteBlock = ({isEditingAddress, setIsEditingAddress, setAddress, ...props}) => {
	const storedAddress = useStoredAddress(props.addressType),
		addressRef = useRef(),
		isEditingAddressRef = useRef(),
		[isApiDown, setIsApiDown] = useState(false);

	addressRef.current = props.address;
	isEditingAddressRef.current = isEditingAddress;

	/**
	 * @param {Object|null} apiAddress - Address object from API result. If null, clears address.
	 * @param {Array|null} [mailLines] - Optional mail lines, default null.
	 */
	const setAddressWithStorage = useCallback((apiAddress, mailLines = null) => {
		const mappedValues = {},
			values = apiAddress === null ? {} : {
				street: apiAddress.street,
				streetAndHouseNumber: apiAddress.streetLine,
				houseNumber: apiAddress.buildingNumber ?? apiAddress.houseNumber,
				houseNumberAddition: apiAddress.buildingNumberAddition ?? apiAddress.houseNumberAddition,
				houseNumberAndAddition: apiAddress.building,
				postcode: apiAddress.postcode,
				city: apiAddress.locality ?? apiAddress.city,
				province: apiAddress.province,
			};

		for (const key of Object.keys(addressRef.current))
		{
			const prop = settings.addressFieldMapping[key] ?? null;
			if (prop !== null)
			{
				mappedValues[key] = String(values[prop] ?? '');
			}
		}

		if (apiAddress === null)
		{
			storedAddress.clear();
		}
		else
		{
			storedAddress.set(mappedValues, mailLines);
		}

		setAddress({...addressRef.current, ...mappedValues});
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
			const addressValues = getMappedAddressValues(addressRef.current),
				houseNumber = addressValues.houseNumberAndAddition || extractHouseNumber(
					addressValues.streetAndHouseNumber ?? `${addressRef.current.address_1} ${addressRef.current.address_2}`
				);

			// If house number is unambiguous, validate using NL API. Otherwise fall back to Validate API.
			if (houseNumber !== null)
			{
				getNlAddress(addressValues.postcode, houseNumber)
					.then((response) => {
						const {status, address} = response;
						if (status === 'valid' && (address.addressType !== 'PO box' || validatePoBox(props.addressType)))
						{
							setAddressWithStorage(
								address,
								[
									`${address.street} ${address.houseNumber} ${address.houseNumberAddition ?? ''}`.trim(),
									`${address.postcode} ${address.city}`,
								]
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
					setAddressWithStorage(null);
				}
				else
				{
					setAddressWithStorage(result.address, result.mailLines);
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
