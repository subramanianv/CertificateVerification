# DiplomaVerification

There are 3 main entities

* University (issuer)
* Student
* Contract to store the certificate/diploma

For each diploma, we create a **digital signature**. The digital signature ensures that the diploma has been issued by that university only.

For each diploma, The university creates a key pair (Private and Public key)

The diploma(image/text) is published on IPFS.  
The diploma is hashed and then encrypted with the university's private key  
We have now created a signature  
All the above steps happen outside the blockchain  

On the blockchain, the following are stored for each diploma

The ipfs hash of the diploma.  
The signature derived above  
The public key of the university(stored in ipfs)  

**For verification**  
The diploma is presented by the student for verification  
We pull up the record on the blockchain  
The hash of the diploma is computed  
The signature of the diploma is decrypted using the public key stored in the IPFS(address available in the contract)  

If the hash of the diploma matches the decrypted message, then we can verify that the diploma is valid and has been issued by the university.  

The public,private key can be generated on the browser
