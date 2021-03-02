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
				// Empty all fields when switching to a supported country
				PostcodeNlAddressAutocomplete.setAddress(addressContainer, null);

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

				PostcodeNlAddressAutocomplete.applyDisplayModeOnInitialize(addressContainer);
			}
			else
			{
				PostcodeNlDutchAddressLookup.deinitialize(queryElement);
				autocompleteContainer.css('display', 'none');
				PostcodeNlAddressAutocomplete.showAddressFields(addressContainer);
				addressContainer.find('.postcodenl-address-autocomplete-message').remove();
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
				PostcodeNlAddressAutocomplete.setAddress(addressContainer, result.address);
				PostcodeNlAddressAutocomplete.applyDisplayModeOnAddressSelect(addressContainer, result.mailLines.join('<br>'));
			});
		});

		queryElement.addEventListener('autocomplete-search', function() {
			PostcodeNlAddressAutocomplete.applyDisplayModeOnLookup(addressContainer);

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

PostcodeNlAddressAutocomplete.applyDisplayModeOnInitialize = function(container) {
	if (PostcodeNlAddressAutocompleteSettings.displayMode === 'default' || PostcodeNlAddressAutocompleteSettings.displayMode === 'showOnAddress') {
		PostcodeNlAddressAutocomplete.hideAddressFields(container);
	}

	// Address fields are visible after rendering
};

PostcodeNlAddressAutocomplete.applyDisplayModeOnAddressSelect = function(container, addressInformation) {
	if (PostcodeNlAddressAutocompleteSettings.displayMode === 'showOnAddress') {
		PostcodeNlAddressAutocomplete.showAddressFields(container);
	}

	if (PostcodeNlAddressAutocompleteSettings.displayMode === 'default') {
		let autocompleteContainer = container.find('.postcodenl-address-autocomplete');
		autocompleteContainer.find('.postcodenl-address-autocomplete-message').remove();
		autocompleteContainer.append(
			'<span class="postcodenl-address-autocomplete-message">' +
			addressInformation +
			'</span>'
		);
	}
};

PostcodeNlAddressAutocomplete.applyDisplayModeOnLookup = function(container) {
	if (PostcodeNlAddressAutocompleteSettings.displayMode === 'default') {
		let autocompleteContainer = container.find('.postcodenl-address-autocomplete');
		autocompleteContainer.find('.postcodenl-address-autocomplete-message').remove();
	}
}

PostcodeNlAddressAutocomplete.hideAddressFields = function(container) {
	PostcodeNlAddressAutocomplete.findAddressElements(container, function(formRow) {
		formRow.addClass('hidden').css('display', '');
	});
};

PostcodeNlAddressAutocomplete.showAddressFields = function(container) {
	PostcodeNlAddressAutocomplete.findAddressElements(container, function(formRow) {
		formRow.removeClass('hidden');
	});
};

PostcodeNlAddressAutocomplete.findAddressElements = function(container, callback) {
	container.find('.form-row.address-field').each(function() {
		let formRow = jQuery(this);
		if (formRow.find('.country_select').length === 0 && formRow.css('display') !== 'none') {
			callback(formRow);
		}
	});
};

/**
 * Set the address for the container. Empty all address fields by specifying null for the address argument.
 */
PostcodeNlAddressAutocomplete.setAddress = function(container, address) {
	for (let fieldName in PostcodeNlAddressFieldMapping.mapping)
	{
		if (!PostcodeNlAddressFieldMapping.mapping.hasOwnProperty(fieldName))
		{
			continue;
		}

		let addressPart = PostcodeNlAddressFieldMapping.mapping[fieldName];
		let value = '';

		if (address !== null) {
			switch (addressPart) {
				case PostcodeNlAddressFieldMapping.street:
					value = address.street;
					break;
				case PostcodeNlAddressFieldMapping.houseNumber:
					value = address.buildingNumber;
					break;
				case PostcodeNlAddressFieldMapping.houseNumberAddition:
					value = address.buildingNumberAddition ? address.buildingNumberAddition : '';
					break;
				case PostcodeNlAddressFieldMapping.postcode:
					value = address.postcode;
					break;
				case PostcodeNlAddressFieldMapping.city:
					value = address.locality;
					break;
				case PostcodeNlAddressFieldMapping.streetAndHouseNumber:
					value = address.street + ' ' + address.building;
					break;
				case PostcodeNlAddressFieldMapping.houseNumberAndAddition:
					value = address.building;
					break;
			}
		}
		container
			.find('input[name$="' + fieldName + '"]')
			.val(value)
			.trigger('change');
	}

	// Force WooCommerce to recalculate shipping costs after address change
	jQuery(document.body).trigger('update_checkout');
};
