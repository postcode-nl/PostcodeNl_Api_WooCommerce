Postcode.nl International Address API plugin for WooCommerce
=============

Adds autocompletion for addresses to the checkout page. Multiple countries are supported using official postal data via the [Postcode.nl](https://postcode.nl) API.

This module has been created by [Postcode.nl](https://postcode.nl).


How to install
=============

### From this repository

Download the most recent release from [releases](https://github.com/postcode-nl/PostcodeNl_Api_WooCommerce/releases).

In your WordPress administration panel, go to `Plugins > Add New` and click the `Upload Plugin` button at the top of the page.

## How to Use

In your WordPress administration panel go to `Plugins > Installed Plugins` and look for `Postcode.nl Address Autocomplete` and activate it. Then click on `Settings` to configure the plugin.

## Translations

The plugins texts are in English, if you want to translate any of the plugins texts you can find out how to do so here:
[WordPress Localization](https://developer.wordpress.org/plugins/internationalization/localization/)

## Address form field mapping

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

Postcode.nl Account
=============

A [Postcode.nl account](https://www.postcode.nl/en/services/adresdata/producten-overzicht) is required.
Testing is free. After testing you can choose to purchase a subscription. 


License
=============

The code is available under the Simplified BSD License, see the included LICENSE file.
