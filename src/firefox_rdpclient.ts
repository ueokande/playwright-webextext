// This is TypeScript version of the following
// https://github.com/mozilla/web-ext/blob/master/src/firefox/rdp-client.js

import * as net from "node:net";
import { EventEmitter } from "events";
import * as domain from "domain";
import type {
  RDPRequestType,
  RDPRequest,
  RDPRequestMap,
  RDPResponseMap,
} from "./firefox_types";

type RDPMessage = {
  from: string;
  type: string;
  error: Error;
};

export type Deferred = {
  resolve: (value: any) => void;
  reject: (err: unknown) => void;
};

type ParseResult = {
  data: Buffer;
  rdpMessage?: RDPMessage;
  error?: Error;
  fatal?: boolean;
};

export const DEFAULT_PORT = 6000;
export const DEFAULT_HOST = "127.0.0.1";

const UNSOLICITED_EVENTS = new Set([
  "tabNavigated",
  "styleApplied",
  "propertyChange",
  "networkEventUpdate",
  "networkEvent",
  "propertyChange",
  "newMutations",
  "frameUpdate",
  "tabListChanged",
]);

// Parse RDP packets: BYTE_LENGTH + ':' + DATA.
export function parseRDPMessage(data: Buffer): ParseResult {
  const str = data.toString();
  const sepIdx = str.indexOf(":");
  if (sepIdx < 1) {
    return { data };
  }

  const byteLen = parseInt(str.slice(0, sepIdx));
  if (isNaN(byteLen)) {
    const error = new Error("Error parsing RDP message length");
    return { data, error, fatal: true };
  }

  if (data.length - (sepIdx + 1) < byteLen) {
    // Can't parse yet, will retry once more data has been received.
    return { data };
  }

  data = data.slice(sepIdx + 1);
  const msg = data.slice(0, byteLen);
  data = data.slice(byteLen);

  try {
    return { data, rdpMessage: JSON.parse(msg.toString()) };
  } catch (error) {
    return { data, error: error as Error, fatal: false };
  }
}

export function connectToFirefox(port: number): Promise<FirefoxRDPClient> {
  const client = new FirefoxRDPClient();
  return client.connect(port).then(() => client);
}

export default class FirefoxRDPClient extends EventEmitter {
  private incoming: Buffer = Buffer.alloc(0);
  private pending: Array<{ request: RDPRequest; deferred: Deferred }> = [];
  private active: Map<string, Deferred> = new Map();
  private rdpConnection?: net.Socket;

  private readonly _onData = (data: Buffer) => this.onData(data);
  private readonly _onError = (err: Error) => this.onError(err);
  private readonly _onEnd = () => this.onEnd();
  private readonly _onTimeout = () => this.onTimeout();

  connect(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create a domain to wrap the errors that may be triggered
      // by creating the client connection (e.g. ECONNREFUSED)
      // so that we can reject the promise returned instead of
      // exiting the entire process.
      const d = domain.create();
      d.once("error", reject);
      d.run(() => {
        const conn = net.createConnection({
          port,
          host: DEFAULT_HOST,
        });

        this.rdpConnection = conn;
        conn.on("data", this._onData);
        conn.on("error", this._onError);
        conn.on("end", this._onEnd);
        conn.on("timeout", this._onTimeout);

        // Resolve once the expected initial root message
        // has been received.
        this.expectReply("root", { resolve, reject });
      });
    });
  }

  disconnect(): void {
    if (!this.rdpConnection) {
      return;
    }

    const conn = this.rdpConnection;
    conn.off("data", this._onData);
    conn.off("error", this._onError);
    conn.off("end", this._onEnd);
    conn.off("timeout", this._onTimeout);
    conn.end();

    this.rejectAllRequests(new Error("RDP connection closed"));
  }

  private rejectAllRequests(error: Error) {
    for (const activeDeferred of Array.from(this.active.values())) {
      activeDeferred.reject(error);
    }
    this.active.clear();

    for (const { deferred } of this.pending) {
      deferred.reject(error);
    }
    this.pending = [];
  }

  async request<K extends RDPRequestType>(
    requestProps: K | RDPRequestMap[K],
  ): Promise<RDPResponseMap[K]> {
    let request: RDPRequest;

    if (typeof requestProps === "string") {
      request = { to: "root", type: requestProps };
    } else {
      request = requestProps;
    }

    if (request.to == null) {
      throw new Error(
        `Unexpected RDP request without target actor: ${request.type}`,
      );
    }

    return new Promise((resolve, reject) => {
      const deferred = { resolve, reject };
      this.pending.push({ request, deferred });
      this.flushPendingRequests();
    });
  }

  private flushPendingRequests(): void {
    this.pending = this.pending.filter(({ request, deferred }) => {
      if (this.active.has(request.to)) {
        // Keep in the pending requests until there are no requests
        // active on the target RDP actor.
        return true;
      }

      const conn = this.rdpConnection;
      if (!conn) {
        throw new Error("RDP connection closed");
      }

      try {
        let str = JSON.stringify(request);
        str = `${Buffer.from(str).length}:${str}`;
        conn.write(str);
        this.expectReply(request.to, deferred);
      } catch (err) {
        deferred.reject(err);
      }

      // Remove the pending request from the queue.
      return false;
    });
  }

  private expectReply(targetActor: string, deferred: Deferred): void {
    if (this.active.has(targetActor)) {
      throw new Error(`${targetActor} does already have an active request`);
    }

    this.active.set(targetActor, deferred);
  }

  private handleMessage(rdpData: RDPMessage): void {
    if (rdpData.from == null) {
      if (rdpData.error) {
        this.emit("rdp-error", rdpData);
        return;
      }

      this.emit(
        "error",
        new Error(
          `Received an RDP message without a sender actor: ${JSON.stringify(
            rdpData,
          )}`,
        ),
      );
      return;
    }

    if (UNSOLICITED_EVENTS.has(rdpData.type)) {
      this.emit("unsolicited-event", rdpData);
      return;
    }

    if (this.active.has(rdpData.from)) {
      const deferred = this.active.get(rdpData.from);
      this.active.delete(rdpData.from);
      if (rdpData.error) {
        deferred?.reject(rdpData);
      } else {
        deferred?.resolve(rdpData);
      }
      this.flushPendingRequests();
      return;
    }

    this.emit(
      "error",
      new Error(`Unexpected RDP message received: ${JSON.stringify(rdpData)}`),
    );
  }

  private readMessage(): boolean {
    const { data, rdpMessage, error, fatal } = parseRDPMessage(this.incoming);

    this.incoming = data;

    if (error) {
      this.emit(
        "error",
        new Error(`Error parsing RDP packet: ${String(error)}`),
      );
      // Disconnect automatically on a fatal error.
      if (fatal) {
        this.disconnect();
      }
      // Caller can parse the next message if the error wasn't fatal
      // (e.g. the RDP packet that couldn't be parsed has been already
      // removed from the incoming data buffer).
      return !fatal;
    }

    if (!rdpMessage) {
      // Caller will need to wait more data to parse the next message.
      return false;
    }

    this.handleMessage(rdpMessage);
    // Caller can try to parse the next message from the remining data.
    return true;
  }

  onData(data: Buffer) {
    this.incoming = Buffer.concat([this.incoming, data]);
    while (this.readMessage()) {
      // Keep parsing and handling messages until readMessage
      // returns false.
    }
  }

  onError(error: Error) {
    this.emit("error", error);
  }

  onEnd() {
    this.emit("end");
  }

  onTimeout() {
    this.emit("timeout");
  }
}
