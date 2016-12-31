pragma solidity ^0.4.4;
contract Documents {

  struct Document {
    bool added;
    bytes assigneeHash;
    address assignee;
    address issuer;
    bool verified;
    bool revoked;
    uint id;
    string name;
    uint timestamp;
  }

  uint public docID = 1;
  mapping (bytes32 => Document) public documents;
  mapping (address => uint[]) documentsIssuedTo;
  mapping (uint => bytes32) public docIdHash;

  event DocumentAdded(address indexed assignee, bytes32 docHash, bytes assigneeHash,uint docID);

  function addDocument (bytes32 docHash, bytes assigneeHash, address assignee, string docName) {
    if(documents[docHash].added == true) throw;
    Document doc = documents[docHash];
    doc.assigneeHash = assigneeHash;
    doc.revoked = false;
    doc.verified = false;
    doc.assignee = assignee;
    doc.issuer = msg.sender;
    doc.added = true;
    doc.name = docName;
    doc.id = docID;
    doc.timestamp = now;
    documents[docHash] = doc;
    docIdHash[docID] = docHash;
    documentsIssuedTo[assignee].push(docID);
    docID = docID + 1;
    DocumentAdded(assignee, docHash, assigneeHash, doc.id);
  }

  function verifyDocument(uint docID) {
      Document doc = documents[docIdHash[docID]];
      if(doc.added == false || doc.assignee != msg.sender || doc.revoked == true || doc.verified == true) throw;
      doc.verified = true;
  }

  function revokeDocument(uint docID) {
      Document doc = documents[docIdHash[docID]];
      if(doc.added == false || doc.issuer != msg.sender || doc.revoked == true || doc.verified == false) throw;
      doc.revoked = true;
  }

  function getDocumentsIssuedTo(address assignee) constant returns(uint[]) {
      return documentsIssuedTo[assignee];
  }

  function getDocumentHash(uint docID) constant public returns(bytes32 docHash) {
      return docIdHash[docID];
  }

  function getDocumentByHash(bytes32 docHash) constant public returns(address issuer, address assignee , bytes assigneeHash, uint _id, uint timestamp, string name) {
    Document doc = documents[docHash];
    issuer  = doc.issuer;
    assignee = doc.assignee;
    assigneeHash = doc.assigneeHash;
    _id = doc.id;
    timestamp = doc.timestamp;
    name = doc.name;
  }

  function getDocumentById(uint docID) constant public returns(address issuer, address assignee, bytes assigneeHash ,uint _id, uint timestamp, string name) {
      bytes32 docHash = docIdHash[docID];
      return getDocumentByHash(docHash);
  }

  function getIssuer(uint docID) constant public returns(address) {
      Document doc = documents[docIdHash[docID]];
      address issuer = doc.issuer;
      return issuer;
  }

  function getAssignee(uint docID) constant public returns(address) {
      Document doc = documents[docIdHash[docID]];
      return doc.assignee;
  }

}
