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
var keyStore = lightwallet.keystore;
var bs58 = require('bs58');
var registryAddress = '0x7356B947b626F48647E648D490C3a4FDe2d11e50';
var seed = keyStore.generateRandomSeed();
console.log(seed);
var pubkey = '0xbf761487a00c156db3f874d010d2fbd39e5bec6a15e7ae3a22a168c21c4e7d3bda5204f71e69b494c2dfe239225940871c99c503922a4746bb6aae61c20b7241';


// console.log(seed);
//var salt = 'swag';
var ipfsOptions = {
  host : 'localhost',
  port : 5001,
  protocol : 'http',
  root : ''
}
web3.setProvider(window.web3.currentProvider);
var address = web3.eth.accounts[0];
var persona = new uport.Persona(address, ipfsOptions, web3.currentProvider, registryAddress);
persona.load().then(function(tokens) {
  var c = persona.getPublicSigningKey();
  console.log("pub key", c);
}, errorlog);
function errorlog(e) {
  console.log('error', e);
}
// var persona = new uport.MutablePersona(address, ipfsOptions, web3.currentProvider, registryAddress);
// persona.setPublicSigningKey("41e0568d6c95f23e9e8e3a59d289c3888b92f11caa3f0b8438628d0912c0928b");
// persona.writeToRegistry().then(function(tx) {
//   console.log('yolo', tx);
// },console.log);


// keyStore.createVault({
//     password: password,
//     seedPhrase: seed, // Optionally provide a 12-word seed phrase
//     salt: salt
// }, function(err, ks) {
//   console.log(err);
//     ks.passwordProvider = function(callback) {
//         callback(null, "mypass");
//     };
//     ks.keyFromPassword(password, function(err, pwDerivedKey) {
//         if (err) throw err;
//
//         ks.generateNewAddress(pwDerivedKey, 1);
//         var addr = ks.getAddresses();
//         var myAddress = '0x' + addr[0];
//         debugger;
//     });
// })
