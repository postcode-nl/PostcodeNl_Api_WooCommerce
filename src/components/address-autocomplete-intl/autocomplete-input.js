import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import { useSelect, useDispatch, select as selectStore } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { VALIDATION_STORE_KEY } from '@woocommerce/block-data';
import { TextInput, ValidationInputError } from '@woocommerce/blocks-components';
import { getSetting } from '@woocommerce/settings';

const settings = getSetting('postcode-eu-address-validation_data');

const isSupportedCountry = (countryIso2) => typeof settings.enabledCountries[countryIso2] !== 'undefined';

// Correctly format street and building line for countries that use reversed order.
const formatStreetLine = (countryIso2, street, building) => {
	let a = street, b = building;
	if (settings.reverseStreetLineCountries.includes(countryIso2))
		[a, b] = [b, a];

	return `${a} ${b}`.trim();
}

PostcodeNl.addressDetailsCache ??= new Map();

function initAutocomplete (inputElement, countryIso3)
{
	const instance = new PostcodeNl.AutocompleteAddress(inputElement, {
		autocompleteUrl: settings.autocomplete,
		addressDetailsUrl: settings.getDetails,
		context: countryIso3,
	});

	instance.getSuggestions = function (context, term, response)
	{
		const encodedTerm = new TextEncoder().encode(term),
			binaryTerm = Array.from(encodedTerm, (byte) => String.fromCodePoint(byte)).join(''),
			url = this.options.autocompleteUrl.replace('${context}', encodeURIComponent(context)).replace('${term}', encodeURIComponent(btoa(binaryTerm)));

		return this.xhrGet(`${url}`, response);
	}

	instance.getDetails = function (addressId, response)
	{
		const url = this.options.addressDetailsUrl.replace('${context}', encodeURIComponent(addressId));
		return this.xhrGet(url, response);
	}

	return instance;
}

const AutocompleteInput = ({id, addressType, address, setAddress, setAddressDetails}) => {
	const inputRef = useRef(null),
		addressRef = useRef(address),
		initialValueRef = useRef(''),
		autocompleteInstance = useRef(null),
		[isPristine, setIsPristine] = useState(true),
		[isLoading, setIsLoading] = useState(null),
		[isMenuOpen, setIsMenuOpen] = useState(false),
		[value, setValue] = useState(''),
		{setValidationErrors, clearValidationError} = useDispatch(VALIDATION_STORE_KEY);

	const {validationError, validationErrorId} = useSelect(
		(select) => {
			const store = select(VALIDATION_STORE_KEY);
			return {
				validationError: store.getValidationError(id),
				validationErrorId: store.getValidationErrorId(id),
			};
		}
	);

	// Keep a reference to address for use in event handlers to prevent using old values.
	useEffect(() => { addressRef.current = address; }, [address]);

	const resetAddress = useCallback(() => {
		setAddress({...addressRef.current, address_1: '', city: '', postcode: ''})
		setAddressDetails(null);
	}, [setAddress, setAddressDetails]);

	const validateInput = useCallback(
		(errorsHidden = true) => {
			const isValid = ['address_1', 'city', 'postcode'].every((field) => {
				const error = selectStore(VALIDATION_STORE_KEY).getValidationError(`${addressType}_${field}`);
				return typeof error === 'undefined';
			})

			if (isValid)
			{
				clearValidationError(id);
			}
			else
			{
				setValidationErrors({
					[id]: {
						message: __('Please enter an address and select it.', 'postcode-eu-address-validation'),
						hidden: errorsHidden,
					},
				});
			}
		},
		[id, clearValidationError, setValidationErrors]
	);

	const getAddressDetails = useCallback(
		(context, callback) => {
			if (PostcodeNl.addressDetailsCache.has(context)) {
				callback(PostcodeNl.addressDetailsCache.get(context));
				return;
			}

			autocompleteInstance.current.getDetails(context, (result) => {
				callback(result);
				PostcodeNl.addressDetailsCache.set(context, result);
			});
		},
		[]
	);

	const selectAddress = useCallback(
		(selectedItem) => {
			setIsLoading(true);
			getAddressDetails(selectedItem.context, (result) => {
				const { locality, street, postcode, building } = result.address;
				setAddress({
					...addressRef.current,
					address_1: formatStreetLine(result.country.iso2Code, street, building),
					city: locality,
					postcode: postcode,
				});
				setAddressDetails(result);
				validateInput(false);
				setIsLoading(false);
			});
		},
		[setIsLoading, setAddress, setAddressDetails, validateInput]
	);

	const autocompleteInitialValues = useCallback(
		() => {
			inputRef.current.addEventListener('autocomplete-response', (response) => {
				const matches = response.detail.matches;
				if (matches.length === 1 && matches[0].precision === 'Address')
				{
					selectAddress(matches[0]);
				}
				else
				{
					// Make sure an error is set if there are multiple matches. Otherwise the user may try to
					// submit the form and never see an error message for an incomplete/invalid address.
					validateInput(true);
				}
			}, { once: true });

			autocompleteInstance.current.search(inputRef.current, { term: initialValueRef.current, showMenu: false });
		},
		[selectAddress, validateInput]
	);

	useEffect(() => {
		if (!isPristine)
		{
			return;
		}

		setIsPristine(false);

		// Check for prefilled values.
		const fields = ['postcode', 'city', 'address_1', 'address_2'];
		initialValueRef.current = fields.map((field) => addressRef.current[field]).join(' ').trim();
		setValue(initialValueRef.current);

		// Set form values on select.
		inputRef.current.addEventListener('autocomplete-select', (e) => {
			setValue(e.detail.value);
			e.preventDefault();

			if (e.detail.precision === 'Address')
			{
				selectAddress(e.detail);
			}
		});

		inputRef.current.addEventListener('autocomplete-search', resetAddress);

		inputRef.current.addEventListener('autocomplete-error', () => {
			setIsLoading(false);
			setValidationErrors({
				[id]: {
					message: __(
						'An error has occurred while retrieving address data. Please contact us if the problem persists.',
						'postcode-eu-address-validation'
					),
					hidden: false,
				},
			});
		});

		inputRef.current.addEventListener('autocomplete-open', () => setIsMenuOpen(true));
		inputRef.current.addEventListener('autocomplete-close', () => setIsMenuOpen(false));
	}, [
		isPristine,
		setIsPristine,
		setValue,
		setAddressDetails,
		resetAddress,
		setIsLoading,
		setValidationErrors,
		setIsMenuOpen,
	]);

	useEffect(() => {
		if (!isSupportedCountry(address.country))
		{
			clearValidationError(id);
			return;
		}

		const country = settings.enabledCountries[address.country];

		if (autocompleteInstance.current === null)
		{
			autocompleteInstance.current = initAutocomplete(inputRef.current, country.iso3);

			if (initialValueRef.current.length > 0)
			{
				autocompleteInitialValues();
			}
		}
		else
		{
			// Clear address values when switching to supported country.
			autocompleteInstance.current.reset();
			autocompleteInstance.current.setCountry(country.iso3);
			resetAddress();
			setValue('');
		}

		const error = selectStore(VALIDATION_STORE_KEY).getValidationError(id);
		validateInput(error?.hidden ?? true);

	}, [address.country, id, clearValidationError, setValue, resetAddress]);

	// Remove validation errors when unmounted.
	useEffect(() => () => clearValidationError(id), [clearValidationError, id]);

	// Toggle loading className on input element.
	useEffect(() => {
		if (isLoading !== null)
		{
			inputRef.current.classList.toggle(`${autocompleteInstance.current.options.cssPrefix}loading`, isLoading);
		}
	}, [isLoading]);

	const hasError = validationError?.message && !validationError?.hidden;

	return (
		<TextInput
			id={id}
			required={true}
			className={{ 'has-error': hasError }}
			ref={inputRef}
			label={__('Start typing your address or zip/postal code', 'postcode-eu-address-validation')}
			value={value}
			onChange={(newValue) => {
				validateInput(true);
				setValue(newValue);
			}}
			onBlur={() => !isMenuOpen && validateInput(false)}
			aria-invalid={hasError === true}
			ariaDescribedBy={hasError && validationErrorId ? validationErrorId : null}
			feedback={
				<ValidationInputError propertyName={id} elementId={id}/>
			}
			title="" // Hide error message in title.
		/>
	)
};

export default AutocompleteInput;
