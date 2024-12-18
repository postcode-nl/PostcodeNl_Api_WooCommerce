(()=>{"use strict";const e=window.wc.blocksCheckout,t=JSON.parse('{"$schema":"https://schemas.wp.org/trunk/block.json","apiVersion":3,"name":"postcode-eu-address-validation/billing-address-autocomplete-intl","version":"1.0.0","title":"International Address Autocomplete","category":"woocommerce","description":"Autocomplete international addresses using the Postcode.eu API.","example":{},"parent":["woocommerce/checkout-billing-address-block"],"attributes":{"lock":{"type":"object","default":{"remove":true,"move":true}}},"textdomain":"postcode-eu-address-validation"}'),s=window.React,r=window.wp.data,o=window.wc.wcBlocksData,n=window.wp.element,a=window.wc.wcSettings,d=window.wp.i18n,c=window.wc.blocksComponents;var l,i;const u=(0,a.getSetting)("postcode-eu-address-validation_data"),p=(e,t,s)=>{let r=t,o=s;return u.reverseStreetLineCountries.includes(e)&&([r,o]=[o,r]),`${r} ${o}`.trim()};null!==(i=(l=PostcodeNl).addressDetailsCache)&&void 0!==i||(l.addressDetailsCache=new Map);const m=({id:e,addressType:t,address:a,setAddress:l,setAddressDetails:i})=>{const m=(0,n.useRef)(null),E=(0,n.useRef)(a),f=(0,n.useRef)(""),g=(0,n.useRef)(null),[h,_]=(0,n.useState)(!0),[v,w]=(0,n.useState)(null),[A,y]=(0,n.useState)(!1),[C,b]=(0,n.useState)(""),{setValidationErrors:S,clearValidationError:D}=(0,r.useDispatch)(o.VALIDATION_STORE_KEY),{validationError:I,validationErrorId:T}=(0,r.useSelect)((t=>{const s=t(o.VALIDATION_STORE_KEY);return{validationError:s.getValidationError(e),validationErrorId:s.getValidationErrorId(e)}}));(0,n.useEffect)((()=>{E.current=a}),[a]);const k=(0,n.useCallback)((()=>{l({...E.current,address_1:"",city:"",postcode:""}),i(null)}),[l,i]),R=(0,n.useRef)(k),O=(0,n.useCallback)(((s=!0)=>{["address_1","city","postcode"].every((e=>void 0===(0,r.select)(o.VALIDATION_STORE_KEY).getValidationError(`${t}_${e}`)))?D(e):S({[e]:{message:(0,d.__)("Please enter an address and select it.","postcode-eu-address-validation"),hidden:s}})}),[e,D,S]),L=(0,n.useCallback)(((e,t)=>{PostcodeNl.addressDetailsCache.has(e)?t(PostcodeNl.addressDetailsCache.get(e)):g.current.getDetails(e,(s=>{t(s),PostcodeNl.addressDetailsCache.set(e,s)}))}),[]),N=(0,n.useCallback)((e=>{w(!0),L(e.context,(e=>{const{locality:t,street:s,postcode:r,building:o}=e.address;l({...E.current,address_1:p(e.country.iso2Code,s,o),city:t,postcode:r}),i(e),O(!1),w(!1)}))}),[w,l,i,O]),V=(0,n.useCallback)((()=>{m.current.addEventListener("autocomplete-response",(e=>{const t=e.detail.matches;1===t.length&&"Address"===t[0].precision?N(t[0]):O(!0)}),{once:!0}),g.current.search(m.current,{term:f.current,showMenu:!1})}),[N,O]);(0,n.useEffect)((()=>{h&&(_(!1),f.current=["postcode","city","address_1","address_2"].map((e=>E.current[e])).join(" ").trim(),b(f.current),m.current.addEventListener("autocomplete-select",(e=>{b(e.detail.value),e.preventDefault(),"Address"===e.detail.precision&&N(e.detail)})),m.current.addEventListener("autocomplete-search",k),m.current.addEventListener("autocomplete-error",(()=>{w(!1),S({[e]:{message:(0,d.__)("An error has occurred while retrieving address data. Please contact us if the problem persists.","postcode-eu-address-validation"),hidden:!1}})})),m.current.addEventListener("autocomplete-open",(()=>y(!0))),m.current.addEventListener("autocomplete-close",(()=>y(!1))))}),[h,_,b,i,k,w,S,y]),(0,n.useEffect)((()=>{var t,s;if(s=a.country,void 0===u.enabledCountries[s])return void D(e);const n=u.enabledCountries[a.country];null===g.current?(g.current=function(e,t){const s=new PostcodeNl.AutocompleteAddress(e,{autocompleteUrl:u.autocomplete,addressDetailsUrl:u.getDetails,context:t});return s.getSuggestions=function(e,t,s){const r=(new TextEncoder).encode(t),o=Array.from(r,(e=>String.fromCodePoint(e))).join(""),n=this.options.autocompleteUrl.replace("${context}",encodeURIComponent(e)).replace("${term}",encodeURIComponent(btoa(o)));return this.xhrGet(`${n}`,s)},s.getDetails=function(e,t){const s=this.options.addressDetailsUrl.replace("${context}",encodeURIComponent(e));return this.xhrGet(s,t)},s}(m.current,n.iso3),f.current.length>0&&V()):(g.current.reset(),g.current.setCountry(n.iso3),R.current(),b(""));const d=(0,r.select)(o.VALIDATION_STORE_KEY).getValidationError(e);O(null===(t=d?.hidden)||void 0===t||t)}),[a.country,e,D,b]),(0,n.useEffect)((()=>()=>D(e)),[D,e]),(0,n.useEffect)((()=>{null!==v&&m.current.classList.toggle(`${g.current.options.cssPrefix}loading`,v)}),[v]);const $=I?.message&&!I?.hidden;return(0,s.createElement)(c.TextInput,{id:e,required:!0,className:{"has-error":$},ref:m,label:(0,d.__)("Start typing your address or zip/postal code","postcode-eu-address-validation"),value:C,onChange:e=>{O(!0),b(e)},onBlur:()=>!A&&O(!1),"aria-invalid":!0===$,ariaDescribedBy:$&&T?T:null,feedback:(0,s.createElement)(c.ValidationInputError,{propertyName:e,elementId:e}),title:""})},E=({forId:e,onClick:t})=>{const n=(0,r.useSelect)((t=>t(o.VALIDATION_STORE_KEY).getValidationError(e))),{clearValidationError:a}=(0,r.useDispatch)(o.VALIDATION_STORE_KEY);return n&&!n.hidden?(0,s.createElement)("a",{className:"postcode-eu-autofill-intl-bypass-link",onClick:()=>{a(e),t()}},(0,d.__)("Enter an address")):null},f=({addressDetails:e})=>e?.mailLines?(0,s.createElement)("address",{className:"postcode-eu-autofill-address"},e.mailLines.join("\n")):null,g=(0,a.getSetting)("postcode-eu-address-validation_data"),h=({addressType:e,address:t,setAddress:r})=>{const o=(0,n.useRef)(null),[a,d]=(0,n.useState)(null),[c,l]=(0,n.useState)(!1),i=`${e}-intl_autocomplete`;return(0,n.useEffect)((()=>{const t=()=>{const t=document.getElementById(`${e}-address_1`)?.parentElement;return t?.before(o.current),t};if(!t()){const e=new MutationObserver((s=>{s.forEach((()=>{t()&&e.disconnect()}))}));return e.observe(o.current.closest(".wc-block-components-checkout-step__content"),{childList:!0}),()=>e.disconnect()}}),[]),(0,n.useEffect)((()=>{l(Boolean(g.enabledCountries[t.country]))}),[l,t.country]),(0,n.useEffect)((()=>{if("showAll"!==g.displayMode)for(const t of["address_1","postcode","city"]){const s=document.getElementById(`${e}-${t}`)?.parentElement;s&&(s.style.display=c?"none":"")}}),[e,c]),(0,s.createElement)("div",{className:"postcode-eu-autofill-container",ref:o,style:c?{}:{display:"none"}},(0,s.createElement)(m,{id:i,addressType:e,address:t,setAddress:r,setAddressDetails:d}),"showAll"!==g.displayMode&&(0,s.createElement)(E,{forId:i,onClick:()=>{l(!1)}}),(0,s.createElement)(f,{addressDetails:a}))};(0,e.registerCheckoutBlock)({metadata:t,component:()=>{const e=(0,r.useSelect)((e=>e(o.CHECKOUT_STORE_KEY).getUseShippingAsBilling()),[]),{billingAddress:t}=(0,r.useSelect)((e=>e(o.CART_STORE_KEY).getCustomerData()),[]),{setBillingAddress:n}=(0,r.useDispatch)(o.CART_STORE_KEY);return e?null:(0,s.createElement)(h,{addressType:"billing",address:t,setAddress:n})}})})();