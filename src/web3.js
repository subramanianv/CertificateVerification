var Web3 = require('web3');
var web3 = new Web3();

// setup web3 provider
var setupWeb3Provider = function(url) {
  if(!url) url = 'http://localhost';
  debugger;
  web3.setProvider(new web3.providers.HttpProvider(url))
};

// export web3 instance and setup
module.exports = {
  web3: web3,
  setupWeb3Provider: setupWeb3Provider
};
