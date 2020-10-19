jQuery(document).ready(function() {
	// Initialize the autocomplete on forms which are available on document ready
	PostcodeNlAddressAutocomplete.initialize();

	// The default WooCommerce checkout form is loaded after dom ready so we must listen to the custom WooCommerce "updated_checkout" event.
	jQuery(document.body).on('updated_checkout', function() {
		PostcodeNlAddressAutocomplete.initialize();
	});
});

const PostcodeNlAddressAutocomplete = {};

PostcodeNlAddressAutocomplete.initialize = function() {
	if (typeof PostcodeNlAddressAutocompleteSettings === "undefined")
	{
		return;
	}

	jQuery('.postcodenl-address-autocomplete').each(function() {
		let autocompleteContainer = jQuery(this);
		let queryElement = this.querySelector('.input-text');
		if (queryElement.getAttribute('data-autocomplete-initialized') === '1')
		{
			return;
		}

		let addressContainer = autocompleteContainer.parent().parent();
		let autocompleteIsDestroyed = false;
		let mappingFields = Object.getOwnPropertyNames(PostcodeNlAddressFieldMapping.mapping);
		if (mappingFields.length > 0)
		{
			jQuery(queryElement.parentNode.parentNode.parentNode).find('input[name$="' + mappingFields.join('"], input[name$="') + '"]')
				.on('input', function() {
					queryElement.value = '';
				}
			);
		}

		let createAutocomplete = function(queryElement) {
			return new PostcodeNl.AutocompleteAddress(queryElement, {
				autocompleteUrl: PostcodeNlAddressAutocompleteSettings.autocomplete,
				addressDetailsUrl: PostcodeNlAddressAutocompleteSettings.getDetails,
				autoFocus: true,
				autoSelect: true,
			});
		};
		// Sometimes the country select change event is triggered without it being changed
		let previousCountryCode = null;
		let switchToCountry = function(iso2CountryCode)
		{
			let countryCode = PostcodeNlAddressAutocomplete.convertCountry2CodeToCountry3Code(iso2CountryCode);
			if (previousCountryCode === countryCode)
			{
				return;
			}
			if (PostcodeNlAddressAutocomplete.isCountrySupported(countryCode))
			{
				if (PostcodeNlDutchAddressLookup.shouldUsePostcodeOnlyLookup(countryCode))
				{
					autocomplete.destroy();
					autocompleteIsDestroyed = true;
					PostcodeNlDutchAddressLookup.initialize(queryElement);
				}
				else
				{
					if (autocompleteIsDestroyed)
					{
						PostcodeNlDutchAddressLookup.deinitialize(queryElement);
						autocompleteIsDestroyed = false;
						autocomplete = createAutocomplete(queryElement);
					}

					autocomplete.setCountry(countryCode);
				}
				autocompleteContainer.css('display', 'inherit');
			}
			else
			{
				autocompleteContainer.css('display', 'none');
			}
			previousCountryCode = countryCode;
		};

		let autocomplete = createAutocomplete(queryElement);

		// Listen to country select changes and initialize current autocomplete
		let countrySelect = addressContainer.find('.country_select');
		// Handle a single country
		if (countrySelect.length === 0)
		{
			let countryToState = addressContainer.find('.country_to_state');
			if (countryToState.length === 0)
			{
				// Country code could not be determined
				autocompleteContainer.css('display', 'none');
				return;
			}
			switchToCountry(countryToState.val());
		}
		else
		{
			// Handle country selection
			let countrySelectHandler = function() {
				switchToCountry(this.value);
			};
			jQuery(countrySelect).on('change', countrySelectHandler);
			countrySelectHandler.call(countrySelect[0]);
		}

		queryElement.addEventListener('autocomplete-select', function (event) {
			if (event.detail.precision !== 'Address')
			{
				return;
			}
			autocomplete.getDetails(event.detail.context, function (result) {
				for (let fieldName in PostcodeNlAddressFieldMapping.mapping)
				{
					if (!PostcodeNlAddressFieldMapping.mapping.hasOwnProperty(fieldName))
					{
						continue;
					}

					let addressPart = PostcodeNlAddressFieldMapping.mapping[fieldName];
					let value;
					switch (addressPart) {
						case PostcodeNlAddressFieldMapping.street:
							value = result.address.street;
							break;
						case PostcodeNlAddressFieldMapping.houseNumber:
							value = result.address.buildingNumber;
							break;
						case PostcodeNlAddressFieldMapping.houseNumberAddition:
							value = result.address.buildingNumberAddition ? result.address.buildingNumberAddition : '';
							break;
						case PostcodeNlAddressFieldMapping.postcode:
							value = result.address.postcode;
							break;
						case PostcodeNlAddressFieldMapping.city:
							value = result.address.locality;
							break;
						case PostcodeNlAddressFieldMapping.streetAndHouseNumber:
							value = result.address.street + ' ' + result.address.building;
							break;
						case PostcodeNlAddressFieldMapping.houseNumberAndAddition:
							value = result.address.building;
							break;
					}
					addressContainer
						.find('input[name$="' + fieldName + '"]')
						.val(value)
						.trigger('change');
				}

				// Force WooCommerce to recalculate shipping costs after address change
				jQuery(document.body).trigger('update_checkout');
			});
		});

		queryElement.addEventListener('autocomplete-search', function() {
			let mappingFields = Object.getOwnPropertyNames(PostcodeNlAddressFieldMapping.mapping);
			if (mappingFields.length > 0)
			{
				jQuery(queryElement.parentNode.parentNode.parentNode).find('input[name$="' + mappingFields.join('"], input[name$="') + '"]').val('');
			}
		});

		queryElement.setAttribute('data-autocomplete-initialized', '1');
	});
};

PostcodeNlAddressAutocomplete.convertCountry2CodeToCountry3Code = function(country2Code) {
	for (let i in PostcodeNlAddressAutocompleteSettings.supportedCountries)
	{
		if (!PostcodeNlAddressAutocompleteSettings.supportedCountries.hasOwnProperty(i)) {
			continue;
		}

		let country = PostcodeNlAddressAutocompleteSettings.supportedCountries[i];
		if (country.iso2 === country2Code)
		{
			return country.iso3;
		}
	}

	return country2Code;
};

PostcodeNlAddressAutocomplete.isCountrySupported = function(country3Code) {
	for (let i in PostcodeNlAddressAutocompleteSettings.supportedCountries)
	{
		if (!PostcodeNlAddressAutocompleteSettings.supportedCountries.hasOwnProperty(i)) {
			continue;
		}

		if (PostcodeNlAddressAutocompleteSettings.supportedCountries[i].iso3 === country3Code)
		{
			return true;
		}
	}

	return false;
};

