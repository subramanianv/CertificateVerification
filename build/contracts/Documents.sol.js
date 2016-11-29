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
      throw new Error("Documents error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("Documents error: contract binary not set. Can't deploy new instance.");
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

      throw new Error("Documents contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of Documents: " + unlinked_libraries);
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
      throw new Error("Invalid address passed to Documents.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: Documents not deployed or address not set.");
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
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "docIdHash",
        "outputs": [
          {
            "name": "",
            "type": "bytes32"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "docID",
            "type": "uint256"
          }
        ],
        "name": "getAssignee",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "docHash",
            "type": "bytes32"
          }
        ],
        "name": "getDocumentByHash",
        "outputs": [
          {
            "name": "issuer",
            "type": "address"
          },
          {
            "name": "assignee",
            "type": "address"
          },
          {
            "name": "issuerHash",
            "type": "bytes"
          },
          {
            "name": "assigneeHash",
            "type": "bytes"
          },
          {
            "name": "_id",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "bytes32"
          }
        ],
        "name": "documents",
        "outputs": [
          {
            "name": "added",
            "type": "bool"
          },
          {
            "name": "issuerHash",
            "type": "bytes"
          },
          {
            "name": "assigneeHash",
            "type": "bytes"
          },
          {
            "name": "assignee",
            "type": "address"
          },
          {
            "name": "issuer",
            "type": "address"
          },
          {
            "name": "verified",
            "type": "bool"
          },
          {
            "name": "revoked",
            "type": "bool"
          },
          {
            "name": "id",
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
            "name": "docID",
            "type": "uint256"
          }
        ],
        "name": "verifyDocument",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "docID",
            "type": "uint256"
          }
        ],
        "name": "getDocumentHash",
        "outputs": [
          {
            "name": "docHash",
            "type": "bytes32"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "assignee",
            "type": "address"
          }
        ],
        "name": "getDocumentsIssuedTo",
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
        "inputs": [
          {
            "name": "docID",
            "type": "uint256"
          }
        ],
        "name": "getIssuer",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "docID",
            "type": "uint256"
          }
        ],
        "name": "getDocumentById",
        "outputs": [
          {
            "name": "issuer",
            "type": "address"
          },
          {
            "name": "assignee",
            "type": "address"
          },
          {
            "name": "issuerHash",
            "type": "bytes"
          },
          {
            "name": "assigneeHash",
            "type": "bytes"
          },
          {
            "name": "_id",
            "type": "uint256"
          }
        ],
        "payable": false,
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "docID",
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
            "name": "docID",
            "type": "uint256"
          }
        ],
        "name": "revokeDocument",
        "outputs": [],
        "payable": false,
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "docHash",
            "type": "bytes32"
          },
          {
            "name": "issuerHash",
            "type": "bytes"
          },
          {
            "name": "assigneeHash",
            "type": "bytes"
          },
          {
            "name": "assignee",
            "type": "address"
          }
        ],
        "name": "addDocument",
        "outputs": [],
        "payable": false,
        "type": "function"
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
            "name": "docHash",
            "type": "bytes32"
          },
          {
            "indexed": false,
            "name": "issuerHash",
            "type": "bytes"
          },
          {
            "indexed": false,
            "name": "assigneeHash",
            "type": "bytes"
          },
          {
            "indexed": false,
            "name": "docID",
            "type": "uint256"
          }
        ],
        "name": "DocumentAdded",
        "type": "event"
      }
    ],
    "unlinked_binary": "0x60606040526001600060005055610e528061001a6000396000f3606060405236156100975760e060020a60003504620507b5811461009c57806307b31818146100b957806307fb5bc2146101055780632b2805db146101155780636dda61d9146101775780638796ec86146101ff578063905c47341461021f57806392089c461461029f578063e0de22dd146102d3578063e4364266146103ac578063fba1842a146103ba578063ffe948241461043e575b610002565b34610002576104ef60043560036020526000908152604090205481565b3461000257600435600090815260036020818152604080842054845260019091529091200154600160a060020a03165b60408051600160a060020a039092168252519081900360200190f35b346100025761050160043561030f565b34610002576105f56004356001602081905260009182526040909120805460038201546004830154600584015460ff9384169585019460020193600160a060020a039384169383169260a060020a810482169260a860020a9091049091169088565b3461000257610734600435600081815260036020908152604080832054835260019091529020805460ff1615806101bf5750600381015433600160a060020a03908116911614155b806101da5750600481015460a860020a900460ff1615156001145b806101f55750600481015460a060020a900460ff1615156001145b1561085757610002565b34610002576104ef6004356000818152600360205260409020545b919050565b346100025761073660043560408051602081810183526000808352600160a060020a0385168152600282528390208054845181840281018401909552808552929392909183018282801561029357602002820191906000526020600020905b8154815260019091019060200180831161027e575b5050505050905061021a565b3461000257600480356000908152600360209081526040808320548352600190915290200154600160a060020a03166100e9565b34610002576105016004356040805160208181018352600080835283518083018552818152858252600390925292832054839291908390610881815b604080516020818101835260008083528351808301855281815285825260018084528583206004810154600382015482840180548a51601f600297831615610100026000190190921696909604908101899004890286018901909a52898552600160a060020a03928316999190921697969495949293928301828280156107f15780601f106107c6576101008083540402835291602001916107f1565b34610002576104ef60005481565b3461000257610734600435600081815260036020908152604080832054835260019091529020805460ff1615806104025750600481015433600160a060020a03908116911614155b8061041d5750600481015460a860020a900460ff1615156001145b806104345750600481015460a060020a900460ff16155b1561089057610002565b346100025760408051602060046024803582810135601f81018590048502860185019096528585526107349583359593946044949392909201918190840183828082843750506040805160209735808a0135601f81018a90048a0283018a0190935282825296989760649791965060249190910194509092508291508401838280828437509496505093359350505050600084815260016020819052604082205460ff1615151415610a0857610a01565b60408051918252519081900360200190f35b6040518086600160a060020a0316815260200185600160a060020a0316815260200180602001806020018481526020018381038352868181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156105895780820380516001836020036101000a031916815260200191505b508381038252858181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156105e25780820380516001836020036101000a031916815260200191505b5097505050505050505060405180910390f35b604080518915158152600160a060020a0380881660608301528616608082015284151560a082015283151560c082015260e08101839052610100602082018181528a54600260001960018316158502019091160491830182905291928301906101208401908b9080156106a95780601f1061067e576101008083540402835291602001916106a9565b820191906000526020600020905b81548152906001019060200180831161068c57829003601f168201915b505083810382528954600260001961010060018416150201909116048082526020909101908a90801561071d5780601f106106f25761010080835404028352916020019161071d565b820191906000526020600020905b81548152906001019060200180831161070057829003601f168201915b50509a505050505050505050505060405180910390f35b005b60405180806020018281038252838181518152602001915080519060200190602002808383829060006004602084601f0104600302600f01f1509050019250505060405180910390f35b820191906000526020600020905b81548152906001019060200180831161078e57829003601f168201915b505050600584015492955091935050505b5091939590929450565b820191906000526020600020905b8154815290600101906020018083116107d457829003601f168201915b50505060028085018054604080516020601f600019610100600187161502019094169590950492830185900485028101850190915281815295995090935091508301828280156107ab5780601f10610780576101008083540402835291602001916107ab565b60048101805474ff0000000000000000000000000000000000000000191660a060020a1790555050565b955095509550955095506107bc565b60048101805475ff000000000000000000000000000000000000000000191660a860020a1790555050565b5050509190906000526020600020900160006000600050549091909150555060006000505460010160006000508190555081600160a060020a03167f522548df57f4a37064bd1ac286242ff2293bc5f4e1ebef794a4fd3817c4e56968686868560050160005054604051808560001916815260200180602001806020018481526020018381038352868181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156109965780820380516001836020036101000a031916815260200191505b508381038252858181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156109ef5780820380516001836020036101000a031916815260200191505b50965050505050505060405180910390a25b5050505050565b5060008481526001602081815260408320865181840180548187529584902092959094601f6002610100928416159290920260001901909216048101849004830193919291890190839010610a8057805160ff19168380011785555b50610ab09291505b80821115610b0b5760008155600101610a6c565b82800160010185558215610a64579182015b82811115610a64578251826000505591602001919060010190610a92565b505082816002016000509080519060200190828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10610b0f57805160ff19168380011785555b50610b3f929150610a6c565b5090565b82800160010185558215610aff579182015b82811115610aff578251826000505591602001919060010190610b21565b505060048101805460038301805473ffffffffffffffffffffffffffffffffffffffff19166c010000000000000000000000008681028190049190911790915575ffffffffffffffffffffffffffffffffffffffffffff1990911633820291909104179055805460ff199081166001908117808455600080546005860155888152602083815260408220805490951660f860020a60ff909416840293909304929092178455828501805485850180548185529385902088979691956002610100878516158102600019908101909816829004601f90810193909304840197948616150290930190931691909104929091839010610c4757805485555b50610c83929150610a6c565b82800160010185558215610c3b57600052602060002091601f016020900482015b82811115610c3b578254825591600101919060010190610c68565b505060028201600050816002016000509080546001816001161561010002031660029004828054600181600116156101000203166002900490600052602060002090601f016020900481019282601f10610ce857805485555b50610d24929150610a6c565b82800160010185558215610cdc57600052602060002091601f016020900482015b82811115610cdc578254825591600101919060010190610d09565b505060038281015482820180546c01000000000000000000000000600160a060020a03938416810281900473ffffffffffffffffffffffffffffffffffffffff19928316179092556004808701805491870180549286168502949094049190921617808355815460f860020a60ff60a060020a928390048116820282900490920274ff00000000000000000000000000000000000000001990931692909217808555925460a860020a908190049091168202919091040275ff0000000000000000000000000000000000000000001990911617905560059384015493909201929092556000805481526020928352604080822089905591851681526002909252902080546001810180835582818380158290116108bb576000838152602090206108bb918101908301610a6c56",
    "events": {
      "0x28128f4335287e0d0848c97704b77e25a494dbcef31a7831714617ec90dbc738": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "name": "issuer",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "ipfsHash",
            "type": "bytes"
          },
          {
            "indexed": false,
            "name": "assignee",
            "type": "address"
          }
        ],
        "name": "DocumentAdded",
        "type": "event"
      },
      "0x89ed780575cff824274fb4ee297619ec46ae8ffb374dc5ecef8b06c935499714": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": false,
            "name": "confirmer",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "ipfsHash",
            "type": "bytes"
          }
        ],
        "name": "DocumentConfirmed",
        "type": "event"
      },
      "0x650c296f7c88056f6a2ef5bb6e5f361a8f23298c35007042c40d637431c8e0d5": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "name": "assignee",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "ipfsHash",
            "type": "bytes"
          },
          {
            "indexed": false,
            "name": "docID",
            "type": "uint256"
          }
        ],
        "name": "DocumentAdded",
        "type": "event"
      },
      "0x385dfa55d941c3dafeb6079a14fd82924bdff3aa5a68477f379a108560a34abc": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "name": "assignee",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "docHash",
            "type": "bytes32"
          },
          {
            "indexed": false,
            "name": "ipfsHash",
            "type": "bytes"
          },
          {
            "indexed": false,
            "name": "docID",
            "type": "uint256"
          }
        ],
        "name": "DocumentAdded",
        "type": "event"
      },
      "0x522548df57f4a37064bd1ac286242ff2293bc5f4e1ebef794a4fd3817c4e5696": {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "name": "assignee",
            "type": "address"
          },
          {
            "indexed": false,
            "name": "docHash",
            "type": "bytes32"
          },
          {
            "indexed": false,
            "name": "issuerHash",
            "type": "bytes"
          },
          {
            "indexed": false,
            "name": "assigneeHash",
            "type": "bytes"
          },
          {
            "indexed": false,
            "name": "docID",
            "type": "uint256"
          }
        ],
        "name": "DocumentAdded",
        "type": "event"
      }
    },
    "updated_at": 1480401454211,
    "links": {},
    "address": "0xfbcb6941cb54dd749d1171920b413e90bb3a9b2e"
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

  Contract.contract_name   = Contract.prototype.contract_name   = "Documents";
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
    window.Documents = Contract;
  }
})();
