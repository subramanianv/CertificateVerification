pragma solidity ^0.4.4;
import "Documents.sol";
contract RequestRegistry {
  Documents documentRegistry;

  struct Request {
    address requester;
    uint docID;
    bytes ipfsHash;
    bool granted;
    bool completed;
  }

  mapping (uint => Request) accessRegistry;

  function requestForAccess (uint docID) {
    Request r = accessRegistry[requestID];
    r.docID = docID;
    r.requester = msg.sender;
    accessRegistry[requestID] = r;
    requestID = requestID + 1;
  }

  function grantAccess(uint requestID) {
      Request r = accessRegistry[requestID];
      address assignee = documentRegistry.getAssignee(r.docID);
      if(assignee != msg.sender) {
          throw;
      }
      accessRegistry[requestID].granted = true;
  }

  function RequestRegistry(address docRegistryAddress) {
      documentRegistry = Documents(docRegistryAddress);
  }

  function attest(uint requestID, bytes ipfsHash) {
      Request r = accessRegistry[requestID];
      if(accessRegistry[requestID].granted == false) {
          throw;
      }

      address issuer = documentRegistry.getIssuer(r.docID);
      if(issuer != msg.sender) {
          throw;
      }
      r.ipfsHash = ipfsHash;
      r.completed = true;
      accessRegistry[requestID] = r;
  }

  uint public requestID = 1;

}
