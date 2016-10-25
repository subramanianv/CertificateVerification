var Tx = require('ethereumjs-tx');
var lightwallet = require('eth-lightwallet');
var Web3 = require('web3');
var web3 = new Web3();
var EthQuery = require('eth-query');
var async = require('async');
var _ = require('underscore');
var HookedWeb3Provider = require("hooked-web3-provider");
var utils = require('ethereumjs-util');
var uport = require('uport-persona');
var ipfs = window.IpfsApi('localhost', '5001')
var TEST_NET = 'https://morden.infura.io/';
var password = 'mypass';
var query;
var seed = 'ecology face asset comic nephew tragic wisdom clump tray whip affair mobile';
var salt = 'swag';
var ipfsOptions = {
  host : 'localhost',
  port : 5001,
  protocol : 'http',
  root : ''
}
var keyStore = lightwallet.keystore;








keyStore.createVault({
    password: password,
    seedPhrase: seed, // Optionally provide a 12-word seed phrase
    salt: salt
}, function(err, ks) {
  console.log(err);
    ks.passwordProvider = function(callback) {
        callback(null, "mypass");
    };
    ks.keyFromPassword(password, function(err, pwDerivedKey) {
        if (err) throw err;

        ks.generateNewAddress(pwDerivedKey, 1);
        var addr = ks.getAddresses();
        var myAddress = '0x' + addr[0];

        var provider = new HookedWeb3Provider({
            host: TEST_NET,
            transaction_signer: {
              hasAddress : ks.hasAddress.bind(ks),
              signTransaction : function(txParams, callback) {
                async.parallel({
                  gas : function(callback) {
                    query.estimateGas(txParams, callback)
                  },
                  gasPrice : function(callback) {
                    query.gasPrice(callback)
                  }
                }, function(err, result) {
                  console.log(txParams);
                  txParams.gas = result.gas;
                  txParams.gasPrice = result.gasPrice;
                  ks.signTransaction(txParams,callback);
                })
              }
            }
        });
        var query = new EthQuery(provider);
        web3.setProvider(provider);
        debugger;
        console.log(ks.exportPrivateKey(addr[0], pwDerivedKey));
        //var persona = new uport.MutablePersona(myAddress, ipfsOptions, web3.currentProvider);
        //persona.setPublicSigningKey(ks.exportPrivateKey(addr[0], pwDerivedKey));
        // debugger;
        //persona.writeToRegistry().then(console.log, console.log);
        console.log(myAddress);
        var persona = new uport.Persona(myAddress, ipfsOptions, web3.currentProvider);
        debugger;
        persona.load().then(console.log, console.log);

    });
})
