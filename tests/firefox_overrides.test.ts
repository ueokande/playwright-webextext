import { test, expect } from "@playwright/test";
import { FirefoxOverrides } from "../src/firefox_overrides";

test.describe("debuggingServerPortArgs", () => {
  test("should and return specified port number", () => {
    const overrides = new FirefoxOverrides(12345);
    const originalArgs =
      "-childID 10 -start-debugger-server 9999 -profile /tmp/profile".split(
        " ",
      );
    const { args, port } = overrides.debuggingServerPortArgs(originalArgs);

    expect(args).toEqual([
      "-childID",
      "10",
      "-start-debugger-server",
      "9999",
      "-profile",
      "/tmp/profile",
    ]);
    expect(port).toBe(9999);
  });

  test("should adds --start-debugger-server arg", () => {
    const overrides = new FirefoxOverrides(12345);
    const originalArgs = "-childID 10 -profile /tmp/profile".split(" ");

    const { args, port } = overrides.debuggingServerPortArgs(originalArgs);

    expect(args).toEqual([
      "-childID",
      "10",
      "-profile",
      "/tmp/profile",
      "--start-debugger-server",
      "12345",
    ]);
    expect(port).toBe(12345);
  });

  test("should throws an error with invalid port number", () => {
    const overrides = new FirefoxOverrides(12345);
    const originalArgs =
      "-childID 10 -start-debugger-server PORT -profile /tmp/profile".split(
        " ",
      );

    expect(() => overrides.debuggingServerPortArgs(originalArgs)).toThrowError(
      "invalid argument",
    );
  });
});

test.describe("userPrefs", () => {
  test("should adds lack of preferences", () => {
    const overrides = new FirefoxOverrides(12345);
    const prefs1 = overrides.userPrefs({
      "browser.search.region": "AU",
    });
    const prefs2 = overrides.userPrefs({
      "browser.search.region": "AU",
      "devtools.debugger.prompt-connection": false,
    });
    const prefs3 = overrides.userPrefs({
      "browser.search.region": "AU",
      "devtools.debugger.remote-enabled": true,
    });
    const prefs4 = overrides.userPrefs({
      "browser.search.region": "AU",
      "extensions.manifestV3.enabled": true,
    });

    const expected = {
      "browser.search.region": "AU",
      "devtools.debugger.prompt-connection": false,
      "devtools.debugger.remote-enabled": true,
      "extensions.manifestV3.enabled": true,
    };
    expect(prefs1).toEqual(expected);
    expect(prefs2).toEqual(expected);
    expect(prefs3).toEqual(expected);
    expect(prefs4).toEqual(expected);
  });

  test("should throws an error with defied preferences", () => {
    const overrides = new FirefoxOverrides(12345);

    expect(() => {
      overrides.userPrefs({
        "browser.search.region": "AU",
        "devtools.debugger.prompt-connection": true,
      });
    }).toThrowError("devtools.debugger.prompt-connection");
    expect(() => {
      overrides.userPrefs({
        "browser.search.region": "AU",
        "devtools.debugger.prompt-connection": 0,
      });
    }).toThrowError("devtools.debugger.prompt-connection");
    expect(() => {
      overrides.userPrefs({
        "browser.search.region": "AU",
        "devtools.debugger.remote-enabled": false,
      });
    }).toThrowError("devtools.debugger.remote-enabled");
    expect(() => {
      overrides.userPrefs({
        "browser.search.region": "AU",
        "devtools.debugger.remote-enabled": 1,
      });
    }).toThrowError("devtools.debugger.remote-enabled");
    expect(() => {
      overrides.userPrefs({
        "browser.search.region": "AU",
        "extensions.manifestV3.enabled": false,
      });
    }).toThrowError("extensions.manifestV3.enabled");
  });
});
