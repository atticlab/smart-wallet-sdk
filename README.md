# Smart Wallet Js

**Create api object**

```js
var api = require('smart-wallet-js');

var WalletApi = new api({
    host: keyserver_host
});
```


#### `Create wallet`
```js
WalletApi.create({
    keypair: accountKeypair,
    password: password,
    // You can signup using any of these fields 
    phone: '+380xxxxxxxxx',
    email: 'xxx@xxx.com'
}).then(wallet => {
    // this is where you get your wallet object
});
```

#### `Get wallet`
```js
WalletApi.get({
    password: 'your_password',
    // You can login using any of these fields 
    phone: '+380xxxxxxxxx',
    email: 'xxx@xxx.com'
    // These fields are optional
    sms_code: 'xxxxxx' // TFA code from SMS
    totp_code: 'xxxxxx' // TFA code using google authenticator
}).then(wallet => {
    // this is where you get your wallet object
});
```

## `Wallet methods`
#### `Enable two-factor auth using totp`
Returns secret key to paste into your google auth or freeotp app
```js
wallet.enableTotp()
```