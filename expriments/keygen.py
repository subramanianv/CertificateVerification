from Crypto.Hash import SHA256
from Crypto.PublicKey import RSA
from Crypto import Random

random_generator = Random.new().read
key = RSA.generate(2048, random_generator)
public_key = key.publickey().exportKey("PEM")
private_key = key.exportKey("PEM")

print public_key
print private_key
