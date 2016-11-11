var Tx = require('ethereumjs-tx');
var lightwallet = require('eth-lightwallet');
var Web3 = require('web3');
var web3 = new Web3();
var EthQuery = require('eth-query');
var async = require('async');
var _ = require('underscore');
var HookedWeb3Provider = require("hooked-web3-provider");
var uport = require('uport-persona');
var ipfs = window.IpfsApi('localhost', '5001')
var rpcURL = 'https://morden.infura.io/';
var password = 'mypass';
var keyStore = lightwallet.keystore;
var registryAddress = '0x7356B947b626F48647E648D490C3a4FDe2d11e50';
var seed = 'nuclear oxygen lesson hint high tool benefit wait sport powder canyon tribe'; //keyStore.generateRandomSeed();
console.log(seed);
var ipfsOptions = {
    host: 'localhost',
    port: 5001,
    protocol: 'http',
    root: ''
}


function createWeb3Provider(rpcURL, keyStoreInstance) {
    var query;
    var provider = new HookedWeb3Provider({
        host: rpcURL,
        transaction_signer: {
            hasAddress: keyStoreInstance.hasAddress.bind(keyStoreInstance),
            signTransaction: function(txParams, callback) {
                debugger;
                async.parallel({
                    gas: function(callback) {
                        query.estimateGas(txParams, callback);
                    },
                    gasPrice: function(callback) {
                        query.gasPrice(callback);
                    }
                }, function(err, result) {
                    debugger;
                    txParams.gas = result.gas;
                    txParams.gasPrice = result.gasPrice;
                    keyStoreInstance.signTransaction(txParams, callback);
                });
            }
        }
    });
    query = new EthQuery(provider);
    return provider;
}

function appInit(args, onSuccess, onError) {
    keyStore.createVault(args, function(err, ks) {
        if (err) {
            onError(err);
            return;
        }

        ks.passwordProvider = function(callback) {
            callback(null, args.password);
        }

        ks.keyFromPassword(args.password, function(err, pwDerivedKey) {
            ks.generateNewAddress(pwDerivedKey, 1);
            var addr = ks.getAddresses();
            addr = '0x' + addr[0];
            var provider = createWeb3Provider(rpcURL, ks);
            onSuccess(addr, pwDerivedKey, ks, provider)
        });

    });
}

function errorlog(e) {
    console.log('error', e);
}

appInit({
    password: password,
    seedPhrase: seed,
    salt: 'swag'
}, onReady, errorlog);

function onReady(address, pwDerivedKey, keyStoreInstance, web3Provider) {
    web3.setProvider(web3Provider);
    debugger;

    var persona = new uport.MutablePersona(address, ipfsOptions, web3.currentProvider, registryAddress);
    // persona.load().then(function(tokens) {
    //     var publicKey = persona.getPublicSigningKey();
    //     console.log(publicKey);
    // }, errorlog);
    var privKey = keyStoreInstance.exportPrivateKey(address, pwDerivedKey);
    persona.setPublicSigningKey(privKey);
    persona.writeToRegistry().then(function(txHash) {

    })
}
