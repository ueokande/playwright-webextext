import fs from "fs/promises";
import path from "path";

type FirefoxExtensionPreference = {
  [addonId: string]: {
    permissions: string[];
    origins: string[];
  };
};

export class FirefoxExtensionPreferencesBuilder {
  private readonly obj: FirefoxExtensionPreference;

  static from(obj: unknown): FirefoxExtensionPreferencesBuilder {
    if (obj === null) {
      throw new TypeError("null is not a valid object");
    }
    if (typeof obj !== "object") {
      throw new TypeError(`${typeof obj} is not a valid object`);
    }
    for (const [key, value] of Object.entries(obj)) {
      if (typeof key !== "string") {
        throw new TypeError(`${typeof key} is not a valid key`);
      }
      if (typeof value !== "object") {
        throw new TypeError(`${typeof value} is not a valid value`);
      }
      if (
        typeof value.permissions !== "undefined" &&
        !Array.isArray(value.permissions)
      ) {
        throw new TypeError(
          `${typeof value.permissions} is not a valid permissions`,
        );
      }
      if (
        typeof value.permissions !== "undefined" &&
        !Array.isArray(value.origins)
      ) {
        throw new TypeError(`${typeof value.origins} is not a valid origins`);
      }
      value.permissions.forEach((permission: unknown) => {
        if (typeof permission !== "string") {
          throw new TypeError(
            `permission '${typeof permission}' is not a valid permission`,
          );
        }
      });
      value.origins.forEach((origin: unknown) => {
        if (typeof origin !== "string") {
          throw new TypeError(
            `origin '${typeof origin}' is not a valid origin`,
          );
        }
      });
    }
    return new FirefoxExtensionPreferencesBuilder(
      obj as FirefoxExtensionPreference,
    );
  }

  static new(): FirefoxExtensionPreferencesBuilder {
    return new FirefoxExtensionPreferencesBuilder({});
  }

  private constructor(obj: FirefoxExtensionPreference) {
    this.obj = obj;
  }

  addPermissions(addonId: string, permissions: string[]): this {
    if (typeof this.obj[addonId] === "undefined") {
      this.obj[addonId] = { permissions: [], origins: [] };
    }
    this.obj[addonId].permissions = Array.from(
      new Set(this.obj[addonId].permissions.concat(permissions)),
    );
    return this;
  }

  addOrigins(addonId: string, origins: string[]): this {
    if (typeof this.obj[addonId] === "undefined") {
      this.obj[addonId] = { permissions: [], origins: [] };
    }
    this.obj[addonId].origins = Array.from(
      new Set(this.obj[addonId].origins.concat(origins)),
    );
    return this;
  }

  build(): FirefoxExtensionPreference {
    return this.obj;
  }
}

type BuilderFn = (builder: FirefoxExtensionPreferencesBuilder) => void;

export class FirefoxExtensionPreferenceRepository {
  private readonly userDataDir: string;

  private readonly jsonPath: string;

  constructor(userDataDir: string) {
    this.userDataDir = userDataDir;
    this.jsonPath = path.join(this.userDataDir, "extension-preferences.json");
  }

  async patch(fn: BuilderFn): Promise<void> {
    const content = await (async () => {
      try {
        return await fs.readFile(this.jsonPath, { encoding: "utf-8" });
      } catch (e: any) {
        if (typeof e === "object" && e.code === "ENOENT") {
          return "{}";
        }
        throw e;
      }
    })();
    const obj = JSON.parse(content);
    const builder = FirefoxExtensionPreferencesBuilder.from(obj);
    fn(builder);
    await fs.mkdir(this.userDataDir, { recursive: true });
    await fs.writeFile(this.jsonPath, JSON.stringify(builder.build()));
  }
}
