contract CertificateVerification {
  struct University {
    bool added;
    string name;
    bool verified;
  }

  struct Certificate {
    bool added;
    bytes ipfsHash;
    mapping(uint => uint) owners;
    Signature signature;
    address issuer;
  }
  struct Signature {
    uint8 v;
    bytes32 r;
    bytes32 s;
  }
  modifier onlyUniversity {
      if (universities[uint(msg.sender)].verified == true)
          _
  }


  mapping (uint => University) universities;
  mapping (bytes => Certificate) certificates;

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

  function addCertificate (bytes ipfsHash, address assignee, bytes32 r, bytes32 s, uint8 v) onlyUniversity {
    if(certificates[ipfsHash].added == true) return;
    Certificate cert = certificates[ipfsHash];
    cert.ipfsHash = ipfsHash;
    cert.owners[uint(msg.sender)] = 2;
    cert.owners[uint(assignee)] = 1;
    cert.issuer = msg.sender;
    cert.added = true;
    cert.signature = Signature({r : r, s : s, v : v});
    certificates[ipfsHash] = cert;
  }

  function getUniversity(address univ) public constant returns (string) {
      return universities[uint(univ)].name;
  }

  function addConfirmation(bytes ipfsHash) {
    if(certificates[ipfsHash].added == false) return;
    Certificate c = certificates[ipfsHash];
    if(c.owners[uint(msg.sender)] == 0) return;
    c.owners[uint(msg.sender)] = 2;
  }

  function revoke(bytes ipfsHash) onlyUniversity {
    if(certificates[ipfsHash].added == false) throw;
    Certificate cert = certificates[ipfsHash];
    if(cert.owners[uint(msg.sender)] != 2) throw;
    cert.owners[uint(msg.sender)] = 1;
  }

  function verifySignature(bytes ipfsHash, address issuer, Signature signature) internal returns (bool) {
    bytes32 h = sha3(ipfsHash);
    return ecrecover(h, signature.v, signature.r,signature.s) == issuer;
  }

  function isCertificateValid(bytes ipfsHash, address assignee) public constant returns (bool) {
    if(certificates[ipfsHash].added == false) return false;
    Certificate cert = certificates[ipfsHash];
    return (
      cert.owners[uint(assignee)] == 2 &&
      cert.owners[uint(cert.issuer)] == 2 &&
      verifySignature(ipfsHash,cert.issuer, cert.signature)
    );
  }
}
