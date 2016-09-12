# DiplomaVerification

There are 3 main entities

* University (issuer)
* Student
* Contract to store the certificate/diploma

For each diploma, we create a **digital signature** and upload the diploma to IPFS. The student and the university have to sign do a multisign to make the certificate valid. The certificate verification can be done using ecrecover.
