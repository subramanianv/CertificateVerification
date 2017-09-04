var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, instance, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("RequestRegistry error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("RequestRegistry error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("RequestRegistry contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of RequestRegistry: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to RequestRegistry.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: RequestRegistry not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "default": {
    "abi": [
      {
        "constant": false,
        "inputs": [
          {
            "name": "requestID",
            "type": "uint256"
          }
        ],
        "name": "grantAccess",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "_for",
            "type": "address"
          }
        ],
        "name": "getRequests",
        "outputs": [
          {
            "name": "",
            "type": "uint256[]"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "requestID",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "requestID",
            "type": "uint256"
          },
          {
            "name": "ipfsHash",
            "type": "bytes"
          }
        ],
        "name": "attest",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "docID",
            "type": "uint256"
          }
        ],
        "name": "requestForAccess",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "requestID",
            "type": "uint256"
          }
        ],
        "name": "getRequest",
        "outputs": [
          {
            "name": "requester",
            "type": "address"
          },
          {
            "name": "docID",
            "type": "uint256"
          },
          {
            "name": "docIPFSHash",
            "type": "bytes"
          },
          {
            "name": "granted",
            "type": "bool"
          },
          {
            "name": "completed",
            "type": "bool"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "inputs": [
          {
            "name": "docRegistryAddress",
            "type": "address"
          }
        ],
        "type": "constructor"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "name": "assignee",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "requestID",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "docID",
            "type": "uint256"
          }
        ],
        "name": "DocumentRequested",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "sender",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "requestID",
            "type": "uint256"
          }
        ],
        "name": "AccessGranted",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "issuer",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "requestID",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "docID",
            "type": "uint256"
          }
        ],
        "name": "DocumentAttested",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x6060604081905260018055602080610ba0833950608060405251600080546c0100000000000000000000000080840204600160a060020a031990911617905550610b538061004d6000396000f3606060405236156100565760e060020a60003504637ca14563811461005b578063804e44f3146100f15780638f77920114610171578063aa60bfe91461017f578063c0de72d3146101f1578063c58343ef14610287575b610002565b34610002576004803560008181526002602090815260408083208354600182015483518501869052835160e360020a62f6630302815297880152915161031596919493600160a060020a03909316926307b31818926024808201939182900301818787803b156100025760325a03f1156100025750506040515191505033600160a060020a039081169082161461040a57610002565b346100025761031760043560408051602081810183526000808352600160a060020a0385168152600382528390208054845181840281018401909552808552929392909183018282801561016557602002820191906000526020600020905b81548152600190910190602001808311610150575b50505050509050919050565b346100025761036160015481565b346100025760408051602060046024803582810135601f810185900485028601850190965285855261031595833595939460449493929092019181908401838280828437509496505050505050506000828152600260205260408120600381015490919060ff16151561047057610002565b3461000257610315600435600060006000836000600060009054906101000a9004600160a060020a0316600160a060020a03166307b31818836000604051602001526040518260e060020a02815260040180828152602001915050602060405180830381600087803b156100025760325a03f11561000257505060405151915050600160a060020a038116151561074757610002565b346100025760408051602080820183526000808352600435808252600280845285832060018082015482840180548a519381161561010002600019011694909404601f81018890048802830188019099528882526103739894979596909594879485949392909190830182828015610b235780601f10610af857610100808354040283529160200191610b23565b005b60405180806020018281038252838181518152602001915080519060200190602002808383829060006004602084601f0104600302600f01f1509050019250505060405180910390f35b60408051918252519081900360200190f35b6040518086600160a060020a0316815260200185815260200180602001841515815260200183151581526020018281038252858181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156103f85780820380516001836020036101000a031916815260200191505b50965050505050505060405180910390f35b600083815260026020908152604091829020600301805460ff191660011790558151600160a060020a033316815290810185905281517fb4c6779ceb4a20f448e76a0e11f39bd183cff9c9dbac53df6bfcc202e2eb32f1929181900390910190a1505050565b600060009054906101000a9004600160a060020a0316600160a060020a03166392089c4683600101600050546000604051602001526040518260e060020a02815260040180828152602001915050602060405180830381600087803b156100025760325a03f1156100025750506040515191505033600160a060020a03908116908216146104fd57610002565b82826002016000509080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f1061056657805160ff19168380011785555b506105969291505b808211156106645760008155600101610552565b8280016001018555821561054a579182015b8281111561054a578251826000505591602001919060010190610578565b505060038201805461ff00191661010090811790915560008581526002602081815260408320865481546c01000000000000000000000000600160a060020a0390921682029190910473ffffffffffffffffffffffffffffffffffffffff199091161781556001878101548282015583880180548386018054818952978690208b9995989197601f8387161588026000199081019094168290048101989098048201979584161590960290910190911693909304929183901061066857805485555b506106a4929150610552565b5090565b8280016001018555821561065857600052602060002091601f016020900482015b82811115610658578254825591600101919060010190610689565b505060038281018054918301805460f860020a60ff948516810281900460ff199092169190911780835592546101009081900490941681020490920261ff0019909116179055600491820154910155600182015460408051600160a060020a03331681526020810187905280820192909252517f32c94573316078c697563d687b7649946914fd68c26bf5f9aa92c5e867801c989181900360600190a150505050565b600060009054906101000a9004600160a060020a0316600160a060020a03166392089c4684600101600050546000604051602001526040518260e060020a02815260040180828152602001915050602060405180830381600087803b156100025760325a03f1156100025750506040805180516000805460018901546020948501839052855160e360020a62f6630302815260048101919091529451929a50600160a060020a031694506307b31818936024808201949392918390030190829087803b156100025760325a03f1156100025750506040805151600180546000908152600260208181528583208085018e8155815473ffffffffffffffffffffffffffffffffffffffff199081166c0100000000000000000000000033810281900491909117808555426004860155885488529987208054909216600160a060020a03909a1681020498909817885554878601558083018054888501805481885296859020989e50929c508c99509196610100868816158102600019908101909716869004601f90810195909504820197841615029095019091169290920492919083901061090057805485555b5061093c929150610552565b828001600101855582156108f457600052602060002091601f016020900482015b828111156108f4578254825591600101919060010190610921565b505060038281018054838301805460ff191660f860020a60ff938416810281900491909117808355935461ff001990941661010094859004909316810204909202179055600492830154929091019190915533600160a060020a031660009081526020919091526040902080546001810180835582818380158290116109d3576000838152602090206109d3918101908301610552565b5050506000928352506020808320600180549190930155600160a060020a038816835260039052604090912080549182018082559091908281838015829011610a2d57600083815260209020610a2d918101908301610552565b5050506000928352506020808320600180549190930155600160a060020a038716835260039052604090912080549182018082559091908281838015829011610a8757600083815260209020610a87918101908301610552565b505050919090600052602060002090016000506001805491829055818101905560408051918252600019890160208301528051600160a060020a03331693507f674f4969d8487d6f8264447675cc44cdc40f7c3033ccdfc887ad40a24453c60f9281900390910190a2505050505050565b820191906000526020600020905b815481529060010190602001808311610b0657829003601f168201915b5050505060038301549254600160a060020a0316999698509096505060ff8082169561010090920416935091505056",
    "events": {
      "0x674f4969d8487d6f8264447675cc44cdc40f7c3033ccdfc887ad40a24453c60f": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "name": "assignee",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "requestID",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "docID",
            "type": "uint256"
          }
        ],
        "name": "DocumentRequested",
        "type": "event"
      },
      "0xb4c6779ceb4a20f448e76a0e11f39bd183cff9c9dbac53df6bfcc202e2eb32f1": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "sender",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "requestID",
            "type": "uint256"
          }
        ],
        "name": "AccessGranted",
        "type": "event"
      },
      "0x32c94573316078c697563d687b7649946914fd68c26bf5f9aa92c5e867801c98": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "issuer",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "requestID",
            "type": "uint256"
          },
          {
            "indexed": false,
            "name": "docID",
            "type": "uint256"
          }
        ],
        "name": "DocumentAttested",
        "type": "event"
      }
    },
    "updated_at": 1480471723292,
    "links": {},
    "address": "0xbea6fb2d6fa405bdc73309e48ce1fdd12aee0a6d"
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "RequestRegistry";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.RequestRegistry = Contract;
  }
})();
