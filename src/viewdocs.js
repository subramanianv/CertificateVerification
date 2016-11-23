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
var rpcURL = '127.0.0.1';
var keyStore = lightwallet.keystore;
var encryption = lightwallet.encryption;
var registryAddress = require('./../build/contracts/UportRegistry.sol').deployed().address;
console.log(registryAddress);
var EmailRegistry = require('./../build/contracts/EmailRegistry.sol.js');
var emailRegistry = EmailRegistry.deployed();
console.log(emailRegistry.address);

var Promise = require('bluebird');
var encryptionHDPath = "m/0'/0'/2'";
var DocumentRegistry = require('./../build/contracts/Documents.sol');
var documentRegistry = DocumentRegistry.deployed();
var test_accounts = require('./test_accounts');
var user_account = test_accounts.student;
var password = user_account.password;
var salt = user_account.salt;
var seed = user_account.seed


console.log(seed);

function base58ToHex(b58) {
    var hexBuf = new Buffer(bs58.decode(b58));
    return hexBuf.toString('hex');
};

function hexToBase58(hexStr) {
    var buf = new Buffer(hexStr, 'hex');
    return bs58.encode(buf);
};

function decryptImage(obj, callback) {
  var userPublicKey_ = ethUtils.stripHexPrefix(userPublicKey);
  var cleartext = encryption.asymDecryptString(userKeystore, userPWDerivedKey, obj, userPublicKey_, userPublicKey_, encryptionHDPath);
  var ci = document.getElementById('cimg');
  var _base = 'data:image/png;base64,' + cleartext;
  ci.setAttribute('src', _base);
  //var arrayBuf = new Buffer(cleartext, 'base64');
  callback(null, cleartext);
}

function createWeb3Provider(rpcURL, keyStoreInstance) {
    var query;
    var provider = new HookedWeb3Provider({
        host: undefined,
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
    DocumentRegistry.setProvider(provider);
    var DocumentAdded = documentRegistry.DocumentAdded({}, {
        fromBlock: "latest"
    });
    EmailRegistry.setProvider(provider);
    DocumentAdded.watch(function(error, result) {
        console.log('Logged');
        if (error == null) {
            console.log(result.args);
        }
    });
    var emailHash = utils.bufferToHex(utils.sha3("subramanian.bsv@gmail.com"));
    console.log(emailHash);
    // emailRegistry.registerEmailAddress(emailHash, test_accounts.student.address, {
    //     from : user_account.address
    // }).then(console.log, console.log);
    console.log('App ready');
    getDocumentsForUser(address)
}

function getDocumentsForUser(address) {
    documentRegistry.getDocumentsIssuedTo(address, {
        from : address
    }).then(function(docs) {
        return _.map(docs, function(doc) {
            return parseInt(doc.toString());
        });
    }).then(function(docs) {
        var docElem = $('#docs')
        for (var i = 0; i < docs.length; i++) {
            docElem.append('<li><a href=' + '"#' + docs[i] + '">'+ docs[i] + '</a></li>')
        }
        $('#docs li a').click(function(e) {
            var docID = window.location.hash;

            getDocumentById(parseInt(docID.slice(1)));
        })
    });
}

function loadPersona(address) {

}

function getDocumentById(docId) {
    var issuerPubKey;
    var issuer;
    var doc;
    var persona;
    documentRegistry.getDocumentById(docId, {
        from : userDetails.address
    }).
    then(function(_doc) {
        doc = _doc;
        issuer  =_doc[0];
        persona = new uport.Persona(issuer, ipfs, web3.currentProvider, registryAddress);
        return persona.load();
    }).then(function() {
        return persona.getClaims('encryption_key')[0].decodedToken.payload.claim.encryption_key;
        // var encryptedObject = body.toString();
        // var pubKey = userDetails.keyStoreInstance.getPubKeys(encryptionHDPath)[0];
        // var userPublicKey_ = utils.stripHexPrefix(pubKey);
        // //encryptionKey = utils.stripHexPrefix(encryptionKey);
        // //var cleartext = encryption.asymDecryptString(userKeystore, userPWDerivedKey, obj, userPublicKey_, userPublicKey_, encryptionHDPath);
        // encryptedObject = JSON.parse(encryptedObject);
        // var cleartext = encryption.asymDecryptString(userDetails.keyStoreInstance, userDetails.pwDerivedKey, encryptedObject, userPublicKey_, userPublicKey_, encryptionHDPath);
        // var ci = document.getElementById('cimg');
        // var _base = 'data:image/png;base64,' + cleartext;
        // ci.setAttribute('src', _base);
    }).then(function(_issuerPubKey) {
        issuerPubKey = _issuerPubKey;
        var hashHex = hexToBase58(doc[doc.length - 2].slice(2));
        return ipfs.cat(hashHex, {buffer : true});
    }).then(function(body) {
        var encryptedObject = body.toString();
        var pubKey = userDetails.keyStoreInstance.getPubKeys(encryptionHDPath)[0];
        var userPublicKey_ = utils.stripHexPrefix(pubKey);
        encryptedObject = JSON.parse(encryptedObject);
        var cleartext = encryption.asymDecryptString(userDetails.keyStoreInstance, userDetails.pwDerivedKey, encryptedObject, utils.stripHexPrefix(issuerPubKey), userPublicKey_, encryptionHDPath);
        var ci = document.getElementById('cimg');
        var _base = 'data:image/png;base64,' + cleartext;
        ci.setAttribute('src', _base);
    });
}



document.addEventListener("DOMContentLoaded", function() {
    console.log("Dom Loaded");
    appInit({
        password: password,
        seed: seed,
        salt: 'swag'
    }, onReady, errorlog);

});
