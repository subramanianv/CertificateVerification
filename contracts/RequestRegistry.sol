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
    uint requestTime;
  }
  uint public requestID = 1;
  mapping (uint => Request) accessRegistry;
  mapping (address => uint[]) requests;

  modifier onlyValidDocument(uint docID) {
    address assignee = documentRegistry.getAssignee(docID);
    if(assignee == address(0x0)) {
        throw;
    }
    _;
  }

  function requestForAccess (uint docID) onlyValidDocument(docID) {
    address assignee = documentRegistry.getAssignee(r.docID);
    address issuer = documentRegistry.getAssignee(r.docID);
    Request r = accessRegistry[requestID];
    r.docID = docID;
    r.requester = msg.sender;
    r.requestTime = now;
    accessRegistry[requestID] = r;

    requests[msg.sender].push(requestID);
    requests[assignee].push(requestID);
    requests[issuer].push(requestID);
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

  function getRequests(address _for) constant returns(uint[]) {
      return requests[_for];
  }

  function getRequest(uint requestID) constant public returns(address requester, uint docID ,bytes docIPFSHash, bool granted, bool completed) {
      Request req = accessRegistry[requestID];
      docID  = req.docID;
      docIPFSHash = req.ipfsHash;
      granted = req.granted;
      completed = req.completed;
  }
}
