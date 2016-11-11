var accounts = require('../src/Accounts');
var utils = require('ethereumjs-util');
var ipfsAPI = require('ipfs-api');
var express = require('express')

var app = express()

var params = {
	seed : 'nuclear oxygen lesson hint high tool benefit wait sport powder canyon tribe',
	password : 'mypass',
	salt : 'swag'
};
console.log();
var rpcURL = 'https://morden.infura.io/';
var registryAddress = '0x6A63bD7E183b3FF621092677515d9D7Eea202F1e';
var Web3 = require('web3');
var web3 = new Web3();
var EthQuery = require('eth-query');
var async = require('async');
var _ = require('underscore');
var ipfs = ipfsAPI('localhost', '5001', {protocol: 'http'});
var HookedWeb3Provider = require("hooked-web3-provider");
var uport = require('uport-persona');
var bodyParser = require('body-parser');
var jsonParser = bodyParser.json()

function createWeb3Provider(rpcURL, keyStoreInstance) {
    var query;
    var provider = new HookedWeb3Provider({
        host: rpcURL,
        transaction_signer: {
            hasAddress: keyStoreInstance.hasAddress.bind(keyStoreInstance),
            signTransaction: function(txParams, callback) {
				//txParams.from = '0x040fe96c87343a6a426a9342771b306239614b44';
				console.log("pp", txParams);
                async.parallel({
                    gas: function(callback) {
                        query.estimateGas(txParams, callback);
                    },
                    gasPrice: function(callback) {
                        query.gasPrice(callback);
                    }
                }, function(err, result) {
					console.log(txParams.from);
					txParams.from = '0x040fe96c87343a6a426a9342771b306239614b44';
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

async.waterfall([
	async.constant(params),
	accounts.createNewAccount
],function(err, address, pubKey, pwDerivedKey, ks) {
	console.log(address);
	ks.passwordProvider = function(callback) {
		callback(null, params.password);
	}
	var provider = createWeb3Provider(rpcURL, ks);
	web3.setProvider(provider);
	console.log('keyStore ready');
});



app.get('/', function (req, res) {
  res.send('Hello World!')
})

app.post('/persona', jsonParser, function(req, res) {
	var seed = req.body.seed;
	var password  = req.body.password;
	var params = {
		seed : seed,
		password : password,
		salt : 'swag'
	}
	accounts.createNewAccount(params, function(err, address, pubKey, pwDerivedKey, ks) {
		console.log('user address', address);
		var persona = new uport.MutablePersona(address, ipfs , web3.currentProvider, registryAddress);
		var privateKey = ks.exportPrivateKey(address, pwDerivedKey);
		persona.setPublicSigningKey(privateKey);
		persona.addAttribute({encryption_key : pubKey}, privateKey);
		persona.writeToRegistry(address, '0x040fe96c87343a6a426a9342771b306239614b44').then(function(tx) {
			res.json(tx);
		}, function(err) {
			console.log("error", err);
			res.json(err);
		});
	})
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})
