![Postcode.eu](assets/img/postcode-eu-logo-gradient.svg)

# Postcode.eu International Address API plugin for WooCommerce

Adds autocompletion for addresses to the checkout page. [Multiple countries](https://www.postcode.nl/services/adresdata/internationaal) are supported using official postal data via the [Postcode.eu](https://postcode.eu) API.

This plugin has been created by [Postcode.eu](https://postcode.eu).


## Postcode.eu Account

A [Postcode.eu account](https://www.postcode.nl/en/services/adresdata/producten-overzicht) is required.
Testing is free. After testing you can choose to purchase a subscription.


## How to install

### From this repository

Download the most recent release from [releases](https://github.com/postcode-nl/PostcodeNl_Api_WooCommerce/releases).

In your WordPress administration panel, go to `Plugins > Add New` and click the `Upload Plugin` button at the top of the page.

### How to Use

In your WordPress administration panel go to `Plugins > Installed Plugins` and look for `Postcode.nl Address Autocomplete` and activate it. Then click on `Settings` to configure the plugin.

### Translations

The plugins texts are in English and Dutch, if you want to translate any of the plugins texts you can find out how to do so here:
[WordPress Localization](https://developer.wordpress.org/plugins/internationalization/localization/)

### Limiting orders from regions of a country

Shipping can be limited by setting up [Shipping Zones in WooCommerce](https://woocommerce.com/document/setting-up-shipping-zones/).

For example, limiting shipping to French overseas territories, set up a shipping zone for France and add a postcode range of 97000...99000. Add specific shipping options, or only local pick up. Make sure the shipping zone is near the top of the list, shipping zones are matched from top to bottom.

### Address form field mapping

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

### WooCommerce block-based checkout
The plugin is currently not compatible with the new block-based checkout. We are working on ensuring compatibility for a future version. In the meantime, we recommend using the classic checkout with our plugin.

## Third-Party Service Usage

This plugin relies on the Postcode.eu API, a third-party service, for address autocompletion and validation. The use of this service is essential for the plugin's functionality, enabling it to provide accurate address suggestions and validations across multiple countries using official postal data.

- [Terms and Conditions](https://documentatie.postcode.nl/termsandconditions.pdf)
- [Privacy policy](https://www.postcode.nl/en/privacy)

### API Usage Context

- The service is used during the checkout process to offer address autocompletion suggestions to the user.
- The plugin communicates with the Postcode.eu API servers to retrieve address data based on the input provided by the user.
- A valid Postcode.eu account is required to access the API services.

For more details on the Postcode.eu API and how to obtain an account, please visit [Postcode.eu](https://postcode.eu).

## Address API documentation

You can find our API documentation at https://developer.postcode.eu/documentation.

## FAQ and Knowledge Base

* View Frequently Asked Questions at https://www.postcode.eu/#faq.
* For more questions and answers, see https://kb.postcode.nl/help.
* If the above didn't answer your question, [contact us](https://www.postcode.eu/contact).

## License

The code is available under the Simplified BSD License, see the included LICENSE file.


