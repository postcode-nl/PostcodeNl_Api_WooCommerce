const PostcodeNlDutchAddressLookup = {};
PostcodeNlDutchAddressLookup.lookupTimeout = -1;
PostcodeNlDutchAddressLookup.houseNumberFieldClass = 'postcodenl-netherlands-housenumber';
PostcodeNlDutchAddressLookup.previousQuery = null;
PostcodeNlDutchAddressLookup.postcodeHouseNumberRegex = /^([1-9][0-9]{3}\s?[a-z]{2})\s?(\d+.*)?/i;

PostcodeNlDutchAddressLookup.shouldUsePostcodeOnlyLookup = function(countryCode) {
	if (countryCode !== 'NLD')
	{
		return false;
	}

	return PostcodeNlAddressAutocompleteSettings.netherlandsMode !== 'default';
};

PostcodeNlDutchAddressLookup.initialize = function(queryElement) {
	let input = jQuery(queryElement);
	let placeholder = PostcodeNlAddressAutocompleteSettings.postcodeOnlyPlaceholder;
	if (PostcodeNlAddressAutocompleteSettings.netherlandsMode === 'postcodeOnlySplit')
	{
		input.after('<input type="text" class="' + PostcodeNlDutchAddressLookup.houseNumberFieldClass + '" placeholder="' + PostcodeNlAddressAutocompleteSettings.houseNumberPlaceholder + '" />');
		let houseNumber = input.parent().find('.' + PostcodeNlDutchAddressLookup.houseNumberFieldClass);
		houseNumber.on('blur', PostcodeNlDutchAddressLookup.checkPostcode);
		houseNumber.on('keyup', PostcodeNlDutchAddressLookup.delayCheckPostcode);
		let addressData = input.val().match(PostcodeNlDutchAddressLookup.postcodeHouseNumberRegex);
		if (addressData && addressData.length === 3)
		{
			if (addressData[1] !== undefined)
			{
				input.val(addressData[1]);
			}
			if (addressData[2] !== undefined)
			{
				houseNumber.val(addressData[2]);
			}
		}
		placeholder = PostcodeNlAddressAutocompleteSettings.postcodeOnlyPlaceholderSplit;
		input.addClass('postcodenl-postcode');
	}
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
	input.attr('placeholder', placeholder);
	label.html(PostcodeNlAddressAutocompleteSettings.postcodeOnlyLabel);
};

PostcodeNlDutchAddressLookup.deinitialize = function(queryElement) {
	PostcodeNlDutchAddressLookup.clearWarnings();
	PostcodeNlDutchAddressLookup.previousQuery = null;
	clearTimeout(PostcodeNlDutchAddressLookup.lookupTimeout);
	PostcodeNlDutchAddressLookup.lookupTimeout = -1;
	jQuery(queryElement).off('blur', PostcodeNlDutchAddressLookup.checkPostcode);
	jQuery(queryElement).off('keyup', PostcodeNlDutchAddressLookup.delayCheckPostcode);
	let input = jQuery(queryElement);
	input.attr('placeholder', input.data('original-placeholder'));
	input.removeClass('postcodenl-postcode');
	let label = input.parents('.postcodenl-address-autocomplete').find('label');
	label.html(label.data('original-label'));
	jQuery(queryElement.parentNode.parentNode.parentNode).find('.' + PostcodeNlDutchAddressLookup.houseNumberFieldClass).remove();
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
	let query = PostcodeNlDutchAddressLookup.getPostcodeAndHouseNumber(input);
	if (query === PostcodeNlDutchAddressLookup.previousQuery)
	{
		return;
	}
	let addressContainer = input.parents('.postcodenl-address-autocomplete').parent().parent();
	let addressData = query.match(PostcodeNlDutchAddressLookup.postcodeHouseNumberRegex);
	// When only postcode is entered we expect the use to follow with a house number, so no need to warn the use just yet
	if (input.is(':focus') && addressData && addressData.length === 3 && addressData[2] === undefined)
	{
		return;
	}

	if (!addressData || addressData.length < 3 || addressData[2] === undefined)
	{
		// No postcode and house number found
		if (PostcodeNlDutchAddressLookup.hasFocus(input))
		{
			PostcodeNlDutchAddressLookup.clearWarnings();
			input.parent().append('<span class="postcodenl-address-autocomplete-warning">' + PostcodeNlAddressAutocompleteSettings.postcodeOnlyInputHint + '</span>');
		}

		return;
	}
	input.addClass('postcodenl-address-autocomplete-loading');

	PostcodeNlDutchAddressLookup.previousQuery = query;
	let mappingFields = Object.getOwnPropertyNames(PostcodeNlAddressFieldMapping.mapping);
	if (mappingFields.length > 0)
	{
		input.parent().parent().parent().find('input[name$="' + mappingFields.join('"], input[name$="') + '"]').val('');
	}

	let postcode = addressData[1];
	let houseNumber = addressData[2];
	jQuery.get(PostcodeNlAddressAutocompleteSettings.dutchAddressLookup + postcode + '/' + houseNumber, function(response) {
		input.removeClass('postcodenl-address-autocomplete-loading');
		PostcodeNlDutchAddressLookup.clearWarnings();

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
					value = response.street;
					break;
				case PostcodeNlAddressFieldMapping.houseNumber:
					value = response.houseNumber;
					break;
				case PostcodeNlAddressFieldMapping.houseNumberAddition:
					value = response.houseNumberAddition ? response.houseNumberAddition : '';
					break;
				case PostcodeNlAddressFieldMapping.postcode:
					value = response.postcode;
					break;
				case PostcodeNlAddressFieldMapping.city:
					value = response.city;
					break;
				case PostcodeNlAddressFieldMapping.streetAndHouseNumber:
					value = response.street + ' ' + response.houseNumber + (' ' + (response.houseNumberAddition ? response.houseNumberAddition : '')).trim();
					break;
				case PostcodeNlAddressFieldMapping.houseNumberAndAddition:
					value = response.houseNumber + (' ' + (response.houseNumberAddition ? response.houseNumberAddition : '')).trim();
					break;
			}
			addressContainer
				.find('input[name$="' + fieldName + '"]')
				.val(value)
				.trigger('change');
		}

		PostcodeNlAddressAutocomplete.applyDisplayModeOnAddressSelect(addressContainer, (response.street + " " + response.houseNumber + " " + response.houseNumberAddition).trim() + "<br>" + response.postcode + " " + response.city);
		// Force WooCommerce to recalculate shipping costs after address change
		jQuery(document.body).trigger('update_checkout');
	}).fail(function(response) {
		input.removeClass('postcodenl-address-autocomplete-loading');
		let data = JSON.parse(response.responseText);

		PostcodeNlDutchAddressLookup.clearWarnings();
		input.parent().append('<span class="postcodenl-address-autocomplete-warning">' + data.message + '</span>');
	});
};

PostcodeNlDutchAddressLookup.hasFocus = function(element) {
	if (PostcodeNlAddressAutocompleteSettings.netherlandsMode !== 'postcodeOnlySplit')
	{
		return element.is(':focus');
	}

	let secondElement;
	if (element.hasClass(PostcodeNlDutchAddressLookup.houseNumberFieldClass))
	{
		secondElement = element.parent().find('.postcodenl-postcode');
	}
	else
	{
		secondElement = jQuery('.' + PostcodeNlDutchAddressLookup.houseNumberFieldClass);
	}

	return element.is(':focus') || secondElement.is(':focus');
};

PostcodeNlDutchAddressLookup.getPostcodeAndHouseNumber = function(element) {
	let query = element.val();
	if (PostcodeNlAddressAutocompleteSettings.netherlandsMode !== 'postcodeOnlySplit')
	{
		return query;
	}
	if (element.hasClass(PostcodeNlDutchAddressLookup.houseNumberFieldClass))
	{
		return element.parent().find('.postcodenl-postcode').val() + query;
	}
	else
	{
		return query + jQuery('.' + PostcodeNlDutchAddressLookup.houseNumberFieldClass).val();
	}
};

PostcodeNlDutchAddressLookup.clearWarnings = function() {
	jQuery('.postcodenl-address-autocomplete-warning').remove();
};
