var $ = require("jquery");
var Web3 = require('./web3');
var web3 = Web3.web3;
var utils =  require('ethereumjs-util');
Web3.setupWeb3Provider();
$(document).ready(function() {
    $("form#data").submit(function(event) {
        //disable the default form submission
        event.preventDefault();
        //grab all form data
        var formData = new FormData($(this)[0]);
        $.ajax({
            url: 'http://localhost:5001/api/v0/add',
            type: 'POST',
            data: formData,
            async: false,
            cache: false,
            contentType: false,
            processData: false,
            success: function(result) {
                var ipfsURL = "http://gateway.ipfs.io/ipfs/" + result.Hash;
                $("#filename").html(result.Name);
                $("#hash").html(result.Hash)
                $('#ipfs_link').html(ipfsURL);
                $('#ipfs_link').attr('href', ipfsURL);
                onSuccess(result);
            }
        });
        return false;
    });
});

function onSuccess(result) {

    web3.eth.sign(web3.eth.accounts[0], web3.sha3(result.Hash), extractSignature);
}

function extractSignature(err, signature) {
  r = utils.toBuffer(signature.slice(0,66))
  s = utils.toBuffer('0x' + signature.slice(66,130))
  v = utils.toBuffer('0x' + signature.slice(130,132));
  console.log(r, s, v);
}
