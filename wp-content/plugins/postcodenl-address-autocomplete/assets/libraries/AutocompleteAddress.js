/*!
 * Postcode.nl international address autocompletion
 *
 * https://api.postcode.nl
 *
 * Copyright Postcode.nl
 * Released under the MIT license
 * https://tldrlegal.com/l/mit
 *
 * @author Postcode.nl
 * @version 1.0
 */

var PostcodeNl = PostcodeNl || {};

(function () {
	'use strict';

	const document = window.document,
		$ = function (selector) { return document.querySelectorAll(selector); },
		elementData = new WeakMap(),
		EVENT_NAMESPACE = 'autocomplete-',
		PRECISION_ADDRESS = 'Address',
		KEY_ESC = 'Escape',
		KEY_ENTER = 'Enter',
		KEY_TAB = 'Tab',
		KEY_UP = 'ArrowUp',
		KEY_DOWN = 'ArrowDown',

		/**
		 * Default options.
		 * @type {Object}
		 */
		defaults = Object.create(null, {
			/**
			 * Initial autocomplete context. E.g. a country code "nld", "bel" or "deu" to start searching in that country.
			 * @type {string}
			 */
			context: {
				value: 'nld',
				writable: true,
			},

			/**
			 * URL that will return autocomplete JSON data.
			 * @type {string}
			 */
			autocompleteUrl: {
				value: 'https://api.postcode.eu/int/v1/autocomplete',
				writable: true,
			},

			/**
			 * URL that will return address details JSON data.
			 * @type {string}
			 */
			addressDetailsUrl: {
				value: 'https://api.postcode.eu/int/v1/address',
				writable: true,
			},

			/**
			 * Text to use with tags.
			 * @type {Object}
			 */
			tags: {
				value: {
					'unvalidated-housenumber': '(unknown house number)',
					'unvalidated-housenumber-addition': '(unknown house number addition)',
				},
				writable: true,
			},

			/**
			 * CSS prefix
			 * @type {string}
			 */
			cssPrefix: {
				value: 'postcodenl-autocomplete-',
				writable: true,
			},

			/**
			 * Minimum number of characters typed before a search is performed.
			 * @type {number}
			 */
			minLength: {
				value: 1,
				writable: true,
			},

			/**
			 * Delay in milliseconds between when a keystroke occurs and when a search is performed.
			 * @type {number}
			 */
			delay: {
				value: 300,
				writable: true,
			},

			/**
			 * Which element the menu should be appended to.
			 * @type {string|HTMLElement}
			 */
			appendTo: {
				value: document.body,
				writable: true,
			},

			/**
			 * Focus the first item when the menu is shown.
			 * @type {boolean}
			 */
			autoFocus: {
				value: false,
				writable: true,
			},

			/**
			 * Select the first full address suggestion on blur (if any, and no menu item was selected).
			 * @type {boolean}
			 */
			autoSelect: {
				value: false,
				writable: true,
			},

			/**
			 * Get screen reader text for a successful response with at least one match.
			 * Override this function to translate the message.
			 *
			 * @param {number} count - Number of matches. Will be at least one.
			 * @return {string} Screen reader message based on the number of matches.
			 */
			getResponseMessage: {
				value: function (count)
				{
					let message;

					if (count > 1)
					{
						message = count + ' address suggestions available. ';
					}
					else
					{
						message = 'One address suggestion available. ';
					}

					message += 'Use up and down arrow keys to navigate.';

					return message;
				},
				writable: true,
			},
		});

	/**
	 * The autocomplete menu.
	 *
	 * @constructor
	 * @param {Object} options - Autocomplete options.
	 */
	const Menu = function (options)
	{
		const self = this,
			ul = document.createElement('ul'),
			classNames = {
				menuOpen: options.cssPrefix + 'menu-open',
				itemFocus: options.cssPrefix + 'item-focus',
			},

			/**
			 * Position the menu near an element.
			 *
			 * @param {HTMLElement} element
			 */
			positionTo = function (element)
			{
				const rect = element.getBoundingClientRect();
				ul.style.top = rect.bottom + (window.scrollY || window.pageYOffset) + 'px';
				ul.style.left = rect.left + (window.scrollX || window.pageXOffset) + 'px';
				ul.style.width = rect.width + 'px';
			},

			/**
			 * Move focus to the next or previous menu item and set the input element value.
			 *
			 * @param {boolean} focusNext - Move focus to the next item if true, to previous item otherwise.
			 * @param {boolean} [setValue] - Set the value of the associated input element (optional).
			 */
			moveItemFocus = function (focusNext, setValue)
			{
				const startChild = focusNext? ul.firstElementChild : ul.lastElementChild,
					endChild = focusNext? ul.lastElementChild : ul.firstElementChild;

				if (typeof setValue === 'undefined')
				{
					setValue = true;
				}

				removeItemFocus();

				if (item === null)
				{
					item = startChild;
				}
				else if (item === endChild)
				{
					item = null;
					inputElement.value = inputValue;
					elementData.get(inputElement).context = inputContext;
					return;
				}
				else
				{
					item = (focusNext? item.nextElementSibling : item.previousElementSibling) || startChild;
				}

				item.classList.add(classNames.itemFocus);

				// Update the input element value unless the focus event was cancelled.
				if (setValue && true === inputElement.dispatchEvent(new CustomEvent(EVENT_NAMESPACE + 'focus', {cancelable: true})))
				{
					const data = elementData.get(item);

					inputElement.value = data.value;
					elementData.get(inputElement).context = data.context;
				}
			},

			/**
			 * Remove the item focus CSS class from the active item, if any.
			 */
			removeItemFocus = function ()
			{
				if (item !== null)
				{
					item.classList.remove(classNames.itemFocus);
				}
			};

		let isOpen = false,
			isMousedown = false,
			item = null,
			inputElement,
			inputValue,
			inputContext;

		Object.defineProperties(this, {
			id: {
				get: function () {
					return ul.id;
				},
			},
			isOpen: {
				get: function () {
					return isOpen;
				},
			},
			isMousedown: {
				get: function () {
					return isMousedown;
				},
			},
			hasFocus: {
				get: function () {
					return item !== null;
				},
			},
		});

		ul.classList.add(options.cssPrefix + 'menu');

		ul.addEventListener('mouseover', function (e) {
			if (e.target === ul)
			{
				return;
			}

			removeItemFocus();

			let target = e.target;

			while (target.parentElement !== ul)
			{
				target = target.parentElement;
			}

			item = target;
			item.classList.add(classNames.itemFocus);
		});

		ul.addEventListener('mouseout', function () {
			removeItemFocus();
			item = null;
		});

		ul.addEventListener('mousedown', function () {
			isMousedown = true;
		});

		ul.addEventListener('click', function (e) {
			e.preventDefault();

			if (item !== null)
			{
				self.select();
			}

			isMousedown = false;
		});

		// Add the menu to the page.
		if (HTMLElement.prototype.isPrototypeOf(options.appendTo))
		{
			options.appendTo.appendChild(ul);
		}
		else
		{
			(document.querySelector(options.appendTo) || document.body).appendChild(ul);
		}

		/**
		 * Render a list item for each match and map the match to the li element.
		 *
		 * @param {Object[]} matches - Matches from the autocomplete response.
		 * @param {Function} renderItem - Function to create a list item and add it to the menu element.
		 */
		this.setItems = function (matches, renderItem)
		{
			ul.innerHTML = '';

			for (let i = 0, li, match; match = matches[i++];)
			{
				li = renderItem(ul, match);
				elementData.set(li, match);
			}

			item = null;
		}

		/**
		 * Open the menu (if it has items).
		 *
		 * @param {HTMLElement} element - Associated input element.
		 */
		this.open = function (element)
		{
			inputElement = element;
			inputValue = inputElement.value;
			inputContext = elementData.get(inputElement).context;

			if (isOpen || ul.children.length === 0)
			{
				return;
			}

			positionTo(inputElement);
			ul.classList.add(classNames.menuOpen);
			isOpen = true;
			inputElement.dispatchEvent(new CustomEvent(EVENT_NAMESPACE + 'open'));

			if (options.autoFocus)
			{
				this.focusNext(false);
			}
		}

		/**
		 * Close the menu.
		 *
		 * @param {boolean} [restoreValue] Restore input element value and context if true.
		 */
		this.close = function (restoreValue)
		{
			if (!isOpen)
			{
				return;
			}

			if (restoreValue)
			{
				inputElement.value = inputValue;
				elementData.get(inputElement).context = inputContext;
			}

			removeItemFocus();
			item = null;
			ul.classList.remove(classNames.menuOpen);
			isOpen = false;
			inputElement.dispatchEvent(new CustomEvent(EVENT_NAMESPACE + 'close'));
		}

		/**
		 * Toggle the menu based on the specified state.
		 *
		 * @param {HTMLElement} element - Associated input element.
		 * @param {boolean} state - Open the menu if true, close otherwise.
		 */
		this.toggle = function (element, state)
		{
			if (state)
			{
				this.open(element);
			}
			else
			{
				this.close();
			}
		}

		/**
		 * Focus the previous menu item.
		 */
		this.focusPrevious = moveItemFocus.bind(this, false);

		/**
		 * Focus the next menu item.
		 */
		this.focusNext = moveItemFocus.bind(this, true);

		/**
		 * Select the active menu item, update and focus the associated input element, then close the menu.
		 */
		this.select = function ()
		{
			const selectedMatch = elementData.get(item);

			// Update the input element value unless the select event was cancelled.
			if (true === inputElement.dispatchEvent(new CustomEvent(EVENT_NAMESPACE + 'select', {detail: selectedMatch, cancelable: true})))
			{
				inputElement.value = selectedMatch.value;
			}

			inputElement.focus();
			this.close();
		}
	}

	/**
	 * @constructor
	 * @param {HTMLElement|NodeList|string} elementsOrSelector - Element(s) or CSS selector string for element(s) to be used as autocomplete input.
	 * @param {Object} options - Options to override the defaults. @see PostcodeNl~defaults.
	 */
	this.AutocompleteAddress = function (elementsOrSelector, options)
	{
		let inputElements,
			searchTimeoutId = null,
			previousValue = null,
			previousContext = null,
			matches = [];

		if (typeof elementsOrSelector === 'string')
		{
			inputElements = $(elementsOrSelector);
		}
		else if (HTMLElement.prototype.isPrototypeOf(elementsOrSelector))
		{
			inputElements = [elementsOrSelector];
		}
		else if (NodeList.prototype.isPrototypeOf(elementsOrSelector))
		{
			inputElements = elementsOrSelector;
		}
		else
		{
			throw new TypeError('Element(s) or selector has invalid type. Use HTMLElement, NodeList or valid CSS selector string.');
		}

		if (inputElements.length === 0)
		{
			return;
		}

		const self = this;

		// Create options object that inherits from defaults.
		options = extend(Object.create(defaults), options);

		// Expose options.
		Object.defineProperty(this, 'options', {
			get: function () {
				return options;
			},
		});

		// Add menu instance.
		const menu = new Menu(options);

		// Create an ARIA live region for screen readers.
		// See https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions
		const liveRegion = document.createElement('div');
		liveRegion.id = getUniqueId('aria-live-region');
		liveRegion.setAttribute('aria-role', 'status');
		liveRegion.setAttribute('aria-live', 'assertive');
		liveRegion.classList.add(options.cssPrefix + liveRegion.id);
		document.body.appendChild(liveRegion);

		/**
		 * Announce screen reader text via the live region.
		 *
		 * @param {string} str - Text to announce.
		 */
		this.announce = function (str)
		{
			liveRegion.innerHTML = '<div>' + str + '</div>';
		}

		/**
		 * @callback successCallback
		 * @param {Object} Callback function to handle a succesful XMLHttpRequest response.
		 */

		/**
		 * Create an XMLHttpRequest GET request.
		 *
		 * @param {string} url - URL to which the request is sent.
		 * @param {Object} data - Parameters to send with the request.
		 * @param {successCallback} success - Function that is executed if the request succeeds.
		 * @return {XMLHttpRequest} Object representing the eventual completion/failure of the request, and its resulting value.
		 */
		this.xhrGet = function (url, data, success)
		{
			const xhr = new XMLHttpRequest(),
				params = [];

			xhr.addEventListener('load', function () {
				if (this.status === 200)
				{
					success.call(this, JSON.parse(xhr.response));
				}
			});

			for (let i in data)
			{
				params.push(i + '=' + encodeURIComponent(data[i]));
			}

			xhr.open('GET', url + (params.length > 0 ? '?' + params.join('&') : ''));
			xhr.setRequestHeader('X-Autocomplete-Session', getSessionId());
			xhr.send();

			return xhr;
		}

		/**
		 * Get autocomplete matches for the specified context and term.
		 *
		 * @see {@link https://api.postcode.nl/documentation/int/v1/Address/autocomplete}
		 * @param {string} context - A place identifier denoting the context to search in. e.g. “nld”.
		 * @param {string} term - The search query to process. e.g. “2012ES”, “Haarlem”, “Julian”.
		 * @param {successCallback} response - Function that handles the response.
		 * @return {XMLHttpRequest} @see PostcodeNl.AutocompleteAddress.xhrGet.
		 */
		this.getSuggestions = function (context, term, response)
		{
			return this.xhrGet(this.options.autocompleteUrl + '/' + context + '/' + encodeURIComponent(term), {}, response);
		}

		/**
		 * Get address details for the specified address identifier.
		 *
		 * @see {@link https://api.postcode.nl/documentation/int/v1/Address/getDetails}
		 * @param {string} addressId - Address identifier returned by a match of precision “Address”.
		 * @param {string} [dispatchCountry] - Dispatching country ISO3 code, used to determine country address line presence and language.
		 * If not given, country is not added in mailLines.
		 * @param {successCallback} response - Function that handles the response.
		 * @return {XMLHttpRequest} @see PostcodeNl.AutocompleteAddress.xhrGet.
		 */
		this.getDetails = function (addressId)
		{
			let dispatchCountry = null,
				response = arguments[1];

			let params = [encodeURIComponent(addressId)];

			if (arguments.length === 3)
			{
				dispatchCountry = arguments[1];
				response = arguments[2];
				params.push(encodeURIComponent(dispatchCountry));
			}

			return this.xhrGet(this.options.addressDetailsUrl + '/' + params.join('/'), {}, response);
		}

		/**
		 * Method that controls the creation of each menu item.
		 *
		 * @param {HTMLElement} ul - Element that the newly created list item must be appended to.
		 * @param {Object} item - Single autocomplete item.
		 * @return {HTMLElement} List item element containing an autocomplete match.
		 */
		this.renderItem = function (ul, item)
		{
			const li = document.createElement('li');
			li.classList.add(this.options.cssPrefix + 'item');
			li.innerHTML = this.highlight(item.label, item.highlights);

			if (item.precision !== PRECISION_ADDRESS)
			{
				li.classList.add(this.options.cssPrefix + 'item-more');
			}

			if (item.description)
			{
				let span = document.createElement('span');
				span.textContent = item.description;
				span.classList.add(this.options.cssPrefix + 'item-description');
				li.appendChild(span);
			}

			if (item.tags)
			{
				for (let i = 0, tag; tag = item.tags[i++];)
				{
					let em = document.createElement('em');
					em.textContent = this.options.tags[tag];
					em.classList.add(this.options.cssPrefix + 'item-tag');
					li.appendChild(em);
				}
			}

			ul.appendChild(li);
			return li;
		}

		/**
		 * Highlight matched portions in the item label.
		 *
		 * @param {string} str - Item label to highlight.
		 * @param {Array.Array.<number>} indices - Array of character offset pairs.
		 * @return {string} Highlighted string (using "mark" elements).
		 */
		this.highlight = function (str, indices)
		{
			if (indices.length === 0)
			{
				return str;
			}

			var i = 0,
				start = 0,
				end = 0,
				result = [],
				pair;

			while (pair = indices[i++])
			{
				result.push(str.slice(end, pair[0]));
				start = pair[0];
				end = pair[1];
				result.push('<mark>' + str.slice(start, end) + '</mark>');
			}

			result.push(str.slice(end));
			return result.join('');
		}

		/**
		 * Set the country to start searching in.
		 *
		 * @param {string} iso3Code ISO 3166-1 alpha-3 country code.
		 */
		this.setCountry = function (iso3Code)
		{
			options.context = iso3Code.toLowerCase();

			for (let i = 0, element; element = inputElements[i++];)
			{
				elementData.get(element).context = options.context;
			}
		}

		Array.prototype.forEach.call(inputElements, function (element) {
			let isKeyEvent = false;

			// Map match and context to this element.
			elementData.set(element, {
				match: {},
				context: options.context,
			});

			element.spellcheck = false;
			element.autocomplete = 'off';
			element.setAttribute('aria-controls', liveRegion.id);
			element.classList.add(options.cssPrefix + 'address-input');

			element.addEventListener('keydown', function (e) {
				isKeyEvent = true;

				switch (e.key)
				{
					case KEY_UP:
						if (menu.isOpen)
						{
							menu.focusPrevious();
						}
						else
						{
							search(this);
						}

						e.preventDefault();
						break;

					case KEY_DOWN:
						if (menu.isOpen)
						{
							menu.focusNext();
						}
						else
						{
							search(this);
						}

						e.preventDefault();
						break;

					case KEY_ESC:
						menu.close(true);
						break;

					case KEY_TAB:
					case KEY_ENTER:
						if (menu.hasFocus)
						{
							menu.select();
							e.preventDefault();
						}
						break;

					default:
						searchDebounced(this);
				}
			});

			element.addEventListener('input', function (e) {
				// Skip key event to prevent searching twice.
				if (isKeyEvent)
				{
					isKeyEvent = false;
					return;
				}

				searchDebounced(this);
			});

			element.addEventListener('focus', function () {
				const data = elementData.get(this);

				// Trigger search if the address is incomplete.
				if (typeof data.match.precision === 'undefined' || data.match.precision !== PRECISION_ADDRESS)
				{
					search(this);
				}
			});

			element.addEventListener('click', function () {
				if (this.value.length >= options.minLength)
				{
					menu.open(this);
				}
			});

			element.addEventListener(EVENT_NAMESPACE + 'select', function (e) {
				const data = elementData.get(this);

				data.match = e.detail;

				if (e.detail.precision === PRECISION_ADDRESS)
				{
					// Update the previous value to prevent opening the menu on focus for an address that is already complete.
					previousValue = e.detail.value;
				}
				else
				{
					data.context = e.detail.context;
					window.setTimeout(search, 0, this);
				}
			});

			element.addEventListener('blur', function () {
				if (menu.isMousedown)
				{
					return;
				}

				const data = elementData.get(this);
				window.clearTimeout(searchTimeoutId);
				menu.close();

				if (options.autoSelect && typeof data.match.context === 'undefined')
				{
					// Get first full address from matches, if any.
					for (let i = 0, m; m = matches[i++];)
					{
						if (m.precision === PRECISION_ADDRESS)
						{
							this.value = m.value;
							this.dispatchEvent(new CustomEvent(EVENT_NAMESPACE + 'select', {detail: m}));
							break;
						}
					}
				}
			});
		});

		/**
		 * Search after input has stopped arriving for the amount of milliseconds specified by options.delay.
		 *
		 * @param {HTMLElement} element - Associated input element.
		 */
		const searchDebounced = function (element)
		{
			window.clearTimeout(searchTimeoutId);
			searchTimeoutId = window.setTimeout(search, options.delay, element);
		}

		/**
		 * Search for address matches and toggle the menu based on the result.
		 *
		 * @param {HTMLElement} element - Associated input element.
		 */
		const search = function (element)
		{
			if (element.value.length < options.minLength)
			{
				menu.close();
				return;
			}

			const data = elementData.get(element);

			if (element.value === previousValue && data.context === previousContext)
			{
				menu.open(element);
				return;
			}

			const hasSubstring = previousValue !== null && (element.value.indexOf(previousValue) === 0 || previousValue.indexOf(element.value) === 0);
			previousValue = element.value;
			previousContext = data.context;
			data.match = {};

			// Trigger the search event. Cancel this event to prevent the request for address suggestions.
			if (false === element.dispatchEvent(new CustomEvent(EVENT_NAMESPACE + 'search', {cancelable: true})))
			{
				return;
			}

			element.classList.add(options.cssPrefix + 'loading');

			const xhr = self.getSuggestions.call(self, data.context, element.value, function (matches) {
				// Trigger the response event. Cancel this event to prevent rendering address suggestions.
				if (true === element.dispatchEvent(new CustomEvent(EVENT_NAMESPACE + 'response', {detail: matches, cancelable: true})))
				{
					if (hasSubstring && matches.length === 0)
					{
						menu.open(element);
						return;
					}

					menu.setItems(matches, self.renderItem.bind(self));
					menu.toggle(element, matches.length > 0)
					self.announce(options.getResponseMessage(matches.length));
				}
			});

			xhr.addEventListener('error', function (e) {
				// Trigger an error event for failed requests.
				element.dispatchEvent(new CustomEvent(EVENT_NAMESPACE + 'error', {detail: e}));
			});

			xhr.addEventListener('loadend', function (e) { // All three load-ending conditions (abort, load, or error).
				element.classList.remove(options.cssPrefix + 'loading');
			});
		}
	}

	// Expose plugin defaults.
	Object.defineProperty(this.AutocompleteAddress, 'defaults', {
		get: function () {
			return defaults;
		},
	});

	/**
	 * Get a random session identifier.
	 *
	 * @return {string} Cached session identifier.
	 */
	const getSessionId = (function () {
		const length = 32,
			randomIntegers = new Uint8Array(length),
			randomCharacters = [],
			characterSet = '0123456789abcdef';

		(window.crypto || window.msCrypto).getRandomValues(randomIntegers);

		for (let i = 0, j = characterSet.length; i < length; i++)
		{
			randomCharacters.push(characterSet[randomIntegers[i] % j]);
		}

		const id = randomCharacters.join('');

		return function () {
			return id;
		};
	})();

	/**
	 * Get a unique element identifier.
	 *
	 * @param {string} id - Element identifier.
	 * @return {string} Element identifier, with numeric suffix if the original identifier is already in use.
	 */
	const getUniqueId = function (id)
	{
		let i = 2,
			result = id;

		while (document.getElementById(result) !== null)
		{
			result = id + '-' + i;
			i++;
		}

		return result;
	}

	/**
	 * Basic object extension method.
	 *
	 * @param {Object} target
	 * @param {Object} source
	 * @return {Object} target
	 */
	const extend = function (target, source)
	{
		for (let prop in source)
		{
			target[prop] = source[prop];
		}

		return target;
	}

	if (typeof window.CustomEvent !== 'function')
	{
		/**
		 * Fix CustomEvent in IE11.
		 *
		 * @param {string} event - DOMString representing the name of the event.
		 * @param {Object} [params] - Optional dictionary that emulates CustomEventInit.
		 * @return {Event} Custom event.
		 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent#Polyfill}
		 */
		const CustomEvent = function (event, params)
		{
			params = params || {bubbles: false, cancelable: false, detail: null};
			var evt = document.createEvent('CustomEvent');
			evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
			return evt;
		}

		window.CustomEvent = CustomEvent;
	}

}).apply(PostcodeNl);

