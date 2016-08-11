struct University {
  string name,
  bool verified
}
uint university_id = 0;
mapping (address => bool) universityMap ;
mapping (uint => University) university ;

function addUniversity(_name) {
  if(universityMap[msg.sender] == true) {
    return;
  }
  else {
    uint uid = ++university_id;
    University univ = university[uid];
    univ.name = _name;
    univ.verified = false;
  }
}
