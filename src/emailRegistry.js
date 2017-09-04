var Web3 = require('web3');
var web3 = new Web3();
var utils = require('ethereumjs-util');
var EmailRegistry = '[ { "constant": true, "inputs": [ { "name": "email", "type": "bytes32" } ], "name": "getAddress", "outputs": [ { "name": "", "type": "address", "value": "0x0000000000000000000000000000000000000000" } ], "type": "function" }, { "constant": false, "inputs": [ { "name": "email", "type": "bytes32" }, { "name": "assignee", "type": "address" } ], "name": "registerEmailAddress", "outputs": [], "type": "function" } ]';
EmailRegistry = JSON.parse(EmailRegistry);
EmailRegistry = web3.eth.contract(EmailRegistry);

function setWeb3Provider(web3Prov) {
  web3.setProvider(web3Prov);
};


function registerEmail(email, registryAddress, txData, callback) {
    var reg = EmailRegistry.at(registryAddress);
    var hash = utils.bufferToHex(utils.sha3(email));
    reg.registerEmailAddress(hash, personaAddress, txData, function(err, tx) {

    });
}

function getAddress(email, registryAddress, tx, callback) {
    var hash = utils.bufferToHex(utils.sha3(email));
    var reg = EmailRegistry.at(registryAddress);
    debugger;
    reg.getAddress(hash, tx, callback);
}


module.exports.setWeb3Provider = setWeb3Provider;
module.exports.registerEmail = registerEmail;
module.exports.getAddress = getAddress;
