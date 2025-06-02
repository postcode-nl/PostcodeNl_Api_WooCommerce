import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import { NlAddressLookup, IntlAutocomplete, IntlAutocompleteBypass, FormattedOutput, settings } from '.';

const AutocompleteContainer = ({addressType, address, setAddress}) => {
	const ref = useRef(null),
		addressRef = useRef(address),
		[formattedAddress, setFormattedAddress] = useState(null),
		[visible, setVisible] = useState(false),
		intlFieldId = `${addressType}-postcode-eu-address_autocomplete`,
		isEnabledCountry = Object.hasOwn(settings.enabledCountries, address.country);

	addressRef.current = address;

	const resetAddress = useCallback(() => {
		setAddress({...addressRef.current, address_1: '', city: '', postcode: ''})
		setFormattedAddress(null);
	}, [
		setAddress,
		setFormattedAddress,
	]);

	// Container placement
	useEffect(() => {
		const moveContainer = () => {
			const targetElement = document.getElementById(`${addressType}-address_1`)?.parentElement;
			return targetElement?.before(ref.current), targetElement;
		}

		if (!moveContainer())
		{
			// Watch step content until address_1 element is found.
			const observer = new MutationObserver((records) => {
				records.forEach(() => {
					if (moveContainer())
					{
						observer.disconnect();
					}
				});
			});

			observer.observe(
				ref.current.closest('.wc-block-components-checkout-step__content'),
				{ childList: true }
			);

			return () => observer.disconnect(); // Cleanup observer on unmount.
		}
	}, [
		addressType,
	]);

	// Field visibility
	useEffect(() => {
		if (settings.displayMode === 'showAll')
		{
			return;
		}

		for (const name of ['address_1', 'postcode', 'city'])
		{
			const element = document.getElementById(`${addressType}-${name}`)?.parentElement;
			if (element)
			{
				element.style.display = visible ? 'none' : '';
			}
		}
	}, [
		addressType,
		visible
	]);

	useEffect(() => {
		setVisible(isEnabledCountry);
	}, [
		setVisible,
		isEnabledCountry,
	]);

	const childProps = {addressType, address, setAddress, setFormattedAddress, addressRef, resetAddress};

	return (
		<div className="postcode-eu-autofill-container" ref={ref} style={visible ? {} : {display: 'none'}}>
			{isEnabledCountry && (
				<>
					{address.country === 'NL' && settings.netherlandsMode === 'postcodeOnly' ? (
						<NlAddressLookup {...childProps} />
					) : (
						<IntlAutocomplete id={intlFieldId} {...childProps} />
					)}

					{settings.allowAutofillIntlBypass === 'y' && settings.displayMode !== 'showAll' && (
						<IntlAutocompleteBypass forId={intlFieldId} onClick={() => setVisible(false)} />
					)}

					<FormattedOutput formattedAddress={formattedAddress} />
				</>
			)}
		</div>
	)
}

export default AutocompleteContainer;
