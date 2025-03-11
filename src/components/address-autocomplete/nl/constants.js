export const ADDRESS_LOOKUP_DELAY = 750;
export const POSTCODE_REGEX = /([1-9]\d{3})\s*([A-Z]{2})/i;
export const HOUSE_NUMBER_REGEX = /([1-9]\d{0,4})(\D.*)?$/i;
export const ADDRESS_RESULT_STATUS = Object.freeze({
	VALID: 'valid',
	NOT_FOUND: 'notFound',
	ADDITION_INCORRECT: 'houseNumberAdditionIncorrect',
});
export const ADDITION_PLACEHOLDER_VALUE = '_';
