const ssh2 = require("ssh2");
import fs = require("fs");
import { Client } from "./client";
import path = require("path");
import { logger, logClient } from "./logger";
import { staticFolder, unlink, options } from "./server";

const userSpecificPath = function (client: Client): string {
  return client.id + "-files/";
};

const downloadFromDocker = function (
  client: Client,
  sourceFileName: string,
  sshCredentials,
  next
) {
  const fileName: string = path.basename(sourceFileName);
  if (!fileName || !client.instance || !client.instance.host) return;
  const sshConnection = ssh2();
  sshConnection.on("end", function () {
    logger.info("File action ended."); // ???
  });

  const userPath = userSpecificPath(client);
  const targetPath = staticFolder + userPath;
  const targetFileName = targetPath + fileName;

  logClient(client, "File download request: " + sourceFileName);

  const success = function () {
    logClient(client, "Successfully downloaded " + sourceFileName);
    setTimeout(unlink(targetFileName), 1000 * 60 * 10);
    next(userPath + fileName);
  };

  fs.mkdir(targetPath, function (fsError) {
    if (fsError) {
      if (fsError.code !== "EEXIST")
        logger.error("Error creating directory: " + targetPath);
    }
    sshConnection.on("ready", function () {
      sshConnection.sftp(function (generateError, sftp) {
        if (generateError) {
          logger.error("ssh2.sftp() failed: " + generateError);
          return next();
        }
        sftp.fastGet(sourceFileName, targetFileName, function (sftpError) {
          if (!sftpError) success();
          else {
            // annoying subtlety: we don't know if path relative or absolute => try both :/
            if (sourceFileName.startsWith("/")) {
              sourceFileName =
                options.serverConfig.baseDirectory +
                sourceFileName.substring(1);
              sftp.fastGet(
                sourceFileName,
                targetFileName,
                function (sftpError) {
                  if (!sftpError) success();
                  else next();
                }
              );
            } else next();
          }
        });
      });
    });
    sshConnection.connect(sshCredentials(client.instance));
  });
};

export { downloadFromDocker };
