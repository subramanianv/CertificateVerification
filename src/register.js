var _ = require('underscore');
var cookie = require('js-cookie');
var accounts = require('./Accounts');
var utils = require('ethereumjs-util');
var toBuffer = require('typedarray-to-buffer');
var async = require('async')
function getQueryParameters(str) {
	var p =  (str || document.location.search).replace(/(^\?)/,'').split("&").map(function(n){return n = n.split("="),this[n[0]] = n[1],this}.bind({}))[0];
  return _.mapObject(p, function(val) {
    return decodeURIComponent(val);
  });
}

var params = getQueryParameters();
accounts.createNewAccount(params, function(err, address, pubKey, pwDerivedKey, keystore) {
	var serialized = keystore.serialize();
	var pwDerivedKeyHex = utils.bufferToHex(toBuffer(pwDerivedKey));
});

async.waterfall([
	async.constant(params),
	accounts.createNewAccount,
	function(address, pubKey, pwDerivedKey, keystore) {
		var serialized = keystore.serialize();
		var pwDerivedKey = utils.bufferToHex(toBuffer(pwDerivedKey));
	},

],console.log)
