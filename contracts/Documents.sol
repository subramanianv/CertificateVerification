pragma solidity ^0.4.4;
contract Documents {

  struct Document {
    bool added;
    bytes ipfsHash;
    address assignee;
    address issuer;
    uint id;
  }

  uint public docID = 1;
  mapping (bytes => Document) documents;
  mapping (address => uint[]) documentsIssuedTo;
  mapping (uint => bytes) docIdHash;

  event DocumentAdded(address indexed assignee, bytes ipfsHash, uint docID);

  function addDocument (bytes ipfsHash, address assignee) {
    if(documents[ipfsHash].added == true) return;
    Document doc = documents[ipfsHash];
    doc.ipfsHash = ipfsHash;
    doc.assignee = assignee;
    doc.issuer = msg.sender;
    doc.added = true;
    doc.id = docID;
    documents[ipfsHash] = doc;
    docIdHash[docID] = ipfsHash;
    documentsIssuedTo[assignee].push(docID);
    docID = docID + 1;
    DocumentAdded(assignee, ipfsHash, doc.id);
  }

  function getDocumentsIssuedTo(address assignee) constant returns(uint[]) {
      return documentsIssuedTo[assignee];
  }

  function getDocumentByHash(bytes ipfsHash) constant returns(address issuer, address assignee, bytes _ipfsHash, uint _id) {
      Document doc = documents[ipfsHash];
      issuer  = doc.issuer;
      assignee = doc.assignee;
      _ipfsHash = ipfsHash;
      _id = doc.id;
  }

  function getDocumentById(uint docID) constant constant returns(address issuer, address assignee, bytes _ipfsHash, uint _id) {
      bytes ipfsHash = docIdHash[docID];
      return getDocumentByHash(ipfsHash);
  }

}
