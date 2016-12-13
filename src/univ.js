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
//
//
var RequestRegistry = require('./../build/contracts/RequestRegistry.sol.js')
var requestRegistry = RequestRegistry.deployed();

var Promise = require('bluebird');
var encryptionHDPath = "m/0'/0'/2'";
var DocumentRegistry = require('./../build/contracts/Documents.sol');
var documentRegistry = DocumentRegistry.deployed();
var test_accounts = require('./test_accounts');
var user_account = test_accounts.university;
var password = user_account.password;
var salt = user_account.salt;
var seed = user_account.seed
//
//
// console.log(seed);
//
function base58ToHex(b58) {
    var hexBuf = new Buffer(bs58.decode(b58));
    return hexBuf.toString('hex');
};

function hexToBase58(hexStr) {
    var buf = utils.toBuffer(hexStr);
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
//
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
                    console.log("error", err);
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
//
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
//
function errorlog(e) {
    console.log('error', e);
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
    requestRegistry.DocumentAttested({}, {fromBlock : "latest"}).watch(function(error, result) {
        console.log(error, result);
    });
    requestRegistry.AccessGranted({}, {fromBlock : "latest"}).watch(function(error, result) {
        console.log(error, result);
    });
    document.getElementById("eth_address").innerHTML = address;
}

function showUploadBox(e) {
    e.preventDefault();
    $("#issueCertificate").hide();
    $("#upload").show();

}

function uploadCertificate(e) {
    $("#error").hide();
    var email = document.getElementById('email').value;
    var uploadFile = document.getElementById("doc").files[0];

    var persona;
    var emailHash = utils.bufferToHex(utils.sha3(email));
    var theirPubKey;
    var userAddress;
    var docHash;
    var assigneeHash;
    var imgData;
    e.preventDefault();

    var emailHash = utils.bufferToHex(utils.sha3(email));
    emailRegistry.getAddress(emailHash, {
        from: user_account.address
    }).then(function(address) {
        userAddress = address;
        persona = new uport.Persona(address, ipfs, web3.currentProvider, registryAddress);
        return persona.load();
    }).then(function(_persona) {
        return persona.getClaims('encryption_key')[0].decodedToken.payload.claim.encryption_key;
    }).then(function(encryption_key) {

        theirPubKey = encryption_key;
        return readFilePromise(uploadFile);
    }).then(function(data) {
        imgData = data;
        docHash = utils.bufferToHex(utils.sha3(data));
        var keystore = userDetails.keyStoreInstance;
        return encryptImagePromise(keystore, userDetails.pwDerivedKey, theirPubKey, encryptionHDPath, data);
    }).then(function(encryptedObject) {
        encryptedObject = JSON.stringify(encryptedObject);
        var encryptedBuffer = utils.toBuffer(encryptedObject);
        return ipfs.add(encryptedBuffer);
    }).then(function(ipfsResult) {
        console.log(ipfsResult);
        var ipfsHex = '0x' + base58ToHex(ipfsResult[0].hash);
        assigneeHash = ipfsHex;
        var encryptionKey = '0x' + userDetails.keyStoreInstance.getPubKeys(encryptionHDPath)[0];
        return encryptImagePromise(userDetails.keyStoreInstance, userDetails.pwDerivedKey, encryptionKey, encryptionHDPath, imgData);
    }).then(function(encryptedObject) {
        encryptedObject = JSON.stringify(encryptedObject);
        var encryptedBuffer = utils.toBuffer(encryptedObject);
        return ipfs.add(encryptedBuffer);
    }).then(function(ipfsResult) {
        var ipfsHex = '0x' + base58ToHex(ipfsResult[0].hash);
        issuerHash = ipfsHex;
        return documentRegistry.addDocument(docHash, issuerHash, assigneeHash, userAddress, {from : user_account.address});
    }).then(function(tx) {
        console.log(tx);
        $("#upload").hide();
        $("#success").show();
        $("#successMessage").html("The certificate has been successfully issued. The certificate has been sent to the student for a confirmation. You will be notified when the student confirms.")
    }).catch(function(err) {
        var msg = 'A Unknown Error has occurred. Please try again'
        if (err && err.message && err.message.indexOf("multihash") >= 0) {
            msg = "The student's email address doesnt exist";
        }
        else if(err && err.message && err.message.indexOf("invalid") >=0) {
            msg = 'This Certificate has already been issued';
        }
        $("#error").show();
        $("#errorMessage").html(msg);
    });
}


document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("issueCertificate").addEventListener("click", showUploadBox)
    document.getElementById("certificateUpload").addEventListener("submit", uploadCertificate)
    appInit({
        password: password,
        seed: seed,
        salt: 'swag'
    }, onReady, errorlog);
});
