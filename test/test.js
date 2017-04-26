/* * Copyright 2017 Atticlab LLC.
 * Licensed under the Apache License, Version 2.0
 * See the LICENSE or LICENSE_UA file at the root of this repository
 * Contact us at http://atticlab.net
 */
const StellarSdk = require('stellar-sdk');
const wallet = require('../wallet');
const api = require('../index');
const chai = require('chai');

chai.use(require('chai-as-promised'));
chai.should();

var WalletApi = new api({
    host: 'http://127.0.0.1:8085',
    debug: true
});

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

describe('Wallets', function () {
    it('Check if username is free', function () {
        return WalletApi.notExist({
            email: 'debug@' + Date.now() + '.com',
        });
    });

    it('Sign message', function () {
        let phone = getRandomInt(380000000000, 389999999999).toString();
        let accountKeypair = StellarSdk.Keypair.random();
        let password = '12312x3';

        return WalletApi.create({
            keypair: accountKeypair,
            password: password,
            phone: phone,
        }).then(wallet => {
            var signature = wallet.sign('test message');
            return signature;
        })
    })

    it('Create and get wallet object', () => {
        let phone = getRandomInt(380000000000, 389999999999).toString();
        let accountKeypair = StellarSdk.Keypair.random();
        let password = '12312x3';

        return WalletApi.create({
                keypair: accountKeypair,
                password: password,
                phone: phone,
            })
            .should.eventually.be.instanceof(wallet)
            .then((wallet)=> {
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve()
                    }, 1000);
                });
            })
            .then(() => {
                return WalletApi.get({
                    phone: phone,
                    password: password,
                })
            })
            .should.eventually.be.instanceof(wallet);
    });

    it('createTotp', function () {
        let phone = getRandomInt(380000000000, 389999999999).toString();
        let accountKeypair = StellarSdk.Keypair.random();
        let password = '12312x3';

        return WalletApi.create({
            keypair: accountKeypair,
            password: password,
            phone: phone,
        }).then(wallet => {
            return wallet.enableTotp();
        })
    })
});