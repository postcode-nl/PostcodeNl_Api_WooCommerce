(function () {
	'use strict';

	if (typeof PostcodeEuSettings === 'undefined')
	{
		return;
	}

	const $ = jQuery,
		__ = wp.i18n.__,
		settings = PostcodeEuSettings,
		initializedElements = new Set();

	const initialize = function ()
	{
		$('.postcode-eu-autofill-intl').closest('div').each(function () {
			if (initializedElements.has(this))
			{
				return; // Already initialized.
			}

			const container = $(this);

			initializedElements.add(this);

			addAddressAutocompleteNl(container);
			addAddressAutocompleteIntl(container);

			if (settings.displayMode === 'default')
			{
				addFormattedAddressOutput(container);
			}

			if (settings.displayMode === 'showAll')
			{
				return;
			}

			container.find('.country_to_state').on('change.postcode-eu.address-fields', function () {
				const selectedCountry = this.value;

				// Wrap in timeout to execute after Woocommerce field logic:
				window.setTimeout(function () {
					toggleAddressFields(getAddressFields(container), !isSupportedCountry(selectedCountry), true);
				});
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
		const fields = {};

		for (let key in PostcodeNlAddressFieldMapping.mapping)
		{
			fields[key] = form.find('[name$="' + key + '"]');
		}

		return fields;
	}

	const resetAddressFields = function (addressFields)
	{
		for (let i in addressFields)
		{
			addressFields[i]
				.val('')
				.trigger('input'); // Clears field validation.
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
			let field = addressFields[i];

			if (field.length > 0 && field.prop('type') !== 'hidden')
			{
				field.closest('.form-row').toggle(state);
			}
		}
	}

	const fillAddressFields = function (addressFields, mappedValues)
	{
		for (let key in PostcodeNlAddressFieldMapping.mapping)
		{
			const addressPart = PostcodeNlAddressFieldMapping.mapping[key];

			if (mappedValues.has(addressPart) && addressFields[key].length > 0)
			{
				const field = addressFields[key].val(mappedValues.get(addressPart))[0];
				field.dispatchEvent(new Event('change'));
			}
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

	const addAddressAutocompleteNl = function (container)
	{
		if (settings.netherlandsMode !== 'postcodeOnly')
		{
			return;
		}

		const countryToState = container.find('.country_to_state'),
			nlFields = container.find('.postcode-eu-autofill-nl'),
			lookupDelay = 750,
			postcodeRegex = /[1-9][0-9]{3}\s*[a-z]{2}/i,
			houseNumberRegex = /[1-9]\d{0,4}(?:\D.*)?$/i,
			postcodeField = container.find('.postcode-eu-autofill-nl-postcode input'),
			houseNumberField = container.find('.postcode-eu-autofill-nl-house-number input'),
			houseNumberSelect = container.find('.postcode-eu-autofill-nl-house-number-select select'),
			addressFields = getAddressFields(container);

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
				fillAddressFieldsNl(data.address);
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
			fillAddressFieldsNl(address, this.value);
		});

		const getAddress = function ()
		{
			const postcode = postcodeRegex.exec(postcodeField.val())[0].replace(/\s/g, ''),
				houseNumberAndAddition = houseNumberRegex.exec(houseNumberField.val())[0].trim(),
				url = settings.dutchAddressLookup.replace('${postcode}', encodeURIComponent(postcode)).replace('${houseNumberAndAddition}', encodeURIComponent(houseNumberAndAddition));

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

		const fillAddressFieldsNl = function (address, houseNumberAddition)
		{
			if (typeof houseNumberAddition !== 'undefined')
			{
				address.houseNumberAddition = houseNumberAddition;
			}

			const addition = address.houseNumberAddition || '';

			fillAddressFields(addressFields, new Map([
				[PostcodeNlAddressFieldMapping.street, address.street],
				[PostcodeNlAddressFieldMapping.houseNumber, address.houseNumber],
				[PostcodeNlAddressFieldMapping.houseNumberAddition, addition],
				[PostcodeNlAddressFieldMapping.postcode, address.postcode],
				[PostcodeNlAddressFieldMapping.city, address.city],
				[PostcodeNlAddressFieldMapping.streetAndHouseNumber, address.street + ' ' + (address.houseNumber + ' ' + addition).trim()],
				[PostcodeNlAddressFieldMapping.houseNumberAndAddition, (address.houseNumber + ' ' + addition).trim()],
			]));

			// Force WooCommerce to recalculate shipping costs after address change
			$(document.body).trigger('update_checkout');
		}

		const resetHouseNumberSelect = function ()
		{
			houseNumberSelect.closest('.postcode-eu-autofill').hide();
			houseNumberSelect.children().eq(0).siblings().remove();
		}
	}

	const addAddressAutocompleteIntl = function (container)
	{
		const countryToState = container.find('.country_to_state'),
			countryIso2 = countryToState.val(),
			intlFormRow = container.find('.postcode-eu-autofill-intl'),
			intlField = intlFormRow.find('input'),
			countryIsoMap = (function () {
				const map = new Map();

				for (let i in settings.supportedCountries)
				{
					map.set(settings.supportedCountries[i].iso2, settings.supportedCountries[i].iso3);
				}

				return map;
			})();

		let autocompleteInstance = null,
			addressFields = getAddressFields(container);

		const isSupportedCountryIntl = function (countryIso2)
		{
			if (settings.netherlandsMode === 'postcodeOnly' && countryIso2 === 'NL')
			{
				return false;
			}

			return isSupportedCountry(countryIso2);
		}

		const fillAddressFieldsIntl = function (address)
		{
			fillAddressFields(addressFields, new Map([
				[PostcodeNlAddressFieldMapping.street, address.street],
				[PostcodeNlAddressFieldMapping.houseNumber, address.buildingNumber || ''],
				[PostcodeNlAddressFieldMapping.houseNumberAddition, address.buildingNumberAddition || ''],
				[PostcodeNlAddressFieldMapping.postcode, address.postcode],
				[PostcodeNlAddressFieldMapping.city, address.locality],
				[PostcodeNlAddressFieldMapping.streetAndHouseNumber, (address.street + ' ' + address.building).trim()],
				[PostcodeNlAddressFieldMapping.houseNumberAndAddition, address.building],
			]));

			$(document.body).trigger('update_checkout');
		}

		const intlFieldObserver = new MutationObserver(function () {
			if (autocompleteInstance !== null)
			{
				return;
			}

			autocompleteInstance = new PostcodeNl.AutocompleteAddress(intlField[0], {
				autocompleteUrl: settings.autocomplete,
				addressDetailsUrl: settings.getDetails,
				context: (countryIsoMap.get(countryToState.val()) || 'nld').toLowerCase(),
				autoFocus: true,
			});

			const getSuggestions = autocompleteInstance.getSuggestions;

			autocompleteInstance.getSuggestions = function (context, term, response) {
				const url = this.options.autocompleteUrl.replace('${context}', encodeURIComponent(context)).replace('${term}', encodeURIComponent(term));
				return this.xhrGet(url, response);
			}

			const getDetails = autocompleteInstance.getDetails;

			autocompleteInstance.getDetails = function (addressId, response)
			{
				const url = this.options.addressDetailsUrl.replace('${context}', encodeURIComponent(addressId));
				return this.xhrGet(url, response);
			}

			intlField[0].addEventListener('autocomplete-select', function (e) {
				if (e.detail.precision === 'Address')
				{
					intlField.addClass('postcodenl-address-autocomplete-loading');

					autocompleteInstance.getDetails(e.detail.context, function (result) {
						fillAddressFieldsIntl(result.address);
						toggleAddressFields(addressFields, true);
						intlField
							.removeClass('postcodenl-address-autocomplete-loading')
							.trigger('address-result', result);

						intlFormRow
							.removeClass('woocommerce-invalid')
							.addClass('woocommerce-validated');

						clearFieldErrors(intlField);
					});
				}
			});

			document.addEventListener('autocomplete-xhrerror', function (e) {
				console.error('Autocomplete XHR error', e);
				toggleAddressFields(addressFields, true);
				intlField.removeClass('postcodenl-address-autocomplete-loading')
				intlFormRow
					.removeClass('woocommerce-validated')
					.addClass('woocommerce-invalid');
				setFieldError(intlField, __('An error has occurred while retrieving address data. Please contact us if the problem persists.', 'postcodenl-address-autocomplete'));
			});

			// Clear the previous values when searching for a new address.
			intlField[0].addEventListener('autocomplete-search', function () {
				resetAddressFields(addressFields);
			});

			intlField.on('change', function (e) {
				intlFormRow
					.removeClass('woocommerce-validated')
					.addClass('woocommerce-invalid');
				setFieldError(intlField, __('Please enter an address and select it.',  'postcodenl-address-autocomplete'));
				e.stopPropagation(); // Prevent default validation via delegated event handler.
			});
		});

		intlFieldObserver.observe(intlFormRow[0], {attributes: true, attributeFilter: ['style']});

		intlFormRow.toggle(isSupportedCountryIntl(countryToState.val()));

		countryToState.on('change', window.setTimeout.bind(window, function () {
				addressFields = getAddressFields(container);

				const isSupported = isSupportedCountryIntl(countryToState.val());

				if (isSupported && autocompleteInstance !== null)
				{
					resetAddressFields(addressFields);
					autocompleteInstance.reset();
					autocompleteInstance.setCountry(countryIsoMap.get(countryToState.val()));
				}

				intlFormRow.toggle(isSupported);
			})
		);
	}

	const addFormattedAddressOutput = function (container)
	{
		const formRow = $('<div>', {class: 'form-row form-row-wide postcode-eu-autofill'}),
			addressElement = $('<address>', {class: 'postcode-eu-autofill-address'}).appendTo(formRow);

		container.find('.postcode-eu-autofill').last().after(formRow);

		container.find('.country_to_state').on('change', function () {
			formRow.hide();
		});

		container.find('.postcode-eu-autofill-intl').on('address-result', function (e, result) {
			addressElement.html(result.mailLines[0] + '<br>' + result.mailLines[1]);
			formRow.show();
		});

		container.find('.postcode-eu-autofill-intl input').on('autocomplete-search', function () {
			formRow.hide();
		});

		container.find('.postcode-eu-autofill-nl').on('address-result', function (e, result) {
			if (result.status !== 'valid')
			{
				formRow.hide();
				return;
			}

			const line1 = result.address.street + ' ' + result.address.houseNumber + (result.address.houseNumberAddition ? ' ' + result.address.houseNumberAddition : ''),
				line2 = result.address.postcode + ' ' + result.address.city;

			addressElement.html(line1 + '<br>' + line2);
			formRow.show();
		});
	}
})();
