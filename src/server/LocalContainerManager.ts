import { Instance } from "./instance";
import { InstanceManager } from "./instanceManager";

import childProcess = require("child_process");
const exec = childProcess.exec;

class LocalContainerManager implements InstanceManager {
  private options: any;

  constructor() {
    const options = {
      credentials: {
        host: "127.0.0.1",
        port: 22,
        username: undefined,
        sshKey: undefined,
      },
    };
    exec("whoami", function (error, username) {
      options.credentials.username = username.trim();
    });

    exec("echo $HOME", function (error, homedir) {
      options.credentials.sshKey = homedir.trim() + "/.ssh/id_rsa";
    });

    this.options = options;
  }

  public getNewInstance = function (userId: string, next: any) {
    next(false, this.options.credentials);
  };

  public updateLastActiveTime(instance: Instance) {
    //
  }

  public recoverInstances(next) {
    // not implemented yet
    next({});
  }
}

export { LocalContainerManager };
