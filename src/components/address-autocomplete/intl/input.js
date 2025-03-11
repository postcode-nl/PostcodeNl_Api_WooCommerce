import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import { useSelect, useDispatch, select as selectStore } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { VALIDATION_STORE_KEY } from '@woocommerce/block-data';
import { TextInput, ValidationInputError } from '@woocommerce/blocks-components';
import { validateStoreAddress } from '../utils';
import { settings } from '..';
import { useAutocomplete } from './hooks';

let didInit = false;

const initValue = (address) => {
	return ['postcode', 'city', 'address_1', 'address_2'].map((field) => address[field]).join(' ').trim();
}

const AutocompleteInput = (
	{
		id,
		addressType,
		address,
		setAddress,
		setFormattedAddress,
		addressRef,
		resetAddress,
		didInit: didParentInit,
	}
) => {
	const inputRef = useRef(null),
		[isLoading, setIsLoading] = useState(false),
		[isMenuOpen, setIsMenuOpen] = useState(false),
		[value, setValue] = useState(() => didParentInit ? '' : initValue(address)),
		initialValueRef = useRef(value),
		{setValidationErrors, clearValidationError} = useDispatch(VALIDATION_STORE_KEY),
		autocomplete = useAutocomplete(inputRef, address.country);

	const {validationError, validationErrorId} = useSelect(
		(select) => {
			const store = select(VALIDATION_STORE_KEY);
			return {
				validationError: store.getValidationError(id),
				validationErrorId: store.getValidationErrorId(id),
			};
		}
	);

	const validateInput = useCallback(
		(errorsHidden = true) => {
			if (validateStoreAddress(addressType))
			{
				clearValidationError(id);
			}
			else
			{
				setValidationErrors({
					[id]: {
						message: __('Please enter an address and select it', 'postcode-eu-address-validation'),
						hidden: errorsHidden,
					},
				});
			}
		},
		[addressType, id, clearValidationError, setValidationErrors]
	);

	const selectAddress = useCallback(
		(selectedItem) => {
			setIsLoading(true);
			autocomplete.getAddressDetails(selectedItem.context)
				.then((result) => {
					const { locality, postcode, building } = result.address;
					setAddress({
						...addressRef.current,
						address_1: result.streetLine,
						city: locality,
						postcode: postcode,
					});

					if (settings.displayMode === 'default')
					{
						setFormattedAddress(result.mailLines.join('\n'));
					}

					validateInput(false);
				})
				.finally(() => setIsLoading(false));
		},
		[setIsLoading, setAddress, setFormattedAddress, validateInput]
	);

	const autocompleteInitialValue = useCallback(
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

			autocomplete.search({ term: initialValueRef.current, showMenu: false });
		},
		[selectAddress, validateInput]
	);

	useEffect(() => {
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
		setValue,
		resetAddress,
		setIsLoading,
		setValidationErrors,
		setIsMenuOpen,
	]);

	// Reset values when switching country.
	useEffect(() => {
		if (didInit)
		{
			autocomplete.instance.reset();
			setValue('');
		}

		autocomplete.instance.setCountry(settings.enabledCountries[address.country].iso3);
		resetAddress();

		const error = selectStore(VALIDATION_STORE_KEY).getValidationError(id);
		validateInput(error?.hidden ?? true);
	}, [
		address.country,
		resetAddress,
		setValue,
		id,
	]);

	// Remove validation errors when unmounted.
	useEffect(() => () => clearValidationError(id), [clearValidationError, id]);

	// Toggle loading className on input element.
	useEffect(() => {
		inputRef.current.classList.toggle(`${autocomplete.instance.options.cssPrefix}loading`, isLoading);
	}, [
		isLoading,
	]);

	useEffect(() => {
		autocompleteInitialValue();
		didInit = true;
	}, [
		autocompleteInitialValue,
	]);

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
}

export default AutocompleteInput;
