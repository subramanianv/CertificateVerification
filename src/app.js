var lightwallet = require('eth-lightwallet');
var keystore = lightwallet.keystore;
var password = 'mypass';
var seed = 'ecology face asset comic nephew tragic wisdom clump tray whip affair mobile';

keystore.deriveKeyFromPassword(password, function(err, pwDerivedKey) {
  var ks = new keystore(seed, pwDerivedKey);
  ks.generateNewAddress(pwDerivedKey);
  var address = ks.getAddresses()[0];
  var privateKey = ks.exportPrivateKey(address, pwDerivedKey);
  var signature = lightwallet.signing.signMsg(ks, pwDerivedKey, "subbu", address);
  console.log(signature, address, privateKey);
});
