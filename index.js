/* * Copyright 2017 Atticlab LLC.
 * Licensed under the Apache License, Version 2.0
 * See the LICENSE or LICENSE_UA file at the root of this repository
 * Contact us at http://atticlab.net
 */

const EventEmitter = require('events').EventEmitter;
const StellarSdk = require('stellar-sdk');
const _ = require('lodash');
const axios = require('axios');
const nacl = require('tweetnacl');
const sjcl = require('sjcl');
const Wallet = require('./wallet');
const crypto = require('./crypto');
const bad_passwords = require('./bad_passwords');

const EVENT_PROCESS = 'process';
var cached_kdf_params;

module.exports = class extends EventEmitter {
    constructor(options) {
        super();

        var self = this;

        if (typeof options.host == undefined) {
            throw new Error('host is not set');
        }

        this.options = Object.assign({}, {
            // Ttl for api requests
            request_ttl: 10,

            // Enable debug mode
            debug: false,
        }, options);

        this.axios = axios.create();
        this.axios.defaults.baseURL = this.options.host.replace(/\/+$/g, '');
        this.axios.defaults.timeout = this.options.request_ttl * 1000;
        this.axios.defaults.paramsSerializer = function (params) {
            return Qs.stringify(params, {arrayFormat: 'brackets'})
        }
        this.axios.interceptors.request.use(function (config) {
            if (self.options.debug) {
                config.headers['Debug'] = true;
            }

            return config;
        });
    }

    create(params) {
        var self = this;

        if (!_.isObject(params)) {
            throw new Error('params is not an object');
        }

        if (!_.isString(params.password)) {
            throw new Error('password is not set');
        }

        if (!params.keypair instanceof StellarSdk.Keypair){
            throw new Error('keypair must be an instanceof StellarSdk.Keypair');
        }

        // check bad password
        if (bad_passwords.indexOf(params.password) > -1) {
            throw new Error('Insecure password');
        }

        if (_.isEmpty(params.phone) && _.isEmpty(params.email)) {
            throw new Error('both phone and email cannot be empty');
        }

        params.seed = params.keypair.seed();
        params.account_id = params.keypair.accountId();
        params.salt = crypto.base64Encode(nacl.randomBytes(16));

        return Promise.resolve(params)
            .then(this.getKdfParams.bind(this))
            .then(params => {
                return crypto.calculatePassword(params, (roundsDone) => {
                    self.emit(EVENT_PROCESS, {
                        func: 'calculatePasswordProgress',
                        progress: roundsDone,
                    });
                });
            })
            .then(params => {
                self.emit(EVENT_PROCESS, {
                    func: 'calculateMasterKey',
                });

                return crypto.calculateMasterKey(params); //S0
            })
            .then(params => {
                let raw_wallet_id = crypto.deriveWalletId(params.raw_master_key);
                let raw_wallet_key = crypto.deriveWalletKey(params.raw_master_key);

                params.wallet_id = sjcl.codec.base64.fromBits(raw_wallet_id);
                params.keychain_data = crypto.encryptData(params.seed, raw_wallet_key);

                self.emit(EVENT_PROCESS, {
                    func: 'walletsCreate',
                });

                return self.axios.post('/wallets/create', _.pick(params, [
                        'account_id',
                        'wallet_id',
                        'keychain_data',
                        'salt',
                        'kdf_params',
                        'phone',
                        'email'
                    ]))
                    .then(() => {
                        return Promise.resolve(new Wallet(self, _.pick(params, [
                            'wallet_id',
                            'account_id',
                            'seed',
                            'phone',
                            'email',
                        ])));
                    })
            });
    }

    getKdfParams(params) {
        if (_.isObject(params.kdf_params)) {
            return Promise.resolve(params);
        }

        if (cached_kdf_params) {
            params.kdf_params = cached_kdf_params;
            return Promise.resolve(params);
        }

        this.emit(EVENT_PROCESS, {
            func: 'getKdfParams',
        });

        return this.axios.get('/index/getkdf')
            .then(function (resp) {
                cached_kdf_params = resp.data;
                params.kdf_params = resp.data;

                return Promise.resolve(params);
            })
    }

    getData(params) {
        this.emit(EVENT_PROCESS, {
            func: 'getData',
        });

        return this.axios.post('/wallets/getdata', _.pick(params, ['email', 'phone']))
            .then(function (resp) {
                params.salt = resp.data.salt;
                params.account_id = resp.data.account_id
                params.kdf_params = resp.data.kdf_params;

                return Promise.resolve(params);
            })
    }

    get(params) {
        var self = this;

        if (!_.isObject(params)) {
            throw new Error('params is not an object');
        }

        if (_.isEmpty(params.phone) && _.isEmpty(params.email)) {
            throw new Error('both phone and email cannot be empty');
        }

        return this.getData(params)
            .then(params => {
                return crypto.calculatePassword(params, (roundsDone) => {
                    self.emit(EVENT_PROCESS, {
                        func: 'calculatePasswordProgress',
                        progress: roundsDone,
                    });
                });
            })
            .then(params => {
                self.emit(EVENT_PROCESS, {
                    func: 'calculateMasterKey',
                });

                return crypto.calculateMasterKey(params); //S0
            })
            .then(params => {
                let raw_wallet_id = crypto.deriveWalletId(params.raw_master_key);
                let raw_wallet_key = crypto.deriveWalletKey(params.raw_master_key);

                params.wallet_id = sjcl.codec.base64.fromBits(raw_wallet_id);
                params.raw_wallet_key = raw_wallet_key;

                self.emit(EVENT_PROCESS, {
                    func: 'walletsGet',
                });

                // Send request
                return self.axios.post('/wallets/get', _.pick(params, [
                        'account_id',
                        'wallet_id',
                    ]))
                    .then(function (resp) {
                        params.keychain_data = resp.data.keychain_data;
                        params.email = resp.data.email;
                        params.phone = resp.data.phone;

                        self.emit(EVENT_PROCESS, {
                            func: 'decryptWallet',
                        });

                        // Decrypt wallet
                        var p = _.pick(params, [
                            'wallet_id',
                            'seed',
                            'account_id',
                            'phone',
                            'email',
                        ]);

                        p.seed = crypto.decryptData(params.keychain_data, params.raw_wallet_key);

                        return Promise.resolve(new Wallet(self, p));
                    });
            })
    }

    notExist(params) {
        var self = this;

        if (!_.isObject(params)) {
            throw new Error('params is not an object');
        }

        if (_.isEmpty(params.phone) && _.isEmpty(params.email)) {
            throw new Error('both phone and email cannot be empty');
        }

        return this.axios.post('/wallets/notexist', _.pick(params, [
            'phone',
            'email'
        ])).then(() => {
            return Promise.resolve(true);
        });
    }
}
