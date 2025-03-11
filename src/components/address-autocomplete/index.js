import { getSetting } from '@woocommerce/settings';
const settings = getSetting('postcode-eu-address-validation_data');

export { settings }
export * from './intl'
export * from './nl'
export { default as FormattedOutput } from './formatted-output';
