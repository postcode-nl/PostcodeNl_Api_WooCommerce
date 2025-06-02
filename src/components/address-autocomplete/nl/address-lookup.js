import { __ } from '@wordpress/i18n';
import { useState, useEffect, useCallback, useRef } from '@wordpress/element';
import { useDispatch } from '@wordpress/data';
import { ValidatedTextInput, Spinner } from '@woocommerce/blocks-components';
import { VALIDATION_STORE_KEY } from '@woocommerce/block-data';
import { settings } from '..';
import { useStoredAddress } from '../hooks';
import { validateStoreAddress, extractHouseNumber } from '../utils';
import { HouseNumberSelect, LookupError } from '.';
import {
	ADDRESS_LOOKUP_DELAY,
	POSTCODE_REGEX,
	HOUSE_NUMBER_REGEX,
	ADDRESS_RESULT_STATUS,
	ADDITION_PLACEHOLDER_VALUE,
} from './constants';
import { getAddress } from './api';

const initHouseNumber = ({address_1, address_2}) => extractHouseNumber(`${address_1} ${address_2}`) ?? '';

const AddressLookup = (
	{
		addressType,
		address,
		setAddress,
		setFormattedAddress,
		addressRef,
		resetAddress,
	}
) => {
	const postcodeInputId = `${addressType}-postcode-eu-postcode`,
		houseNumberInputId = `${addressType}-postcode-eu-house_number`,
		houseNumberSelectId = `${addressType}-postcode-eu-house_number_select`,
		lookupErrorId = `${addressType}-postcode-eu-address-lookup-error`,
		[postcodeValue, setPostcodeValue] = useState(address.postcode ?? ''),
		[houseNumberValue, setHouseNumberValue] = useState(() => initHouseNumber(address)),
		[houseNumberAdditionValue, setHouseNumberAdditionValue] = useState(ADDITION_PLACEHOLDER_VALUE),
		[houseNumberOptions, setHouseNumberOptions] = useState([]),
		[parsedPostcodeValue, setParsedPostcodeValue] = useState(null),
		[parsedHouseNumberValue, setParsedHouseNumberValue] = useState(null),
		[isLoading, setIsLoading] = useState(false),
		[addressLookupResult, setAddressLookupResult] = useState({
			status: null,
			address: null
		}),
		lookupTimeoutRef = useRef(),
		{setValidationErrors, clearValidationError} = useDispatch(VALIDATION_STORE_KEY),
		storedAddress = useStoredAddress(addressType),
		initStoredAddressRef = useRef(!storedAddress.isExpired() && storedAddress.isEqual(addressRef.current));

	const isOptional = useCallback(() => validateStoreAddress(addressType) , [addressType]);

	const validatePostcode = useCallback((inputElement) => {
		const match = POSTCODE_REGEX.exec(inputElement.value);
		setParsedPostcodeValue(match === null ? null : match[1] + match[2]);
		return isOptional() || match !== null;
	}, [isOptional]);

	const validateHouseNumber = useCallback((inputElement) => {
		const match = HOUSE_NUMBER_REGEX.exec(inputElement.value);
		setParsedHouseNumberValue(match === null ? null : `${match[1]} ${match[2]?.trim() ?? ''}`.trim());
		return isOptional() || match !== null;
	}, [isOptional]);

	const checkAddressStatus = useCallback(({status, address}) => {
		clearValidationError(lookupErrorId);

		if (status === ADDRESS_RESULT_STATUS.NOT_FOUND)
		{
			setValidationErrors({
				[lookupErrorId]: {
					message: __('Address not found.', 'postcode-eu-address-validation'),
					hidden: false,
				},
			});
		}
		else if (status === ADDRESS_RESULT_STATUS.ADDITION_INCORRECT)
		{
			setHouseNumberOptions(address.houseNumberAdditions.map((addition) => ({
				value: addition,
				label: `${address.houseNumber} ${addition}`.trim(),
			})));
		}
	}, [
		clearValidationError,
		lookupErrorId,
		setValidationErrors,
		setHouseNumberOptions,
	]);

	useEffect(() => {
		if (!initStoredAddressRef.current)
		{
			resetAddress();
			setHouseNumberOptions([]);
			setHouseNumberAdditionValue(ADDITION_PLACEHOLDER_VALUE);
		}

		if (parsedPostcodeValue === null || parsedHouseNumberValue === null)
		{
			return;
		}

		if (initStoredAddressRef.current)
		{
			initStoredAddressRef.current = false;
			return;
		}

		lookupTimeoutRef.current = window.setTimeout(() => {
			setIsLoading(true);

			getAddress(parsedPostcodeValue, parsedHouseNumberValue)
				.then((response) => {
					checkAddressStatus(response);
					setAddressLookupResult(response);
				})
				.catch(() => {
					setValidationErrors({
						[lookupErrorId]: {
							message: __(
								'An error has occurred. Please try again later or contact us.',
								'postcode-eu-address-validation'
							),
							hidden: false,
						},
					});
				})
				.finally(() => setIsLoading(false));
		}, ADDRESS_LOOKUP_DELAY);

		return () => window.clearTimeout(lookupTimeoutRef.current);
	}, [
		resetAddress,
		setHouseNumberOptions,
		setHouseNumberAdditionValue,
		parsedPostcodeValue,
		parsedHouseNumberValue,
		setIsLoading,
		checkAddressStatus,
		setAddressLookupResult,
		setValidationErrors,
		lookupErrorId,
	]);

	useEffect(() => {
		if (initStoredAddressRef.current)
		{
			setFormattedAddress(storedAddress.get().mailLines.join('\n'));
			return;
		}

		const {status, address} = addressLookupResult;
		if (status === ADDRESS_RESULT_STATUS.VALID)
		{
			const house = `${address.houseNumber} ${address.houseNumberAddition ?? ''}`.trim(),
				mailLines = [`${address.street} ${house}`, `${address.postcode} ${address.city}`];

			setAddress(
				{
					...addressRef.current,
					address_1: `${address.street} ${house}`,
					city: address.city,
					postcode: address.postcode,
				},
				mailLines
			);

			if (settings.displayMode === 'default')
			{
				setFormattedAddress(mailLines.join('\n'));
			}
		}
		else
		{
			resetAddress();
			setFormattedAddress(null);
		}
	}, [
		addressLookupResult,
		setFormattedAddress,
		storedAddress,
		setAddress,
		addressRef,
		resetAddress,
	]);

	// Remove validation errors when unmounted.
	useEffect(() => () => clearValidationError(lookupErrorId), [clearValidationError, lookupErrorId]);

	useEffect(() => {
		if (initStoredAddressRef.current)
		{
			return;
		}

		setAddressLookupResult((result) => {
			if (result.address === null)
			{
				return result;
			}

			const isPlaceholder = houseNumberAdditionValue === ADDITION_PLACEHOLDER_VALUE;
			return {
				address: {...result.address, houseNumberAddition: isPlaceholder ? null : houseNumberAdditionValue},
				status: isPlaceholder ? null : ADDRESS_RESULT_STATUS.VALID,
			};
		});
	}, [
		houseNumberAdditionValue,
		setAddressLookupResult,
	]);

	return (
		<>
			<ValidatedTextInput
				id={postcodeInputId}
				label={__('Postcode', 'postcode-eu-address-validation')}
				value={postcodeValue}
				onChange={setPostcodeValue}
				customValidation={validatePostcode}
				errorMessage={__('Please enter a valid postcode', 'postcode-eu-address-validation')}
			/>

			<ValidatedTextInput
				id={houseNumberInputId}
				label={__('House number and addition', 'postcode-eu-address-validation')}
				value={houseNumberValue}
				onChange={setHouseNumberValue}
				customValidation={validateHouseNumber}
				errorMessage={__('Please enter a valid house number', 'postcode-eu-address-validation')}
			/>

			{houseNumberOptions.length > 0 && (
				<HouseNumberSelect
					id={houseNumberSelectId}
					options={houseNumberOptions}
					value={houseNumberAdditionValue}
					onChange={setHouseNumberAdditionValue}
				/>
			)}

			<div className="postcode-eu-address-lookup-status">
				{isLoading && <Spinner />}
				<LookupError id={lookupErrorId} />
			</div>
		</>
	);
};

export default AddressLookup;
