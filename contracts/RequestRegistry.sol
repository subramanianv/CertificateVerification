pragma solidity ^0.4.4;
import "Documents.sol";
contract RequestRegistry {
  Documents document;
  struct Request {
    address requester;
    uint docID;
    bytes ipfsHash;
    bool granted;
    bool completed;
  }

  mapping (uint => Request) accessRegisty;

  function requestForAccess (uint docID) {
      Request r = accessRegisty[requestID];
      r.docID = docID;
      r.requester = msg.sender;
      accessRegisty[requestID] = r;
      requestID = requestID + 1;
  }

  function grantAccess(uint requestID) {
      accessRegisty[requestID].granted = true;
  }

  function RequestRegistry(address docRegistryAddress) {
      document = Documents(docRegistryAddress);
  }

  function attest(uint requestID, bytes ipfsHash, bytes32 docHash) {
      Request r = accessRegisty[requestID];
      r.ipfsHash = ipfsHash;
      r.completed = true;
      accessRegisty[requestID] = r;
    }

  uint public requestID = 1;

}
