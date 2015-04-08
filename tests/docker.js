var assert = require("assert");
var spawn = require('child_process').spawn;


describe('Start docker container', function () {
    it('should show M2 preamble', function (done) {
        // ssh localhost

        var docker = "docker";
        var process = spawn(docker, ["run", "fhinkel/macaulay2", "M2"]);
        var encoding = "utf8";
        process.stderr.setEncoding(encoding);
        var result = "";
        process.stderr.on('data', function (data) {
            console.log("Preamble: " + data);
            result += data;
        });
        process.on('error', function (error) {
            assert(false, error);
            next();
        });
        process.on('close', function() {
            assert(result.match(/Macaulay2, version 1\.\d/),
                'M2 preamble does not match');
            done();
        });

    });
});



