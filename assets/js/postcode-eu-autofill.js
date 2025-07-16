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
		loadingClassName = 'postcode-eu-address-validation-loading';

	const initialize = function ()
	{
		$('.postcode-eu-autofill-intl').closest('div').each(function () {
			if (initializedElements.has(this))
			{
				return; // Already initialized.
			}

			const container = $(this),
				addressType = container.find('#billing_city').length === 0 ? 'shipping' : 'billing';

			storedAddresses[addressType] ??= new StoredAddress(addressType);

			if (false === container.is(':visible'))
			{
				return; // Skip if the container is not visible. Will try again on update_checkout.
			}

			initializedElements.add(this);

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
				addAutofillIntlBypass(container);
			}

			container.find('.country_to_state').on('change.postcode-eu.address-fields', function () {
				const selectedCountry = this.value;

				window.setTimeout( // Execute after Woocommerce field logic:
					() => toggleAddressFields(getAddressFields(container), !isSupportedCountry(selectedCountry), true)
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

	const getAddressFields = function (container)
	{
		const fields = {};

		for (const [key, addressPart] of Object.entries(PostcodeNlAddressFieldMapping.mapping))
		{
			const field = container.find('[name$="' + key + '"]');
			if (field.length > 0)
			{
				fields[addressPart] = field;
			}
		}

		return fields;
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

	/**
	 * @typedef MappedAddressValues
	 * @type {Object}
	 * @property {string} [postcode]
	 * @property {string} [city]
	 * @property {string} [street]
	 * @property {string} [streetAndHouseNumber]
	 * @property {string} [houseNumber]
	 * @property {string} [houseNumberAddition]
	 * @property {string} [houseNumberAndAddition]
	 * @property {string} [province]
	 *
	 * @param {MappedAddressValues} values
	 */
	const fillAddressFields = function (addressFields, values)
	{
		for (const addressPart of Object.values(PostcodeNlAddressFieldMapping.mapping))
		{
			if (
				typeof values[addressPart] !== 'undefined'
				&& typeof addressFields[addressPart] !== 'undefined'
			)
			{
				const field = addressFields[addressPart].val(values[addressPart])[0];
				field.dispatchEvent(new Event('change', {bubbles: true, cancelable: true}));
			}
		}
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

	const getPrefilledAddressValues = (addressFields) => {
		const values = {};

		for (const name of [
			'postcode',
			'city',
			'street',
			'streetAndHouseNumber',
			'houseNumber',
			'houseNumberAddition',
			'houseNumberAndAddition',
		])
		{
			values[name] = addressFields[PostcodeNlAddressFieldMapping[name]]?.val().trim() ?? null;
		}

		// Check for separate street and house number fields, fill combined fields.
		if (values.street)
		{
			if (values.houseNumber)
			{
				values.houseNumberAndAddition = [
					values.houseNumber,
					values.houseNumberAddition ?? '',
				].join(' ').trim();
			}

			if (values.houseNumberAndAddition)
			{
				values.streetAndHouseNumber = [
					values.street,
					values.houseNumberAndAddition,
				].join(' ');
			}
		}

		// Return values if required fields are filled. Otherwise return null.
		if (values.postcode && values.city && values.streetAndHouseNumber)
		{
			return values;
		}

		return null;
	};

	const validateAddress = (countryIso3, streetAndBuilding, postcode, locality) => {
		const url = settings.actions.validate
			.replace('${country}', encodeURIComponent(countryIso3 ?? ''))
			.replace('${streetAndBuilding}', encodeURIComponent(streetAndBuilding ?? ''))
			.replace('${postcode}', encodeURIComponent(postcode ?? ''))
			.replace('${locality}', encodeURIComponent(locality ?? ''));

		return fetch(url).then((response) => {
			if (response.ok)
			{
				return response.json();
			}

			throw new Error(response.statusText);
		});
	};

	const getValidatedAddress = (countryIso3, streetAndBuilding, postcode, locality) => {
		return validateAddress(countryIso3, streetAndBuilding, postcode, locality)
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

	const addAddressAutocompleteNl = function (container, addressType)
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
			addressFields = getAddressFields(container),
			storedAddress = storedAddresses[addressType];

		let lookupTimeout,
			currentAddress = null;

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
				isPostcodeValid() ? '' : __('Please enter a valid postcode', 'postcode-eu-address-validation')
			);
		});

		houseNumberField.on('change', (e) => {
			e.stopPropagation();

			setFieldValidity(
				houseNumberField,
				isHouseNumberValid() ? '' : __('Please enter a valid house number', 'postcode-eu-address-validation')
			);
		});

		countryToState.on('change', () => {
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
				const {address} = data,
					addition = address.houseNumberAddition ?? '',
					building = `${address.houseNumber} ${addition}`.trim();

				fillAddressFieldsNl({
					[PostcodeNlAddressFieldMapping.postcode]: address.postcode,
					[PostcodeNlAddressFieldMapping.city]: address.city,
					[PostcodeNlAddressFieldMapping.street]: address.street,
					[PostcodeNlAddressFieldMapping.streetAndHouseNumber]: address.street + ' ' + building,
					[PostcodeNlAddressFieldMapping.houseNumber]: address.houseNumber,
					[PostcodeNlAddressFieldMapping.houseNumberAddition]: addition,
					[PostcodeNlAddressFieldMapping.houseNumberAndAddition]: building,
				});
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
		});

		const getAddress = function ()
		{
			const postcode = postcodeRegex.exec(postcodeField.val())[0].replace(/\s/g, ''),
				houseNumberAndAddition = houseNumberRegex.exec(houseNumberField.val())[0].trim(),
				url = settings.actions.dutchAddressLookup.replace('${postcode}', encodeURIComponent(postcode)).replace('${houseNumberAndAddition}', encodeURIComponent(houseNumberAndAddition));

			resetHouseNumberSelect();
			resetAddressFields(addressFields);
			currentAddress = null;
			postcodeField.addClass(loadingClassName);

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
				}
			}).fail(function () {
				setFieldValidity(
					houseNumberField,
					__('An error has occurred. Please try again later or contact us.', 'postcode-eu-address-validation')
				);
			}).always(function (response, textStatus) {
				postcodeField.removeClass(loadingClassName);

				postcodeField.trigger(
					'address-result',
					textStatus === 'success' ? response : {status: 'error', address: null}
				);
			});
		};

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
		};

		/**
	 	 * @param {MappedAddressValues} values
		 */
		const fillAddressFieldsNl = function (values)
		{
			postcodeField.val(values.postcode);
			houseNumberField.val(values.houseNumberAndAddition);
			fillAddressFields(addressFields, values);

			const mailLines = getMailLinesNl(values);
			storedAddress.set(values, mailLines);

			if (addressType === 'billing' && isUseBillingAsShipping())
			{
				// Also set shipping to avoid redundant validation at next pageview.
				storedAddresses.shipping.set(values, mailLines);
			}

			// Force WooCommerce to recalculate shipping costs after address change
			$(document.body).trigger('update_checkout');
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

			const prefilledAddressValues = getPrefilledAddressValues(addressFields);
			if (prefilledAddressValues === null)
			{
				return;
			}

			// Check for stored address to use.
			if (
				!storedAddress.isExpired()
				&& storedAddress.isEqual({
					[PostcodeNlAddressFieldMapping.postcode]: prefilledAddressValues.postcode,
					[PostcodeNlAddressFieldMapping.city]: prefilledAddressValues.city,
					[PostcodeNlAddressFieldMapping.streetAndHouseNumber]: prefilledAddressValues.streetAndHouseNumber,
				})
			)
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

			// No stored address found, continue with prefilled values.

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
						}
						else
						{
							const {address} = result;
							fillAddressFieldsNl({
								[PostcodeNlAddressFieldMapping.postcode]: address.postcode,
								[PostcodeNlAddressFieldMapping.city]: address.locality,
								[PostcodeNlAddressFieldMapping.street]: address.street,
								[PostcodeNlAddressFieldMapping.streetAndHouseNumber]: address.street + ' ' + address.building,
								[PostcodeNlAddressFieldMapping.houseNumber]: address.buildingNumber,
								[PostcodeNlAddressFieldMapping.houseNumberAddition]: address.buildingNumberAddition,
								[PostcodeNlAddressFieldMapping.houseNumberAndAddition]: address.building,
							});

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
			addressFields = getAddressFields(container),
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
			let province = null;
			if (result.country.iso3Code === 'ESP')
			{
				province = PostcodeNlStateToValueMapping.ESP[result.details.espProvince.name];
			}
			else if(result.country.iso3Code === 'CHE')
			{
				province = PostcodeNlStateToValueMapping.CHE[result.details.cheCanton.name];
			}

			const {address} = result,
				values = {
					[PostcodeNlAddressFieldMapping.street]: address.street,
					[PostcodeNlAddressFieldMapping.houseNumber]: address.buildingNumber || '',
					[PostcodeNlAddressFieldMapping.houseNumberAddition]: address.buildingNumberAddition || '',
					[PostcodeNlAddressFieldMapping.postcode]: address.postcode,
					[PostcodeNlAddressFieldMapping.city]: address.locality,
					[PostcodeNlAddressFieldMapping.streetAndHouseNumber]: result.streetLine,
					[PostcodeNlAddressFieldMapping.houseNumberAndAddition]: address.building,
					[PostcodeNlAddressFieldMapping.province]: province,
				};

			fillAddressFields(addressFields, values);

			storedAddress.set(values, result.mailLines);

			if (addressType === 'billing' && isUseBillingAsShipping())
			{
				storedAddresses.shipping.set(values, result.mailLines);
			}

			$(document.body).trigger('update_checkout');
		};

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
						fillAddressFieldsIntl(result);
						toggleAddressFields(addressFields, true);
						intlField.trigger('address-result', result);

						setFieldValidity(intlField);

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

				intlField[0].addEventListener('autocomplete-select', function (e) {
					if (e.detail.precision === 'Address')
					{
						selectAutocompleteAddress(e.detail);
					}
				});

				intlField[0].addEventListener('autocomplete-error', function (e) {
					console.error('Autocomplete XHR error', e);
					toggleAddressFields(addressFields, true);
					intlField.removeClass(loadingClassName);
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
				intlField.on('change', (e) => e.stopPropagation());
			});
		});

		intlFieldObserver.observe(intlFormRow[0]);

		intlFormRow.toggle(isSupportedCountryIntl(countryToState.val()));

		countryToState.on('change', () => window.setTimeout(() => {
			const isSupported = isSupportedCountryIntl(countryToState.val());
			if (isSupported)
			{
				intlField.val('');
				resetAddressFields(getAddressFields(container));
				storedAddress.clear();
				autocompleteInstance?.reset();
				autocompleteInstance?.setCountry(settings.enabledCountries[countryToState.val()].iso3);
			}

			intlFormRow.toggle(isSupported);
		}));

		// Initialize
		(() => {
			if (false === isSupportedCountryIntl(countryToState.val()))
			{
				return; // Only use values from supported countries.
			}

			const prefilledAddressValues = getPrefilledAddressValues(addressFields);
			if (prefilledAddressValues === null)
			{
				return;
			}

			const {postcode, city, streetAndHouseNumber} = prefilledAddressValues;
			intlField.val(`${postcode} ${city} ${streetAndHouseNumber}`.trim());

			// Check for stored address to use.
			if (
				!storedAddress.isExpired()
				&& storedAddress.isEqual({
					[PostcodeNlAddressFieldMapping.postcode]: prefilledAddressValues.postcode,
					[PostcodeNlAddressFieldMapping.city]: prefilledAddressValues.city,
					[PostcodeNlAddressFieldMapping.streetAndHouseNumber]: prefilledAddressValues.streetAndHouseNumber,
				})
			)
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
		const {street, houseNumber, houseNumberAddition, city, postcode} = address;
		return [
			`${street} ${houseNumber} ${houseNumberAddition ?? ''}`.trim(),
			`${postcode} ${city}`
		];
	};

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

			addressElement.html(getMailLinesNl(result.address).join('<br>'));
			formRow.show();
		});
	};

	const addAutofillIntlBypass = function (container)
	{
		const formRow = container.find('.form-row.postcode-eu-autofill-intl'),
			wrapper = $('<span>', {'class': 'postcode-eu-autofill-intl-bypass'}),
			link = $('<a>', {text: settings.autofillIntlBypassLinkText});

		link.on('click', function () {
			toggleAddressFields(getAddressFields(container), true, true);
			formRow.hide();
			return false;
		});

		wrapper.append(link);
		formRow.append(wrapper);
	};

	const isUseBillingAsShipping = function ()
	{
		if (typeof window.checkout.ship_to_different_address === 'undefined')
		{
			// Return false because there's no shipping form in this case.
			return false;
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
			const data = {timestamp: Date.now(), values, mailLines};
			window.localStorage.setItem(this.storageKey, JSON.stringify(data));
		}

		isEqual(values)
		{
			const storedValues = this.get()?.values;
			return (storedValues ?? false) && Object.entries(values).every(([k, v]) => storedValues[k] === v);
		}

		isExpired()
		{
			const data = JSON.parse(window.localStorage.getItem(this.storageKey));
			return data?.timestamp + 90 * 24 * 60 * 60 * 1000 < Date.now();
		}

		clear()
		{
			window.localStorage.removeItem(this.storageKey);
		}
	}
})();
