import { useState, useEffect, useRef } from '@wordpress/element';
import { getSetting } from '@woocommerce/settings';
import { AutocompleteInput, AutocompleteBypassLink, FormattedOutput } from '.';

const settings = getSetting('postcode-eu-address-validation_data');

const AutocompleteContainer = ({addressType, address, setAddress}) => {
	const ref = useRef(null),
		[addressDetails, setAddressDetails] = useState(null),
		[visible, setVisible] = useState(false),
		intlFieldId = `${addressType}-intl_autocomplete`;

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
	}, []);

	useEffect(() => {
		setVisible(Boolean(settings.enabledCountries[address.country]));
	}, [setVisible, address.country]);

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
	}, [addressType, visible]);

	return (
		<div className="postcode-eu-autofill-container" ref={ref} style={visible ? {} : {display: 'none'}}>
			<AutocompleteInput
				id={intlFieldId}
				addressType={addressType}
				address={address}
				setAddress={setAddress}
				setAddressDetails={setAddressDetails}
			/>

			{settings.displayMode !== 'showAll' && (
				<AutocompleteBypassLink forId={intlFieldId} onClick={() => { setVisible(false); }} />
			)}

			<FormattedOutput addressDetails={addressDetails} />
		</div>
	)
}

export default AutocompleteContainer;
