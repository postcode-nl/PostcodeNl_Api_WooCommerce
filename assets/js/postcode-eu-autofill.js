/* global PostcodeEuSettings, PostcodeNlAddressFieldMapping, PostcodeNlStateToValueMapping */
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
		addressDetailsCache = new Map(),
		storedAddresses = {},
		checkoutElements = {},
		loadingClassName = 'postcode-eu-address-validation-loading';

	const initialize = function ()
	{
		if (typeof PostcodeNlAddressFieldMapping !== 'undefined')
		{
			// Provide backward compatibility with the `PostcodeNlAddressFieldMapping.mapping` global.
			$.extend(settings.addressFieldMapping, PostcodeNlAddressFieldMapping.mapping);
		}

		$('.postcode-eu-autofill-intl').closest('div').each(function () {
			if (initializedElements.has(this))
			{
				return; // Already initialized.
			}

			const container = $(this),
				addressType = this.querySelector('#billing_city') ? 'billing' : 'shipping';

			storedAddresses[addressType] ??= new StoredAddress(addressType);

			if (false === container.is(':visible'))
			{
				return; // Skip if the container is not visible. Will try again on update_checkout.
			}

			initializedElements.add(this);

			const addressFields = getAddressFields(addressType);
			checkoutElements[addressType] = { container, addressFields };

			if (settings.displayMode === 'default')
			{
				addFormattedAddressOutput(container);
			}

			addAddressAutocompleteNl(container, addressType);
			addAddressAutocompleteIntl(container, addressType);

			if (settings.displayMode === 'showAll')
			{
				return;
			}

			if (settings.allowAutofillIntlBypass === 'y')
			{
				addAutofillIntlBypass(container, addressType);
			}

			container.find('.country_to_state').on('change.postcode-eu.address-fields', function () {
				const selectedCountry = this.value;

				window.setTimeout( // Execute after Woocommerce field logic:
					() => toggleAddressFields(addressFields, !isSupportedCountry(selectedCountry), true)
				);
			}).trigger('change.postcode-eu.address-fields');
		});
	};

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
	};

	const getAddressFields = function (addressType)
	{
		const fields = {};

		for (const [key, addressPart] of Object.entries(settings.addressFieldMapping))
		{
			const field = document.forms.checkout[`${addressType}_${key}`];
			if (field && addressPart !== null && field.type !== 'hidden')
			{
				fields[key] = $(field);
			}
		}

		return fields;
	};

	const getAddressFieldValues = function (addressType)
	{
		const fields = checkoutElements[addressType]?.addressFields ?? {};
		return Object.fromEntries(Object.entries(fields).map(([k, el]) => [k, el.val()]));
	};

	const resetAddressFields = function (addressFields)
	{
		for (let i in addressFields)
		{
			addressFields[i]
				.val('')
				.trigger('input'); // Clears field validation.
		}
	};

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
	};

	const setAddressWithStorage = function (addressType, apiAddress, mailLines = null)
	{
		const mappedValues = {},
			values = {
				street: apiAddress.street,
				streetAndHouseNumber: apiAddress.streetLine,
				houseNumber: apiAddress.buildingNumber ?? apiAddress.houseNumber,
				houseNumberAddition: apiAddress.buildingNumberAddition ?? apiAddress.houseNumberAddition,
				houseNumberAndAddition: apiAddress.building,
				postcode: apiAddress.postcode,
				city: apiAddress.locality ?? apiAddress.city,
				province: apiAddress.province,
			};

		for (const [key, field] of Object.entries(checkoutElements[addressType].addressFields))
		{
			mappedValues[key] = String(values[settings.addressFieldMapping[key]] ?? '');
			field[0].value = mappedValues[key];
			field[0].dispatchEvent(new Event('change', {bubbles: true, cancelable: true}));
		}

		storedAddresses[addressType].set(mappedValues, mailLines);

		if (addressType === 'billing' && hasUnusedShippingForm())
		{
			// Also set shipping to avoid redundant validation at next pageview.
			storedAddresses.shipping.set(mappedValues, mailLines);
		}

		// Force WooCommerce to recalculate shipping costs after address change.
		$(document.body).trigger('update_checkout');
	};

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
	};

	const clearFieldValidity = function (field)
	{
		field.closest('.form-row').removeClass('woocommerce-validated woocommerce-invalid');
		field.siblings('.postcode-eu-address-validation-warning').remove();
	};

	const getMappedAddressValues = (addressType) => {
		// Get values according to field mapping. Mapped key must exist in address fields.
		const values = {};
		for (const [key, prop] of Object.entries(settings.addressFieldMapping))
		{
			if (prop && key in checkoutElements[addressType].addressFields)
			{
				values[prop] = checkoutElements[addressType].addressFields[key].val();
			}
		}

		// Check for separate street and house number fields, fill combined fields.
		if ('street' in values)
		{
			if ('houseNumber' in values)
			{
				values.houseNumberAndAddition = [values.houseNumber, values.houseNumberAddition ?? ''].join(' ').trim();
			}

			if ('houseNumberAndAddition' in values)
			{
				values.streetAndHouseNumber = [values.street, values.houseNumberAndAddition].join(' ');
			}
		}

		// Return values if required fields are filled. Otherwise return null.
		if (values.postcode && values.city && values.streetAndHouseNumber)
		{
			return values;
		}

		return null;
	};

	const validateAddress = (countryIso3, streetAndBuilding = '', postcode = '', locality = '') => {
		const url = settings.actions.validate
			.replace('${country}', encodeURIComponent(countryIso3))
			.replace('${streetAndBuilding}', encodeURIComponent(streetAndBuilding))
			.replace('${postcode}', encodeURIComponent(postcode))
			.replace('${locality}', encodeURIComponent(locality));

		return fetch(url, {headers: {'X-WC-Checkout-Type': 'classic'}}).then((response) => {
			if (response.ok)
			{
				return response.json();
			}

			throw new Error(response.statusText);
		});
	};

	const getValidatedAddress = (...args) => {
		return validateAddress(...args)
			.then((response) => {
				const top = response.matches[0];
				if (
					top?.status
					&& !top.status.isAmbiguous
					&& top.status.grade < 'C'
					&& ['Building', 'BuildingPartial'].includes(top.status.validationLevel)
				)
				{
					return top;
				}

				return null;
			})
			.catch((error) => console.error(error));
	};

	const validatePoBox = function (addressType)
	{
		return settings.allowPoBoxShipping === 'y' || !(addressType === 'shipping' || isBillingAsShipping());
	};

	const destruct = function ()
	{
		for (const addressType in checkoutElements)
		{
			checkoutElements[addressType].container.find('.country_to_state').off('change.postcode-eu');
			checkoutElements[addressType].container.find('.form-row.postcode-eu-autofill').remove();
			toggleAddressFields(checkoutElements[addressType].addressFields, true, true);
		}
	};

	const addAddressAutocompleteNl = function (container, addressType)
	{
		if (typeof settings.enabledCountries.NL === 'undefined' || settings.netherlandsMode !== 'postcodeOnly')
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
			addressFields = checkoutElements[addressType].addressFields = getAddressFields(addressType),
			storedAddress = storedAddresses[addressType];

		let lookupTimeout,
			currentAddress = null,
			currentStatus = null;

		const toggleNlFields = function (state)
		{
			nlFields.slice(0, 2).toggle(state);
			nlFields.slice(-1).toggle(state && houseNumberSelect.children().length > 1);
		};

		const isNl = function ()
		{
			return countryToState.val() === 'NL';
		};

		const isPostcodeValid = () => postcodeRegex.test(postcodeField.val());

		const isHouseNumberValid = () => houseNumberRegex.test(houseNumberField.val());

		postcodeField.on('input', () => {
			window.clearTimeout(lookupTimeout);
			clearFieldValidity(postcodeField);
			resetHouseNumberSelect();
			currentStatus = null;

			if (isPostcodeValid() && isHouseNumberValid())
			{
				lookupTimeout = window.setTimeout(getAddress, lookupDelay);
			}
		});

		houseNumberField.on('input', () => {
			window.clearTimeout(lookupTimeout);
			clearFieldValidity(houseNumberField);
			resetHouseNumberSelect();
			currentStatus = null;

			if (isHouseNumberValid() && isPostcodeValid())
			{
				lookupTimeout = window.setTimeout(getAddress, lookupDelay);
			}
		});

		// Replace WooCommerce checkout validation.
		postcodeField.on('change focusout validate', (e) => {
			e.stopPropagation();

			setFieldValidity(
				postcodeField,
				isPostcodeValid() ? '' : __('Please enter a valid postcode', 'postcode-eu-address-validation')
			);
		});

		houseNumberField.on('change focusout validate', (e) => {
			e.stopPropagation();

			if (currentStatus === null || currentStatus === 'valid')
			{
				setFieldValidity(
					houseNumberField,
					isHouseNumberValid() ? '' : __('Please enter a valid house number', 'postcode-eu-address-validation')
				);
			}
		});

		countryToState.on('change.postcode-eu', () => {
			toggleNlFields(isNl());

			if (!isNl())
			{
				return;
			}

			resetAddressFields(addressFields);
			storedAddress.clear();

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

		houseNumberSelect.on('change validate', function () {
			if (this.value === '0') // '0' is the select-house-number label.
			{
				if (this.children.length > 1)
				{
					currentAddress.houseNumberAddition = null;
					postcodeField.trigger('address-result', {address: currentAddress, status: 'houseNumberAdditionIncorrect'});
					toggleAddressFields(addressFields, false);
					resetAddressFields(addressFields);
					setFieldValidity(
						houseNumberSelect,
						__('Please select a house number.', 'postcode-eu-address-validation')
					);
				}

				return;
			}

			toggleAddressFields(addressFields, true);
			currentAddress.houseNumberAddition = this.value;
			postcodeField.trigger('address-result', {address: currentAddress, status: 'valid'});
			clearFieldValidity(houseNumberSelect);
		});

		container.on('reset-address', () => {
			if (isNl())
			{
				postcodeField.val('');
				houseNumberField.val('');
				resetHouseNumberSelect();
				resetAddressFields(addressFields);
				storedAddress.clear();
				postcodeField.focus();
			}
		});

		const getAddress = function ()
		{
			const postcode = postcodeRegex.exec(postcodeField.val())[0].replace(/\s/g, ''),
				houseNumberAndAddition = houseNumberRegex.exec(houseNumberField.val())[0].trim(),
				url = settings.actions.dutchAddressLookup.replace('${postcode}', encodeURIComponent(postcode)).replace('${houseNumberAndAddition}', encodeURIComponent(houseNumberAndAddition));

			resetHouseNumberSelect();
			resetAddressFields(addressFields);
			currentAddress = currentStatus = null;
			postcodeField.addClass(loadingClassName);

			$.get({
				url: url,
				cache: true,
				dataType: 'json',
				headers: { 'X-WC-Checkout-Type': 'classic' },
				success: function (response) {
					if (response.status === 'notFound')
					{
						setFieldValidity(
							houseNumberField,
							__('Address not found.', 'postcode-eu-address-validation')
						);
						return;
					}

					if (response.address.addressType === 'PO box' && !validatePoBox(addressType))
					{
						setFieldValidity(
							houseNumberField,
							__('Sorry, we cannot ship to a PO Box address.', 'postcode-eu-address-validation')
						);
						response.status = 'poBoxNotAllowed';
						return;
					}

					if (response.status === 'houseNumberAdditionIncorrect')
					{
						setHouseNumberOptions(response.address);
						houseNumberSelect.closest('.postcode-eu-autofill').show();
					}
					else
					{
						toggleAddressFields(addressFields, true);
						setFieldValidity(postcodeField);
						setFieldValidity(houseNumberField);
					}

					currentAddress = response.address;
				}
			}).fail(function (jqXhr) {
				if (jqXhr.status === 503)
				{
					destruct();
					return;
				}

				setFieldValidity(
					houseNumberField,
					__('An error has occurred. Please try again later or contact us.', 'postcode-eu-address-validation')
				);
			}).always(function (response, textStatus) {
				currentStatus = response.status ?? textStatus;

				postcodeField.removeClass(loadingClassName);

				postcodeField.trigger(
					'address-result',
					textStatus === 'success' ? response : {status: textStatus, address: null}
				);
			});
		};

		const setHouseNumberOptions = function (address)
		{
			houseNumberSelect.children().eq(0).siblings().remove();

			let options = document.createDocumentFragment();

			address.houseNumberAdditions.forEach((addition) => options.appendChild(createOption(addition)));
			options.appendChild(createOption(
				address.unknownHouseNumberAddition,
				'(' + __('unknown addition', 'postcode-eu-address-validation') + ')'
			));
			houseNumberSelect.append(options);

			function createOption(addition, labelSuffix)
			{
				const option = document.createElement('option');
				option.value = addition;
				option.textContent = (address.houseNumber + ' ' + addition + ' ' + (labelSuffix ?? '')).trim();
				return option;
			}
		};

		const fillAddressFieldsNl = function (apiAddress)
		{
			setAddressWithStorage(addressType, apiAddress, getMailLinesNl(apiAddress));
		};

		const resetHouseNumberSelect = function ()
		{
			houseNumberSelect.closest('.postcode-eu-autofill').hide();
			houseNumberSelect.children().eq(0).siblings().remove();
		};

		const extractHouseNumber = (streetAndHouseNumber) => {
			const matches = [...streetAndHouseNumber.matchAll(/[1-9]\d{0,4}\D*/g)];

			if (matches[0]?.index === 0)
			{
				matches.shift(); // Discard leading number as a valid house number.
			}

			if (matches.length === 1) // Single match is most likely the house number.
			{
				return matches[0][0].trim();
			}

			return null; // No match or ambiguous (i.e. multiple numbers found).
		};

		// Initialize
		(() => {
			toggleNlFields(isNl());

			if (!isNl())
			{
				return;
			}

			const prefilledAddressValues = getMappedAddressValues(addressType);
			if (prefilledAddressValues === null)
			{
				return;
			}

			// Check for stored address to use.
			if (!storedAddress.isExpired() && storedAddress.isEqual(getAddressFieldValues(addressType)))
			{
				const {values, mailLines} = storedAddress.get();

				postcodeField.val(values.postcode);
				houseNumberField.val(values.houseNumberAndAddition);

				setFieldValidity(postcodeField);
				setFieldValidity(houseNumberField);

				container.find('.postcode-eu-autofill-intl').trigger('address-result', {mailLines});

				toggleAddressFields(addressFields, true);

				return;
			}

			// Stored address expired or not found, continue with prefilled values.

			const houseNumberAndAddition = prefilledAddressValues.houseNumberAndAddition ??
				extractHouseNumber(prefilledAddressValues.streetAndHouseNumber);

			postcodeField.val(prefilledAddressValues.postcode);

			if (houseNumberAndAddition)
			{
				houseNumberField.val(houseNumberAndAddition);
			}

			// Use NL API if the postcode and house number are both valid.
			if (isPostcodeValid() && isHouseNumberValid())
			{
				getAddress();
				return;
			}

			// Fall back to Validate API for ambiguous house number cases. Because when a street line contains
			// multiple numbers, the house number can't easily be determined via pattern matching.
			if (houseNumberRegex.test(prefilledAddressValues.streetAndHouseNumber))
			{
				postcodeField.addClass(loadingClassName);

				const {postcode, city, streetAndHouseNumber} = prefilledAddressValues;
				getValidatedAddress('NLD', streetAndHouseNumber, postcode, city)
					.then((result) => {
						if (result === null)
						{
							resetAddressFields(addressFields);
							setFieldValidity(
								houseNumberField,
								__('Please enter a valid address.', 'postcode-eu-address-validation')
							);
							currentStatus = 'notFound';
						}
						else if (result.isPoBox && !validatePoBox(addressType))
						{
							resetAddressFields(addressFields);
							setFieldValidity(
								houseNumberField,
								__('Sorry, we cannot ship to a PO Box address.', 'postcode-eu-address-validation')
							);
							currentStatus = 'poBoxNotAllowed';
						}
						else
						{
							fillAddressFieldsNl(result.address);

							setFieldValidity(postcodeField);
							setFieldValidity(houseNumberField);

							container.find('.postcode-eu-autofill-intl').trigger('address-result', result);

							toggleAddressFields(addressFields, true);
						}
					})
					.finally(() => postcodeField.removeClass(loadingClassName));
			}
		})();
	};

	const addAddressAutocompleteIntl = function (container, addressType)
	{
		const countryToState = container.find('.country_to_state'),
			intlFormRow = container.find('.postcode-eu-autofill-intl'),
			intlField = intlFormRow.find('input'),
			storedAddress = storedAddresses[addressType];

		let autocompleteInstance = null,
			addressFields = checkoutElements[addressType].addressFields = getAddressFields(addressType),
			matches = [];

		const isSupportedCountryIntl = function (countryIso2)
		{
			if (settings.netherlandsMode === 'postcodeOnly' && countryIso2 === 'NL')
			{
				return false;
			}

			return isSupportedCountry(countryIso2);
		};

		const fillAddressFieldsIntl = function (result)
		{
			if (result.country.iso3Code === 'ESP')
			{
				result.address.province = PostcodeNlStateToValueMapping.ESP[result.details.espProvince.name];
			}
			else if(result.country.iso3Code === 'CHE')
			{
				result.address.province = result.details.cheCanton.code;
			}
			else if(result.country.iso3Code === 'ITA')
			{
				result.address.province = result.details.itaTerritory.code;
			}

			setAddressWithStorage(addressType, result.address, result.mailLines);
		};

		const reset = function ()
		{
			intlField.val('');
			resetAddressFields(addressFields);
			storedAddress.clear();
			autocompleteInstance?.reset();
		};

		countryToState.on('change.postcode-eu', () => window.setTimeout(() => {
			const isSupported = isSupportedCountryIntl(countryToState.val());
			if (isSupported)
			{
				reset();
				autocompleteInstance?.setCountry(settings.enabledCountries[countryToState.val()].iso3);
			}

			intlFormRow.toggle(isSupported);
		}));

		container.on('reset-address', () => {
			if (isSupportedCountryIntl(countryToState.val()))
			{
				reset();
				intlField.focus();
			}
		});

		const intlFieldObserver = new IntersectionObserver(function (entries) {
			entries.forEach((entry) => {
				if (!entry.isIntersecting || autocompleteInstance !== null)
				{
					return;
				}

				let deferred = $.Deferred();

				const selectAutocompleteAddress = function (item)
				{
					const callback = (result) => {
						if (result.isPoBox && !validatePoBox(addressType))
						{
							resetAddressFields(addressFields);
							setFieldValidity(
								intlField,
								__('Sorry, we cannot ship to a PO Box address.', 'postcode-eu-address-validation')
							);
						}
						else
						{
							fillAddressFieldsIntl(result);
							toggleAddressFields(addressFields, true);
							intlField.trigger('address-result', result);
							setFieldValidity(intlField);
						}

						deferred.resolve();
					};

					if (addressDetailsCache.has(item.context))
					{
						callback(addressDetailsCache.get(item.context));
						return;
					}

					intlField.addClass(loadingClassName);

					autocompleteInstance.getDetails(item.context, (result) => {
						callback(result);
						addressDetailsCache.set(item.context, result);
						intlField.removeClass(loadingClassName);
					});
				};

				const isSingleAddressMatch = () => matches.length === 1 && matches[0].precision === 'Address';

				autocompleteInstance = new PostcodeNl.AutocompleteAddress(intlField[0], {
					autocompleteUrl: settings.actions.autocomplete,
					addressDetailsUrl: settings.actions.getDetails,
					context: (settings.enabledCountries[countryToState.val()]?.iso3 ?? 'nld').toLowerCase(),
				});

				autocompleteInstance.getSuggestions = function (context, term, response)
				{
					const encodedTerm = new TextEncoder().encode(term),
						binaryTerm = Array.from(encodedTerm, (byte) => String.fromCodePoint(byte)).join(''),
						url = this.options.autocompleteUrl.replace('${context}', encodeURIComponent(context)).replace('${term}', encodeURIComponent(btoa(binaryTerm)));

					return this.xhrGet(url, response);
				};

				autocompleteInstance.getDetails = function (addressId, response)
				{
					const url = this.options.addressDetailsUrl.replace('${context}', encodeURIComponent(addressId));
					return this.xhrGet(url, response);
				};

				intlField[0].addEventListener('autocomplete-xhr-send', ({detail: xhr}) => {
					xhr.setRequestHeader('X-WC-Checkout-Type', 'classic');
				});

				intlField[0].addEventListener('autocomplete-select', function (e) {
					if (e.detail.precision === 'Address')
					{
						selectAutocompleteAddress(e.detail);
					}
				});

				intlField[0].addEventListener('autocomplete-error', function (e) {
					console.error('Autocomplete XHR error', e);
					intlField.removeClass(loadingClassName);

					if (e.detail.request.status === 503)
					{
						// API seems to be down, restore standard address fields.
						destruct();
						return;
					}

					toggleAddressFields(addressFields, true);
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

					deferred.fail(() => setFieldValidity(intlField, __('Please enter an address and select it', 'postcode-eu-address-validation')));
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

				// Prevent default validation via delegated event handler.
				intlField.on('change focusout validate', (e) => e.stopPropagation());
			});
		});

		intlFieldObserver.observe(intlFormRow[0]);

		intlFormRow.toggle(isSupportedCountryIntl(countryToState.val()));

		// Initialize
		(() => {
			if (false === isSupportedCountryIntl(countryToState.val()))
			{
				return; // Only use values from supported countries.
			}

			const prefilledAddressValues = getMappedAddressValues(addressType);
			if (prefilledAddressValues === null)
			{
				return;
			}

			const {postcode, city, streetAndHouseNumber} = prefilledAddressValues;
			intlField.val(`${postcode} ${city} ${streetAndHouseNumber}`.trim());

			// Check for stored address to use.
			if (!storedAddress.isExpired() && storedAddress.isEqual(getAddressFieldValues(addressType)))
			{
				setFieldValidity(intlField);

				const {mailLines} = storedAddress.get();
				intlFormRow.trigger('address-result', {mailLines});

				return;
			}

			intlField.addClass(loadingClassName);

			// Autocomplete prefilled address values using the Validate API.
			const countryIso3 = settings.enabledCountries[countryToState.val()].iso3;
			getValidatedAddress(countryIso3, streetAndHouseNumber, postcode, city)
				.then((result) => {
					if (result === null)
					{
						resetAddressFields(addressFields);
						setFieldValidity(
							intlField,
							__('Please select a valid address', 'postcode-eu-address-validation')
						);
					}
					else if (result.isPoBox && !validatePoBox(addressType))
					{
						resetAddressFields(addressFields);
						setFieldValidity(
							intlField,
							__('Sorry, we cannot ship to a PO Box address.', 'postcode-eu-address-validation')
						);
					}
					else
					{
						fillAddressFieldsIntl(result);
						setFieldValidity(intlField);
						intlField.trigger('address-result', result);
						toggleAddressFields(addressFields, true);
					}
				})
				.finally(() => intlField.removeClass(loadingClassName));
		})();
	};

	const getMailLinesNl = function (address)
	{
		return [address.streetLine, `${address.postcode} ${address.city}`];
	};

	const addFormattedAddressOutput = function (container)
	{
		const formRow = $('<div>', {class: 'form-row form-row-wide postcode-eu-autofill form-row-postcode-eu-autofill-address'}),
			resetButton = $(
				'<span>',
				{
					text: '✕',
					title:__('Remove address', 'postcode-eu-address-validation'),
					class: 'postcode-eu-autofill-address-reset',
					click: () => {
						container.trigger('reset-address');
						formRow.hide();
					},
				}
			),
			addressElement = $('<address>', {class: 'postcode-eu-autofill-address'});

		formRow.append(resetButton, addressElement);
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

			addressElement.html(getMailLinesNl(result.address).join('<br>'));
			formRow.show();
		});
	};

	const addAutofillIntlBypass = function (container, addressType)
	{
		const formRow = container.find('.form-row.postcode-eu-autofill-intl'),
			wrapper = $('<span>', {'class': 'postcode-eu-autofill-intl-bypass'}),
			link = $('<a>', {text: settings.autofillIntlBypassLinkText});

		link.on('click', function () {
			toggleAddressFields(checkoutElements[addressType].addressFields, true, true);
			formRow.hide();
			return false;
		});

		wrapper.append(link);
		formRow.append(wrapper);
	};

	const hasUnusedShippingForm = function ()
	{
		if (typeof window.checkout.ship_to_different_address === 'undefined')
		{
			return false; // No separate shipping form exists.
		}

		return !window.checkout.ship_to_different_address.checked;
	};

	const isBillingAsShipping = function ()
	{
		if (typeof window.checkout.ship_to_different_address === 'undefined')
		{
			return true; // Forced shipping to billing address. No separate shipping form.
		}

		return !window.checkout.ship_to_different_address.checked;
	};

	class StoredAddress {
		storageKey;

		constructor(addressType)
		{
			this.storageKey = 'postcode-eu-validated-address-' + addressType;
		}

		get()
		{
			return JSON.parse(window.localStorage.getItem(this.storageKey)) ?? null;
		}

		set(values, mailLines)
		{
			window.localStorage.setItem(
				this.storageKey,
				JSON.stringify({
					timestamp: Date.now(),
					token: settings.localStorageToken,
					values: Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '')),
					mailLines,
				})
			);
		}

		isEqual(values)
		{
			const storedValues = this.get()?.values;
			return (storedValues ?? false) && Object.entries(storedValues).every(([k, v]) => values[k] === v);
		}

		isExpired()
		{
			const data = JSON.parse(window.localStorage.getItem(this.storageKey));
			return data?.timestamp + 90 * 24 * 60 * 60 * 1000 < Date.now() || data?.token !== settings.localStorageToken;
		}

		clear()
		{
			window.localStorage.removeItem(this.storageKey);
		}
	}
})();
