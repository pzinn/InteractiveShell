import ssh2 = require("ssh2");
import SocketIOFileUpload = require("socketio-file-upload");
const logger = require("./logger");

const completeFileUpload = function (client, sshCredentials) {
  return function (event) {
    const credentials = sshCredentials(client.instance);
    const connection: ssh2.Client = new ssh2.Client();

    connection.on("ready", function () {
      connection.sftp(function (err, sftp) {
        if (err) {
          logger.error("There was an error while connecting via sftp: " + err);
        }
        const stream = sftp.createWriteStream(event.file.name);
        stream.write(client.fileUploadBuffer);
        stream.end(function () {
          connection.end();
        });
        client.fileUploadBuffer = "";
      });
    });

    connection.connect(credentials);
  };
};

module.exports = function (logExceptOnTest, sshCredentials) {
  return {
    attachUploadListenerToSocket(client, socket) {
      const uploader = new SocketIOFileUpload();
      uploader.listen(socket);

      uploader.on("error", function (event) {
        logger.error("Error in upload " + event);
      });

      uploader.on("start", function (event) {
        client.fileUploadBuffer = "";
        logExceptOnTest("File upload name:" + event.file.name);
        logExceptOnTest("File upload encoding: " + event.file.encoding);
      });

      uploader.on("progress", function (event) {
        client.fileUploadBuffer += event.buffer;
      });

      uploader.on("complete", completeFileUpload(client, sshCredentials));
    },
  };
};
