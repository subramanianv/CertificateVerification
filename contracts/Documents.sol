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
  mapping (bytes32 => Document) documents;
  mapping (address => uint[]) documentsIssuedTo;
  mapping (uint => bytes32) docIdHash;

  event DocumentAdded(address indexed assignee, bytes32 docHash, bytes ipfsHash, uint docID);

  function addDocument (bytes32 docHash, bytes ipfsHash, address assignee) {
    if(documents[docHash].added == true) return;
    Document doc = documents[docHash];
    doc.ipfsHash = ipfsHash;
    doc.assignee = assignee;
    doc.issuer = msg.sender;
    doc.added = true;
    doc.id = docID;
    documents[docHash] = doc;
    docIdHash[docID] = docHash;
    documentsIssuedTo[assignee].push(docID);
    docID = docID + 1;
    DocumentAdded(assignee, docHash, ipfsHash, doc.id);
  }

  function getDocumentsIssuedTo(address assignee) constant returns(uint[]) {
      return documentsIssuedTo[assignee];
  }

  function getDocumentByHash(bytes32 docHash) constant returns(address issuer, address assignee, bytes _ipfsHash, uint _id) {
      Document doc = documents[docHash];
      issuer  = doc.issuer;
      assignee = doc.assignee;
      _ipfsHash = doc.ipfsHash;
      _id = doc.id;
  }

  function getDocumentById(uint docID) constant constant returns(address issuer, address assignee, bytes _ipfsHash, uint _id) {
      bytes32 docHash = docIdHash[docID];
      return getDocumentByHash(docHash);
  }

}
