const FormattedOutput = ({addressDetails}) => {
	return addressDetails?.mailLines ? (
		<address className="postcode-eu-autofill-address">{addressDetails.mailLines.join('\n')}</address>
	) : null;
}

export default FormattedOutput;
