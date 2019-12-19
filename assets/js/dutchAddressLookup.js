const PostcodeNlDutchAddressLookup = {};
PostcodeNlDutchAddressLookup.lookupTimeout = -1;

PostcodeNlDutchAddressLookup.shouldUsePostcodeOnlyLookup = function(countryCode) {
	if (countryCode !== 'NLD')
	{
		return false;
	}

	return PostcodeNlAddressAutocompleteSettings.netherlandsPostcodeOnly;
};

PostcodeNlDutchAddressLookup.initialize = function(queryElement) {
	let input = jQuery(queryElement);
	let label = input.parents('.postcodenl-address-autocomplete').find('label');
	if (!input.data('original-placeholder'))
	{
		input.data('original-placeholder', input.attr('placeholder'));
	}
	if (!label.data('original-label'))
	{
		label.data('original-label', label.html());
	}
	jQuery(queryElement).on('blur', PostcodeNlDutchAddressLookup.checkPostcode);
	jQuery(queryElement).on('keyup', PostcodeNlDutchAddressLookup.delayCheckPostcode);
	input.attr('placeholder', PostcodeNlAddressAutocompleteSettings.postcodeOnlyPlaceholder);
	label.html(PostcodeNlAddressAutocompleteSettings.postcodeOnlyLabel);
};

PostcodeNlDutchAddressLookup.deinitialize = function(queryElement) {
	PostcodeNlDutchAddressLookup.clearWarnings();
	jQuery(queryElement).off('blur', PostcodeNlDutchAddressLookup.checkPostcode);
	jQuery(queryElement).off('keyup', PostcodeNlDutchAddressLookup.delayCheckPostcode);
	let input = jQuery(queryElement);
	input.attr('placeholder', input.data('original-placeholder'));
	let label = input.parents('.postcodenl-address-autocomplete').find('label');
	label.html(label.data('original-label'));
};

PostcodeNlDutchAddressLookup.delayCheckPostcode = function() {
	let element = this;
	clearTimeout(PostcodeNlDutchAddressLookup.lookupTimeout);
	PostcodeNlDutchAddressLookup.lookupTimeout = setTimeout(function() {
		PostcodeNlDutchAddressLookup.checkPostcode.call(element);
	}, 750);
};

PostcodeNlDutchAddressLookup.checkPostcode = function() {
	let input = jQuery(this);
	let addressContainer = input.parents('.postcodenl-address-autocomplete').parent().parent();
	let query = this.value;
	let regex = /([1-9][0-9]{3}\s?[a-z]{2})\s?(\d+.*)/i;
	let addressData = query.match(regex);
	if (!addressData || addressData.length < 3)
	{
		// No postcode and house number found
		if (query.length > 7)
		{
			PostcodeNlDutchAddressLookup.clearWarnings();
			input.after('<span class="postcodenl-address-autocomplete-warning">' + PostcodeNlAddressAutocompleteSettings.postcodeOnlyInputHint + '</span>');
		}

		return;
	}
	input.addClass('postcodenl-address-autocomplete-loading');

	let postcode = addressData[1];
	let houseNumber = addressData[2];
	jQuery.get(PostcodeNlAddressAutocompleteSettings.dutchAddressLookup + postcode + '/' + houseNumber, function(response) {
		input.removeClass('postcodenl-address-autocomplete-loading');
		PostcodeNlDutchAddressLookup.clearWarnings();
		if (response.error)
		{
			input.after('<span class="postcodenl-address-autocomplete-warning">' + response.message + '</span>');
			return;
		}
		addressContainer.find('input[name$="_address_1"]').val(response.street + ' ' + response.houseNumber + (' ' + (response.houseNumberAddition ? response.houseNumberAddition : '')).trim());
		addressContainer.find('input[name$="_postcode"]').val(response.postcode);
		addressContainer.find('input[name$="_city"]').val(response.city);
		// Support for other address fields if available
		addressContainer.find('input[name$="_street_name"]').val(response.street);
		addressContainer.find('input[name$="_house_number"]').val(response.houseNumber);
		addressContainer.find('input[name$="_house_number_suffix"]').val(response.houseNumberAddition ? response.houseNumberAddition : '');

		// Force WooCommerce to recalculate shipping costs after address change
		jQuery(document.body).trigger('update_checkout');
	}).fail(function() {
		input.removeClass('postcodenl-address-autocomplete-loading');
	});
};

PostcodeNlDutchAddressLookup.clearWarnings = function() {
	jQuery('.postcodenl-address-autocomplete-warning').remove();
};
