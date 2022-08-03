export type FirefoxRDPAddonActor = {
  id: string;
  actor: string;
};

export type RDPRequestType =
  | "getRoot"
  | "requestTypes"
  | "installTemporaryAddon"
  | "listAddons"
  | "listTabs"
  | "reload";

export interface RDPRequest {
  to: string;
  type: string;
}

type GetRootRequest = RDPRequest;

type RequestTypesRequest = RDPRequest;

interface InstallTemporaryAddonRequest extends RDPRequest {
  addonPath: string;
}

interface ListAddonsRequest extends RDPRequest {
  type: "listAddons";
}

interface ListTabsRequest extends RDPRequest {
  type: "listTabs";
}

interface ReloadRequest extends RDPRequest {
  type: "reload";
}

export interface RDPRequestMap {
  getRoot: GetRootRequest;
  requestTypes: RequestTypesRequest;
  installTemporaryAddon: InstallTemporaryAddonRequest;
  listAddons: ListAddonsRequest;
  listTabs: ListTabsRequest;
  reload: ReloadRequest;
}

export interface RDPResponse {
  from: string;
  type: string;
  addonsActor: string | null;
}

export type GetRootResponse = RDPResponse;

export interface RequestTypesResponse extends RDPResponse {
  requestTypes: string[];
}

export interface InstallTemporaryAddonResponse extends RDPResponse {
  addon: FirefoxRDPAddonActor;
}

export interface ListAddonsResponse extends RDPResponse {
  addons: FirefoxRDPAddonActor[];
}

export type ListTabsResponse = RDPResponse;

export type ReloadResponse = RDPResponse;

export interface RDPResponseMap {
  getRoot: GetRootResponse;
  requestTypes: RequestTypesResponse;
  installTemporaryAddon: InstallTemporaryAddonResponse;
  listAddons: ListAddonsResponse;
  listTabs: ListTabsResponse;
  reload: ReloadResponse;
}
