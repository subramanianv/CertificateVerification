var _ = require('underscore');
var async = require('async');
var encryptionHDPath = "m/0'/0'/2'";
var lightwallet = require('eth-lightwallet');
var keyStore = lightwallet.keystore;
console.log(keyStore.generateRandomSeed());
function createNewAccount(args, callback) {
    var password = args.password;
    var seed = args.seed;
    var salt = args.salt || 'swag';
    keyStore.createVault({
        password: password,
        salt: salt,
        seedPhrase: seed
    }, function(err, ks) {
        if (err) {
            return callback(err);
        }
        ks.passwordProvider = function(callback) {
            callback(null, password);
        }
        ks.keyFromPassword(password, function(err, pwDerivedKey) {
            var firstAddress = getAddress(ks, pwDerivedKey)
            var pubKey = getEncryptionKey(ks, pwDerivedKey);
            callback(null, firstAddress, pubKey, pwDerivedKey, ks);
        })
    })
}

function getAddress(keystore, pwDerivedKey) {
    var address;
    address = keystore.getAddresses()[0];
    if (!address) {
        keystore.generateNewAddress(pwDerivedKey, 1);
    }
    return '0x' + keystore.getAddresses()[0];
}

function getEncryptionKey(keystore, pwDerivedKey) {
    try {
        keystore.getPubKeys(encryptionHDPath);
    } catch (e) {
        keystore.addHdDerivationPath(encryptionHDPath, pwDerivedKey, {
            curve: 'curve25519',
            purpose: 'asymEncrypt'
        });
        keystore.generateNewEncryptionKeys(pwDerivedKey, 1, encryptionHDPath);
    }
    return '0x' + keystore.getPubKeys(encryptionHDPath)[0];
}

function getKeystoreFromCookie(serializedData) {
    var keystore = keyStore.deserialize(serializedData);
    return {
        address : getAddress(keystore),
        pubKey : getEncryptionKey(keystore),
        keystore : keystore
    }
}

module.exports = {
    createNewAccount: createNewAccount,
    getKeystoreFromCookie : getKeystoreFromCookie
}
