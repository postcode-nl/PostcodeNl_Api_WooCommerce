import { useSelect, useDispatch } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { VALIDATION_STORE_KEY } from '@woocommerce/block-data';
import { Icon, edit as editIcon } from '@wordpress/icons';

const AutocompleteBypass = ({forId, onClick}) => {
	const validationError = useSelect((select) => select(VALIDATION_STORE_KEY).getValidationError(forId)),
		{clearValidationError} = useDispatch(VALIDATION_STORE_KEY);

	return validationError && !validationError.hidden ? (
		<span className="postcode-eu-autofill-intl-bypass">
			<Icon icon={editIcon} />

			<a onClick={() => {
				clearValidationError(forId);
				onClick();
			}}>
				{__('Enter an address')}
			</a>
		</span>
	) : null;
}

export default AutocompleteBypass;
