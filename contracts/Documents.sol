pragma solidity ^0.4.4;
contract Documents {

  struct Document {
    bool added;
    bytes issuerHash;
    bytes assigneeHash;
    address assignee;
    address issuer;
    bool verified;
    bool revoked;
    uint id;
  }

  uint public docID = 1;
  mapping (bytes32 => Document) documents;
  mapping (address => uint[]) documentsIssuedTo;
  mapping (uint => bytes32) docIdHash;

  event DocumentAdded(address indexed assignee, bytes32 docHash, bytes issuerHash, bytes assigneeHash,uint docID);

  function addDocument (bytes32 docHash, bytes issuerHash, bytes assigneeHash, address assignee) {
    if(documents[docHash].added == true) return;
    Document doc = documents[docHash];
    doc.issuerHash = issuerHash;
    doc.assigneeHash = assigneeHash;
    doc.revoked = false;
    doc.verified = false;
    doc.assignee = assignee;
    doc.issuer = msg.sender;
    doc.added = true;
    doc.id = docID;
    documents[docHash] = doc;
    docIdHash[docID] = docHash;
    documentsIssuedTo[assignee].push(docID);
    docID = docID + 1;
    DocumentAdded(assignee, docHash, issuerHash, assigneeHash, doc.id);
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


  function getDocumentByHash(bytes32 docHash) constant returns(address issuer, address assignee, bytes issuerHash, bytes assigneeHash ,uint _id) {
    Document doc = documents[docHash];
    issuer  = doc.issuer;
    assignee = doc.assignee;
    issuerHash = doc.issuerHash;
    assigneeHash = doc.assigneeHash;
    _id = doc.id;
  }

  function getDocumentById(uint docID) constant constant returns(address issuer, address assignee, bytes issuerHash, bytes assigneeHash ,uint _id) {
      bytes32 docHash = docIdHash[docID];
      return getDocumentByHash(docHash);
  }

}
