import clsx from 'clsx';
import { __ } from '@wordpress/i18n';
import { useEffect } from '@wordpress/element';
import { Icon, chevronDown } from '@wordpress/icons';
import { useSelect, useDispatch } from '@wordpress/data';
import { ValidationInputError } from '@woocommerce/blocks-components';
import { VALIDATION_STORE_KEY } from '@woocommerce/block-data';
import { ADDITION_PLACEHOLDER_VALUE } from './constants';

const HouseNumberSelect = ({id, onChange, options = [], value = ADDITION_PLACEHOLDER_VALUE}) => {
	const {setValidationErrors, clearValidationError} = useDispatch(VALIDATION_STORE_KEY);

	const {validationError, validationErrorId} = useSelect(
		(select) => {
			const store = select(VALIDATION_STORE_KEY);
			return {
				validationError: store.getValidationError(id),
				validationErrorId: store.getValidationErrorId(id),
			};
		}
	);

	useEffect(() => {
		if (value === ADDITION_PLACEHOLDER_VALUE)
		{
			setValidationErrors({
				[id]: {
					message: __('Please select a house number', 'postcode-eu-address-validation'),
					hidden: true,
				}
			});
		}
		else
		{
			clearValidationError(id);
		}

		return () => clearValidationError(id);
	}, [
		value,
		id,
		setValidationErrors,
		clearValidationError,
	]);

	const hasError = validationError?.message && !validationError?.hidden;

	return (
		<div className={clsx('postcode-eu-house-number-select', {'has-error': hasError})}>
			<div className="wc-blocks-components-select">
				<div className="wc-blocks-components-select__container">
					<label
						htmlFor={id}
						className="wc-blocks-components-select__label"
					>
						{__('Which house number do you mean?', 'postcode-eu-address-validation')}
					</label>

					<select
						className="wc-blocks-components-select__select"
						id={id}
						onChange={(e) => onChange(e.target.value)}
						value={value}
						aria-invalid={hasError}
						aria-errormessage={validationErrorId}
					>
						<option key={ADDITION_PLACEHOLDER_VALUE} value={ADDITION_PLACEHOLDER_VALUE}>
							{__('Select house number' , 'postcode-eu-address-validation')}
						</option>

						{options.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>

					<Icon className="wc-blocks-components-select__expand" icon={chevronDown} />
				</div>
			</div>

			<ValidationInputError propertyName={id} elementId={id} />
		</div>
	);
}

export default HouseNumberSelect;
