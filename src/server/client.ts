import { Instance } from "./instance";
import ssh2 = require("ssh2");

export class Client {
  public saneState: boolean;
  public instance: Instance;
  public sockets: SocketIO.Socket[];
  public savedOutput: string; // previous output
  public outputRate: number; // an idea of output rate, to prevent flooding
  public channel: ssh2.ClientChannel;
  public id: string;
  constructor(newId: string) {
    this.saneState = true;
    this.sockets = [];
    this.savedOutput = "";
    this.outputRate = 0;
    this.id = newId;
  }
}

interface IClients {
  [clientId: string]: Client;
}
export { IClients };
