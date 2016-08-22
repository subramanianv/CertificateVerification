contract certVeri {
  struct University {
    bool added;
    string name;
    bool verified;
  }

  struct Certificate {
    bool added;
    string ipfsHash;
    mapping(uint => uint) owners;
  }

    modifier onlyUniversity {
        if (universities[uint(msg.sender)].verified == true)
            _
    }


  mapping (uint => University) universities;
  mapping (string => Certificate) certificates;

  function addUniversity (string _name) {
    if(universities[uint(msg.sender)].added) {
      return;
    } else {
      University univ = universities[uint(msg.sender)];
      univ.name = _name;
      univ.verified = true;
      univ.added = true;
      universities[uint(msg.sender)] = univ;
    }
  }

  function addCertificate (string ipfsHash, address assignee) onlyUniversity {
    if(certificates[ipfsHash].added == true) return;
    Certificate cert = certificates[ipfsHash];
    cert.ipfsHash = ipfsHash;
    cert.owners[uint(msg.sender)] = 2;
    cert.owners[uint(assignee)] = 1;
    certificates[ipfsHash] = cert;
  }

  function addConfirmation(string ipfsHash) {
    if(certificates[ipfsHash].added == false) return;
    Certificate c = certificates[ipfsHash];
    if(c.owners[uint(msg.sender)] == 0) return;
    c.owners[uint(msg.sender)] = 2;
  }

  function isCertificateValid(string ipfsHash, address owner) constant returns (bool) {
    if(certificates[ipfsHash].added == false) return false;
    Certificate cert = certificates[ipfsHash];
    if(cert.owners[uint(owner)] == 2)
      return true;
     else{
       return false;
     }
  }
}
