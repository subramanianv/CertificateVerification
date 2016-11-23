module.exports = function(deployer) {
    deployer.deploy(Documents).then(function() {
        return deployer.deploy(RequestRegistry, Documents.address);
    });
};
