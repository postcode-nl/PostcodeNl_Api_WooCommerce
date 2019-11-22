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
	jQuery('.postcodenl-address-autocomplete').each(function() {
		let autocompleteContainer = jQuery(this);
		let queryElement = this.querySelector('.input-text');
		if (queryElement.getAttribute('data-autocomplete-initialized') === '1')
		{
			return;
		}

		let addressContainer = autocompleteContainer.parent().parent();

		let autocomplete = new PostcodeNl.AutocompleteAddress(queryElement, {
			autocompleteUrl: PostcodeNlAddressAutocompleteSettings.autocomplete,
			addressDetailsUrl: PostcodeNlAddressAutocompleteSettings.getDetails,
			autoFocus: true,
			autoSelect: true,
		});

		// Listen to country select changes and initialize current autocomplete
		let countrySelect = addressContainer.find('.country_select');
		let countrySelectHandler = function() {
			let countryCode = PostcodeNlAddressAutocomplete.convertCountry2CodeToCountry3Code(this.value);

			if (PostcodeNlAddressAutocomplete.isCountrySupported(countryCode))
			{
				autocomplete.setCountry(countryCode);
				autocompleteContainer.css('display', 'inherit');
			}
			else
			{
				autocompleteContainer.css('display', 'none');
			}
		};
		jQuery(countrySelect).on('change', countrySelectHandler);
		countrySelectHandler.call(countrySelect[0]);

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

