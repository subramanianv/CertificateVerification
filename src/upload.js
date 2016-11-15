var Tx = require('ethereumjs-tx');
var bs58 = require('bs58');
var lightwallet = require('eth-lightwallet');
var utils = require('ethereumjs-util');
var Web3 = require('web3');
var web3 = new Web3();
var EthQuery = require('eth-query');
var accounts = require('./Accounts');
var async = require('async');
var _ = require('underscore');
var HookedWeb3Provider = require("hooked-web3-provider");
var uport = require('uport-persona');
var ipfs = window.IpfsApi('localhost', '5001')
var rpcURL = 'https://morden.infura.io/';
var password = 'mypass';
var keyStore = lightwallet.keystore;
var encryption = lightwallet.encryption;
var registryAddress = '0x6A63bD7E183b3FF621092677515d9D7Eea202F1e';
var EmailRegistry = require('./../build/contracts/EmailRegistry.sol.js');
var emailRegistry = EmailRegistry.deployed();
var Promise = require('bluebird');
var encryptionHDPath = "m/0'/0'/2'";
var DocumentRegistry = require('./../build/contracts/Documents.sol');
var documentRegistry = DocumentRegistry.deployed();

var seed = 'nuclear oxygen lesson hint high tool benefit wait sport powder canyon tribe'; //keyStore.generateRandomSeed();
console.log(seed);

function base58ToHex(b58) {
  var hexBuf = new Buffer(bs58.decode(b58));
  return hexBuf.toString('hex');
};

function hexToBase58(hexStr) {
  var buf = new Buffer(hexStr, 'hex');
  return bs58.encode(buf);
};

function hexToBase58(hexStr) {
  var buf = new Buffer(hexStr, 'hex');
  return bs58.encode(buf);
};

function createWeb3Provider(rpcURL, keyStoreInstance) {
    var query;
    var provider = new HookedWeb3Provider({
        host: rpcURL,
        transaction_signer: {
            hasAddress: function(address, callback) {
                callback(null, true);
            },
            signTransaction: function(txParams, callback) {
                async.parallel({
                    gas: function(callback) {
                        query.estimateGas(txParams, callback);
                    },
                    gasPrice: function(callback) {
                        query.gasPrice(callback);
                    }
                }, function(err, result) {
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
    accounts.createNewAccount(args, function(err) {
        if (err) {
            return onError(err);
        }
        var args = _.toArray(arguments);
        args = args.slice(1);
        onSuccess.apply(this, args);
    });
}

function errorlog(e) {
    console.log('error', e);
}

appInit({
    password: password,
    seed: seed,
    salt: 'swag'
}, onReady, errorlog);


var userDetails = {};

function onReady(address, encryption_key, pwDerivedKey, keyStoreInstance) {
    userDetails = {
        address: address,
        encryption_key: encryption_key,
        pwDerivedKey: pwDerivedKey,
        keyStoreInstance: keyStoreInstance
    };
    var provider = createWeb3Provider(rpcURL, keyStoreInstance);
    web3.setProvider(provider);
    EmailRegistry.setProvider(provider);
    DocumentRegistry.setProvider(provider);
    console.log('App ready');
}


function readFile(file, callback) {
    var reader = new FileReader();
    reader.onload = function() {
        var array = new Buffer(reader.result);
        callback(null, array);
    }
    reader.readAsArrayBuffer(file);
}
var readFilePromise = Promise.promisify(readFile);

function encryptImage(keystore, pwDerivedKey, encryptionKey, path, data, callback) {
    var msg = new Buffer(data).toString('base64')
    var pubKey = keystore.getPubKeys(path)[0];
    var userPublicKey_ = utils.stripHexPrefix(pubKey);
    encryptionKey = utils.stripHexPrefix(encryptionKey);
    var encryptedObject = encryption.asymEncryptString(keystore, pwDerivedKey, msg, userPublicKey_, encryptionKey, path);
    callback(null, encryptedObject);
}

var encryptImagePromise = Promise.promisify(encryptImage);

function handleUpload(email, uploadFile) {
    var persona;
    var emailHash = utils.bufferToHex(utils.sha3(email));
    var theirPubKey;
    var userAddress;
    emailRegistry.getAddress(emailHash, {
            from: "0x040fe96c87343a6a426a9342771b306239614b44"
        })
        .then(function(address) {
            userAddress = address;
            persona = new uport.Persona(address, ipfs, web3.currentProvider, registryAddress);
            return persona.load();
        }).then(function(_persona) {
            return persona.getClaims('encryption_key')[0].decodedToken.payload.claim.encryption_key;
        }).then(function(encryption_key) {
            theirPubKey = encryption_key;
            return readFilePromise(uploadFile);
        }).then(function(data) {
            var keystore = userDetails.keyStoreInstance;
            return encryptImagePromise(keystore, userDetails.pwDerivedKey, theirPubKey, encryptionHDPath, data);
        }).then(function(encryptedObject) {
            encryptedObject = JSON.stringify(encryptedObject);
            var encryptedBuffer = utils.toBuffer(encryptedObject);
            return ipfs.add(encryptedBuffer)
        }).then(function(ipfsResult) {
            console.log(ipfsResult);
            var ipfsHex  = '0x' + base58ToHex(ipfsResult[0].hash);
            console.log(ipfsHex);
            return documentRegistry.getDocumentByHash(ipfsHex, {from : "0x040fe96c87343a6a426a9342771b306239614b44"});
        }).then(function(docs) {
            console.log(docs);
            debugger;
            return documentRegistry.getDocumentsIssuedTo(userAddress, { from : "0x040fe96c87343a6a426a9342771b306239614b44"})
        }).then(function(docs) {
            for (var i = 0; i < docs.length; i++) {
                console.log(docs[i].toString());
            }
            return  "";
        }).then(function() {
            return documentRegistry.getDocumentById(1, { from : "0x040fe96c87343a6a426a9342771b306239614b44"});
        }).then(function(_doc) {
            var hashHex = _doc[2].slice(2);
            console.log(hexToBase58(hashHex));
        });
}

document.addEventListener("DOMContentLoaded", function() {
    var form = document.getElementById("upload");
    form.addEventListener("submit", function(e) {
        e.preventDefault();
        var email = document.getElementById('email').value;
        var doc = document.getElementById("doc");
        console.log(doc.files[0]);
        handleUpload(email, doc.files[0]);
    });
});
