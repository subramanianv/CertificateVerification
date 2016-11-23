var accounts = require('./src/Accounts');
var utils = require('ethereumjs-util');
var ipfsAPI = require('ipfs-api');
var express = require('express')
var test_accounts = require('./src/test_accounts.json');

var university_account = test_accounts.university;
var params = university_account;
var testRPC = require('ethereumjs-testrpc');
var registryAddress = require('./build/contracts/UportRegistry.sol').deployed().address
var EmailRegistry = require('./build/contracts/EmailRegistry.sol');
var emailRegistry = EmailRegistry.deployed();

var Web3 = require('web3');
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));

var async = require('async');
var _ = require('underscore');
var ipfs = ipfsAPI('localhost', '5001', {
    protocol: 'http'
});
var uport = require('uport-persona');


EmailRegistry.setProvider(web3.currentProvider);
async.map(test_accounts, function(account, callback) {
	var emailHex = utils.bufferToHex(utils.sha3(account.email));
	accounts.createNewAccount(account, function(err, address, pubKey, pwDerivedKey, ks) {
		var persona = new uport.MutablePersona(address, ipfs, web3.currentProvider, registryAddress);
		var privateKey = ks.exportPrivateKey(address, pwDerivedKey);
		persona.setPublicSigningKey(privateKey);
		persona.addAttribute({
			encryption_key : pubKey
		}, privateKey);
		persona.writeToRegistry(address, university_account.address).then(function(tx) {
			return emailRegistry.registerEmailAddress(emailHex, address, {
				from: address
			});
		}).then(function(tx) {
			callback(null, account.email);
		})
	});
}, function(err, result) {
	console.log(result);
});

// var params = {
//     seed: seed,
//     password: password,
//     salt: 'swag'
// }
// var emailHex = utils.bufferToHex(utils.sha3(params.email));
// accounts.createNewAccount(params, function(err, address, pubKey, pwDerivedKey, ks) {
// console.log(err, address, pubKey);
// var persona = new uport.MutablePersona(address, ipfs, web3.currentProvider, registryAddress);
// var privateKey = ks.exportPrivateKey(address, pwDerivedKey);
// persona.setPublicSigningKey(privateKey);
// persona.addAttribute({
//     encryption_key: pubKey
// }, privateKey);
// console.log(university_account.address);
// persona.writeToRegistry(address, university_account.address).then(function(tx) {
//     console.log(emailHex);
//     return emailRegistry.registerEmailAddress(emailHex, address, {
//         from: address
//     });
//
// }, function(err) {
//     console.log("error", err);
//     res.json(err);
// }).then(function(tx) {
//     return emailRegistry.getAddress(emailHex, {
//         from: address
//     });
// }).then(function(email) {
//     console.log(email);
//     res.json(email);
// });
// });
// });
//
// app.listen(3000, function() {
//     console.log('Example app listening on port 3000!')
// })
