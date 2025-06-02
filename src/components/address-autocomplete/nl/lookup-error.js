import { Icon, cautionFilled as warningIcon} from '@wordpress/icons';
import { useSelect } from '@wordpress/data';
import { VALIDATION_STORE_KEY } from '@woocommerce/block-data';

const LookupError = ({id}) => {
	const {error, errorId} = useSelect(
		(select) => {
			const store = select(VALIDATION_STORE_KEY);
			return {
				error: store.getValidationError(id),
				errorId: store.getValidationErrorId(id),
			};
		}
	);

	if (error?.hidden || !error?.message)
	{
		return null;
	}

	return (
		<div className="postcode-eu-address-lookup-error" role="alert">
			<p id={errorId}>
				<Icon icon={warningIcon} />
				<span>{error.message}</span>
			</p>
		</div>
	);
};

export default LookupError;
