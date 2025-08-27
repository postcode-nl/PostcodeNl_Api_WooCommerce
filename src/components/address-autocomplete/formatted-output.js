import { Icon, closeSmall } from '@wordpress/icons';

const FormattedOutput = ({formattedAddress, reset}) => {
	return formattedAddress ? (
		<div className="postcode-eu-autofill-address-wrapper">
			<span className="postcode-eu-autofill-address-reset" onClick={reset}>
				<Icon icon={closeSmall} size="20" />
			</span>
			<address className="postcode-eu-autofill-address">{formattedAddress}</address>
		</div>
	) : null;
};

export default FormattedOutput;
