contract CertificateVerification {
  struct Organization {
    bool added;
    string name;
    bool verified;
  }

  struct Certificate {
    bool added;
    bytes ipfsHash;
    mapping(address => uint) owners;
    Signature signature;
    address assignee;
    address issuer;
  }
  struct Signature {
    uint8 v;
    bytes32 r;
    bytes32 s;
  }
  modifier onlyOrganization {
      if (organizations[msg.sender].verified == true)
          _
  }
  uint _certCount = 0;
  event CertificateAdded(address indexed issuer, bytes ipfsHash, address assignee);
  event CertificateConfirmed(address confirmer, bytes ipfsHash);
  event Log(address from, string _s);
  mapping (address => Organization) organizations;
  mapping (bytes => Certificate) certificates;

  function addOrganization (string _name) {
    if(organizations[msg.sender].added) {
      return;
    } else {
      Organization org = organizations[msg.sender];
      org.name = _name;
      org.verified = true;
      org.added = true;
      organizations[msg.sender] = org;
    }
  }

  function addCertificate (bytes ipfsHash, address assignee, address issuer, bytes32 r, bytes32 s, uint8 v) {
    if(certificates[ipfsHash].added == true) return;
    Certificate cert = certificates[ipfsHash];
    cert.ipfsHash = ipfsHash;
    cert.assignee = assignee;
    cert.issuer = issuer;
    cert.owners[cert.issuer] = 2;
    cert.owners[assignee] = 1;
    cert.added = true;
    cert.signature = Signature({r : r, s : s, v : v});
    certificates[ipfsHash] = cert;
    _certCount = _certCount + 1;
    CertificateAdded(msg.sender, ipfsHash, assignee);


  }
  function getCount() public constant returns (uint) {
    return _certCount;
  }

  function addConfirmation(bytes ipfsHash) {
    if(certificates[ipfsHash].added == false) return;
    Certificate c = certificates[ipfsHash];
    if(c.owners[msg.sender] == 0 || c.issuer == msg.sender) return;
    c.owners[msg.sender] = 2;
    CertificateConfirmed(msg.sender, ipfsHash);
  }

  function revoke(bytes ipfsHash) onlyOrganization {
    if(certificates[ipfsHash].added == false) throw;
    Certificate cert = certificates[ipfsHash];
    if(cert.owners[msg.sender] != 2) throw;
    cert.owners[msg.sender] = 1;
  }

  function getIssuerFromSig(bytes32 ipfsSha3, address issuer, Signature sig) constant internal returns (address) {
    return ecrecover(ipfsSha3, sig.v, sig.r, sig.s);
  }

  function isCertificateValid(bytes ipfsHash, address assignee) public constant returns (bool) {
    if(certificates[ipfsHash].added == false) return false;
    Certificate cert = certificates[ipfsHash];
    return (
      cert.owners[assignee] == 2 &&
      cert.owners[cert.issuer] == 2 &&
      getIssuerFromSig(sha3(ipfsHash),cert.issuer, cert.signature) == cert.issuer
    );

  }
}
