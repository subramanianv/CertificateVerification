pragma solidity ^0.4.4;
contract EmailRegistry {

  mapping (bytes32 => address) emails;

  function getAddress (bytes32 email) constant returns(address) {
      return emails[email];
  }

  function registerEmailAddress(bytes32 email, address assignee) {
      if(emails[email] != 0x0) {
          throw;
      }
      else {
        emails[email] = assignee;
      }
  }
}
