=== Postcode.eu Address Validation ===
Contributors: postcodenl
Tags: address validation, address autocomplete, postcode api, address api, postcode check
Stable tag: 2.3.2
Tested up to: 6.5
License: FreeBSD license
License URI: https://directory.fsf.org/wiki/License:BSD-2-Clause-FreeBSD

Address autocomplete and validation using the Postcode.eu API. Supports both Dutch and international addresses.

== Description ==

Postcode.eu Address validation provides address autocomplete and validation with an easy to implement API. The API offers addresses from several European countries, and more countries are constantly being added. We only work with official sources such as postal companies and governments to ensure high quality and accurate data that is up to date.

The Postcode.eu Address Validation plugin uses the Dutch Postcode API and International Address API to streamline the checkout process. By offering autocomplete suggestions for both Dutch and international addresses, it simplifies address input for customers. This functionality helps improve the accuracy of deliveries, reduce return rates due to incorrect addresses, and increase overall customer satisfaction. The result is a more efficient e-commerce operation with a higher conversion rate.

= Features =
* **Address Autocompletion**: This feature drastically reduces the time and effort required to enter addresses, offering autofill suggestions as your customer types, applicable for both Dutch and international addresses.
* **Flexible Dutch Address Completion**: Choose to autocomplete Dutch addresses based on postcode and house number, or utilize the single field input feature for an even smoother process.
* **Europe-Wide Coverage**: Enjoy access to all supported countries within Europe with a single subscription, expanding the reach of your e-commerce business. View a full list of supported countries here.
* **Data Accuracy**: Our plugin draws on official, up-to-date sources such as national cadastre and postal companies, ensuring all address data is precise and accurate.
* **Risk-Free Testing**: Try out our API for free and without obligations, enabling you to see firsthand the benefits it can bring to your WooCommerce platform.
* **Typo Recognition**: The plugin uses smart technology to detect and correct spelling errors, preventing wrong entries from being saved in your system.
* **Formatted Address Output**: Choose to display an easy-to-read address for your customers, offering a clear and streamlined look instead of the standard address fields.
* **Manual Input Option**: Gives customers the freedom to bypass autocomplete and manually enter their address if they prefer, ensuring the checkout process is tailored to everyone's comfort level.
* **Privacy Protection**: There are no hidden tracking elements and your data is never resold.
* **Regular Updates**: Our system stays current with regular updates to supported countries, ensuring your business remains global without any extra effort.

= Account and Pricing =

To use the Postcode.eu Address Validation plugin, a separate account is required. Register your account at [account.postcode.eu](https://account.postcode.eu). You can test our service for free. After testing and implementing, you indicate that the subscription can start and you make the choice for a subscription. For information on pricing, [visit our website](https://www.postcode.nl/en/services/adresdata/api-prijzen).

== Screenshots ==

1. A single field for address entry
2. To allow users to skip the autocomplete field and manually enter an address, there's an option to add a link to manual address entry
3. Get a Dutch address by postcode and house number. In this example asking the user to select from valid house number additions
4. A formatted address is shown when the postcode and house number combination is valid

== Installation ==

= Limiting orders from regions of a country =

Shipping can be limited by setting up [Shipping Zones in WooCommerce](https://woocommerce.com/document/setting-up-shipping-zones/).

For example, limiting shipping to French overseas territories, set up a shipping zone for France and add a postcode range of 97000...99000. Add specific shipping options, or only local pick up. Make sure the shipping zone is near the top of the list, shipping zones are matched from top to bottom.

= Address form field mapping =

Depending on your checkout form fields the selected address data might not be placed in the form fields you would like.
The mapping from form field names to address data is defined in [addressFieldMapping.js](https://github.com/postcode-nl/PostcodeNl_Api_WooCommerce/blob/master/assets/js/addressFieldMapping.js).
By changing `PostcodeNlAddressFieldMapping.mapping` you can assign your own preferred address data parts to their respective form fields.

An example of a mapping where `_address_1` is used for the street, `_house_number` for the house number `_address_2` for the house number addition:
```javascript
PostcodeNlAddressFieldMapping.mapping = {
	'_address_1': PostcodeNlAddressFieldMapping.street,
	'_house_number': PostcodeNlAddressFieldMapping.houseNumber,
	'_address_2': PostcodeNlAddressFieldMapping.houseNumberAddition,
	'_postcode': PostcodeNlAddressFieldMapping.postcode,
	'_city': PostcodeNlAddressFieldMapping.city,
};
```
To use this mapping replace `PostcodeNlAddressFieldMapping.mapping = {...};` with the code above.

== Third-Party Service Usage ==

This plugin relies on the Postcode.eu API, a third-party service, for address autocompletion and validation. The use of this service is essential for the plugin's functionality, enabling it to provide accurate address suggestions and validations across multiple countries using official postal data.

- [Terms and Conditions](https://documentatie.postcode.nl/termsandconditions.pdf)
- [Privacy policy](https://www.postcode.nl/en/privacy)

=== API Usage Context ===

- The service is used during the checkout process to offer address autocompletion suggestions to the user.
- The plugin communicates with the Postcode.eu API servers to retrieve address data based on the input provided by the user.
- A valid Postcode.eu account is required to access the API services.

For more details on the Postcode.eu API and how to obtain an account, please visit [Postcode.eu](https://postcode.eu).

== Frequently Asked Questions ==

* View Frequently Asked Questions at https://www.postcode.eu/#faq.
* For more questions and answers, see https://kb.postcode.nl/help.
* If the above didn't answer your question, [contact us](https://www.postcode.eu/contact).

== Changelog ==

= 2.3.2 =
* Fixed issue with autocompleting from a prefilled address having multiple matches.

= 2.3.1 =
* Fix wrong number of parameters to vprintf.
* Fix nonce verification.
* Rename text domain to match plugin slug.

= 2.3.0 =
* Clarify licensing and third-party service usage.
* Security enhancements such as input sanitization and output escaping.
* Updated translations (see upgrade notice).

= 2.2.0 =
* Update autocomplete library to version 1.4.0.
* Replace curl with WP native methods.
* Other minor fixes.

== Upgrade Notice ==

= 2.3.1 =
* The text domain is renamed to match the plugin slug. This may require activating the plugin again. If you have added or customized translations for this plugin, then these will have to use the new text domain as well.

= 2.3.0 =
* This update includes changes to translatable strings due to enhancements in output escaping for improved security and code standards compliance. If you have customized or translated these strings, please review and update them accordingly.
