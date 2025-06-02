const FormattedOutput = ({formattedAddress}) => {
	return formattedAddress ? (
		<address className="postcode-eu-autofill-address">{formattedAddress}</address>
	) : null;
};

export default FormattedOutput;
