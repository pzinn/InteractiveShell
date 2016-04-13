GLOBAL.OPTIONS = require('./default.js').getConfig({
  authentification: "basic",
  serverConfig: {
    port: 8002,
    MATH_PROGRAM_COMMAND: 'export WWWBROWSER=/usr/bin/open; ' +
    'export PATH=/usr/bin:$PATH; M2 --print-width 100',
    CONTAINERS: './sudoDockerContainers.js'
  }
});

console.log(GLOBAL.OPTIONS);

var Macaulay2Server = require('./index.js').MathServer();
Macaulay2Server.listen();
