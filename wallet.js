/* * Copyright 2017 Atticlab LLC.
 * Licensed under the Apache License, Version 2.0
 * See the LICENSE or LICENSE_UA file at the root of this repository
 * Contact us at http://atticlab.net
 */

const StellarSdk = require('stellar-sdk');
const _ = require('lodash');
const sjcl = require('sjcl');
const crypto = require('./crypto');
const nacl = require('tweetnacl');
nacl.util = require('tweetnacl-util');

class Wallet {
    constructor(api, p) {
        var self = this;
        var params = _.cloneDeep(p);
        var properties = [
            'wallet_id',
            'account_id',
            'seed',
            'phone',
            'email',
            'is_totp_enabled'
        ];

        _.each(properties, function (param) {
            self[param] = params[param];
        });

        this.api = api;
    }

    getNonce() {
        return this.api.axios.post('/auth/createnonce', _.pick(this, ['account_id']))
    }

    enableTotp() {
        return this.getNonce()
            .then(nonce => {
                return this.api.axios.post('/auth/enableTotp', {
                    nonce: nonce,
                    signature: this.sign(nonce),
                });
            })
    }

    activateTotp(code) {
        var self = this;

        if (_.isUndefined(code)) {
            throw new TypeError('code is not isset.');
        }

        return this.api.axios.post('/auth/activateTotp', {
            account_id: this.account_id,
            totp_code: code
        }).then(() => {
            self.is_totp_enabled = true;
        })
    }

    disableTotp() {
        var self = this;

        return this.getNonce()
            .then(nonce => {
                return this.api.axios.post('/auth/disableTotp', {
                    nonce: nonce,
                    signature: this.sign(nonce),
                });
            }).then(() => {
                self.is_totp_enabled = false;
            })
    }

    sign(message) {
        if (!_.isString(message)) {
            throw new TypeError('message must be a String.');
        }

        let keypair = StellarSdk.Keypair.fromSeed(this.seed)

        return crypto.base64Encode(nacl.sign.detached(nacl.util.decodeUTF8(message), keypair._secretKey));
    }
}

module.exports = Wallet;