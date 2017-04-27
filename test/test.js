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
        let email = getRandomInt(0, 9999999) + '-test@test.com';
        let accountKeypair = StellarSdk.Keypair.random();
        let password = '12312x3';

        return WalletApi.create({
                keypair: accountKeypair,
                password: password,
                email: email,
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
                    email: email,
                    password: password,
                })
            })
            .should.eventually.be.instanceof(wallet);
    });

    it('Enable TOTP', function () {
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

    // it('sendSms', function () {
    //     return WalletApi.get({
    //         password: '123123',
    //         phone: '+xxxxxxx',
    //         sms_code: 922224
    //     }).catch(err => {
    //         console.log(err)
    //         throw new Error(err)
    //     })
    //
    //     return WalletApi.sendSms({
    //         password: '123123',
    //         phone: '+xxxxxxx',
    //     }).then(resp => {
    //         console.log(resp)
    //     })
    // })
});