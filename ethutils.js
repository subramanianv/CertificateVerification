var utils = require('ethereumjs-util');
var EC = require('elliptic').ec;

var msg = 'subbu';
var msgHash = utils.sha3(msg);
console.log(msgHash);
var secp256k1 = new EC('secp256k1');

// Generate keys
var key = secp256k1.genKeyPair();

// // Sign message (must be an array, or it'll be treated as a hex sequence)
var signature = secp256k1.sign(msgHash, key.priv);
console.log(signature.r.toString(10));
console.log(signature.s.toString(10));
console.log(secp256k1.verify(msgHash, signature, key.getPublic()));
