![Postcode.eu](assets/img/postcode-eu-logo-gradient.svg)

# Postcode.eu International Address API plugin for WooCommerce

Adds autocompletion for addresses to the checkout page. [Multiple countries](https://www.postcode.eu/products/address-api/international) are supported using official postal data via the [Postcode.eu](https://postcode.eu) API.

This plugin has been created by [Postcode.eu](https://postcode.eu).


## Postcode.eu Account

A [Postcode.eu account](https://www.postcode.eu/products/address-api/prices) is required.
Testing is free. After testing you can choose to purchase a subscription.


## How to install

### From this repository

Download the most recent release from [releases](https://github.com/postcode-nl/PostcodeNl_Api_WooCommerce/releases).

In your WordPress administration panel, go to `Plugins > Add New` and click the `Upload Plugin` button at the top of the page.

### How to Use

In your WordPress administration panel go to `Plugins > Installed Plugins` and look for `Postcode.eu Address Validation ` and activate it. Then click on `Settings` to configure the plugin.

### Translations

The plugins texts are in English and Dutch, if you want to translate any of the plugins texts you can find out how to do so here:
[WordPress Localization](https://developer.wordpress.org/plugins/internationalization/localization/)

### Limiting orders from regions of a country

Shipping can be limited by setting up [Shipping Zones in WooCommerce](https://woocommerce.com/document/setting-up-shipping-zones/).

For example, limiting shipping to French overseas territories, set up a shipping zone for France and add a postcode range of 97000...99000. Add specific shipping options, or only local pick up. Make sure the shipping zone is near the top of the list, shipping zones are matched from top to bottom.

### Address form field mapping

Depending on your checkout form fields, the selected address data might not be placed in the fields you would like. The plugin provides the `postcodenl_address_field_mapping` filter to map WooCommerce address fields to address parts returned by the Postcode.eu API.

Add the filter to your theme's `functions.php` file or, preferably, to a custom plugin. The keys are WooCommerce address field names and the values are Postcode.eu address parts. Set a value to `null` when a field should not be populated by the plugin.

Address parts which can be used to populate form fields:

- `street`: Street name without the house number.
- `houseNumber`: House number.
- `houseNumberAddition`: House number addition or suffix.
- `city`: City or locality.
- `postcode`: Postal code.
- `streetAndHouseNumber`: Street name and house number, including any addition.
- `houseNumberAndAddition`: House number and house number addition combined.
- `province`: Province or a similar administrative level, such as a state or canton.

For example, to split the street name and building information over two fields:

```php
add_filter('postcodenl_address_field_mapping', function ($mapping) {
    $mapping['address_1'] = 'street';
    $mapping['address_2'] = 'houseNumberAndAddition';

    return $mapping;
});
```

The default mapping is:

- `address_1` → `streetAndHouseNumber`
- `address_2` → not populated
- `postcode` → `postcode`
- `city` → `city`
- `state` → `province`
- `street_name` → `street`
- `house_number` → `houseNumber`
- `house_number_suffix` → `houseNumberAddition`

> [!WARNING]
> The mapping applies to newly selected and validated addresses in both the classic and block-based WooCommerce checkout. Changing a mapping does not migrate values already stored in WooCommerce carts, checkout sessions, or customer profiles. Existing data may have been saved in the format of the previous mapping. After changing a mapping, clear active WooCommerce customer sessions and review or migrate saved customer addresses as needed.

### WooCommerce block-based checkout

The plugin now has support for the new block-based checkout.

## Third-Party Service Usage

This plugin relies on the Postcode.eu API, a third-party service, for address autocompletion and validation. The use of this service is essential for the plugin's functionality, enabling it to provide accurate address suggestions and validations across multiple countries using official postal data.

- [Terms and Conditions](https://www.postcode.eu/documents/termsandconditions.pdf)
- [Privacy policy](https://www.postcode.eu/privacy)

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


