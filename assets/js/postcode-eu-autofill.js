(function () {
	'use strict';

	if (typeof PostcodeEuSettings === 'undefined')
	{
		return;
	}

	const $ = jQuery,
		__ = wp.i18n.__,
		settings = PostcodeEuSettings,
		initializedElements = new Set(),
		addressDetailsCache = new Map();

	const initialize = function ()
	{
		$('.postcode-eu-autofill-intl').closest('div').each(function () {
			if (initializedElements.has(this))
			{
				return; // Already initialized.
			}

			const container = $(this);

			if (false === container.is(':visible'))
			{
				return; // Skip if the container is not visible. Will try again on update_checkout.
			}

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

			if (settings.allowAutofillIntlBypass === 'y')
			{
				addAutofillIntlBypassLink(container);
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
		for (let i in settings.enabledCountries)
		{
			if (settings.enabledCountries[i].iso2 === countryIso2)
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
				// Fields remain hidden in default mode. A formatted address is shown instead.
				state = false;
			}
			else if (settings.displayMode === 'showAll')
			{
				// Fields always visible in showAll mode.
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

	const setFieldValidity = function (field, errorMessage)
	{
		errorMessage = errorMessage || '';
		console.assert($.type(errorMessage) === 'string', 'Error message must be a string.');
		clearFieldValidity(field);

		if (errorMessage === '')
		{
			field.closest('.form-row').addClass('woocommerce-validated');
		}
		else
		{
			field.closest('.form-row').addClass('woocommerce-invalid');
			field.after($('<span>', {class: 'postcode-eu-address-validation-warning', text: errorMessage}));
		}
	}

	const clearFieldValidity = function (field)
	{
		field.closest('.form-row').removeClass('woocommerce-validated woocommerce-invalid');
		field.siblings('.postcode-eu-address-validation-warning').remove();
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

		let lookupTimeout,
			currentAddress = null;

		const toggleNlFields = function (state)
		{
			nlFields.slice(0, 2).toggle(state);
			nlFields.slice(-1).toggle(state && houseNumberSelect.children().length > 1);
		}

		const isNl = function ()
		{
			return countryToState.val() === 'NL';
		}

		const isPostcodeValid = () => postcodeRegex.test(postcodeField.val());

		const isHouseNumberValid = () => houseNumberRegex.test(houseNumberField.val());

		postcodeField.on('input', () => {
			window.clearTimeout(lookupTimeout);
			clearFieldValidity(postcodeField);
			resetHouseNumberSelect();

			if (isPostcodeValid() && isHouseNumberValid())
			{
				lookupTimeout = window.setTimeout(getAddress, lookupDelay);
			}
		});

		houseNumberField.on('input', () => {
			window.clearTimeout(lookupTimeout);
			clearFieldValidity(houseNumberField);
			resetHouseNumberSelect();

			if (isHouseNumberValid() && isPostcodeValid())
			{
				lookupTimeout = window.setTimeout(getAddress, lookupDelay);
			}
		});

		// Replace WooCommerce checkout validation.
		postcodeField.on('change', (e) => {
			e.stopPropagation();

			setFieldValidity(
				postcodeField,
				isPostcodeValid() ? '' : __('Please enter a valid postcode.', 'postcode-eu-address-validation')
			);
		});

		houseNumberField.on('change', (e) => {
			e.stopPropagation();

			setFieldValidity(
				houseNumberField,
				isHouseNumberValid() ? '' : __('Please enter a valid house number.', 'postcode-eu-address-validation')
			);
		});

		countryToState.on('change', () => {
			toggleNlFields(isNl());

			if (!isNl())
			{
				return;
			}

			resetAddressFields(addressFields);

			if (isPostcodeValid() && isHouseNumberValid())
			{
				getAddress();
			}
		});

		postcodeField.on('address-result', function (_, data) {
			if (data.status === 'valid')
			{
				fillAddressFieldsNl(data.address);
			}
		});

		houseNumberSelect.on('change', function () {
			if (this.value === '0') // '0' is the select-house-number label.
			{
				currentAddress.houseNumberAddition = null;
				postcodeField.trigger('address-result', {address: currentAddress, status: 'houseNumberAdditionIncorrect'});
				toggleAddressFields(addressFields, false);
				resetAddressFields(addressFields);
				return;
			}

			toggleAddressFields(addressFields, true);
			currentAddress.houseNumberAddition = this.value;
			postcodeField.trigger('address-result', {address: currentAddress, status: 'valid'});
			fillAddressFieldsNl(currentAddress, this.value);
		});

		const getAddress = function ()
		{
			const postcode = postcodeRegex.exec(postcodeField.val())[0].replace(/\s/g, ''),
				houseNumberAndAddition = houseNumberRegex.exec(houseNumberField.val())[0].trim(),
				url = settings.dutchAddressLookup.replace('${postcode}', encodeURIComponent(postcode)).replace('${houseNumberAndAddition}', encodeURIComponent(houseNumberAndAddition));

			resetHouseNumberSelect();
			resetAddressFields(addressFields);
			currentAddress = null;
			postcodeField.addClass('postcode-eu-address-validation-loading');

			$.get({
				url: url,
				cache: true,
				dataType: 'json',
				success: function (response) {
					if (response.status === 'notFound')
					{
						setFieldValidity(houseNumberField, __('Address not found.', 'postcode-eu-address-validation'));
						return;
					}

					currentAddress = response.address;
					postcodeField.trigger('address-result', response);

					if (response.status === 'houseNumberAdditionIncorrect')
					{
						setHouseNumberOptions(response.address);
						houseNumberSelect.closest('.postcode-eu-autofill').show();
					}
					else
					{
						toggleAddressFields(addressFields, true);
					}
				}
			}).fail(function () {
				setFieldValidity(houseNumberField, __('An error has occurred. Please try again later or contact us.', 'postcode-eu-address-validation'));
			}).always(function () {
				postcodeField.removeClass('postcode-eu-address-validation-loading');
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

			const addition = address.houseNumberAddition || '',
				building = `${address.houseNumber} ${addition}`.trim();

			postcodeField.val(address.postcode);
			houseNumberField.val(building);

			fillAddressFields(addressFields, new Map([
				[PostcodeNlAddressFieldMapping.street, address.street],
				[PostcodeNlAddressFieldMapping.houseNumber, address.houseNumber],
				[PostcodeNlAddressFieldMapping.houseNumberAddition, addition],
				[PostcodeNlAddressFieldMapping.postcode, address.postcode],
				[PostcodeNlAddressFieldMapping.city, address.city],
				[PostcodeNlAddressFieldMapping.streetAndHouseNumber, address.street + ' ' + building],
				[PostcodeNlAddressFieldMapping.houseNumberAndAddition, building],
			]));

			// Force WooCommerce to recalculate shipping costs after address change
			$(document.body).trigger('update_checkout');
		}

		const resetHouseNumberSelect = function ()
		{
			houseNumberSelect.closest('.postcode-eu-autofill').hide();
			houseNumberSelect.children().eq(0).siblings().remove();
		}

		// Return a tuple of postcode and house number values, or null if one or both are not found.
		const findPrefilledPostcodeHouseNumberValues = () => {
			const findValue = (mappingName) => {
				let key = findFieldMapping(mappingName);
				if (key === null || addressFields[key].length === 0 || addressFields[key].val().trim() === '')
				{
					return null;
				}

				return addressFields[key].val().trim();
			}

			let postcode = findValue(PostcodeNlAddressFieldMapping.postcode);
			if (postcode === null)
			{
				return null;
			}

			let houseNumber;
			if (houseNumber = findValue(PostcodeNlAddressFieldMapping.houseNumber))
			{
				let houseNumberAddition = findValue(PostcodeNlAddressFieldMapping.houseNumberAddition);
				if (houseNumberAddition !== null)
				{
					houseNumber = `${houseNumber} ${houseNumberAddition}`;
				}

				return [postcode, houseNumber];
			}

			if (houseNumber = findValue(PostcodeNlAddressFieldMapping.houseNumberAndAddition))
			{
				return [postcode, houseNumber];
			}

			let streetAndHouseNumber;
			if (streetAndHouseNumber = findValue(PostcodeNlAddressFieldMapping.streetAndHouseNumber))
			{
				// Try to extract house number from street + house number combination as a last resort.
				if(houseNumber = streetAndHouseNumber.match(/\b\d+.*$/))
				{
					return [postcode, houseNumber[0]];
				}
			}

			return null;
		}

		// Initialize
		(() => {
			toggleNlFields(isNl());

			if (!isNl())
			{
				return;
			}

			if (postcodeField.val() === '' && houseNumberField.val() === '')
			{
				const prefilledValues = findPrefilledPostcodeHouseNumberValues();
				if (prefilledValues !== null)
				{
					postcodeField.val(prefilledValues[0]);
					houseNumberField.val(prefilledValues[1]);
				}
			}

			if (isPostcodeValid() && isHouseNumberValid())
			{
				getAddress();
			}
		})();
	}

	const addAddressAutocompleteIntl = function (container)
	{
		const countryToState = container.find('.country_to_state'),
			intlFormRow = container.find('.postcode-eu-autofill-intl'),
			intlField = intlFormRow.find('input'),
			countryIsoMap = (function () {
				const map = new Map();

				for (let i in settings.enabledCountries)
				{
					map.set(settings.enabledCountries[i].iso2, settings.enabledCountries[i].iso3);
				}

				return map;
			})();

		let autocompleteInstance = null,
			addressFields = getAddressFields(container),
			matches = [];

		const isSupportedCountryIntl = function (countryIso2)
		{
			if (settings.netherlandsMode === 'postcodeOnly' && countryIso2 === 'NL')
			{
				return false;
			}

			return isSupportedCountry(countryIso2);
		}

		const fillAddressFieldsIntl = function (result)
		{
			let address = result.address;
			let province = null;
			if (result.country.iso3Code === 'ESP')
			{
				province = PostcodeNlStateToValueMapping.ESP[result.details.espProvince.name];
			}
			else if(result.country.iso3Code === 'CHE')
			{
				province = PostcodeNlStateToValueMapping.CHE[result.details.cheCanton.name];
			}
			fillAddressFields(addressFields, new Map([
				[PostcodeNlAddressFieldMapping.street, address.street],
				[PostcodeNlAddressFieldMapping.houseNumber, address.buildingNumber || ''],
				[PostcodeNlAddressFieldMapping.houseNumberAddition, address.buildingNumberAddition || ''],
				[PostcodeNlAddressFieldMapping.postcode, address.postcode],
				[PostcodeNlAddressFieldMapping.city, address.locality],
				[PostcodeNlAddressFieldMapping.streetAndHouseNumber, (address.street + ' ' + address.building).trim()],
				[PostcodeNlAddressFieldMapping.houseNumberAndAddition, address.building],
				[PostcodeNlAddressFieldMapping.province, province],
			]));

			$(document.body).trigger('update_checkout');
		}

		// Get a prefilled address value from the intl field.
		// If missing, try to construct a value from the address fields.
		const getPrefilledAddressValue = () => {
			const intlFieldValue = intlField.val().trim();
			if (intlFieldValue !== '')
			{
				return intlFieldValue;
			}

			const addressParts = [];
			const addValue = (mappingName) => {
				let key = findFieldMapping(mappingName);
				if (key === null || addressFields[key].length === 0 || addressFields[key].val().trim() === '')
				{
					return false;
				}

				addressParts.push(addressFields[key].val());
				return true;
			}
			addValue(PostcodeNlAddressFieldMapping.postcode);
			addValue(PostcodeNlAddressFieldMapping.city);

			// Try separate street fields first for better precision.
			if (addValue(PostcodeNlAddressFieldMapping.street))
			{
				addValue(PostcodeNlAddressFieldMapping.houseNumber);
				addValue(PostcodeNlAddressFieldMapping.houseNumberAddition)
			}
			else
			{
				addValue(PostcodeNlAddressFieldMapping.streetAndHouseNumber);
			}

			return addressParts.join(' ');
		}

		const intlFieldObserver = new MutationObserver(function () {
			if (autocompleteInstance !== null)
			{
				return;
			}

			let deferred = $.Deferred();

			const selectAutocompleteAddress = function (item)
			{
				intlField.addClass('postcode-eu-address-validation-loading');

				const callback = (result) => {
					fillAddressFieldsIntl(result);
					toggleAddressFields(addressFields, true);
					intlField
						.removeClass('postcode-eu-address-validation-loading')
						.trigger('address-result', result);

					setFieldValidity(intlField);

					deferred.resolve();
				}

				if (addressDetailsCache.has(item.context))
				{
					callback(addressDetailsCache.get(item.context));
					return;
				}

				autocompleteInstance.getDetails(item.context, (result) => {
					callback(result)
					addressDetailsCache.set(item.context, result);
				});
			}

			const isSingleAddressMatch = () => matches.length === 1 && matches[0].precision === 'Address';

			autocompleteInstance = new PostcodeNl.AutocompleteAddress(intlField[0], {
				autocompleteUrl: settings.autocomplete,
				addressDetailsUrl: settings.getDetails,
				context: (countryIsoMap.get(countryToState.val()) || 'nld').toLowerCase(),
			});

			autocompleteInstance.getSuggestions = function (context, term, response)
			{
				const encodedTerm = new TextEncoder().encode(term),
					binaryTerm = Array.from(encodedTerm, (byte) => String.fromCodePoint(byte)).join(''),
					url = this.options.autocompleteUrl.replace('${context}', encodeURIComponent(context)).replace('${term}', encodeURIComponent(btoa(binaryTerm)));

				return this.xhrGet(url, response);
			}

			autocompleteInstance.getDetails = function (addressId, response)
			{
				const url = this.options.addressDetailsUrl.replace('${context}', encodeURIComponent(addressId));
				return this.xhrGet(url, response);
			}

			intlField[0].addEventListener('autocomplete-select', function (e) {
				if (e.detail.precision === 'Address')
				{
					selectAutocompleteAddress(e.detail);
				}
			});

			document.addEventListener('autocomplete-xhrerror', function (e) {
				console.error('Autocomplete XHR error', e);
				toggleAddressFields(addressFields, true);
				intlField.removeClass('postcode-eu-address-validation-loading')
				setFieldValidity(
					intlField,
					__('An error has occurred while retrieving address data. Please contact us if the problem persists.', 'postcode-eu-address-validation')
				);
			});

			// Clear the previous values when searching for a new address.
			intlField[0].addEventListener('autocomplete-search', function () {
				resetAddressFields(addressFields);
			});

			intlField[0].addEventListener('autocomplete-response', function (e) {
				matches = e.detail.matches;

				deferred = $.Deferred();

				deferred.fail(() => setFieldValidity(intlField, __('Please enter an address and select it.', 'postcode-eu-address-validation')));
			});

			intlField.on('blur', () => {
				if (
					false === isSingleAddressMatch()
					&& false === autocompleteInstance.elements.menu.classList.contains('postcodenl-autocomplete-menu-open')
				)
				{
					deferred.reject();
				}

				matches = [];
			});

			intlField.on('change', function (e) {
				e.stopPropagation(); // Prevent default validation via delegated event handler.
			});

			// Initialize
			(() => {
				if (false === isSupportedCountryIntl(countryToState.val()))
				{
					return; // Only use values from supported countries.
				}

				// Run autocomplete if there's a prefilled address value.
				const prefilledAddressValue = getPrefilledAddressValue();
				if (prefilledAddressValue !== '')
				{
					const oneTimeHandler = () => {
						if (isSingleAddressMatch() === true)
						{
							selectAutocompleteAddress(matches[0]);
						}

						matches = [];
						intlField[0].removeEventListener('autocomplete-response', oneTimeHandler);
					};
					intlField[0].addEventListener('autocomplete-response', oneTimeHandler);
					autocompleteInstance.search(intlField[0], { term: prefilledAddressValue, showMenu: false });
				}
			})();
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

		container.find('.postcode-eu-autofill-intl').on('address-result', function (_, result) {
			addressElement.html(result.mailLines.join('<br>'));
			formRow.show();
		});

		container.find('.postcode-eu-autofill-intl input').on('autocomplete-search', function () {
			formRow.hide();
		});

		container.find('.postcode-eu-autofill-nl').on('address-result', function (_, result) {
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

	const addAutofillIntlBypassLink = function (container)
	{
		const formRow = container.find('.form-row.postcode-eu-autofill-intl'),
			link = $('<a>', {'class': 'postcode-eu-autofill-intl-bypass-link', text: settings.autofillIntlBypassLinkText});

		link.on('click', function () {
			toggleAddressFields(getAddressFields(container), true, true);
			formRow.hide();
			return false;
		});

		formRow.append(link);
	}

	// Search PostcodeNlAddressFieldMapping.mapping for given value and
	// return the first corresponding key if successful. Otherwise returns null.
	const findFieldMapping = (value) => {
		for (let key in PostcodeNlAddressFieldMapping.mapping)
		{
			if (PostcodeNlAddressFieldMapping.mapping[key] === value)
			{
				return key;
			}
		}

		return null;
	}
})();
