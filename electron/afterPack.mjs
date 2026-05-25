import path from "node:path";
import { rcedit } from "rcedit";

export default async function afterPack(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const { appInfo } = context.packager;
  const executablePath = path.join(
    context.appOutDir,
    `${appInfo.productFilename}.exe`,
  );
  const windowsVersion = appInfo.getVersionInWeirdWindowsForm();

  await rcedit(executablePath, {
    "version-string": {
      FileDescription: appInfo.productName,
      ProductName: appInfo.productName,
      CompanyName: appInfo.companyName ?? "Pratik",
      LegalCopyright: appInfo.copyright,
      InternalName: appInfo.productFilename,
      OriginalFilename: `${appInfo.productFilename}.exe`,
    },
    "file-version": windowsVersion,
    "product-version": windowsVersion,
  });
}
