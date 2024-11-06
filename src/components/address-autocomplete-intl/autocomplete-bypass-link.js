import { useSelect, useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { VALIDATION_STORE_KEY } from '@woocommerce/block-data';

const AutocompleteBypassLink = ({forId, onClick}) => {
	const validationError = useSelect((select) => select(VALIDATION_STORE_KEY).getValidationError(forId)),
		{clearValidationError} = useDispatch(VALIDATION_STORE_KEY);

	return validationError && !validationError.hidden ? (
		<a className="postcode-eu-autofill-intl-bypass-link"
			onClick={() => {
				clearValidationError(forId);
				onClick();
			}}>
			{__('Enter an address')}
		</a>
	) : null;
}

export default AutocompleteBypassLink;
