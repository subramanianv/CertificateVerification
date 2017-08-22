var Tx = require('ethereumjs-tx');
var moment = require('moment');
window.moment = moment;
var bs58 = require('bs58');
var lightwallet = require('eth-lightwallet');
var utils = require('ethereumjs-util');
var Web3 = require('web3');
var web3 = new Web3();
var EthQuery = require('eth-query');
var accounts = require('./Accounts');
var async = require('async');
var mustache = require('mustache');
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

var docTemplate = '<thead><tr><th width="100">#</th><th width="170">Name</th><th width="170">Issuer</th><th width="150">Actions</th><th width="170">Timestamp</th></tr></thead><tbody>{{#documents}}<tr><td>{{id}}</td><td>{{name}}</td><td>{{issuer}}</td><td>Send</td><td>{{timestamp}}</td></tr>{{/documents}}</tbody>';
var RequestRegistry = require('./../build/contracts/RequestRegistry.sol.js')
var requestRegistry = RequestRegistry.deployed();

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
    RequestRegistry.setProvider(provider);
    DocumentAdded.watch(function(error, result) {
        console.log('Logged');
        if (error == null) {
            console.log(result.args);
        }
    });

    requestRegistry.AccessGranted({}, {fromBlock : "latest"}).watch(function(error, result) {
        console.log(error, result);
    });
    console.log('App ready');
    console.log(address);
    getDocumentsForUser(address);
    getAccessRequestsForUser(address);

}


function getAccessRequestsForUser(address) {
    requestRegistry.getRequests(address, {from : userDetails.address}).then(function(requestIDs) {
        return _.map(requestIDs,function(requestID) {
            return parseInt(requestID.toString());
        })
    }).then(function(requestIDs) {
        var docElem = $('#requestAccess');
        for (var i = 0; i < requestIDs.length; i++) {
            docElem.append('<li><a href=' + '"#' + requestIDs[i] + '">'+ requestIDs[i]  + '- Grant Access</a></li>')
        }
        $('#requestAccess li a').click(function(e) {
            var requestID = window.location.hash.slice(1);
            requestRegistry.grantAccess(requestID, {from : userDetails.address}).then(console.log);
        })
    });
}

function getDocumentsForUser(address) {
    documentRegistry.getDocumentsIssuedTo(address, {
        from : address
    }).then(function(docs) {
        return _.map(docs, function(doc) {
            return parseInt(doc.toString());
        });
    }).then(function(docs) {
        async.map(docs, function(doc, callback) {
            documentRegistry.getDocumentById(doc, {from : userDetails.address}).then(function(results) {
                callback(null, results);
            });
        },function(err, docs) {
            docs = _.map(docs, function(doc) {
                console.log(doc);
                return {
                    id : doc[3].toString(),
                    timestamp : moment(doc[4]).format('llll'),
                    name : doc[5],
                    issuer : doc[0]
                }
            });
            docs = _.sortBy(docs, 'timestamp').reverse();
            var renderedTable = mustache.render(docTemplate, {
                documents : docs
            });
            $('#documents').html(renderedTable);
        });
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
