import { useEffect, useRef, useCallback, useMemo } from '@wordpress/element';
import { settings } from '.';

PostcodeNl.addressDetailsCache ??= new Map();

export function useAutocomplete(inputRef)
{
	const instance = useRef(null);

	const getAddressDetails = useCallback((context) => {
		if (PostcodeNl.addressDetailsCache.has(context))
		{
			return Promise.resolve(PostcodeNl.addressDetailsCache.get(context));
		}

		return new Promise((resolve) => {
			instance.current.getDetails(context, (result) => {
				resolve(result);
				PostcodeNl.addressDetailsCache.set(context, result);
			});
		});
	}, []);

	const search = useCallback((...args) => instance.current.search(inputRef.current, ...args), [inputRef]);

	useEffect(() => {
		instance.current = new PostcodeNl.AutocompleteAddress(inputRef.current, {
			autocompleteUrl: settings.actions.autocomplete,
			addressDetailsUrl: settings.actions.getDetails,
		});

		instance.current.getSuggestions = function (context, term, response)
		{
			const encodedTerm = new TextEncoder().encode(term),
				binaryTerm = Array.from(encodedTerm, (byte) => String.fromCodePoint(byte)).join(''),
				url = this.options.autocompleteUrl
					.replace('${context}', encodeURIComponent(context))
					.replace('${term}', encodeURIComponent(btoa(binaryTerm)));

			return this.xhrGet(`${url}`, response);
		}

		instance.current.getDetails = function (addressId, response)
		{
			const url = this.options.addressDetailsUrl.replace('${context}', encodeURIComponent(addressId));
			return this.xhrGet(url, response);
		}

		return () => instance.current.destroy();
	}, [
		inputRef,
	]);

	return useMemo(() => ({
		instanceRef: instance,
		getAddressDetails,
		search,
	}), [
		instance,
		getAddressDetails,
		search,
	]);
}

export function useStoredAddress(addressType)
{
	return useMemo(() => ({
		storageKey: 'postcode-eu-validated-address-' + addressType,

		get()
		{
			return JSON.parse(window.localStorage.getItem(this.storageKey)) ?? null;
		},

		set({address_1, postcode, city}, mailLines)
		{
			const data = {
				timestamp: Date.now(),
				values: {address_1, postcode, city},
				mailLines: mailLines,
			};
			window.localStorage.setItem(this.storageKey, JSON.stringify(data));
		},

		isEqual(values)
		{
			const storedValues = this.get()?.values;
			return (storedValues ?? false) && Object.entries(storedValues).every(([k, v]) => values[k] === v);
		},

		isExpired()
		{
			const data = JSON.parse(window.localStorage.getItem(this.storageKey));
			return data?.timestamp + 90 * 24 * 60 * 60 * 1000 < Date.now();
		},

		clear()
		{
			window.localStorage.removeItem(this.storageKey);
		},
	}), [
		addressType,
	]);
}
