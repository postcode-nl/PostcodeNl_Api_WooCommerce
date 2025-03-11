import { useEffect, useRef, useCallback } from 'react';
import { settings } from '..';

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

	const search = useCallback((...args) => instance.current.search(inputRef.current, ...args), []);

	useEffect(() => {
		instance.current = new PostcodeNl.AutocompleteAddress(inputRef.current, {
			autocompleteUrl: settings.autocomplete,
			addressDetailsUrl: settings.getDetails,
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
		inputRef
	]);

	return {
		get instance() { return instance.current },
		getAddressDetails,
		search,
	};
}
