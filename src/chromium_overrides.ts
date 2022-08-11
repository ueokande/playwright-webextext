export class ChromiumOverrides {
  private readonly extensionPaths: string[];

  constructor(extPaths: string | string[]) {
    if (typeof extPaths === "string") {
      this.extensionPaths = [extPaths];
    } else {
      this.extensionPaths = extPaths;
    }
  }

  args(args: string[] = []) {
    return [
      ...args,
      `--disable-extensions-except=${this.extensionPaths.join(",")}`,
      `--load-extension=${this.extensionPaths.join(",")}`,
    ];
  }
}
