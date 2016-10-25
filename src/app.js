var Tx = require('ethereumjs-tx');
var lightwallet = require('eth-lightwallet');
var Web3 = require('web3');
var web3 = new Web3();
var EthQuery = require('eth-query');
var async = require('async');
var _ = require('underscore');
var HookedWeb3Provider = require("hooked-web3-provider");
var utils = require('ethereumjs-util');


var TEST_NET = 'https://morden.infura.io/';
var password = 'mypass';
var seed = 'ecology face asset comic nephew tragic wisdom clump tray whip affair mobile';
var salt = 'swag';
var keyStore = lightwallet.keystore;





keyStore.createVault({
    password: password,
    seedPhrase: seed, // Optionally provide a 12-word seed phrase
    salt: salt
}, function(err, ks) {

    ks.passwordProvider = function(callback) {
        callback(null, "mypass");
    };

    ks.keyFromPassword(password, function(err, pwDerivedKey) {
        if (err) throw err;
        ks.generateNewAddress(pwDerivedKey, 1);
        var addr = ks.getAddresses();
        addr[0] = '0x' + addr[0];
        console.log(addr[0]);
        var provider = new HookedWeb3Provider({
            host: TEST_NET,
            transaction_signer: ks
        });
        web3.setProvider(provider);
        var query = new EthQuery(provider);
        // //query.gasPrice(console.log);
        //
        var simplestorageContract = web3.eth.contract([{
            "constant": false,
            "inputs": [{
                "name": "x",
                "type": "uint256"
            }],
            "name": "set",
            "outputs": [],
            "payable": false,
            "type": "function"
        }, {
            "constant": true,
            "inputs": [],
            "name": "get",
            "outputs": [{
                "name": "retVal",
                "type": "uint256"
            }],
            "payable": false,
            "type": "function"
        }]);
        var simplestorage = simplestorageContract.at("0x4500ff0fcab6949466bb9c0779a7fb2c8c320705");
        var tx = {
            from: addr[0]
        }
        // var gasPrice = 50000000000
        // var gas = 3141592
        // var tx = {
        //     from: addr[0]
        // }
        var args = [20, tx];
        async.waterfall([
            function(callback) {
                query.gasPrice(callback)
            },

            function estimateGas(gasPrice, callback) {
                simplestorage.set.estimateGas(100, tx, function(err, gas) {
                    callback(null, {
                        gasPrice: gasPrice,
                        gas : gas
                    })
                })
            },
            function(args, callback) {
                var tx = {
                    from: addr[0]
                }
                tx = _.extendOwn(tx, args)
                console.log(tx);
                callback(null, tx);
            }
        ], function(err, tx) {
            simplestorage.set(101, tx, console.log);
        });
    });
})
