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
		jQuery('input[name$="_address_1"], input[name$="_postcode"], input[name$="_city"], input[name$="_street_name"], input[name$="_house_number"], input[name$="_house_number_suffix"]')
			.on('input', function() {
				queryElement.value = '';
			}
		);

		let createAutocomplete = function(queryElement) {
			return new PostcodeNl.AutocompleteAddress(queryElement, {
				autocompleteUrl: PostcodeNlAddressAutocompleteSettings.autocomplete,
				addressDetailsUrl: PostcodeNlAddressAutocompleteSettings.getDetails,
				autoFocus: true,
				autoSelect: true,
			});
		};
		let switchToCountry = function(iso2CountryCode)
		{
			let countryCode = PostcodeNlAddressAutocomplete.convertCountry2CodeToCountry3Code(iso2CountryCode);
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
			if (event.detail.precision === 'Address') {
				autocomplete.getDetails(event.detail.context, function (result) {
					addressContainer.find('input[name$="_address_1"]').val(result.address.street + ' ' + result.address.building);
					addressContainer.find('input[name$="_postcode"]').val(result.address.postcode);
					addressContainer.find('input[name$="_city"]').val(result.address.locality);
					// Support for other address fields if available
					addressContainer.find('input[name$="_street_name"]').val(result.address.street);
					addressContainer.find('input[name$="_house_number"]').val(result.address.buildingNumber);
					addressContainer.find('input[name$="_house_number_suffix"]').val(result.address.buildingNumberAddition ? result.address.buildingNumberAddition : '');

					// Force WooCommerce to recalculate shipping costs after address change
					jQuery(document.body).trigger('update_checkout');
				});
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

