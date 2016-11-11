contract Documents {

  struct Document {
    bool added;
    bytes ipfsHash;
    address assignee;
    address issuer;
  }

  uint docID = 1;
  event DocumentAdded(address indexed issuer, bytes ipfsHash, address assignee);
  event DocumentConfirmed(address confirmer, bytes ipfsHash);
  mapping (ipfsHash => Document) documents;
  mapping (address => uint[]) documentsIssuedTo;

  function addDocument (bytes ipfsHash, address assignee) {
    if(Documents[ipfsHash].added == true) return;
    Document doc = Documents[ipfsHash];
    doc.ipfsHash = ipfsHash;
    doc.assignee = assignee;
    doc.issuer = msg.sender;
    doc.added = true;
    docID = docID + 1;
    documents[docID] = doc;
    documentsIssuedTo[assignee].push(docID);
    DocumentAdded(msg.sender, ipfsHash, assignee);
  }

  function getDocumentsIssuedTo(address assignee) constant returns(uint[]) {
      return documentsIssuedTo[assignee];
  }

}
