var accounts = require('../src/Accounts');
var utils = require('ethereumjs-util');
var ipfsAPI = require('ipfs-api');
var express = require('express')
var test_accounts = require('./../src/test_accounts.json');
var app = express();
var university_account = test_accounts.university;
var params = university_account;
var testRPC = require('ethereumjs-testrpc');
var registryAddress = require('./../build/contracts/UportRegistry.sol').deployed().address
console.log(registryAddress);
var Web3 = require('web3');
var web3 = new Web3();
console.log(test_accounts.accounts);

web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
var async = require('async');
var _ = require('underscore');
var ipfs = ipfsAPI('localhost', '5001', {protocol: 'http'});
var uport = require('uport-persona');
var bodyParser = require('body-parser');
var EmailRegistry = require('./../build/contracts/EmailRegistry.sol');
var emailRegistry = EmailRegistry.deployed();
EmailRegistry.setProvider(web3.currentProvider);
console.log(emailRegistry.address);
var jsonParser = bodyParser.json()
app.post('/persona', jsonParser, function(req, res) {
	var seed = req.body.seed;
	var password  = req.body.password;
	var params = {
		seed : seed,
		password : password,
		salt : 'swag'
	}
	var email = req.body.email;
        var emailHex = utils.bufferToHex(utils.sha3(email));
	accounts.createNewAccount(params, function(err, address, pubKey, pwDerivedKey, ks) {
		console.log(err, address, pubKey);
		var persona = new uport.MutablePersona(address, ipfs , web3.currentProvider, registryAddress);
		var privateKey = ks.exportPrivateKey(address, pwDerivedKey);
		persona.setPublicSigningKey(privateKey);
		persona.addAttribute({encryption_key : pubKey}, privateKey);
		console.log(university_account.address);
		persona.writeToRegistry(address, university_account.address).then(function(tx) {
                        console.log(emailHex);
			return emailRegistry.registerEmailAddress(emailHex, address, {from : address});

		}, function(err) {
			console.log("error", err);
			res.json(err);
		}).then(function(tx) {
                        return emailRegistry.getAddress(emailHex, {from : address});
		}).then(function(email){
                    console.log(email);
                    res.json(email);
                });
	});
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
