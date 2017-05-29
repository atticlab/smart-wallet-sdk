/* * Copyright 2017 Atticlab LLC.
 * Licensed under the Apache License, Version 2.0
 * See the LICENSE or LICENSE_UA file at the root of this repository
 * Contact us at http://atticlab.net
 */

const _ = require('lodash');
const sjcl = require('sjcl');

require('sjcl-scrypt').extendSjcl(sjcl);

class Crypto {

    calculatePassword(params, cb) {
        if (!params.kdf_params.password_algorithm || !params.kdf_params.password_rounds) {
            return Promise.resolve(params);
        }

        if (params.password_hash) {
            return Promise.resolve(params);
        }

        var iterations_per_round = Math.floor(params.kdf_params.password_rounds / 100) || params.kdf_params.password_rounds;
        var p = Promise.resolve(params);
        var c = 0;

        params.password_hash = params.account_id + params.password + params.salt;

        for (var i = 0; i < params.kdf_params.password_rounds; i += iterations_per_round) {
            p.then(params => {
                for (var b = 0; b < iterations_per_round; b++) {
                    params.password_hash = sjcl.hash[params.kdf_params.password_algorithm].hash(params.password_hash);

                    c++;

                    if (c >= params.kdf_params.password_rounds) {
                        params.password_hash = sjcl.codec.hex.fromBits(params.password_hash);
                        break;
                    }
                }

                return new Promise(resolve => {
                    setTimeout(() => {
                        cb();

                        resolve(params)
                    }, 100);
                });
            });
        }

        return p;
    }

    calculateMasterKey(params) {
        let password = params.password_hash || params.password;
        let salt = _.reduce([sjcl.codec.base64.toBits(params.salt), sjcl.codec.utf8String.toBits(params.username)], sjcl.bitArray.concat);

        return new Promise(resolve => {
            params.raw_master_key = sjcl.misc.scrypt(
                password,
                sjcl.hash.sha256.hash(salt),
                params.kdf_params.n,
                params.kdf_params.r,
                params.kdf_params.p,
                params.kdf_params.bits / 8
            );
            resolve(params);
        });
    }

    base64Encode(str) {
        return (new Buffer(str)).toString('base64');
    }

    base64Decode(str) {
        return (new Buffer(str, 'base64')).toString();
    }

    deriveWalletId(key) {
        var hmac = new sjcl.misc.hmac(key, sjcl.hash.sha256);
        return hmac.encrypt('WALLET_ID');
    }

    deriveWalletKey(key) {
        var hmac = new sjcl.misc.hmac(key, sjcl.hash.sha256);
        return hmac.encrypt('WALLET_KEY');
    }

    encryptData(data, key) {
        if (!_.isString(data)) {
            throw new TypeError('data must be a String.');
        }

        const cipherName = 'aes';
        const modeName = 'gcm';

        let cipher = new sjcl.cipher[cipherName](key);
        let rawIV = sjcl.random.randomWords(3);
        let encryptedData = sjcl.mode[modeName].encrypt(
            cipher,
            sjcl.codec.utf8String.toBits(data),
            rawIV
        );

        data = JSON.stringify({
            IV: sjcl.codec.base64.fromBits(rawIV),
            cipherText: sjcl.codec.base64.fromBits(encryptedData),
            cipherName: cipherName,
            modeName: modeName
        });

        return this.base64Encode(data);
    }

    decryptData(encryptedData, key) {
        let rawCipherText, rawIV, cipherName, modeName;

        try {
            let resultObject = JSON.parse(this.base64Decode(encryptedData));
            rawIV = sjcl.codec.base64.toBits(resultObject.IV);
            rawCipherText = sjcl.codec.base64.toBits(resultObject.cipherText);
            cipherName = resultObject.cipherName;
            modeName = resultObject.modeName;
        } catch (e) {
            new errors.DataCorrupt();
        }

        let cipher = new sjcl.cipher[cipherName](key);
        let rawData = sjcl.mode[modeName].decrypt(cipher, rawCipherText, rawIV);
        return sjcl.codec.utf8String.fromBits(rawData);
    }
}

module.exports = new Crypto