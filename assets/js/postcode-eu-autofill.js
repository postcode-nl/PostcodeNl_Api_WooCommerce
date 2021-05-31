(function () {
	'use strict';

	if (typeof PostcodeEuSettings === 'undefined')
	{
		return;
	}

	const $ = jQuery,
		__ = wp.i18n.__,
		settings = PostcodeEuSettings;

	const initialize = function ()
	{
		$('.postcode-eu-autofill-intl').closest('div').each(function () {
			if ($(this).find('.postcodenl-autocomplete-address-input').length > 0)
			{
				return; // Already initialized.
			}

			addAddressAutocompleteNl($(this));
			addAddressAutocompleteIntl($(this));

			if (settings.displayMode === 'default')
			{
				addFormattedAddressOutput($(this));
			}

			const addressFields = getAddressFields($(this));

			if (settings.displayMode === 'showAll')
			{
				return;
			}

			$(this).find('.country_to_state').on('change.postcode-eu.address-fields', function () {
				// Wrap in timeout to execute after Woocommerce field logic:
				window.setTimeout(toggleAddressFields, 0, addressFields, !isSupportedCountry(this.value), true);
			}).trigger('change.postcode-eu.address-fields');
		})
	}

	$(initialize); // On DOMReady
	$(document.body).on('updated_checkout', initialize);

	const isSupportedCountry = function (countryIso2)
	{
		for (let i in settings.supportedCountries)
		{
			if (settings.supportedCountries[i].iso2 === countryIso2)
			{
				return true;
			}
		}

		return false;
	}

	const getAddressFields = function (form)
	{
		return {
			'address_1': form.find('[name$="_address_1"]'),
			'address_2': form.find('[name$="_address_2"]'),
			'postcode': form.find('[name$="_postcode"]'),
			'city': form.find('[name$="_city"]'),
			'street_name': form.find('[name$="_street_name"]'),
			'house_number': form.find('[name$="_house_number"]'),
			'house_number_suffix': form.find('[name$="_house_number_suffix"]'),
		};
	}

	const resetAddressFields = function (addressFields)
	{
		for (let i in addressFields)
		{
			addressFields[i].val('');
		}
	}

	const toggleAddressFields = function (addressFields, state, force)
	{
		if (!force)
		{
			if (settings.displayMode === 'default')
			{
				state = false;
			}
			else if (settings.displayMode === 'showAll')
			{
				state = true;
			}
		}

		for (let i in addressFields)
		{
			addressFields[i].closest('.form-row').toggle(state);
		}
	}

	const setFieldError = function (field, message)
	{
		clearFieldErrors(field);
		field.after($('<span>', {class: 'postcodenl-address-autocomplete-warning', text: message}));
	}

	const clearFieldErrors = function (fields)
	{
		fields.siblings('.postcodenl-address-autocomplete-warning').remove();
	}

	const addAddressAutocompleteNl = function (form)
	{
		if (settings.netherlandsMode !== 'postcodeOnly')
		{
			return;
		}

		const countryToState = form.find('.country_to_state'),
			nlFields = form.find('.postcode-eu-autofill-nl'),
			lookupDelay = 750,
			postcodeRegex = /[1-9][0-9]{3}\s*[a-z]{2}/i,
			houseNumberRegex = /[1-9]\d{0,4}(?:\D.*)?$/i,
			postcodeField = form.find('.postcode-eu-autofill-nl-postcode input'),
			houseNumberField = form.find('.postcode-eu-autofill-nl-house-number input'),
			houseNumberSelect = form.find('.postcode-eu-autofill-nl-house-number-select select'),
			addressFields = getAddressFields(form);

		let lookupTimeout;

		const toggleNlFields = function (state)
		{
			nlFields.slice(0, 2).toggle(state);
			nlFields.slice(-1).toggle(state && houseNumberSelect.children().length > 1);
		}

		const isNl = function ()
		{
			return countryToState.val() === 'NL';
		}

		toggleNlFields(isNl());

		countryToState.on('change', function () {
			toggleNlFields(isNl());
		});

		postcodeField.on('input', function () {
			window.clearTimeout(lookupTimeout);

			if (this.value === '')
			{
				clearFieldErrors(postcodeField);
				return;
			}

			lookupTimeout = window.setTimeout(function () {
				if (postcodeRegex.test(this.value))
				{
					clearFieldErrors(postcodeField);

					if (houseNumberRegex.test(houseNumberField.val()))
					{
						getAddress();
					}

					return;
				}

				setFieldError(postcodeField, __('Please enter a valid zip/postal code.',  'postcodenl-address-autocomplete'));
				resetHouseNumberSelect();
			}.bind(this), lookupDelay);
		});

		houseNumberField.on('input', function () {
			window.clearTimeout(lookupTimeout);

			if (this.value === '')
			{
				resetHouseNumberSelect();
				clearFieldErrors(houseNumberField);
				return;
			}

			lookupTimeout = window.setTimeout(function () {
				if (houseNumberRegex.test(this.value)) {
					clearFieldErrors(houseNumberField);

					if (postcodeRegex.test(postcodeField.val())) {
						getAddress();
					}

					return;
				}

				setFieldError(houseNumberField, __('Please enter a valid house number.',  'postcodenl-address-autocomplete'));
				resetHouseNumberSelect();
			}.bind(this), lookupDelay);
		});

		postcodeField.on('address-result', function (e, data) {
			if (data.status === 'valid')
			{
				fillAddressFields(data.address);
			}
		});

		houseNumberSelect.on('change', function () {
			const address = postcodeField.data('address');

			if (this.value === '0')
			{
				address.houseNumberAddition = null;
				postcodeField.trigger('address-result', {address: address, status: 'houseNumberAdditionIncorrect'});
				toggleAddressFields(addressFields, false);
				resetAddressFields(addressFields);
				return;
			}

			toggleAddressFields(addressFields, true);
			address.houseNumberAddition = this.value;
			postcodeField.trigger('address-result', {address: address, status: 'valid'});
			fillAddressFields(address, this.value);
		});

		const getAddress = function ()
		{
			const postcode = postcodeRegex.exec(postcodeField.val())[0].replace(/\s/g, ''),
				houseNumber = houseNumberRegex.exec(houseNumberField.val())[0].trim(),
				url = settings.dutchAddressLookup + postcode + '/' + houseNumber;

			resetHouseNumberSelect();
			resetAddressFields(addressFields);

			postcodeField
				.removeData('address')
				.addClass('postcodenl-address-autocomplete-loading');

			$.get({
				url: url,
				cache: true,
				dataType: 'json',
				success: function (response) {
					if (response.status === 'notFound') {
						setFieldError(houseNumberField, __('Address not found.',  'postcodenl-address-autocomplete'));
						return;
					}

					postcodeField
						.data('address', response.address)
						.trigger('address-result', response);

					if (response.status === 'houseNumberAdditionIncorrect') {
						setHouseNumberOptions(response.address);
						houseNumberSelect.closest('.postcode-eu-autofill').show();
					}
					else {
						toggleAddressFields(addressFields, true);
					}
				}
			}).fail(function () {
				setFieldError(houseNumberField, __('An error has occurred. Please try again later or contact us.',  'postcodenl-address-autocomplete'));
			}).always(function () {
				postcodeField.removeClass('postcodenl-address-autocomplete-loading');
			});

		}

		const setHouseNumberOptions = function (address)
		{
			houseNumberSelect.children().eq(0).siblings().remove();

			let options = document.createDocumentFragment();

			address.houseNumberAdditions.forEach(function (addition) {
				const option = document.createElement('option');
				option.value = addition;
				option.textContent = (address.houseNumber + ' ' + addition).trim();
				options.appendChild(option);
			});

			houseNumberSelect.append(options);
		}

		const fillAddressFields = function (address, houseNumberAddition)
		{
			if (typeof houseNumberAddition !== 'undefined')
			{
				address.houseNumberAddition = houseNumberAddition;
			}

			const addition = address.houseNumberAddition || '';

			new Map([
				['address_1', address.street + ' ' + (address.houseNumber + ' ' + addition).trim()],
				['postcode', address.postcode],
				['city', address.city],
				['street_name', address.street],
				['house_number', address.houseNumber],
				['house_number_suffix', addition],
			]).forEach(function (value, key) {
				addressFields[key].val(value);
			});

			// Force WooCommerce to recalculate shipping costs after address change
			$(document.body).trigger('update_checkout');
		}

		const resetHouseNumberSelect = function ()
		{
			houseNumberSelect.closest('.postcode-eu-autofill').hide();
			houseNumberSelect.children().eq(0).siblings().remove();
		}
	}

	const addAddressAutocompleteIntl = function (form)
	{
		const countryToState = form.find('.country_to_state'),
			countryIso2 = countryToState.val(),
			intlFormRow = form.find('.postcode-eu-autofill-intl'),
			intlField = intlFormRow.find('input'),
			addressFields = getAddressFields(form),
			countryIsoMap = (function () {
				const map = new Map();

				for (let i in settings.supportedCountries)
				{
					map.set(settings.supportedCountries[i].iso2, settings.supportedCountries[i].iso3);
				}

				return map;
			})();

		let autocompleteInstance = null;

		const isSupportedCountryIntl = function (countryIso2)
		{
			if (settings.netherlandsMode === 'postcodeOnly' && countryIso2 === 'NL')
			{
				return false;
			}

			return isSupportedCountry(countryIso2);
		}

		const fillAddressFields = function (address)
		{
			const addition = address.buildingNumberAddition || '';

			new Map([
				['address_1', address.street + ' ' + (address.buildingNumber + ' ' + addition).trim()],
				['postcode', address.postcode],
				['city', address.locality],
				['street_name', address.street],
				['house_number', address.buildingNumber],
				['house_number_suffix', addition],
			]).forEach(function (value, key) {
				addressFields[key].val(value);
			});

			$(document.body).trigger('update_checkout');
		}

		const intlFieldObserver = new MutationObserver(function () {
			if (autocompleteInstance !== null || intlFormRow.is(':hidden'))
			{
				return;
			}

			autocompleteInstance = new PostcodeNl.AutocompleteAddress(intlField[0], {
				autocompleteUrl: settings.autocomplete,
				addressDetailsUrl: settings.getDetails,
				context: (countryIsoMap.get(countryToState.val()) || 'nld').toLowerCase(),
			});

			intlField[0].addEventListener('autocomplete-select', function (e) {
				if (e.detail.precision === 'Address')
				{
					intlField.addClass('postcodenl-address-autocomplete-loading');

					autocompleteInstance.getDetails(e.detail.context, function (result) {
						fillAddressFields(result.address);
						toggleAddressFields(addressFields, true);
						intlField
							.removeClass('postcodenl-address-autocomplete-loading')
							.trigger('address-result', result);
					});
				}
			});

			document.addEventListener('autocomplete-xhrerror', function (e) {
				console.error('Autocomplete XHR error', e);
				toggleAddressFields(addressFields, true);
				intlField.removeClass('postcodenl-address-autocomplete-loading');
			});

			// Clear the previous values when searching for a new address.
			intlField[0].addEventListener('autocomplete-search', function () {
				resetAddressFields(addressFields);
			});
		});

		intlFieldObserver.observe(intlFormRow[0], {attributes: true, attributeFilter: ['style']});

		intlFormRow.toggle(isSupportedCountryIntl(countryToState.val()));

		countryToState.on('change', function () {
			const isSupported = isSupportedCountryIntl(this.value);

			if (isSupported && autocompleteInstance !== null)
			{
				resetAddressFields(addressFields);
				autocompleteInstance.reset();
				autocompleteInstance.setCountry(countryIsoMap.get(this.value));
			}

			intlFormRow.toggle(isSupported);
		});

	}

	const addFormattedAddressOutput = function (form)
	{
		const formRow = $('<div>', {class: 'form-row form-row-wide postcode-eu-autofill'}),
			addressElement = $('<address>', {class: 'postcode-eu-autofill-address'}).appendTo(formRow);

		form.find('.postcode-eu-autofill').last().after(formRow);

		form.find('.country_to_state').on('change', function () {
			formRow.hide();
		});

		form.find('.postcode-eu-autofill-intl').on('address-result', function (e, result) {
			addressElement.html(result.mailLines[0] + '<br>' + result.mailLines[1]);
			formRow.show();
		});

		form.find('.postcode-eu-autofill-nl').on('address-result', function (e, result) {
			if (result.status !== 'valid')
			{
				formRow.hide();
				return;
			}

			const line1 = result.address.street + ' ' + (result.address.houseNumber + ' ' + result.address.houseNumberAddition).trim(),
				line2 = result.address.postcode + ' ' + result.address.city;

			addressElement.html(line1 + '<br>' + line2);
			formRow.show();
		});
	}
})();
